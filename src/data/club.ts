/**
 * 社团基本信息与介绍文案 —— 来自《浙江大学工程师学院人工智能俱乐部介绍》。
 *
 * 集中放一处的原因很实际：联系方式原来在页脚、联系页、招新页各写了一份，
 * 换个邮箱要改三个地方，改漏一个就长期挂着错的。
 *
 * 这里只放**不会经常变**的社团事实。会变的内容（新闻、成员、项目）走数据层。
 */

export const CLUB = {
  name: '浙江大学工程师学院人工智能俱乐部',
  shortName: '浙大工院 AIClub',
  enName: 'ZJU AIClub',
  /** 2018 年 3 月筹建，同年 6 月 10 日正式成立 */
  foundedAt: '2018-06-10',
  founded: '2018 年 6 月 10 日',
  affiliation: '浙江大学工程师学院团委领导，研究生会学术发展中心协管',

  /** 宗旨（社团原文，四个词） */
  motto: ['求知', '笃行', '协作', '创新'] as const,
  /** 核心使命（社团原文） */
  mission: ['学习前沿', '探索工具', '激发应用', '创造价值'] as const,
  /** 战略定位 */
  positioning:
    '聚焦最新 AI 技术与工具的落地应用，帮助同学从「会用」迈向「创用」，把 AI 嵌入学习与生活场景，提升效率、释放创造力。',
} as const;

export const CONTACT = {
  address: '浙江省杭州市拱墅区石祥路 269 号 浙江大学工程师学院',
  postcode: '310015',
  email: '22564006@zju.edu.cn',
} as const;

/**
 * 发展历程五阶段。社团这八年正好跨了 CNN → 大模型 → Agent 三代范式，
 * 所以时间线按「技术侧重点」讲，比按「办了几场活动」讲更能说明它在做什么。
 */
export interface Phase {
  index: string;
  name: string;
  span: string;
  milestone: string;
  tech: string;
}

export const PHASES: Phase[] = [
  {
    index: '01',
    name: '算法奠基期',
    span: '2018 – 2019',
    milestone: '2018.06.10 正式成立',
    tech: '传统深度学习（CV / NLP）：CNN、RNN、TensorFlow / PyTorch，Kaggle 竞赛起步。',
  },
  {
    index: '02',
    name: '工程深耕期',
    span: '2020 – 2022',
    milestone: '2020.01 独立公众号首文',
    tech: '竞赛与工程化：模型压缩、端侧部署、FPGA 与边缘计算，强调算法真正落地。',
  },
  {
    index: '03',
    name: '转型过渡期',
    span: '2022 – 2023',
    milestone: '独立号停更、社团重组',
    tech: '传统 CV / NLP 红利消退，是一段寻找新方向的技术空窗期。',
  },
  {
    index: '04',
    name: '大模型探索期',
    span: '2023 – 2024',
    milestone: '2023.05 转向生成式 AI',
    tech: '生成式 AI：LLM 基础、提示词工程，Transformer 与 Diffusion 概念普及。',
  },
  {
    index: '05',
    name: '智能体深化期',
    span: '2025 – 至今',
    milestone: '2026.05 重启独立品牌',
    tech: 'AI Agent 与科研赋能：RAG、MCP 协议、多模态工具链、Claude Code 等 Agent 实操。',
  },
];

/**
 * 四大核心职能，社团自己的说法是「学 – 练 – 产 – 管」闭环。
 */
export interface Duty {
  tag: string;
  title: string;
  desc: string;
}

export const DUTIES: Duty[] = [
  {
    tag: '学',
    title: '学术研究引领',
    desc: '追踪 AI 前沿动态，搭建高水平交流机制。例如「AI Agent 工具介绍与实践」分享会，直接上手 Claude Code 等前沿工具。',
  },
  {
    tag: '练',
    title: '创新实践孵化',
    desc: '对接学科竞赛与产业实战，项目驱动培养。从早期的 Kaggle 刷榜，转向结合工院特色的「AI+行业」方案，如智能物流、柔性直流输电。',
  },
  {
    tag: '产',
    title: '人才梯队建设',
    desc: '系统化选拔加「传帮带」，提升跨学科素质。成员背景多元，不限于计算机专业，契合工程师学院的交叉属性。',
  },
  {
    tag: '管',
    title: '社群生态运营',
    desc: '跨专业、跨年级整合资源。竞赛转入社群精细化运营，公开内容聚焦高价值的科研赋能，如 RAG 辅助论文写作、AI 绘图。',
  },
];

/**
 * 部门职责。
 *
 * 部门口径与社团介绍文档一致：技术部 / 组织部 / 宣传部，外加对应社长与副社长的
 * 管理层。改这里的名字时 `src/types` 的 DEPARTMENTS 词表要同步改，
 * 并且要升一版 members 的存储 key —— 旧数据里存的是旧部门名，不换 key 那些人
 * 会落进一个前台不再渲染的分组里。
 */
export const DEPARTMENT_INTRO: Array<{ name: string; duty: string; role: string }> = [
  {
    name: '管理层',
    duty: '统筹管理、活动策划、对外合作、品牌与财务',
    role: '社长 1 名 + 副社长 2 名，分管纳新外联与宣传财务',
  },
  { name: '技术部', duty: '技术保障、前沿探索、工程应用', role: '推动 AI 项目的开发与落地' },
  { name: '组织部', duty: '活动组织、团建规划、外联事务', role: '保障社团日常运转与文化建设' },
  { name: '宣传部', duty: '物料设计、账号运营、媒体创作', role: '扩大社团影响力与形象维护' },
];
