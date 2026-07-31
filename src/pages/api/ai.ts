/**
 * AI 中转。前端只打这里，**密钥永远不出服务端**。
 *
 * 跑在 **Edge Runtime** 上（见文件末尾的 `config`）。这样同一份代码在
 * `next dev`、Node 部署、Cloudflare Pages 三种环境下行为一致 ——
 * 否则 Cloudflare 那边要靠 `functions/api/ai.ts` 另写一份，两份迟早漂移。
 *
 * Edge 的代价是用不了 Node API（fs / path 之类），但这个接口只需要 fetch，
 * 正好不受影响。
 *
 * 环境变量（本地写 `.env.local`，该文件已 gitignore；线上配在 Cloudflare 控制台）：
 *   AI_API_KEY   必填。硅基流动 / 通义千问 / DeepSeek / 豆包 任一，OpenAI 兼容即可。
 *   AI_API_BASE  可选，默认硅基流动。
 *   AI_MODEL     可选，默认 Qwen/Qwen2.5-7B-Instruct（免费额度内）。
 *
 * 没配 key 时返回 503 + 明确文案，前端据此显示配置引导，而不是弹一个红色报错。
 */
import { buildChatRequest, isAiTask } from '../../lib/aiPrompts';

const DEFAULT_BASE = 'https://api.siliconflow.cn/v1';
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

/** 单次输入上限，防止有人把整本书粘进来把免费额度烧光。 */
const MAX_INPUT = 6000;

const json = (body: unknown, status: number, extra?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: '只接受 POST' }, 405, { Allow: 'POST' });

  let payload: { task?: unknown; input?: unknown; context?: unknown; systemExtra?: unknown };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const { task, input, context, systemExtra } = payload ?? {};

  if (!isAiTask(task)) return json({ error: '未知的 task' }, 400);
  if (typeof input !== 'string' || !input.trim()) return json({ error: '输入不能为空' }, 400);
  if (input.length > MAX_INPUT) {
    return json({ error: `输入太长（${input.length} 字），请压到 ${MAX_INPUT} 字以内` }, 400);
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return json(
      {
        error:
          'AI 能力尚未配置：本地在 .env.local 填 AI_API_KEY，线上在 Cloudflare 控制台配同名环境变量后重新部署。',
      },
      503
    );
  }

  const base = (process.env.AI_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

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
      // 把上游状态码原样透出来：401 是 key 不对，429 是额度用光，一眼能分清。
      return json(
        { error: `上游返回 ${upstream.status}：${detail.slice(0, 300)}` },
        upstream.status
      );
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) return json({ error: '上游返回了空结果' }, 502);

    return json({ text }, 200);
  } catch (err) {
    return json({ error: `请求上游失败：${(err as Error).message}` }, 502);
  }
}

export const config = { runtime: 'edge' };
