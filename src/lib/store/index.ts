/**
 * 数据访问层的门面：按环境变量在**本地演示**和**Supabase 真库**之间二选一。
 *
 * 页面一律 `import { listProjects } from '../lib/store'`，不知道也不需要知道
 * 背后是哪一套 —— 这是当初做接口隔离的兑现点。
 *
 * 为什么保留两套而不是一刀切换成 Supabase：
 *
 * - 没有环境变量时站点仍然完整可跑。换届交接、新人上手、临时演示给老师看，
 *   都不必先去开一个数据库；
 * - 建库过程中可以随时切回来对照行为；
 * - `.env.local` 不进版本库，clone 下来默认就是演示模式，不会因为缺配置白屏。
 *
 * 切换只看一件事：`NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * 是否都填了。填了就走真库，没填就走 localStorage。
 */
import { isSupabaseConfigured } from '../supabase';
import * as local from './local';
import * as remote from './supabase';

export type { ContentQuery, ProjectQuery } from './types';

/**
 * 编译期护栏：两套实现的导出必须完全同构。
 *
 * 少写一个函数、或者哪个函数的参数对不上，这一行就会报错 ——
 * 而不是等到线上切过去之后才发现「保存按钮点了没反应」。
 */
type Backend = typeof local;
const _typecheck: Backend = remote;
void _typecheck;

const impl: Backend = isSupabaseConfigured ? remote : local;

/** 当前是否在用真库。页面据此隐藏「重置演示数据」这类只对本地有意义的入口。 */
export const usingSupabase = isSupabaseConfigured;

export const listMembers = impl.listMembers;
export const getMemberByEmail = impl.getMemberByEmail;
export const getMemberByStudentId = impl.getMemberByStudentId;
export const upsertMember = impl.upsertMember;

export const listProjects = impl.listProjects;
export const getProject = impl.getProject;
export const createProject = impl.createProject;
export const updateProject = impl.updateProject;
export const reviewProject = impl.reviewProject;
export const deleteProject = impl.deleteProject;

export const listPosts = impl.listPosts;
export const createPost = impl.createPost;
export const updatePost = impl.updatePost;
export const deletePost = impl.deletePost;

export const listResources = impl.listResources;
export const createResource = impl.createResource;
export const reviewResource = impl.reviewResource;
export const deleteResource = impl.deleteResource;

export const listForumPosts = impl.listForumPosts;
export const getForumPost = impl.getForumPost;
export const createForumPost = impl.createForumPost;
export const reviewForumPost = impl.reviewForumPost;
export const deleteForumPost = impl.deleteForumPost;

export const listComments = impl.listComments;
export const countComments = impl.countComments;
export const createComment = impl.createComment;
export const deleteComment = impl.deleteComment;

export const listToolLinks = impl.listToolLinks;
export const createToolLink = impl.createToolLink;
export const updateToolLink = impl.updateToolLink;
export const deleteToolLink = impl.deleteToolLink;

export const listMessages = impl.listMessages;
export const createMessage = impl.createMessage;
export const markMessage = impl.markMessage;
export const deleteMessage = impl.deleteMessage;

export const resetLocalData = impl.resetLocalData;
