/**
 * 站点设置 —— 目前只有 AI 客服「小艾」的配置。
 *
 * 与业务数据一样走 store 那套：现在落 localStorage，接口形状照 Supabase 设计
 * （async、单行 upsert），将来换成 `site_settings` 表即可。
 *
 * 与数据层、登录层同一个套路：**配了 Supabase 就存 `site_settings` 表，
 * 没配就退回 localStorage**。
 *
 * 为什么必须进数据库：这些配置是**给访客看的**。只存在管理员浏览器里的话，
 * 管理员看到自己改的版本、访客看到代码里的默认值 —— 改了半天没生效，
 * 而且很难发现，因为改的人自己那边一切正常。
 */

import { db, explain, isSupabaseConfigured } from './supabase';

export interface AssistantSettings {
  /** 客服名字。默认「小艾」。 */
  name: string;
  /** 打开对话框时的第一句话。 */
  welcome: string;
  /** 追加到系统提示词后面的角色设定 —— 决定小艾的语气与边界。 */
  persona: string;
  /** 资料文档：社团制度、招新 FAQ、学习路线等，作答时作为依据。 */
  knowledge: string;
  /** 开场推荐的问题，一行一个。 */
  suggestions: string[];
}

export const DEFAULT_ASSISTANT: AssistantSettings = {
  name: '小艾',
  welcome:
    '你好，我是小艾，AI Club 的在线客服。可以问我社团情况、帮你找项目、查活动与新闻 —— 我只依据站内资料回答，不会瞎编。',
  persona:
    '语气友好、简洁，像一位热心的学长学姐。遇到拿不准的事就承认不知道，并引导对方去「联系我们」页面，不要含糊其辞。不要透露成员的邮箱、学号等个人信息。',
  knowledge: `【社团简介】
浙江大学工程师学院人工智能俱乐部（浙大工院 AIClub / ZJU AIClub），成立于 2018 年 6 月 10 日
（2018 年 3 月筹建），由浙江大学工程师学院团委领导、研究生会学术发展中心协管。
宗旨：求知 · 笃行 · 协作 · 创新。
使命：学习前沿 · 探索工具 · 激发应用 · 创造价值。
定位：聚焦最新 AI 技术与工具的落地应用，帮助同学从「会用」迈向「创用」。

【发展历程】
2018–2019 算法奠基期：传统深度学习（CNN/RNN、TensorFlow/PyTorch），Kaggle 竞赛起步。
2020–2022 工程深耕期：模型压缩、端侧部署、FPGA 与边缘计算，强调算法落地。
2022–2023 转型过渡期：传统 CV/NLP 红利消退，寻找新方向。
2023–2024 大模型探索期：LLM 基础、提示词工程，Transformer 与 Diffusion 普及。
2025 至今 智能体深化期：RAG、MCP 协议、多模态工具链、Claude Code 等 Agent 实操；
2026 年 5 月重启独立品牌。

【四大核心职能（学–练–产–管）】
学：追踪前沿、办分享会，如「AI Agent 工具介绍与实践」。
练：对接学科竞赛与产业实战，从 Kaggle 刷榜转向「AI+行业」方案（智能物流、柔性直流输电等）。
产：系统化选拔 +「传帮带」，成员背景多元，不限计算机专业。
管：跨专业跨年级资源整合，公开内容聚焦科研赋能（RAG 辅助论文写作、AI 绘图等）。

【部门设置】
管理层：社长 1 名、副社长 2 名（分管纳新外联、分管宣传财务），即网站的管理员账号。
技术部：技术保障、前沿探索、工程应用，连接 Kaggle / 天池等实战平台。
宣传部：物料设计、账号运营、媒体创作。
组织部：活动组织、团建规划、外联保障。

【联系方式】
地址：浙江省杭州市拱墅区石祥路 269 号 浙江大学工程师学院（邮编 310015）
邮箱：22564006@zju.edu.cn

【招新常见问题】
Q：需要什么基础？
A：不限年级专业，零基础也可以投技术部，说清楚想学什么方向即可。
Q：面试考什么？
A：不考算法题、不背概念。聊你做过什么、怎么想的。有作品最好，课程项目、小脚本都算。
Q：面试多久？
A：一轮，20 分钟左右，线上线下都行。

【怎么投稿到官网】
学习资料、项目共享、AI 论坛三类内容都能投，在 /community 页面点「我要投稿」，
不需要登录；社团成员登录 /admin 提交会自动带上身份。三类都要审核通过才公开。
论坛评论不审核，未登录也能直接评。`,
  suggestions: [
    '有哪些和 CV 相关的项目？',
    '社团怎么加入？',
    '最近有什么活动或获奖？',
    '想找做 Agent 的同学',
  ],
};

const KEY = 'aiclub:assistant-settings';
/** site_settings 表里的行键。以后加别的设置就再起一个键，不动表结构。 */
const ROW_KEY = 'assistant';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export async function getAssistantSettings(): Promise<AssistantSettings> {
  if (isSupabaseConfigured) {
    const { data, error } = await db()
      .from('site_settings')
      .select('value')
      .eq('key', ROW_KEY)
      .maybeSingle();
    // 读失败就用默认值：小艾少一点个性，总好过整个客服挂掉
    if (error) {
      console.error('[settings] 读取失败：', explain(error));
      return DEFAULT_ASSISTANT;
    }
    // 与默认值合并：以后加了新字段，库里的老记录也不会缺键
    return { ...DEFAULT_ASSISTANT, ...((data?.value as Partial<AssistantSettings>) ?? {}) };
  }

  if (!isBrowser()) return DEFAULT_ASSISTANT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ASSISTANT;
    const parsed = JSON.parse(raw) as Partial<AssistantSettings>;
    return { ...DEFAULT_ASSISTANT, ...parsed };
  } catch {
    return DEFAULT_ASSISTANT;
  }
}

export async function saveAssistantSettings(next: AssistantSettings): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await db()
      .from('site_settings')
      .upsert({ key: ROW_KEY, value: next, updated_at: new Date().toISOString() });
    // 保存失败必须抛：页面上那句「已保存」不能在没存进去时出现
    if (error) throw new Error(explain(error));
    return;
  }
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 配额满 / 隐私模式 */
  }
}

export async function resetAssistantSettings(): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await db().from('site_settings').delete().eq('key', ROW_KEY);
    if (error) throw new Error(explain(error));
    return;
  }
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY);
}
