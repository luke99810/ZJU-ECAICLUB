/**
 * AI 客服的检索层。
 *
 * 思路：**先检索、后回答**。把站内数据（项目 / 学习资料 / 论坛帖 / 新闻 / 成员 / 招新常识）
 * 里跟问题相关的条目挑出来，拼成一段资料喂给模型，同时把命中的条目作为可点击的
 * 结果卡返回。这样有两个好处：
 *
 *   1. 模型只依据站内真实数据作答，不会凭空编项目名；
 *   2. **没有 AI key 时仍然可用** —— 退化成纯关键词检索，照样能把项目和新闻找出来。
 *
 * 检索用的是朴素的词元重叠打分，不是向量。社团这个数据量（几十条）完全够用，
 * 且零依赖、零成本；等条目上千再考虑换 pgvector。
 */
import { listForumPosts, listMembers, listPosts, listProjects, listResources } from './store';
import { CLUB, CONTACT } from '../data/club';
import { isAlumniMember, POST_KIND_LABEL, type AiProject, type ForumPost, type Member, type Post, type Resource } from '../types';

/** 一条检索结果。`href` 有值时 UI 渲染成可点的链接卡。 */
export interface Hit {
  kind: '项目' | '资料' | '帖子' | '新闻' | '活动' | '赛事成果' | '公告' | '成员';
  title: string;
  snippet: string;
  href?: string;
  /** 命中分数，仅用于排序与调试 */
  score: number;
}

/**
 * 切词。中文没有空格，用 bigram（相邻两字）当词元 —— 对「找项目」「有没有 CV 的」
 * 这类短问句效果比单字好得多，也不用引入分词库。英文和数字按原样切。
 */
function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens: string[] = [];

  // 英文单词 / 数字 / 缩写
  for (const m of lower.matchAll(/[a-z0-9][a-z0-9+#.-]*/g)) tokens.push(m[0]);

  // 中文 bigram
  const cjk = lower.replace(/[^一-龥]/g, ' ');
  for (const run of cjk.split(/\s+/)) {
    if (run.length === 1) tokens.push(run);
    for (let i = 0; i + 1 < run.length; i++) tokens.push(run.slice(i, i + 2));
  }
  return tokens;
}

function score(query: string, ...fields: Array<string | undefined>): number {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  const hay = tokenize(fields.filter(Boolean).join(' '));
  if (hay.length === 0) return 0;
  const haySet = new Set(hay);
  let hitCount = 0;
  q.forEach(t => {
    if (haySet.has(t)) hitCount += 1;
  });
  // 归一化到 0–1，避免长文本单纯因为字多而胜出
  return hitCount / q.size;
}

/** 低于这个分数就认为不相关，不要硬凑结果糊弄人。 */
const MIN_SCORE = 0.12;
const MAX_HITS = 6;

export interface Retrieved {
  hits: Hit[];
  /** 拼好的资料，直接作为 qa/assistant 任务的 context。 */
  context: string;
}

export async function retrieve(query: string): Promise<Retrieved> {
  // 三类社区内容都只检索**已通过**的 —— 待审 / 被驳回的不该被客服说出去。
  const [projects, resources, forum, posts, members] = await Promise.all([
    listProjects({ status: 'approved' }),
    listResources({ status: 'approved' }),
    listForumPosts({ status: 'approved' }),
    listPosts(),
    listMembers(),
  ]);

  const hits: Hit[] = [];

  projects.forEach((p: AiProject) => {
    const s = score(query, p.title, p.summary, p.tags.join(' '), p.stack.join(' '), p.author_name);
    if (s >= MIN_SCORE) {
      hits.push({
        kind: '项目',
        title: p.title,
        snippet: `${p.summary}（作者 ${p.author_name}·标签 ${p.tags.join('/')}）`,
        href: '/community/projects',
        score: s,
      });
    }
  });

  resources.forEach((r: Resource) => {
    const s = score(query, r.title, r.summary, r.level, r.tags.join(' '));
    if (s >= MIN_SCORE) {
      hits.push({
        kind: '资料',
        title: r.title,
        snippet: `${r.level}　${r.summary}（推荐人 ${r.author_name}）`,
        href: '/community/resources',
        score: s,
      });
    }
  });

  forum.forEach((f: ForumPost) => {
    const s = score(query, f.title, f.body, f.category);
    if (s >= MIN_SCORE) {
      hits.push({
        kind: '帖子',
        title: f.title,
        snippet: `${f.category}　${f.body.slice(0, 80)}${f.body.length > 80 ? '…' : ''}`,
        href: '/community/forum',
        score: s,
      });
    }
  });

  // 新闻 / 活动 / 赛事成果 / 公告已合并进 posts 表，统一检索、统一指向 /news。
  posts.forEach((p: Post) => {
    const s = score(query, p.title, p.body, p.award);
    if (s >= MIN_SCORE) {
      hits.push({
        kind: POST_KIND_LABEL[p.kind] as Hit['kind'],
        title: p.title,
        snippet: `${p.date}　${p.body}`,
        href: '/news',
        score: s,
      });
    }
  });

  members.forEach((m: Member) => {
    // 成员只按姓名/方向/部门匹配，不把 bio 全文丢进去——避免问「有没有做 CV 的」
    // 时把所有人都捞出来。邮箱与学号绝不参与检索，也绝不进 context。
    const s = score(query, m.name, m.tags.join(' '), m.department, m.interests);
    if (s >= MIN_SCORE) {
      hits.push({
        kind: '成员',
        title: `${m.name}（${m.department}）`,
        snippet: `${m.interests ? `兴趣方向：${m.interests}　` : ''}技术标签：${m.tags.join('/') || '未标注'}${isAlumniMember(m) ? '·往届' : ''}`,
        href: '/team',
        score: s,
      });
    }
  });

  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, MAX_HITS);

  const context = [
    top.length
      ? top.map(h => `【${h.kind}】${h.title}\n${h.snippet}`).join('\n\n')
      : '（站内没有检索到与该问题直接相关的条目）',
    '',
    '【社团速查】',
    `- ${CLUB.name}（${CLUB.shortName} / ${CLUB.enName}），成立于 ${CLUB.founded}，${CLUB.affiliation}`,
    `- 宗旨：${CLUB.motto.join(' · ')}；使命：${CLUB.mission.join(' · ')}`,
    `- 定位：${CLUB.positioning}`,
    `- 地址：${CONTACT.address}（邮编 ${CONTACT.postcode}）；邮箱：${CONTACT.email}`,
    '',
    '【站点导航】',
    '- 开源社区：/community（三个板块：学习资料、项目共享、AI 论坛。任何人都能投稿，不用登录，审核通过后公开）',
    '- 项目共享：/community/projects（可按功能场景 内容创作/图像视频生成/数据挖掘/智能对话/代码开发/科研辅助/音频生成/日常规划/工程应用，或技术标签 LLM/Agent/RAG/MCP/Multimodal/NLP/CV/RL/Robot/Deployment 筛选）',
    '- 学习资料：/community/resources（按入门/进阶/专项分层）',
    '- AI 论坛：/community/forum（发帖需审核，评论不用审核，未登录也能评论）',
    '- 社团成员：/team（分管理层/技术部/宣传部/组织部，可按方向标签找人）',
    '- 社团新闻：/news（新闻、活动、赛事成果、公告都在这里）',
    '- 招新：/join（技术部/宣传部/组织部，不限年级专业，不考算法题）',
    '- 社团介绍：/about（成立背景、发展历程五阶段、四大职能、组织架构）',
    '- AI 工具导航：/tools（外部工具索引）',
    '- 成员后台：/admin（成员登录后提交项目）',
  ].join('\n');

  return { hits: top, context };
}
