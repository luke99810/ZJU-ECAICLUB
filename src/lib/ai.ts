/**
 * AI 工具的前端调用层。
 *
 * 前端永远只打自家的 `/api/ai`，密钥留在服务端 —— 方案里「用边缘函数中转，
 * 隐藏密钥、解决跨域」就是这个意思。本地跑的是 Next 的 API route
 * (`src/pages/api/ai.ts`)，部署到 Cloudflare Pages 时由 `functions/api/ai.ts`
 * 接管，两者请求/响应格式完全一致，前端无感。
 */

/** 方案「三、专为 AI Club 设计的免费 AI 功能」里点名的几件事。 */
export type AiTask =
  /** AI 项目简介生成器 */
  | 'intro'
  /** AI 推文/博客润色 */
  | 'polish'
  /** AI 文章总结 */
  | 'summarize'
  /** AI 关键词提取 */
  | 'keywords'
  /** AI 标签自动生成（限定在社团那套方向标签里选） */
  | 'tags'
  /** 功能场景标签自动生成（论文写作 / 文献查找 / …） */
  | 'functions'
  /** 社团知识库问答 */
  | 'qa'
  /** 站内 AI 客服（带检索出来的站内资料作答） */
  | 'assistant';

export interface AiRunResult {
  text: string;
}

/** 服务端明确告知「没配密钥」时抛这个，UI 据此显示引导而不是报错。 */
export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}

export async function runAi(
  task: AiTask,
  input: string,
  opts: { context?: string; systemExtra?: string; signal?: AbortSignal } = {}
): Promise<AiRunResult> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, input, context: opts.context, systemExtra: opts.systemExtra }),
    signal: opts.signal,
  });

  const body = await res.json().catch(() => ({}) as Record<string, unknown>);

  if (res.status === 503) {
    throw new AiNotConfiguredError(
      typeof body.error === 'string' ? body.error : 'AI 能力尚未配置。'
    );
  }
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `请求失败（${res.status}）`);
  }
  return { text: typeof body.text === 'string' ? body.text : '' };
}
