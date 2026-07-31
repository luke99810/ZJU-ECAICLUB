/**
 * 领域模型 —— 直接对应设计方案「五、数据表设计」的三张表。
 *
 * 字段刻意用 snake_case 对齐 Supabase 的默认列名，将来把 store 换成
 * Supabase client 时不需要在两套命名之间来回映射。
 */

/** **技术标签** —— 回答「用了什么技术」。作品集与成员档案共用一套。 */
export const AI_TAGS = [
  'LLM',
  'Agent',
  'RAG',
  'MCP',
  'Multimodal',
  'NLP',
  'CV',
  'RL',
  'Robot',
  'Deployment',
] as const;
export type AiTag = (typeof AI_TAGS)[number];

/**
 * **功能场景**标签 —— 回答「这东西能帮我干什么」。
 *
 * 与技术标签正交：找项目的人多半不是想找「用了什么模型」，而是想找
 * 「能帮我写论文的工具」。面向研究生群体，按实际使用场景切。
 */
export const FUNCTION_TAGS = [
  '内容创作',
  '图像视频生成',
  '数据挖掘',
  '智能对话',
  '代码开发',
  '科研辅助',
  '音频生成',
  '日常规划',
  '工程应用',
] as const;
export type FunctionTag = (typeof FUNCTION_TAGS)[number];

/** 项目审核状态。提交后默认 pending，审核通过才对外可见。 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/**
 * 项目来源。公开投稿（不用登录）按邮箱后缀自动判定：
 *   - `member`   —— 在册成员登录后台提交
 *   - `alumni`   —— 校友投稿：邮箱是学校域名（zju.edu.cn）但不在成员名单里
 *   - `external` —— 校外投稿：其他邮箱后缀
 *
 * 分这三档是因为审核权限不同：普通成员能审后两类，成员自己的项目要管理层把关。
 */
export type SubmissionOrigin = 'member' | 'alumni' | 'external';

export const ORIGIN_LABEL: Record<SubmissionOrigin, string> = {
  member: '社团成员',
  alumni: '校友投稿',
  external: '校外投稿',
};

export type MemberRole = 'member' | 'admin';

/**
 * 部门。**「管理层」等价于管理员** —— 部门与权限不再是两个可以互相矛盾的字段，
 * 录入时选了管理层就是 admin，其余部门就是 member（见 lib/auth.ts 的 addMember）。
 */
export const DEPARTMENTS = ['管理层', '技术部', '组织部', '宣传部'] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** 管理层部门名。判断「是不是管理员」时用它，别到处写字符串字面量。 */
export const ADMIN_DEPARTMENT: Department = '管理层';

/**
 * 现任 / 往届的分界：加入年份距今**超过这个数**就算往届。
 *
 * 1 表示「今年加入的是现任，往年加入的都是往届」，也就是每年 1 月自动滚一次。
 * 社团如果按两年一届算，把它改成 2 即可 —— 这是唯一需要改的地方。
 */
export const ACTIVE_YEARS = 1;

/**
 * 是否往届。**由加入年份推出来，不是一个手工勾选的字段** ——
 * 手工标记必然会忘记维护，名单每年都要有人挨个去改；用年份推则自动滚动。
 */
export function isAlumniMember(member: Pick<Member, 'joined_at'>, now = new Date()): boolean {
  const joinedYear = Number(member.joined_at.slice(0, 4));
  if (!Number.isFinite(joinedYear)) return false;
  return now.getFullYear() - joinedYear >= ACTIVE_YEARS;
}

/** 表 1：members —— 账号、姓名、部门、头像、权限、加入时间 */
export interface Member {
  id: string;
  email: string;
  /** 学号。登录标识之一，也是管理员新增成员时的初始口令。 */
  student_id: string;
  name: string;
  /** 部门：技术部 / 组织部 / 宣传部 … */
  department: string;
  avatar_url?: string;
  role: MemberRole;
  /**
   * 技术标签，取自固定词表，用来**按技术找人**（想找会 RAG 的就筛 RAG）。
   * 固定词表才筛得动，所以不做自由文本。
   */
  tags: AiTag[];
  /**
   * 兴趣方向，自由文本，如「智慧交通」「柔性直流输电」。
   *
   * 与 `tags` 是两回事：成员的研究方向常常落在那 10 个技术标签之外
   * （工程师学院本来就是交叉学科），只有固定词表会逼着人乱选一个凑数。
   */
  interests?: string;
  bio?: string;
  joined_at: string;

  // ── 口令（演示级，见 src/lib/password.ts 的告知）─────────────────
  /** 每账号独立的盐。首次设定口令时生成。 */
  password_salt?: string;
  /** SHA-256(salt:password)。绝不存明文。 */
  password_hash?: string;
  /**
   * 口令是否已由本人设定过。false 表示还在用出厂口令，登录后会提示去修改。
   */
  password_set?: boolean;
  /**
   * 引导管理员（建站时内置的那一个）。只有它的出厂口令是固定串 AICLUB.2026；
   * 后续由管理员录入的所有账号——包括管理员——出厂口令都是本人学号。
   */
  bootstrap_admin?: boolean;
}

/** 表 2：ai_projects —— 作品集核心表 */
export interface AiProject {
  id: string;
  title: string;
  summary: string;
  /** 技术栈，自由文本数组：PyTorch / Next.js / LangChain … */
  stack: string[];
  tags: AiTag[];
  /**
   * 功能场景标签。旧数据没有这个字段，所以是可选的 —— 读的地方一律
   * `p.functions ?? []`，避免为了加一个字段就把本地已有项目冲掉。
   */
  functions?: FunctionTag[];
  cover_url?: string;
  github_url?: string;
  /** 推文 / 博客链接 */
  blog_url?: string;
  paper_url?: string;

  // ── 投稿来源 ───────────────────────────────────────────────────
  /**
   * 来源。旧数据没有这个字段，读的地方一律 `p.origin ?? 'member'`。
   * 审核权限按它分档：普通成员只能审 alumni / external，
   * member 提交的必须由管理层审。
   */
  origin?: SubmissionOrigin;
  /** 成员投稿时是作者的 member.id；公开投稿没有这个字段。 */
  author_id?: string;
  /** 显示用的提交人姓名。成员是本人姓名，校外是投稿时填的名字。 */
  author_name: string;
  /** 校外投稿的单位 / 学校。 */
  submitter_org?: string;
  /**
   * 校外投稿的联系方式。**仅审核界面可见，绝不出现在对外页面** ——
   * 收集它只是为了必要时能回复投稿人。
   */
  submitter_contact?: string;
  status: ReviewStatus;
  /** 管理员驳回时填，作者能看到原因 */
  review_note?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 表 3：posts —— 社团新闻（活动 / 赛事成果 / 公告统一并入这里）。
 *
 * 原来「社团新闻」和「活动与成果」是两个页面，内容性质其实一样（都是社团动态），
 * 分两处只会让人不知道该发哪边。合并到 /news，用 kind 当分类筛选。
 */
export type PostKind = 'news' | 'activity' | 'award' | 'notice';

export const POST_KIND_LABEL: Record<PostKind, string> = {
  news: '新闻',
  activity: '活动',
  award: '赛事成果',
  notice: '公告',
};

export interface Post {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  cover_url?: string;
  /** 活动日期或获奖日期；公告用发布日 */
  date: string;
  /** 赛事成果专用：奖项名称 */
  award?: string;
  /** 外部链接：微信公众号推文、活动回顾、获奖公示页等。 */
  link_url?: string;
  /** 链接显示文案。留空时按 URL 自动推断（公众号 / 原文链接…）。 */
  link_label?: string;
  /** 最后编辑人 —— 谁都能改，所以要留痕。 */
  edited_by?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * 表 4：resources —— 学习资料。与项目共用「审核后发布 + 三档来源」那套规则。
 */
export const RESOURCE_LEVELS = ['入门', '进阶', '专项'] as const;
export type ResourceLevel = (typeof RESOURCE_LEVELS)[number];

export interface Resource {
  id: string;
  title: string;
  summary: string;
  /** 资料地址：课程、仓库、电子书、云盘链接都行。 */
  url: string;
  level: ResourceLevel;
  tags: AiTag[];
  origin?: SubmissionOrigin;
  author_id?: string;
  author_name: string;
  submitter_org?: string;
  submitter_contact?: string;
  status: ReviewStatus;
  review_note?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 表 5：forum_posts —— AI 论坛。发帖要审核；**评论不审核，且未登录访客也能评**
 * （社团要的是「外部访问只能评论」）。
 */
export const FORUM_CATEGORIES = ['问答', '分享', '讨论'] as const;
export type ForumCategory = (typeof FORUM_CATEGORIES)[number];

export interface ForumPost {
  id: string;
  title: string;
  body: string;
  category: ForumCategory;
  origin?: SubmissionOrigin;
  author_id?: string;
  author_name: string;
  submitter_contact?: string;
  status: ReviewStatus;
  review_note?: string;
  created_at: string;
  updated_at: string;
}

/** 表 6：forum_comments —— 评论。任何人可发，不进审核队列。 */
export interface ForumComment {
  id: string;
  post_id: string;
  body: string;
  author_name: string;
  /** 登录成员评论时带上，用于显示「成员」标记。 */
  author_id?: string;
  created_at: string;
}

/**
 * 表 7：tool_links —— AI 工具导航。
 *
 * 这是一份**外部**工具索引，本站不提供这些能力，只做分类与链接。原来写死在
 * `src/data/aiToolLinks.ts` 里，改一条要发一次版；挪进数据层后后台可直接维护。
 * 工具导航不涉及投稿，所以没有 origin / status —— 谁登录后都能改，删除留给管理员。
 */
export const TOOL_CATEGORIES = [
  '对话与写作',
  '代码',
  '绘画与设计',
  '论文与阅读',
  '音视频',
  '模型与部署',
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** free = 有可用的免费额度；trial = 仅试用；paid = 基本要付费。 */
export type ToolAccess = 'free' | 'trial' | 'paid';

export const TOOL_ACCESS_LABEL: Record<ToolAccess, { text: string; cls: string }> = {
  free: { text: '有免费额度', cls: 'bg-emerald-50 text-emerald-700' },
  trial: { text: '仅试用', cls: 'bg-amber-50 text-amber-700' },
  paid: { text: '需付费', cls: 'bg-gray-100 text-gray-600' },
};

export interface ToolLink {
  id: string;
  name: string;
  /** 一句话说清它解决什么问题，别抄官网标语。 */
  note: string;
  url: string;
  category: ToolCategory;
  access: ToolAccess;
  /** 国内直连是否顺畅 —— 学生最关心的一点。 */
  cnFriendly?: boolean;
  /** 排序权重，越小越靠前；同权重按创建时间。 */
  sort?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 表 8：messages —— 官网「联系我们」的留言。
 *
 * 与三类投稿的**审核**不是一回事：留言不需要「通过后公开」，它压根不对外展示，
 * 只是一个待办队列。所以状态是 new / handled / ignored，不是 pending / approved。
 * 所有登录成员都能看和处理 —— 留言积压比误处理更糟。
 */
export type MessageStatus = 'new' | 'handled' | 'ignored';

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  new: '待处理',
  handled: '已处理',
  ignored: '已忽略',
};

export interface Message {
  id: string;
  name: string;
  email: string;
  body: string;
  status: MessageStatus;
  /** 处理人姓名，留痕用 —— 谁都能处理，所以要知道是谁点的。 */
  handled_by?: string;
  handled_at?: string;
  created_at: string;
}

/** 三类可投稿内容的统称，审核页按它分 tab。 */
export type ContentKind = 'project' | 'resource' | 'forum';

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  project: '项目共享',
  resource: '学习资料',
  forum: 'AI 论坛',
};

/** 当前登录态。未登录为 null。 */
export type Session = { member: Member } | null;
