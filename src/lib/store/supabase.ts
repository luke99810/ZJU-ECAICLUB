/**
 * 数据层的 **Supabase 实现**。函数签名与 `local.ts` 逐个对齐，由 `index.ts` 二选一。
 *
 * 几条贯穿全文件的约定：
 *
 * 1. **写操作出错就抛，读列表出错则软失败。** 这条分得很清楚：
 *    - **写**失败必须让调用方知道 —— 页面上那句「已保存」不能在数据没进库时出现；
 *    - **读列表**失败返回空数组。本地实现（localStorage）永远不会抛，页面因此
 *      普遍没有 `.catch()`；真库一抛就变成未处理的 Promise rejection，
 *      开发时是满屏错误遮罩，线上是整块内容消失。软失败 + 右下角的连接提示条
 *      （`DbStatusBanner`）能把"为什么是空的"讲清楚，比让页面崩掉好。
 *    - **读单条**照常抛：它们出现在具体动作里（打开编辑、登录取账号），
 *      这种场合需要一句明确的报错，而不是当成"没找到"。
 * 2. **列名与 TS 字段同名**，所以不需要映射层：类型定义当初就是照 snake_case 写的。
 *    唯一的例外是 `tool_links.cn_friendly`（SQL 里习惯下划线，TS 里是 `cnFriendly`），
 *    在这个文件里显式转一次。
 * 3. **排序交给数据库**，不要拉回来再 sort —— 内容多了以后前端排序会白拉一堆数据。
 * 4. **模糊搜索用 `ilike`**，跨列搜索用 `.or()`。中文没有分词，`ilike %kw%` 够用；
 *    真要做全文检索得上 pg 的 tsvector，那是内容上千之后的事。
 */
import {
  AI_TAGS,
  type AiProject,
  type ForumComment,
  type ForumPost,
  type Member,
  type Message,
  type MessageStatus,
  type Post,
  type Resource,
  type ReviewStatus,
  type ToolLink,
} from '../../types';
import { db, explain } from '../supabase';
import type { ContentQuery, ProjectQuery } from './types';

/** 统一的错误出口：把 Supabase 的 error 变成能直接给用户看的 Error。写操作用它。 */
function fail(error: unknown): never {
  throw new Error(explain(error as { message?: string; code?: string }));
}

/**
 * 列表读取的软失败：记一条控制台错误，返回兜底值。
 *
 * 不静默 —— 控制台里要留下线索，否则排查时只能看到"页面是空的"。
 * 用户侧的解释交给 `DbStatusBanner`，它会主动探测一次并把原因写在页面上。
 */
function soft<T>(error: unknown, where: string, fallback: T): T {
  console.error(`[store] ${where} 读取失败：`, explain(error as { message?: string }));
  return fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** `ilike` 的通配符要转义，否则用户搜 `%` 会把整表匹配出来。 */
function like(keyword: string): string {
  return `%${keyword.trim().replace(/[%_]/g, m => `\\${m}`)}%`;
}

// ── members ────────────────────────────────────────────────────────────────

/**
 * 成员列表。
 *
 * `members` 表的 RLS 只放行登录成员 —— 邮箱和学号不该让匿名访客通过接口拉走。
 * 但对外的社团成员页也要显示名单，所以数据库里另建了一个**不含邮箱与学号**的视图
 * `public_members`，匿名可读。
 *
 * 这里的策略是「先查全表，空了再退到视图」：
 * SELECT 被 RLS 挡住时返回的是**空结果而不是报错**，所以没法靠 error 判断，
 * 只能看拿没拿到行。代价是社团真的一个成员都没有时会多查一次，可以接受；
 * 好处是这个函数不用知道当前登录状态，也就不会和 auth 形成循环依赖。
 */
export async function listMembers(): Promise<Member[]> {
  const { data, error } = await db()
    .from('members')
    .select('*')
    .order('joined_at', { ascending: false });
  if (error) return soft(error, 'listMembers', []);
  if (data && data.length > 0) return data;

  const pub = await db()
    .from('public_members')
    .select('*')
    .order('joined_at', { ascending: false });
  if (pub.error) return soft(pub.error, 'listMembers(public)', []);
  // 视图里没有邮箱与学号，补成空串让类型对得上 —— 对外页面本来也不展示这两项
  return (pub.data ?? []).map(m => ({ ...m, email: '', student_id: '' })) as Member[];
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const { data, error } = await db()
    .from('members')
    .select('*')
    .ilike('email', email.trim())
    .maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function getMemberByStudentId(studentId: string): Promise<Member | null> {
  const { data, error } = await db()
    .from('members')
    .select('*')
    .eq('student_id', studentId.trim())
    .maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function upsertMember(member: Member): Promise<Member> {
  const { data, error } = await db().from('members').upsert(member).select().single();
  if (error) fail(error);
  return data as Member;
}

// ── ai_projects ────────────────────────────────────────────────────────────

export async function listProjects(query: ProjectQuery = {}): Promise<AiProject[]> {
  let q = db().from('ai_projects').select('*').order('created_at', { ascending: false });
  if (query.status) q = q.eq('status', query.status);
  if (query.authorId) q = q.eq('author_id', query.authorId);
  if (query.origins) q = q.in('origin', query.origins);
  // tags 是 text[]，用 contains 让数据库判断，别拉回来再 filter
  if (query.tag && (AI_TAGS as readonly string[]).includes(query.tag)) {
    q = q.contains('tags', [query.tag]);
  }
  if (query.keyword?.trim()) {
    const kw = like(query.keyword);
    q = q.or(`title.ilike.${kw},summary.ilike.${kw}`);
  }
  const { data, error } = await q;
  if (error) return soft(error, 'listProjects', []);
  return data ?? [];
}

export async function getProject(id: string): Promise<AiProject | null> {
  const { data, error } = await db().from('ai_projects').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function createProject(
  input: Omit<AiProject, 'id' | 'status' | 'created_at' | 'updated_at'>
): Promise<AiProject> {
  const { data, error } = await db()
    .from('ai_projects')
    // status 必须是 pending：RLS 的 insert 策略也在数据库那侧强制了同一条
    .insert({ ...input, status: 'pending' })
    .select()
    .single();
  if (error) fail(error);
  return data as AiProject;
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<AiProject, 'id' | 'author_id' | 'created_at'>>
): Promise<AiProject | null> {
  // 作者改动已通过的项目会打回重审 —— 否则审核形同虚设（审过之后随便改内容）
  const { data, error } = await db()
    .from('ai_projects')
    .update({ ...patch, status: 'pending', review_note: null, updated_at: nowIso() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function reviewProject(
  id: string,
  status: ReviewStatus,
  note?: string
): Promise<AiProject | null> {
  const { data, error } = await db()
    .from('ai_projects')
    .update({ status, review_note: note ?? null, updated_at: nowIso() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await db().from('ai_projects').delete().eq('id', id);
  if (error) fail(error);
}

// ── posts ──────────────────────────────────────────────────────────────────

export async function listPosts(kind?: Post['kind']): Promise<Post[]> {
  let q = db().from('posts').select('*').order('date', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) return soft(error, 'listPosts', []);
  return data ?? [];
}

export async function createPost(
  input: Omit<Post, 'id' | 'created_at' | 'updated_at'>
): Promise<Post> {
  const { data, error } = await db().from('posts').insert(input).select().single();
  if (error) fail(error);
  return data as Post;
}

export async function updatePost(
  id: string,
  patch: Partial<Omit<Post, 'id' | 'created_at'>>
): Promise<Post | null> {
  const { data, error } = await db()
    .from('posts')
    .update({ ...patch, updated_at: nowIso() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await db().from('posts').delete().eq('id', id);
  if (error) fail(error);
}

// ── 三类投稿共用的筛选 ──────────────────────────────────────────────────────

/**
 * 资料与帖子的过滤维度完全一样，拼查询的逻辑抽出来共用 ——
 * 两处各写一遍，迟早有一边忘了过滤 status。
 */
function applyContentQuery<T extends { or: (f: string) => T; eq: (c: string, v: unknown) => T; in: (c: string, v: unknown[]) => T }>(
  q: T,
  query: ContentQuery,
  searchColumns: string[]
): T {
  let out = q;
  if (query.status) out = out.eq('status', query.status);
  if (query.authorId) out = out.eq('author_id', query.authorId);
  if (query.origins) out = out.in('origin', query.origins);
  if (query.keyword?.trim()) {
    const kw = like(query.keyword);
    out = out.or(searchColumns.map(c => `${c}.ilike.${kw}`).join(','));
  }
  return out;
}

// ── resources（学习资料）────────────────────────────────────────────────────

export async function listResources(query: ContentQuery = {}): Promise<Resource[]> {
  const base = db().from('resources').select('*').order('created_at', { ascending: false });
  const { data, error } = await applyContentQuery(base as never, query, ['title', 'summary']);
  if (error) return soft(error, 'listResources', []);
  return (data as Resource[]) ?? [];
}

export async function createResource(
  input: Omit<Resource, 'id' | 'status' | 'created_at' | 'updated_at'>
): Promise<Resource> {
  const { data, error } = await db()
    .from('resources')
    .insert({ ...input, status: 'pending' })
    .select()
    .single();
  if (error) fail(error);
  return data as Resource;
}

export async function reviewResource(
  id: string,
  status: ReviewStatus,
  note?: string
): Promise<void> {
  const { error } = await db()
    .from('resources')
    .update({ status, review_note: note ?? null, updated_at: nowIso() })
    .eq('id', id);
  if (error) fail(error);
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await db().from('resources').delete().eq('id', id);
  if (error) fail(error);
}

// ── forum（AI 论坛）─────────────────────────────────────────────────────────

export async function listForumPosts(query: ContentQuery = {}): Promise<ForumPost[]> {
  const base = db().from('forum_posts').select('*').order('created_at', { ascending: false });
  const { data, error } = await applyContentQuery(base as never, query, ['title', 'body']);
  if (error) return soft(error, 'listForumPosts', []);
  return (data as ForumPost[]) ?? [];
}

export async function getForumPost(id: string): Promise<ForumPost | null> {
  const { data, error } = await db().from('forum_posts').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ?? null;
}

export async function createForumPost(
  input: Omit<ForumPost, 'id' | 'status' | 'created_at' | 'updated_at'>
): Promise<ForumPost> {
  const { data, error } = await db()
    .from('forum_posts')
    .insert({ ...input, status: 'pending' })
    .select()
    .single();
  if (error) fail(error);
  return data as ForumPost;
}

export async function reviewForumPost(
  id: string,
  status: ReviewStatus,
  note?: string
): Promise<void> {
  const { error } = await db()
    .from('forum_posts')
    .update({ status, review_note: note ?? null, updated_at: nowIso() })
    .eq('id', id);
  if (error) fail(error);
}

export async function deleteForumPost(id: string): Promise<void> {
  // 评论有 on delete cascade，数据库会自己清掉，不必像本地实现那样手动删
  const { error } = await db().from('forum_posts').delete().eq('id', id);
  if (error) fail(error);
}

// ── forum_comments ─────────────────────────────────────────────────────────

export async function listComments(postId: string): Promise<ForumComment[]> {
  const { data, error } = await db()
    .from('forum_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) return soft(error, 'listComments', []);
  return data ?? [];
}

/**
 * 每个帖子的评论数。
 *
 * 只取 post_id 一列而不是 `select('*')` —— 列表页只要计数，把评论正文全拉回来
 * 纯属浪费。条目上千之后应该换成数据库里的视图或 rpc 直接 count。
 */
export async function countComments(): Promise<Map<string, number>> {
  const { data, error } = await db().from('forum_comments').select('post_id');
  if (error) return soft(error, 'countComments', new Map<string, number>());
  const m = new Map<string, number>();
  (data ?? []).forEach((c: { post_id: string }) => m.set(c.post_id, (m.get(c.post_id) ?? 0) + 1));
  return m;
}

/** 评论不进审核队列 —— 未登录访客也能评，这是「外部访问只能评论」的实现点。 */
export async function createComment(
  input: Omit<ForumComment, 'id' | 'created_at'>
): Promise<ForumComment> {
  const { data, error } = await db().from('forum_comments').insert(input).select().single();
  if (error) fail(error);
  return data as ForumComment;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await db().from('forum_comments').delete().eq('id', id);
  if (error) fail(error);
}

// ── tool_links ─────────────────────────────────────────────────────────────

/** SQL 列名是 cn_friendly，TS 字段是 cnFriendly —— 这是唯一需要转换的地方。 */
type ToolRow = Omit<ToolLink, 'cnFriendly'> & { cn_friendly?: boolean };

const toolIn = (t: Partial<ToolLink>): Partial<ToolRow> => {
  const { cnFriendly, ...rest } = t;
  return cnFriendly === undefined ? rest : { ...rest, cn_friendly: cnFriendly };
};

const toolOut = (r: ToolRow): ToolLink => {
  const { cn_friendly, ...rest } = r;
  return { ...rest, ...(cn_friendly ? { cnFriendly: true } : {}) } as ToolLink;
};

export async function listToolLinks(): Promise<ToolLink[]> {
  const { data, error } = await db()
    .from('tool_links')
    .select('*')
    .order('sort', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) return soft(error, 'listToolLinks', []);
  return (data ?? []).map(toolOut);
}

export async function createToolLink(
  input: Omit<ToolLink, 'id' | 'created_at' | 'updated_at'>
): Promise<ToolLink> {
  const { data, error } = await db()
    .from('tool_links')
    .insert(toolIn(input))
    .select()
    .single();
  if (error) fail(error);
  return toolOut(data as ToolRow);
}

export async function updateToolLink(
  id: string,
  patch: Partial<Omit<ToolLink, 'id' | 'created_at'>>
): Promise<ToolLink | null> {
  const { data, error } = await db()
    .from('tool_links')
    .update({ ...toolIn(patch), updated_at: nowIso() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) fail(error);
  return data ? toolOut(data as ToolRow) : null;
}

export async function deleteToolLink(id: string): Promise<void> {
  const { error } = await db().from('tool_links').delete().eq('id', id);
  if (error) fail(error);
}

// ── messages ───────────────────────────────────────────────────────────────

export async function listMessages(status?: MessageStatus): Promise<Message[]> {
  let q = db().from('messages').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return soft(error, 'listMessages', []);
  return data ?? [];
}

export async function createMessage(
  input: Pick<Message, 'name' | 'email' | 'body'>
): Promise<Message> {
  const { data, error } = await db()
    .from('messages')
    .insert({
      name: input.name.trim(),
      email: input.email.trim(),
      body: input.body.trim(),
      status: 'new',
    })
    .select()
    .single();
  if (error) fail(error);
  return data as Message;
}

export async function markMessage(
  id: string,
  status: MessageStatus,
  handledBy?: string
): Promise<void> {
  // 重新打开时把处理记录一并清掉，否则会留下「待处理但显示某人已处理」的脏数据
  const patch =
    status === 'new'
      ? { status, handled_by: null, handled_at: null }
      : { status, handled_by: handledBy ?? null, handled_at: nowIso() };
  const { error } = await db().from('messages').update(patch).eq('id', id);
  if (error) fail(error);
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await db().from('messages').delete().eq('id', id);
  if (error) fail(error);
}

/**
 * 真库模式下没有「重置为演示数据」这回事 —— 那会删掉社团的真实内容。
 * 页面上的按钮在这个模式下会隐藏，这里再兜一层，避免误调用。
 */
export function resetLocalData(): void {
  throw new Error('已接入 Supabase，不能重置数据。要清空请在 Supabase 控制台操作。');
}
