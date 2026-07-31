/**
 * 数据层的**本地演示**实现：落 localStorage，首次访问灌入 `src/data` 里的种子。
 *
 * 它不是过渡代码，而是长期保留的一条腿：没配 Supabase 环境变量时数据层就走这里，
 * 于是「clone 下来 npm run dev 就能看到完整站点」始终成立 —— 换届交接、
 * 新人上手、演示给老师看，都不必先去开一个数据库。
 *
 * 真库实现见同目录的 `supabase.ts`，两者由 `index.ts` 按环境变量二选一。
 * 两边的函数签名必须完全一致，`index.ts` 里有类型断言在编译期盯着这件事。
 */
import {
  AI_TAGS,
  type AiProject,
  type ForumComment,
  type ForumPost,
  type Member,
  type Post,
  type Resource,
  type Message,
  type MessageStatus,
  type ReviewStatus,
  type SubmissionOrigin,
  type ToolLink,
} from '../../types';
import {
  seedComments,
  seedForumPosts,
  seedMembers,
  seedPosts,
  seedProjects,
  seedResources,
} from '../../data/seed';
import { seedToolLinks } from '../../data/toolLinks';
import { seedMessages } from '../../data/messages';
import type { ContentQuery, ProjectQuery } from './types';

const KEYS = {
  // v4：标签词表定稿（技术 LLM/Agent/RAG/MCP/Multimodal/NLP/CV/RL/Robot/Deployment，
  // 功能 内容创作/图像视频生成/数据挖掘/…）。词表一变旧数据的标签就全失效，
  // 所以换 key 强制重新播种，而不是留一堆筛不出来的僵尸标签。
  // v5：部门改为四部门制，且「管理层」等价于管理员。
  // v6：「运营部」按社团实际架构更名为「组织部」——旧数据里存的字符串已不在词表内，
  //     不换 key 的话那些人会落进一个前台不再渲染的分组里，等于凭空消失。
  // v7：新增 interests（兴趣方向），并去掉手工的 is_alumni —— 往届改为按加入年份推导。
  members: 'aiclub:members:v7',
  // v6：项目来源改为三档 origin（member / alumni / external），按投稿邮箱后缀判定。
  projects: 'aiclub:projects:v6',
  posts: 'aiclub:posts:v4',
  resources: 'aiclub:resources:v1',
  forum: 'aiclub:forum:v1',
  comments: 'aiclub:comments:v1',
  tools: 'aiclub:tools:v1',
  messages: 'aiclub:messages:v1',
} as const;

/** SSR 阶段没有 localStorage；此时一律回落到种子数据，保证首屏可渲染。 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function read<T>(key: string, seed: T[]): T[] {
  if (!isBrowser()) return seed;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : seed;
  } catch {
    // 存储被禁用（隐私模式）或数据损坏——降级到种子，不让页面白屏。
    return seed;
  }
}

function write<T>(key: string, rows: T[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* 配额满或隐私模式：本地演示场景下静默失败即可 */
  }
}

/** 换成真库后由数据库生成；本地用时间戳 + 随机串保证唯一。 */
function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── members ────────────────────────────────────────────────────────────────

export async function listMembers(): Promise<Member[]> {
  return read<Member>(KEYS.members, seedMembers);
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const rows = await listMembers();
  const target = email.trim().toLowerCase();
  return rows.find(m => m.email.toLowerCase() === target) ?? null;
}

export async function getMemberByStudentId(studentId: string): Promise<Member | null> {
  const rows = await listMembers();
  const target = studentId.trim();
  return rows.find(m => m.student_id === target) ?? null;
}

export async function upsertMember(member: Member): Promise<Member> {
  const rows = await listMembers();
  const i = rows.findIndex(m => m.id === member.id);
  if (i >= 0) rows[i] = member;
  else rows.push(member);
  write(KEYS.members, rows);
  return member;
}

// ── ai_projects ────────────────────────────────────────────────────────────

export async function listProjects(query: ProjectQuery = {}): Promise<AiProject[]> {
  let rows = read<AiProject>(KEYS.projects, seedProjects);
  if (query.status) rows = rows.filter(p => p.status === query.status);
  if (query.authorId) rows = rows.filter(p => p.author_id === query.authorId);
  if (query.origins) {
    rows = rows.filter(p => query.origins!.includes(p.origin ?? 'member'));
  }
  if (query.tag && (AI_TAGS as readonly string[]).includes(query.tag)) {
    rows = rows.filter(p => p.tags.includes(query.tag as never));
  }
  if (query.keyword?.trim()) {
    const q = query.keyword.trim().toLowerCase();
    rows = rows.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.stack.some(s => s.toLowerCase().includes(q))
    );
  }
  // 新的在前
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getProject(id: string): Promise<AiProject | null> {
  const rows = read<AiProject>(KEYS.projects, seedProjects);
  return rows.find(p => p.id === id) ?? null;
}

/** 新建项目。成员提交一律进 pending，等管理员审核。 */
export async function createProject(
  input: Omit<AiProject, 'id' | 'status' | 'created_at' | 'updated_at'>
): Promise<AiProject> {
  const rows = read<AiProject>(KEYS.projects, seedProjects);
  const project: AiProject = {
    ...input,
    id: newId(),
    status: 'pending',
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  rows.push(project);
  write(KEYS.projects, rows);
  return project;
}

/**
 * 更新项目。作者改动已通过的项目会**打回 pending 重审**——否则审核就形同虚设
 * （审过之后随便改内容）。管理员改状态时走 `reviewProject`，不受此限制。
 */
export async function updateProject(
  id: string,
  patch: Partial<Omit<AiProject, 'id' | 'author_id' | 'created_at'>>
): Promise<AiProject | null> {
  const rows = read<AiProject>(KEYS.projects, seedProjects);
  const i = rows.findIndex(p => p.id === id);
  if (i < 0) return null;
  const next: AiProject = {
    ...rows[i],
    ...patch,
    status: 'pending',
    review_note: undefined,
    updated_at: nowIso(),
  };
  rows[i] = next;
  write(KEYS.projects, rows);
  return next;
}

export async function reviewProject(
  id: string,
  status: ReviewStatus,
  note?: string
): Promise<AiProject | null> {
  const rows = read<AiProject>(KEYS.projects, seedProjects);
  const i = rows.findIndex(p => p.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], status, review_note: note, updated_at: nowIso() };
  write(KEYS.projects, rows);
  return rows[i];
}

export async function deleteProject(id: string): Promise<void> {
  const rows = read<AiProject>(KEYS.projects, seedProjects).filter(p => p.id !== id);
  write(KEYS.projects, rows);
}

// ── posts ──────────────────────────────────────────────────────────────────

export async function listPosts(kind?: Post['kind']): Promise<Post[]> {
  const rows = read<Post>(KEYS.posts, seedPosts);
  const filtered = kind ? rows.filter(p => p.kind === kind) : rows;
  return filtered.sort((a, b) => b.date.localeCompare(a.date));
}

/** 新建活动 / 成果 / 公告。任何登录成员都可以发，编辑人记在 edited_by。 */
export async function createPost(
  input: Omit<Post, 'id' | 'created_at' | 'updated_at'>
): Promise<Post> {
  const rows = read<Post>(KEYS.posts, seedPosts);
  const post: Post = { ...input, id: newId(), created_at: nowIso(), updated_at: nowIso() };
  rows.push(post);
  write(KEYS.posts, rows);
  return post;
}

export async function updatePost(
  id: string,
  patch: Partial<Omit<Post, 'id' | 'created_at'>>
): Promise<Post | null> {
  const rows = read<Post>(KEYS.posts, seedPosts);
  const i = rows.findIndex(p => p.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updated_at: nowIso() };
  write(KEYS.posts, rows);
  return rows[i];
}

export async function deletePost(id: string): Promise<void> {
  write(
    KEYS.posts,
    read<Post>(KEYS.posts, seedPosts).filter(p => p.id !== id)
  );
}

// ── resources（学习资料）────────────────────────────────────────────────────

/** 资料与帖子的过滤逻辑一样，抽出来共用，免得两处各写一遍走偏。 */
function filterContent<T extends { status: ReviewStatus; origin?: SubmissionOrigin; author_id?: string; created_at: string }>(
  rows: T[],
  query: ContentQuery,
  searchable: (row: T) => string
): T[] {
  let out = rows;
  if (query.status) out = out.filter(r => r.status === query.status);
  if (query.origins) out = out.filter(r => query.origins!.includes(r.origin ?? 'member'));
  if (query.authorId) out = out.filter(r => r.author_id === query.authorId);
  if (query.keyword?.trim()) {
    const q = query.keyword.trim().toLowerCase();
    out = out.filter(r => searchable(r).toLowerCase().includes(q));
  }
  return [...out].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listResources(query: ContentQuery = {}): Promise<Resource[]> {
  return filterContent(
    read<Resource>(KEYS.resources, seedResources),
    query,
    r => `${r.title} ${r.summary} ${r.tags.join(' ')} ${r.level}`
  );
}

export async function createResource(
  input: Omit<Resource, 'id' | 'status' | 'created_at' | 'updated_at'>
): Promise<Resource> {
  const rows = read<Resource>(KEYS.resources, seedResources);
  const row: Resource = {
    ...input,
    id: newId(),
    status: 'pending',
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  rows.push(row);
  write(KEYS.resources, rows);
  return row;
}

export async function reviewResource(
  id: string,
  status: ReviewStatus,
  note?: string
): Promise<void> {
  const rows = read<Resource>(KEYS.resources, seedResources);
  const i = rows.findIndex(r => r.id === id);
  if (i < 0) return;
  rows[i] = { ...rows[i], status, review_note: note, updated_at: nowIso() };
  write(KEYS.resources, rows);
}

export async function deleteResource(id: string): Promise<void> {
  write(
    KEYS.resources,
    read<Resource>(KEYS.resources, seedResources).filter(r => r.id !== id)
  );
}

// ── forum（AI 论坛）─────────────────────────────────────────────────────────

export async function listForumPosts(query: ContentQuery = {}): Promise<ForumPost[]> {
  return filterContent(
    read<ForumPost>(KEYS.forum, seedForumPosts),
    query,
    p => `${p.title} ${p.body} ${p.category}`
  );
}

export async function getForumPost(id: string): Promise<ForumPost | null> {
  return read<ForumPost>(KEYS.forum, seedForumPosts).find(p => p.id === id) ?? null;
}

export async function createForumPost(
  input: Omit<ForumPost, 'id' | 'status' | 'created_at' | 'updated_at'>
): Promise<ForumPost> {
  const rows = read<ForumPost>(KEYS.forum, seedForumPosts);
  const row: ForumPost = {
    ...input,
    id: newId(),
    status: 'pending',
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  rows.push(row);
  write(KEYS.forum, rows);
  return row;
}

export async function reviewForumPost(
  id: string,
  status: ReviewStatus,
  note?: string
): Promise<void> {
  const rows = read<ForumPost>(KEYS.forum, seedForumPosts);
  const i = rows.findIndex(p => p.id === id);
  if (i < 0) return;
  rows[i] = { ...rows[i], status, review_note: note, updated_at: nowIso() };
  write(KEYS.forum, rows);
}

export async function deleteForumPost(id: string): Promise<void> {
  write(
    KEYS.forum,
    read<ForumPost>(KEYS.forum, seedForumPosts).filter(p => p.id !== id)
  );
  // 帖子没了，评论也别留成孤儿
  write(
    KEYS.comments,
    read<ForumComment>(KEYS.comments, seedComments).filter(c => c.post_id !== id)
  );
}

// ── forum_comments ─────────────────────────────────────────────────────────

export async function listComments(postId: string): Promise<ForumComment[]> {
  return read<ForumComment>(KEYS.comments, seedComments)
    .filter(c => c.post_id === postId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function countComments(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  read<ForumComment>(KEYS.comments, seedComments).forEach(c => {
    m.set(c.post_id, (m.get(c.post_id) ?? 0) + 1);
  });
  return m;
}

/** 评论不进审核队列 —— 未登录访客也能评，这是「外部访问只能评论」的实现点。 */
export async function createComment(
  input: Omit<ForumComment, 'id' | 'created_at'>
): Promise<ForumComment> {
  const rows = read<ForumComment>(KEYS.comments, seedComments);
  const row: ForumComment = { ...input, id: newId(), created_at: nowIso() };
  rows.push(row);
  write(KEYS.comments, rows);
  return row;
}

export async function deleteComment(id: string): Promise<void> {
  write(
    KEYS.comments,
    read<ForumComment>(KEYS.comments, seedComments).filter(c => c.id !== id)
  );
}

// ── tool_links ─────────────────────────────────────────────────────────────

/**
 * 工具导航按 sort 再按名称排。没有审核状态 —— 这是社团自己维护的索引，
 * 不接受外部投稿，所以前台和后台读的是同一份数据，不存在「待审」中间态。
 */
export async function listToolLinks(): Promise<ToolLink[]> {
  return read<ToolLink>(KEYS.tools, seedToolLinks)
    .slice()
    .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || a.name.localeCompare(b.name));
}

export async function createToolLink(
  input: Omit<ToolLink, 'id' | 'created_at' | 'updated_at'>
): Promise<ToolLink> {
  const rows = read<ToolLink>(KEYS.tools, seedToolLinks);
  const row: ToolLink = { ...input, id: newId(), created_at: nowIso(), updated_at: nowIso() };
  rows.push(row);
  write(KEYS.tools, rows);
  return row;
}

export async function updateToolLink(
  id: string,
  patch: Partial<Omit<ToolLink, 'id' | 'created_at'>>
): Promise<ToolLink | null> {
  const rows = read<ToolLink>(KEYS.tools, seedToolLinks);
  const i = rows.findIndex(t => t.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updated_at: nowIso() };
  write(KEYS.tools, rows);
  return rows[i];
}

export async function deleteToolLink(id: string): Promise<void> {
  write(
    KEYS.tools,
    read<ToolLink>(KEYS.tools, seedToolLinks).filter(t => t.id !== id)
  );
}

// ── messages ───────────────────────────────────────────────────────────────

/** 留言列表。默认新的在前 —— 待办队列就该先看最新的。 */
export async function listMessages(status?: MessageStatus): Promise<Message[]> {
  const rows = read<Message>(KEYS.messages, seedMessages);
  const filtered = status ? rows.filter(m => m.status === status) : rows;
  return filtered.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** 官网访客提交。不需要登录，落库即为待处理。 */
export async function createMessage(
  input: Pick<Message, 'name' | 'email' | 'body'>
): Promise<Message> {
  const rows = read<Message>(KEYS.messages, seedMessages);
  const row: Message = {
    id: newId(),
    name: input.name.trim(),
    email: input.email.trim(),
    body: input.body.trim(),
    status: 'new',
    created_at: nowIso(),
  };
  rows.push(row);
  write(KEYS.messages, rows);
  return row;
}

/**
 * 标记处理结果。`handledBy` 记处理人姓名 —— 谁都能处理，不留痕就说不清是谁点的。
 * 重新标回 new 时把处理记录一并清掉，否则会留下「待处理但显示某人已处理」的脏数据。
 */
export async function markMessage(
  id: string,
  status: MessageStatus,
  handledBy?: string
): Promise<void> {
  const rows = read<Message>(KEYS.messages, seedMessages);
  const i = rows.findIndex(m => m.id === id);
  if (i < 0) return;
  rows[i] =
    status === 'new'
      ? { ...rows[i], status, handled_by: undefined, handled_at: undefined }
      : { ...rows[i], status, handled_by: handledBy, handled_at: nowIso() };
  write(KEYS.messages, rows);
}

export async function deleteMessage(id: string): Promise<void> {
  write(
    KEYS.messages,
    read<Message>(KEYS.messages, seedMessages).filter(m => m.id !== id)
  );
}

/** 演示用：清空本地数据回到种子状态。 */
export function resetLocalData(): void {
  if (!isBrowser()) return;
  Object.values(KEYS).forEach(k => window.localStorage.removeItem(k));
}
