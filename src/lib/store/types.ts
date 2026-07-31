/**
 * 数据层的查询参数。
 *
 * 单独放一个文件，是因为**两套实现（local / supabase）都要用同一份定义** ——
 * 各写一份迟早会长歪，比如一边支持 keyword 另一边悄悄不支持，
 * 换后端时才发现搜索没反应。
 */
import type { ReviewStatus, SubmissionOrigin } from '../../types';

export interface ProjectQuery {
  /** 只要某个方向标签 */
  tag?: string;
  /** 只要某个审核状态；不传则不过滤（后台用） */
  status?: ReviewStatus;
  /** 只要某个作者的（「我的项目」用） */
  authorId?: string;
  /** 只要这些来源的；不传则都要。 */
  origins?: SubmissionOrigin[];
  /** 标题/简介模糊匹配 */
  keyword?: string;
}

/** 学习资料与论坛帖共用 —— 两者的过滤维度完全一样。 */
export interface ContentQuery {
  status?: ReviewStatus;
  origins?: SubmissionOrigin[];
  authorId?: string;
  keyword?: string;
}
