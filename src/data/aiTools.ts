/**
 * AI 写作助手的能力清单。
 *
 * 从「每个能力一个面板」改成「一个输入框 + 选能力」之后，这里只描述能力本身，
 * 输入框由 `AiWorkbench` 统一提供。
 *
 * 注意与 `/tools` 页区分：那一页是**外部工具导航**（只有链接，不提供能力），
 * 这里是站点自己提供的、面向成员写项目/写推文的几件事。
 */
import type { AiTask } from '../lib/ai';

export interface AiCapability {
  task: AiTask;
  title: string;
  /** 选中后显示在输入框上方的一句话，说清它会怎么处理你的内容。 */
  description: string;
  placeholder: string;
}

export const AI_CAPABILITIES: AiCapability[] = [
  {
    task: 'intro',
    title: '项目简介',
    description: '把项目要点写成一段适合放作品集的简介，120 字内。',
    placeholder:
      '例如：用 LangChain 做的校园问答 Agent，知识库是学院手册和选课规则，支持多轮追问和出处引用…',
  },
  {
    task: 'tags',
    title: '技术标签',
    description: '按内容从社团那套技术标签（LLM / Agent / RAG / MCP / Multimodal / NLP / CV / RL / Robot / Deployment）里挑最贴切的 1–3 个。',
    placeholder: '把项目简介粘进来，或上传项目文档…',
  },
  {
    task: 'polish',
    title: '润色',
    description: '理顺语句、去掉冗余、统一术语 —— 不改变原意，不添加原文没有的信息。',
    placeholder: '把你写好的技术推文或博客段落粘进来，或上传 Word / Markdown…',
  },
  {
    task: 'summarize',
    title: '摘要',
    description: '输出三到五条要点，只讲原文有的内容。适合读论文和长文档。',
    placeholder: '粘正文，或上传 PDF / Word…',
  },
  {
    task: 'keywords',
    title: '关键词',
    description: '抽出 5–10 个关键词，用顿号分隔。',
    placeholder: '粘一段文本，或上传文档…',
  },
];
