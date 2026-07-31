/**
 * 各 AI 任务的提示词。
 *
 * 单独一个文件，是为了让 Next 的 API route 与 Cloudflare Function 共用同一套
 * 定义——两边只是运行时不同，行为必须一致，否则本地跑通、上线变样。
 */
export const AI_TASKS = [
  'intro',
  'polish',
  'summarize',
  'keywords',
  'tags',
  'functions',
  'qa',
  'assistant',
] as const;
export type AiTaskName = (typeof AI_TASKS)[number];

export const CLUB_TAGS = [
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

/** 功能场景标签，与 src/types 的 FUNCTION_TAGS 保持一致。 */
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

interface TaskSpec {
  system: string;
  /** 把用户输入包成最终 user 消息；context 是可选的补充材料（如知识库）。 */
  user: (input: string, context?: string) => string;
  maxTokens: number;
}

export const TASK_SPECS: Record<AiTaskName, TaskSpec> = {
  intro: {
    system:
      '你是技术社团的文案助手。根据给出的项目要点，写一段用于作品集展示的项目简介。' +
      '要求：中文，120 字以内，一段话，讲清楚"做什么、怎么做、有什么效果"。' +
      '不要用"本项目"开头的套话，不要吹嘘，不要编造数据。只输出简介正文。',
    user: input => `项目要点：\n${input}`,
    maxTokens: 400,
  },
  polish: {
    system:
      '你是中文技术写作编辑。润色用户给的文字：理顺语句、去掉冗余、统一术语，' +
      '但**不要改变原意，不要添加原文没有的信息**。保持原有的段落结构与语言（中文就用中文）。' +
      '只输出润色后的正文。',
    user: input => input,
    maxTokens: 1200,
  },
  summarize: {
    system:
      '你是论文与技术文章的摘要助手。用中文总结用户给的内容，输出三到五条要点，' +
      '每条一行、以「- 」开头。只讲原文有的内容，不要推测、不要补充背景。',
    user: input => input,
    maxTokens: 600,
  },
  keywords: {
    system:
      '从用户给的文本中提取关键词。输出 5 到 10 个，用中文顿号分隔，写成一行。' +
      '只输出关键词本身，不要编号、不要解释。',
    user: input => input,
    maxTokens: 200,
  },
  tags: {
    system:
      `你要为一个 AI 项目打方向标签。只能从这个固定列表里选：${CLUB_TAGS.join('、')}。` +
      '选最贴切的 1 到 3 个，用英文逗号分隔输出，**不要输出列表以外的词**，不要解释。',
    user: input => `项目描述：\n${input}`,
    maxTokens: 100,
  },
  functions: {
    system:
      `你要判断一个项目能帮使用者做什么。只能从这个固定列表里选：${FUNCTION_TAGS.join('、')}。` +
      '选最贴切的 1 到 3 个，用英文逗号分隔输出，**不要输出列表以外的词**，不要解释。' +
      '判断依据是「用户拿它能完成什么任务」，不是「它用了什么技术」。',
    user: input => `项目描述：
${input}`,
    maxTokens: 100,
  },
  /**
   * 站内 AI 客服。context 由 `lib/assistant.ts` 检索站内数据拼出，
   * 回答必须落在这些材料里 —— 客服编一个不存在的项目比不回答更糟。
   */
  assistant: {
    system:
      '你是 AI Club 社团官网的在线客服。只依据下面【站内资料】与【站点导航】回答访客问题，' +
      '可以引导他去对应页面（用 /projects 这样的路径，不要编造 URL）。' +
      '资料里没有的信息，直说「站内资料里没有，建议通过联系我们页面问社团」，**绝对不要编造**' +
      '项目名、成员名、日期或获奖情况。回答用中文，控制在 150 字以内，先给结论再给去哪看。' +
      '不要输出成员的邮箱或学号——那些不在你能看到的资料里，也不该由你透露。',
    user: (input, context) => `【站内资料】
${context ?? '（无）'}

访客问题：${input}`,
    maxTokens: 600,
  },
  qa: {
    system:
      '你是 AI 社团的问答助手。依据下面提供的社团资料回答问题。' +
      '资料里没有的，直接说"社团资料里没有写，建议联系社团负责人确认"，**不要编造**。' +
      '回答用中文，简洁、直接。',
    user: (input, context) =>
      `社团资料：\n${context?.trim() || '（暂未提供资料）'}\n\n问题：${input}`,
    maxTokens: 800,
  },
};

export function isAiTask(v: unknown): v is AiTaskName {
  return typeof v === 'string' && (AI_TASKS as readonly string[]).includes(v);
}

/** 构造 OpenAI 兼容的 chat/completions 请求体。硅基流动/通义/豆包都吃这套。 */
export function buildChatRequest(
  task: AiTaskName,
  input: string,
  context: string | undefined,
  model: string,
  /** 管理员在后台配置的角色设定，追加在系统提示词之后。 */
  systemExtra?: string
) {
  const spec = TASK_SPECS[task];
  const system = systemExtra?.trim()
    ? `${spec.system}

【补充设定】
${systemExtra.trim()}`
    : spec.system;
  return {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: spec.user(input, context) },
    ],
    max_tokens: spec.maxTokens,
    temperature: task === 'tags' || task === 'keywords' ? 0.2 : 0.6,
  };
}
