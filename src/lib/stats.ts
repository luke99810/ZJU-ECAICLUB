/**
 * 后台统计。把各张表算成图表要的形状，页面只负责画。
 *
 * 两个刻意的选择：
 *
 * 1. **按月聚合**，不按天。社团一个月也就几条内容，按天画出来是一条贴着 0 的线，
 *    看不出任何东西。月份是这个数据量下唯一有意义的粒度。
 * 2. **趋势图用累计值**，柱状图用当期新增。累计能看出「盘子在长」，
 *    新增能看出「哪个月在发力」，两个问题都有人问，所以两张图都画。
 *
 * 时间筛选的作用范围：**所有跟"内容"有关的统计都跟着筛**（累计、新增、来源构成、
 * 贡献榜），只有「成员部门分布」始终看全量 —— 那是人员现状，跟选了几个月没关系。
 */
import { listForumPosts, listMembers, listMessages, listPosts, listProjects, listResources, listToolLinks } from './store';
import { isAlumniMember, ORIGIN_LABEL, type SubmissionOrigin } from '../types';

/** 时间范围选项。`0` 表示全部。 */
export const RANGES = [
  { key: 6, label: '近 6 个月' },
  { key: 12, label: '近 12 个月' },
  { key: 24, label: '近 2 年' },
  { key: 0, label: '全部' },
] as const;

export type RangeKey = (typeof RANGES)[number]['key'];

export interface Totals {
  members: number;
  activeMembers: number;
  projects: number;
  resources: number;
  forumPosts: number;
  tools: number;
  posts: number;
  messagesNew: number;
}

/** 内容贡献者。三类内容分开计，页面上可按类型切换排序。 */
export interface Contributor {
  /** 分组键：登录成员用 member.id，公开投稿只能按姓名归并 */
  key: string;
  name: string;
  origin: SubmissionOrigin;
  total: number;
  project: number;
  resource: number;
  forum: number;
}

export interface Stats {
  totals: Totals;
  /** 月份标签，形如 2026-03 */
  months: string[];
  /** 累计量，与 months 对齐 */
  cumulative: { projects: number[]; resources: number[]; forum: number[] };
  /** 当月新增总量（三类内容相加） */
  monthlyNew: number[];
  /** 成员部门分布（现任） */
  byDepartment: Array<{ name: string; value: number }>;
  /** 投稿来源分布（三类内容合计） */
  byOrigin: Array<{ name: string; value: number }>;
  /** 内容贡献榜，按总数降序。页面自己截断成 TOP N。 */
  contributors: Contributor[];
}

const ym = (iso: string) => iso.slice(0, 7);

/** 生成从 start 到当前月的连续月份，缺月要补 0，否则折线会把空月直接跳过。 */
function monthRange(earliest: string, months: number): string[] {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  let start: Date;
  if (months > 0) {
    start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1);
  } else {
    const [y, m] = earliest.split('-').map(Number);
    start = Number.isFinite(y) ? new Date(y, (m || 1) - 1, 1) : end;
  }
  const out: string[] = [];
  const cur = new Date(start);
  // 上限兜底：数据里出现异常早的日期时不至于生成上万个月份把页面卡死
  while (cur <= end && out.length < 120) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export async function getStats(range: RangeKey): Promise<Stats> {
  const [members, projects, resources, forum, tools, posts, messages] = await Promise.all([
    listMembers(),
    listProjects(),
    listResources(),
    listForumPosts(),
    listToolLinks(),
    listPosts(),
    listMessages(),
  ]);

  // 只统计已通过的内容 —— 待审和被驳回的算进去，图会比实际公开的内容多出一截
  const okProjects = projects.filter(p => p.status === 'approved');
  const okResources = resources.filter(r => r.status === 'approved');
  const okForum = forum.filter(f => f.status === 'approved');

  const allDates = [...okProjects, ...okResources, ...okForum].map(x => ym(x.created_at)).sort();
  const months = monthRange(allDates[0] ?? ym(new Date().toISOString()), range);
  const firstMonth = months[0];

  /** 某类内容到每个月末的累计条数 */
  const cumulate = (rows: Array<{ created_at: string }>): number[] => {
    const byMonth = new Map<string, number>();
    rows.forEach(r => {
      const k = ym(r.created_at);
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    });
    // 起点要带上时间窗之前已有的存量，否则近 6 个月的图会从 0 开始，
    // 看起来像社团半年前才成立。
    let acc = rows.filter(r => ym(r.created_at) < firstMonth).length;
    return months.map(m => {
      acc += byMonth.get(m) ?? 0;
      return acc;
    });
  };

  const countPerMonth = (rows: Array<{ created_at: string }>): number[] => {
    const byMonth = new Map<string, number>();
    rows.forEach(r => {
      const k = ym(r.created_at);
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    });
    return months.map(m => byMonth.get(m) ?? 0);
  };

  const monthlyNew = months.map((_, i) =>
    countPerMonth(okProjects)[i] + countPerMonth(okResources)[i] + countPerMonth(okForum)[i]
  );

  // 时间窗内的内容 —— 来源构成与贡献榜都只看这一段，跟上面两张图口径一致
  const inRange = <T extends { created_at: string }>(rows: T[]) =>
    rows.filter(r => ym(r.created_at) >= firstMonth);

  const rangedProjects = inRange(okProjects);
  const rangedResources = inRange(okResources);
  const rangedForum = inRange(okForum);

  /**
   * 贡献榜。登录成员按 author_id 归并，公开投稿没有账号只能按姓名归并 ——
   * 同名的校外投稿人会被并到一起，这是没有账号体系时的必然妥协，不是 bug。
   */
  const contribMap = new Map<string, Contributor>();
  const tally = (
    rows: Array<{ author_id?: string; author_name: string; origin?: SubmissionOrigin }>,
    field: 'project' | 'resource' | 'forum'
  ) => {
    rows.forEach(r => {
      const name = r.author_name?.trim() || '匿名';
      const key = r.author_id ?? `name:${name}`;
      const cur =
        contribMap.get(key) ??
        ({
          key,
          name,
          origin: (r.origin ?? 'member') as SubmissionOrigin,
          total: 0,
          project: 0,
          resource: 0,
          forum: 0,
        } satisfies Contributor);
      cur[field] += 1;
      cur.total += 1;
      contribMap.set(key, cur);
    });
  };
  tally(rangedProjects, 'project');
  tally(rangedResources, 'resource');
  tally(rangedForum, 'forum');

  const active = members.filter(m => !isAlumniMember(m));
  const deptMap = new Map<string, number>();
  active.forEach(m => deptMap.set(m.department, (deptMap.get(m.department) ?? 0) + 1));

  const originMap = new Map<SubmissionOrigin, number>();
  [...rangedProjects, ...rangedResources, ...rangedForum].forEach(x => {
    const o = (x.origin ?? 'member') as SubmissionOrigin;
    originMap.set(o, (originMap.get(o) ?? 0) + 1);
  });

  return {
    totals: {
      members: members.length,
      activeMembers: active.length,
      projects: okProjects.length,
      resources: okResources.length,
      forumPosts: okForum.length,
      tools: tools.length,
      posts: posts.length,
      messagesNew: messages.filter(m => m.status === 'new').length,
    },
    months,
    cumulative: {
      projects: cumulate(okProjects),
      resources: cumulate(okResources),
      forum: cumulate(okForum),
    },
    monthlyNew,
    byDepartment: [...deptMap.entries()].map(([name, value]) => ({ name, value })),
    byOrigin: [...originMap.entries()].map(([o, value]) => ({ name: ORIGIN_LABEL[o], value })),
    contributors: [...contribMap.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
  };
}
