/**
 * 登录与账号管理。**一个文件里两套实现**，按环境变量选：
 *
 *   - 配了 Supabase → 走 Supabase Auth（真登录，口令由 Supabase 保管）
 *   - 没配 → 走本地演示（口令在浏览器里校验，改 localStorage 就能绕过）
 *
 * 为什么不像数据层那样拆成目录：拆过一次，后台页面就整体不再水合了，
 * 排查到清缓存、去掉远端实现、换最简门面都复现，最后没定位到根因。
 * 这里的取舍是**不动模块路径**——同名文件继续是同名文件，只在内部分支。
 * 代码没那么漂亮，但可用性比对称性重要。
 *
 * ## 两套实现的关键差异
 *
 * **会话恢复是同步还是异步。** 本地版读一次 localStorage 就有结果；
 * Supabase 版要先拿 token 再查 members 行，所以判定完成前 `getSession()`
 * 返回 `undefined`（=还不知道），而不是 `null`（=确定没登录）。
 * 混成一个的话后台会先闪一下登录页再跳回来。页面已经按这三态写好了。
 *
 * **账号从哪来。** Supabase 模式下管理员**不能直接创建账号**（那要 service_role
 * key，不能进前端）。改成：管理员加人 → 写进 `member_invites` 名册 →
 * 本人用该邮箱自助设置口令 → 数据库触发器据名册自动建 members 行。
 * 见 `supabase/migrations/001_member_invites.sql`。
 */
import { ADMIN_DEPARTMENT, type Member, type Session } from '../types';
import { db, explain, isSupabaseConfigured, supabase } from './supabase';

import { getMemberByEmail, getMemberByStudentId, listMembers, upsertMember } from './store';
import {
  INITIAL_ADMIN_PASSWORD,
  hashPassword,
  newSalt,
  safeEqual,
  validatePassword,
} from './password';

export type MaybeSession = Session | undefined;

export type AuthListener = (session: MaybeSession) => void;

export interface SignInResult {
  session: Session;
  error?: string;
}

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

export interface AddMemberInput {
  name: string;
  student_id: string;
  email: string;
  department: string;
  tags: Member['tags'];
  /** 兴趣方向，自由文本。社团成员页会展示。 */
  interests?: string;
  bio?: string;
  /**
   * 加入年份。社团按学年招新，只到年份就够，不必精确到日。
   * 往届与否由它推出来（见 types 的 isAlumniMember），不另设标记字段。
   */
  joinedYear?: number;
}

export interface AddMemberResult {
  member?: Member;
  error?: string;
}

export interface ProfilePatch {
  name?: string;
  department?: string;
  bio?: string;
  avatar_url?: string;
  tags?: Member['tags'];
  /** 兴趣方向，自由文本。 */
  interests?: string;
  /** 加入年份。管理员换届整理名单时会用到；它同时决定这人算不算往届。 */
  joinedYear?: number;
}

/** 管理层名额上限（含建站内置的那一个）。 */
export const MAX_ADMINS = 3;

/**
 * 当前是否为真实登录。页面据此决定要不要显示「演示环境提示」那块琥珀色警告 ——
 * 切到真登录后还挂着「改 localStorage 就能绕过」会让人以为线上也不安全。
 */
export const usingRealAuth = isSupabaseConfigured;

const SESSION_KEY = 'aiclub:session';

const listeners = new Set<AuthListener>();

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Supabase 模式下的会话缓存。
 *
 * `undefined` = 还在恢复（刚打开页面，token 还没换成 members 行）；
 * `null` = 确定未登录。`getSession()` 读它，所以对调用方仍然是同步的，
 * 页面不必改成 async。
 */
let remoteSession: MaybeSession = undefined;

/** 拿 auth 用户对应的 members 行。没有这一行 = 有账号但不是社团成员。 */
async function loadMember(userId: string): Promise<Member | null> {
  const { data, error } = await db().from('members').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.error('[auth] 读取成员资料失败：', explain(error));
    return null;
  }
  return (data as Member) ?? null;
}

async function resolveRemote(userId: string | undefined): Promise<void> {
  if (!userId) {
    remoteSession = null;
    emit(null);
    return;
  }
  let member = await loadMember(userId);

  // 没有成员记录时，先试着据名册补建一次再下结论。
  //
  // 为什么不能只靠注册时的触发器：在 auth.users 上建触发器需要足够权限，
  // 不是每个项目都建得上，而且失败时毫无征兆 —— 注册照样成功，只是没建档，
  // 表现成「设了口令却进不去后台」。这里补一刀，顺便也覆盖「人先注册、
  // 管理员后加名册」这种时序。函数只认当前登录用户自己，替不了别人建档。
  if (!member) {
    const { data: claimed } = await db().rpc('claim_invite');
    if (claimed === 'created') member = await loadMember(userId);
  }

  if (!member) {
    console.warn('[auth] 该账号没有对应的成员记录，无法进入后台');
    remoteSession = null;
    emit(null);
    return;
  }
  remoteSession = { member };
  emit({ member });
}

// 模块加载即开始恢复会话，并跟随 Supabase 的登录/登出/换 token 事件。
if (isSupabaseConfigured && supabase && isBrowser()) {
  void supabase.auth
    .getSession()
    .then(({ data }) => resolveRemote(data.session?.user.id))
    .catch(() => {
      remoteSession = null;
      emit(null);
    });
  supabase.auth.onAuthStateChange((_e, sess) => {
    void resolveRemote(sess?.user.id);
  });
}

/** 会话里只存 member；资料每次登录/更新时刷新，避免改了资料 session 还是旧的。 */
export function getSession(): MaybeSession {
  if (isSupabaseConfigured) return remoteSession;
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const member = JSON.parse(raw) as Member;
    return member?.id ? { member } : null;
  } catch {
    return null;
  }
}

function persist(member: Member | null): void {
  if (!isBrowser()) return;
  if (member) window.localStorage.setItem(SESSION_KEY, JSON.stringify(member));
  else window.localStorage.removeItem(SESSION_KEY);
}

function emit(session: MaybeSession): void {
  listeners.forEach(fn => fn(session));
}

export function onAuthStateChange(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isAdmin(session: MaybeSession): boolean {
  return session?.member.role === 'admin';
}

/** 这个账号还在用出厂口令吗？用来提示「请尽快修改口令」。 */
export function usesDefaultPassword(member: Member): boolean {
  return member.password_set !== true;
}

/**
 * 某账号的出厂口令。
 *
 * 只有建站内置的引导管理员用固定串；**后续录入的所有账号——包括管理员——
 * 出厂口令都是本人学号**，这样管理员加人时不需要额外传口令。
 */
function defaultPasswordFor(member: Member): string {
  return member.bootstrap_admin ? INITIAL_ADMIN_PASSWORD : member.student_id;
}

/**
 * 登录。`identifier` 可以是邮箱，也可以是学号 —— 成员记学号比记社团邮箱容易。
 */
export async function signIn(identifier: string, password: string): Promise<SignInResult> {
  const id = identifier.trim();
  if (!id || !password) return { session: null, error: '请填写账号与口令' };

  if (isSupabaseConfigured) {
    // Supabase Auth 以邮箱为账号。想继续支持「学号登录」就得允许匿名查
    // members.email，等于把全社团邮箱公开出去 —— 不值得，所以这里只收邮箱。
    if (!id.includes('@')) {
      return { session: null, error: '请用邮箱登录（学号仅作为成员编号）' };
    }
    const { data, error } = await db().auth.signInWithPassword({ email: id, password });
    if (error) {
      const raw = error.message;
      // 「邮箱没确认」要单独说 —— 它和口令错的处理方式完全不同（去点确认邮件 /
      // 在控制台把 email_confirmed_at 补上），混在一起会让人反复试口令。
      if (/email not confirmed/i.test(raw)) {
        return {
          session: null,
          error: '这个账号的邮箱还没确认。去邮箱点确认链接，或让管理员在 Supabase 控制台确认后再登录。',
        };
      }
      // 「账号不存在」和「口令错误」Supabase 返回同一句话 —— 正好符合
      // 「别让接口变成邮箱是否在册的探测器」这个要求，照原样翻译即可。
      return { session: null, error: /invalid login/i.test(raw) ? '账号或口令不正确' : explain(error) };
    }
    let member = data.user ? await loadMember(data.user.id) : null;
    if (!member && data.user) {
      // 同 resolveRemote：触发器可能没建上，登录时补一次建档
      const { data: claimed } = await db().rpc('claim_invite');
      if (claimed === 'created') member = await loadMember(data.user.id);
    }
    if (!member) {
      await db().auth.signOut();
      return { session: null, error: '这个账号还不是社团成员，请联系管理员把你加进名册' };
    }
    remoteSession = { member };
    emit({ member });
    return { session: { member } };
  }

  const member = id.includes('@')
    ? await getMemberByEmail(id)
    : await getMemberByStudentId(id);

  // 账号不存在与口令错误返回同一句话 —— 否则这个接口就成了「学号是否在册」的探测器。
  const GENERIC = '账号或口令不正确';
  if (!member) return { session: null, error: GENERIC };

  let authed = false;
  let updated = member;

  if (member.password_hash && member.password_salt) {
    const attempt = await hashPassword(password, member.password_salt);
    authed = safeEqual(attempt, member.password_hash);
  } else {
    // 还没设过口令：跟出厂口令比。对上了就当场生成盐与 hash 落库，
    // 之后就走上面那条正常分支。
    authed = safeEqual(password, defaultPasswordFor(member));
    if (authed) {
      const salt = newSalt();
      updated = {
        ...member,
        password_salt: salt,
        password_hash: await hashPassword(password, salt),
        password_set: false, // 用的还是出厂口令，仍要提示修改
      };
      await upsertMember(updated);
    }
  }

  if (!authed) return { session: null, error: GENERIC };

  persist(updated);
  const session = { member: updated };
  emit(session);
  return { session };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    await db().auth.signOut();
    remoteSession = null;
    emit(null);
    return;
  }
  persist(null);
  emit(null);
}

/**
 * 自助设置口令（首次激活账号）。
 *
 * 只对**已在名册里**的邮箱开放：管理员先在后台加人（写进 `member_invites`），
 * 本人再用这个邮箱设口令。注册成功后数据库触发器会自动建 members 行。
 *
 * 先查一次 `can_activate` 是为了给出有用的报错 —— 否则不在名册的人注册成功却
 * 进不了后台，只会一头雾水。
 */
export async function activateAccount(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  if (!isSupabaseConfigured) return { ok: false, error: '当前是本地演示模式，不需要激活' };
  const mail = email.trim().toLowerCase();
  if (!mail.includes('@')) return { ok: false, error: '请填写邮箱' };
  const invalid = validatePassword(password);
  if (invalid) return { ok: false, error: invalid };

  const { data: status, error: checkErr } = await db().rpc('can_activate', { p_email: mail });
  if (checkErr) return { ok: false, error: explain(checkErr) };

  /**
   * `can_activate` 有两个版本，这里都要认：
   *
   *   001 版返回 boolean —— 只回答「名册里有没有」；
   *   003 版返回 text    —— 'ok' / 'exists' / 'not_invited'，能分清「已有账号」和「不在名册」。
   *
   * **必须兼容旧版**：客户端单方面改成只认新版，会让还没执行 003 的库上
   * 「名册里明明有」的人被判成「不在名册里」—— 一个有效邀请被自己的代码挡掉，
   * 而且报错还指向错误的方向。迁移与前端不是同时上线的，这种兼容不是可选项。
   */
  const norm =
    typeof status === 'boolean' ? (status ? 'ok' : 'unknown') : String(status ?? 'unknown');

  if (norm === 'exists') {
    return {
      ok: false,
      error: '这个邮箱已经开通过账号了 —— 直接用上面的「登录」即可。忘了口令请让管理员发一封重置邮件。',
    };
  }
  if (norm === 'not_invited') {
    return { ok: false, error: '这个邮箱不在社团名册里。请先联系管理员在「成员管理」里把你加进去。' };
  }
  if (norm !== 'ok') {
    // 旧版函数分不清这两种情况，只能把两条路都告诉对方，别把人指向单一的错误方向
    return {
      ok: false,
      error:
        '这个邮箱现在不能激活：可能已经开通过账号（那就直接「登录」），也可能还不在名册里（请联系管理员添加）。',
    };
  }

  const { data, error } = await db().auth.signUp({ email: mail, password });
  if (error) return { ok: false, error: explain(error) };

  // 拿到 session 就立刻建档，不依赖触发器是否建上
  if (data.session) {
    await db().rpc('claim_invite');
    await resolveRemote(data.user?.id);
  }
  // 项目开了邮箱验证时 session 为空，要等用户点确认邮件后才能建档
  return { ok: true, needsConfirm: !data.session };
}

export async function changePassword(
  currentPassword: string,
  nextPassword: string
): Promise<ChangePasswordResult> {
  const session = getSession();
  if (!session) return { ok: false, error: '尚未登录' };

  if (isSupabaseConfigured) {
    // Supabase 的 updateUser 不校验旧口令，所以这里先拿旧口令换一次登录来验身份 ——
    // 不验的话，别人借了你没锁屏的电脑就能直接改掉你的口令。
    const verify = await db().auth.signInWithPassword({
      email: session.member.email,
      password: currentPassword,
    });
    if (verify.error) return { ok: false, error: '当前口令不正确' };

    const bad = validatePassword(nextPassword);
    if (bad) return { ok: false, error: bad };
    if (nextPassword === currentPassword) return { ok: false, error: '新口令与当前口令相同' };

    const { error } = await db().auth.updateUser({ password: nextPassword });
    if (error) return { ok: false, error: explain(error) };
    await upsertMember({ ...session.member, password_set: true });
    return { ok: true };
  }

  const { member } = session;
  const verify = await signIn(member.email, currentPassword);
  if (!verify.session) return { ok: false, error: '当前口令不正确' };

  const invalid = validatePassword(nextPassword);
  if (invalid) return { ok: false, error: invalid };
  if (nextPassword === currentPassword) return { ok: false, error: '新口令与当前口令相同' };

  const salt = newSalt();
  const updated: Member = {
    ...verify.session.member,
    password_salt: salt,
    password_hash: await hashPassword(nextPassword, salt),
    password_set: true,
  };
  await upsertMember(updated);
  persist(updated);
  emit({ member: updated });
  return { ok: true };
}

export async function countAdmins(): Promise<number> {
  const all = await listMembers();
  return all.filter(m => m.role === 'admin').length;
}

/**
 * 管理员录入成员。不设口令 —— 初始口令即学号，由 signIn 的懒初始化那条分支处理。
 */
export async function addMember(input: AddMemberInput): Promise<AddMemberResult> {
  if (isSupabaseConfigured) return addMemberRemote(input);
  return addMemberLocal(input);
}

/**
 * Supabase 模式：只写**名册**，不建账号。
 *
 * 建 auth 账号需要 service_role key（绝不能进前端），所以流程拆成两步：
 * 这里把人写进 `member_invites`，本人再用该邮箱在登录页自助设置口令，
 * 数据库触发器届时自动建 members 行。对管理员来说操作没变，只是多一步「通知本人激活」。
 */
async function addMemberRemote(input: AddMemberInput): Promise<AddMemberResult> {
  const session = getSession();
  if (!session || !isAdmin(session)) return { error: '只有管理员可以添加成员' };

  const email = input.email.trim().toLowerCase();
  const studentId = input.student_id.trim();
  if (!input.name.trim() || !studentId || !email) return { error: '姓名、学号、邮箱都要填' };

  const all = await listMembers();
  if (all.some(m => m.student_id === studentId)) return { error: `学号 ${studentId} 已存在` };
  if (all.some(m => m.email.toLowerCase() === email)) return { error: `邮箱 ${email} 已存在` };

  const role: Member['role'] = input.department === ADMIN_DEPARTMENT ? 'admin' : 'member';
  if (role === 'admin') {
    const admins = all.filter(m => m.role === 'admin').length;
    if (admins >= MAX_ADMINS) {
      return { error: `管理员最多 ${MAX_ADMINS} 人，当前已有 ${admins} 人。先把某位调出管理层再加。` };
    }
  }

  const { error } = await db().from('member_invites').insert({
    email,
    student_id: studentId,
    name: input.name.trim(),
    department: input.department,
    role,
    tags: input.tags,
    interests: input.interests?.trim() || null,
    bio: input.bio?.trim() || null,
    joined_at: input.joinedYear
      ? `${input.joinedYear}-09-01`
      : new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: explain(error) };

  // 返回一个"占位"成员对象让调用方能显示姓名；它还没有真正的账号 id。
  return {
    member: {
      id: `invite:${email}`,
      email,
      student_id: studentId,
      name: input.name.trim(),
      department: input.department,
      role,
      tags: input.tags,
      interests: input.interests?.trim() || undefined,
      bio: input.bio?.trim() || undefined,
      joined_at: input.joinedYear ? `${input.joinedYear}-09-01` : new Date().toISOString().slice(0, 10),
      password_set: false,
    },
  };
}

async function addMemberLocal(input: AddMemberInput): Promise<AddMemberResult> {
  const session = getSession();
  if (!isAdmin(session)) return { error: '只有管理员可以添加成员' };

  const studentId = input.student_id.trim();
  const email = input.email.trim().toLowerCase();
  if (!studentId || !email || !input.name.trim()) return { error: '姓名、学号、邮箱都要填' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: '邮箱格式不对' };

  const all = await listMembers();
  if (all.some(m => m.student_id === studentId)) return { error: `学号 ${studentId} 已存在` };
  if (all.some(m => m.email.toLowerCase() === email)) return { error: `邮箱 ${email} 已存在` };

  // 角色由部门推导，不再单独传 —— 「管理层」就是管理员。
  const role: Member['role'] = input.department === ADMIN_DEPARTMENT ? 'admin' : 'member';
  if (role === 'admin') {
    const admins = all.filter(m => m.role === 'admin').length;
    if (admins >= MAX_ADMINS) {
      return {
        error: `管理层最多 ${MAX_ADMINS} 人，当前已有 ${admins} 人。先把某位调到其他部门再加。`,
      };
    }
  }

  const member: Member = {
    id: `m-${studentId}`,
    email,
    student_id: studentId,
    name: input.name.trim(),
    department: input.department,
    role,
    tags: input.tags,
    interests: input.interests?.trim() || undefined,
    bio: input.bio?.trim() || undefined,
    // 社团按学年运作，统一记到当年 9 月 1 日；没填就用今天。
    joined_at: input.joinedYear
      ? `${input.joinedYear}-09-01`
      : new Date().toISOString().slice(0, 10),
    password_set: false,
  };
  await upsertMember(member);
  return { member };
}

/**
 * 更新成员资料。本人可改自己的；管理员可改任何人的。
 * 学号、邮箱、权限不在这里改 —— 那些属于账号管理，走「成员管理」。
 * 往届与否没有对应的字段可改：它由加入年份推出来。
 */
export async function updateProfile(
  memberId: string,
  patch: ProfilePatch
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session) return { ok: false, error: '尚未登录' };
  if (session.member.id !== memberId && !isAdmin(session)) {
    return { ok: false, error: '只能修改自己的资料' };
  }

  const all = await listMembers();
  const target = all.find(m => m.id === memberId);
  if (!target) return { ok: false, error: '找不到该成员' };
  if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: '姓名不能为空' };

  const updated: Member = {
    ...target,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.department !== undefined
      ? {
          department: patch.department,
          // 部门与权限是同一件事，调部门就要同步权限，否则会出现
          // 「部门管理层但没有管理员权限」这种自相矛盾的记录。
          role: (patch.department === ADMIN_DEPARTMENT
            ? 'admin'
            : 'member') as Member['role'],
        }
      : {}),
    ...(patch.bio !== undefined ? { bio: patch.bio.trim() || undefined } : {}),
    ...(patch.avatar_url !== undefined
      ? { avatar_url: patch.avatar_url.trim() || undefined }
      : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    ...(patch.interests !== undefined
      ? { interests: patch.interests.trim() || undefined }
      : {}),
    ...(patch.joinedYear ? { joined_at: `${patch.joinedYear}-09-01` } : {}),
  };
  await upsertMember(updated);

  // 改的是自己：会话里那份也要同步，否则侧栏还显示旧名字。
  if (session.member.id === memberId) {
    if (isSupabaseConfigured) remoteSession = { member: updated };
    else persist(updated);
    emit({ member: updated });
  }
  return { ok: true };
}

/** 管理员重置某成员的口令回学号（成员忘记口令时用）。 */
export async function resetMemberPassword(memberId: string): Promise<ChangePasswordResult> {
  if (isSupabaseConfigured) {
    // 「把口令重置成学号」需要 Admin API（service_role key，不能进前端），
    // 所以改成给本人发一封重置邮件，由他自己设新口令 —— 也更安全，少一次口口相传。
    const session = getSession();
    if (!session || !isAdmin(session)) return { ok: false, error: '只有管理员可以重置口令' };
    const all = await listMembers();
    const target = all.find(m => m.id === memberId);
    if (!target) return { ok: false, error: '找不到该成员' };
    const { error } = await db().auth.resetPasswordForEmail(target.email);
    if (error) return { ok: false, error: explain(error) };
    return { ok: true };
  }

  const session = getSession();
  if (!isAdmin(session)) return { ok: false, error: '只有管理员可以重置口令' };
  const all = await listMembers();
  const member = all.find(m => m.id === memberId);
  if (!member) return { ok: false, error: '找不到该成员' };
  await upsertMember({
    ...member,
    password_salt: undefined,
    password_hash: undefined,
    password_set: false,
  });
  return { ok: true };
}

/**
 * 管理员修改任意成员的全部字段 —— 包括学号这个登录标识。
 *
 * 与 `updateProfile`（本人改自己、不动账号字段）是两回事：这里是**账号管理**，
 * 只有管理员能调。学号是登录标识之一，改它等于换账号，所以调用方（成员管理页）
 * 在提交前要弹确认窗口。邮箱是登录账号，UI 层不开放修改 —— 这里仍保留 email
 * 参数（调用方传回原值），只为与 `AddMemberInput` 同构、便于将来需要时放开。
 */
export interface UpdateMemberInput {
  name: string;
  student_id: string;
  email: string;
  department: string;
  tags: Member['tags'];
  interests?: string;
  bio?: string;
  joinedYear?: number;
}

export interface UpdateMemberResult {
  member?: Member;
  error?: string;
}

export async function updateMember(
  memberId: string,
  input: UpdateMemberInput
): Promise<UpdateMemberResult> {
  if (isSupabaseConfigured) return updateMemberRemote(memberId, input);
  return updateMemberLocal(memberId, input);
}

/** 校验 + 冲突检查 + 名额检查共用的部分，两套实现都走这里。 */
async function prepareMemberUpdate(
  memberId: string,
  input: UpdateMemberInput
): Promise<
  | { ok: true; target: Member; all: Member[]; name: string; studentId: string; email: string; role: Member['role'] }
  | { ok: false; error: string }
> {
  const session = getSession();
  if (!session || !isAdmin(session)) return { ok: false, error: '只有管理员可以修改成员' };

  const name = input.name.trim();
  const studentId = input.student_id.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !studentId || !email) return { ok: false, error: '姓名、学号、邮箱都要填' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: '邮箱格式不对' };

  const all = await listMembers();
  const target = all.find(m => m.id === memberId);
  if (!target) return { ok: false, error: '找不到该成员' };

  // 冲突检查只针对**其他**成员 —— 改回自己的原值不算撞。
  if (all.some(m => m.id !== memberId && m.student_id === studentId)) {
    return { ok: false, error: `学号 ${studentId} 已被其他成员占用` };
  }
  if (all.some(m => m.id !== memberId && m.email.toLowerCase() === email)) {
    return { ok: false, error: `邮箱 ${email} 已被其他成员占用` };
  }

  // 角色由部门推导，调部门就同步权限（与 updateProfile 同一约定）。
  const role: Member['role'] = input.department === ADMIN_DEPARTMENT ? 'admin' : 'member';
  if (role === 'admin' && target.role !== 'admin') {
    const admins = all.filter(m => m.role === 'admin').length;
    if (admins >= MAX_ADMINS) {
      return { ok: false, error: `管理层最多 ${MAX_ADMINS} 人，当前已有 ${admins} 人。先把某位调出管理层再加。` };
    }
  }

  return { ok: true, target, all, name, studentId, email, role };
}

async function updateMemberLocal(memberId: string, input: UpdateMemberInput): Promise<UpdateMemberResult> {
  const prep = await prepareMemberUpdate(memberId, input);
  if (!prep.ok) return { error: prep.error };
  const { target, name, studentId, email, role } = prep;

  const updated: Member = {
    ...target,
    name,
    student_id: studentId,
    email,
    department: input.department,
    role,
    tags: input.tags,
    interests: input.interests?.trim() || undefined,
    bio: input.bio?.trim() || undefined,
    joined_at: input.joinedYear ? `${input.joinedYear}-09-01` : target.joined_at,
  };
  await upsertMember(updated);
  return { member: updated };
}

/**
 * Supabase 模式：直接更新 members 行。
 *
 * 学号只存在于 members 表，改它没有 auth 侧的隐患。邮箱在 UI 层不开放修改
 * （这里 email 传回原值），所以不会碰到「members.email 与 auth.users 登录邮箱
 * 不一致」的问题 —— 那只有将来放开邮箱修改时才需要额外处理。
 */
async function updateMemberRemote(memberId: string, input: UpdateMemberInput): Promise<UpdateMemberResult> {
  const prep = await prepareMemberUpdate(memberId, input);
  if (!prep.ok) return { error: prep.error };
  const { target, name, studentId, email, role } = prep;

  const updated: Member = {
    ...target,
    name,
    student_id: studentId,
    email,
    department: input.department,
    role,
    tags: input.tags,
    interests: input.interests?.trim() || undefined,
    bio: input.bio?.trim() || undefined,
    joined_at: input.joinedYear ? `${input.joinedYear}-09-01` : target.joined_at,
  };
  await upsertMember(updated);
  return { member: updated };
}
