/**
 * ⚠️ **当前部署方式（next-on-pages）不会用到这个文件。**
 *
 * 它是「静态导出 + Pages Functions」那条路线的产物：那时 Next 的 API route 不能存在，
 * /api/ai 由这里接管。改用 next-on-pages 之后，`src/pages/api/ai.ts` 会被编译成
 * Pages Function，这个文件就不参与构建了。
 *
 * 保留它是因为万一 next-on-pages 在 Cloudflare 上跑不通，回退到静态导出时还要用。
 * **改 AI 接口逻辑请改 `src/pages/api/ai.ts`**，别改这里 —— 两份代码只有一份在跑。
 */
/**
 * AI 中转（Cloudflare Pages Function 版）。
 *
 * 与 `src/pages/api/ai.ts` 是同一份契约的两种运行时实现：
 * 本地 `next dev` 走 Next 的 API route，部署到 Cloudflare Pages 后由这个文件
 * 接管 `/api/ai`（Pages 的 Functions 路由优先于静态资源）。
 *
 * 密钥在 Cloudflare 控制台配成环境变量，不进代码库：
 *   AI_API_KEY / AI_API_BASE / AI_MODEL
 *
 * 提示词与请求构造从 `src/lib/aiPrompts.ts` 共用，避免两个运行时行为漂移。
 */
import { buildChatRequest, isAiTask } from '../../src/lib/aiPrompts';

interface Env {
  AI_API_KEY?: string;
  AI_API_BASE?: string;
  AI_MODEL?: string;
}

const DEFAULT_BASE = 'https://api.siliconflow.cn/v1';
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';
const MAX_INPUT = 6000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const onRequestPost = async (ctx: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  let payload: { task?: unknown; input?: unknown; context?: unknown; systemExtra?: unknown };
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const { task, input, context, systemExtra } = payload;
  if (!isAiTask(task)) return json({ error: '未知的 task' }, 400);
  if (typeof input !== 'string' || !input.trim()) return json({ error: '输入不能为空' }, 400);
  if (input.length > MAX_INPUT) {
    return json({ error: `输入太长（${input.length} 字），请压到 ${MAX_INPUT} 字以内` }, 400);
  }

  const apiKey = ctx.env.AI_API_KEY;
  if (!apiKey) {
    return json(
      {
        error:
          'AI 能力尚未配置：请在 Cloudflare Pages 的 Settings → Environment variables 里加上 AI_API_KEY。',
      },
      503
    );
  }

  const base = (ctx.env.AI_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
  const model = ctx.env.AI_MODEL || DEFAULT_MODEL;

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildChatRequest(
          task,
          input,
          typeof context === 'string' ? context : undefined,
          model,
          typeof systemExtra === 'string' ? systemExtra.slice(0, 2000) : undefined
        )
      ),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return json({ error: `上游返回 ${upstream.status}：${detail.slice(0, 300)}` }, upstream.status);
    }

    const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) return json({ error: '上游返回了空结果' }, 502);
    return json({ text });
  } catch (err) {
    return json({ error: `请求上游失败：${(err as Error).message}` }, 502);
  }
};
