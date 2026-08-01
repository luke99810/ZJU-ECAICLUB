/**
 * Cloudflare Worker 入口。
 *
 * 站点走「静态资源 + 一个 Worker」的组合：
 *   - 页面整站静态导出（`out/`），由 Workers 的静态资源伺服直接发；
 *   - `/api/*` 由这个 Worker 处理 —— 它需要读密钥，不能放进浏览器。
 *
 * ## 为什么是这条路
 *
 * 试过两条官方路线都不通：
 *   - `@opennextjs/cloudflare` 要 Next ≥ 15.5，本项目是 14.2（升大版本风险太大）；
 *   - `@cloudflare/next-on-pages` 依赖 Vercel CLI，**在 Windows 上跑不起来**，
 *     没法在本地验证，只能靠构建机试错。
 *
 * 静态导出 + 自写 Worker 的好处是**每一步都能在本地跑通再推**：
 * `npx next build` 出 `out/`，`npx wrangler dev` 起本地边缘环境，
 * 行为与线上一致。代价是 Next 的服务端能力用不了 —— 但这个站点本来就
 * 全是客户端渲染，没有 getServerSideProps，等于没有代价。
 *
 * ## 与 src/lib/aiPrompts.ts 共用提示词
 *
 * 提示词只有一份，Worker 和本地开发的 API route 都从那里取，
 * 避免两处行为漂移（这个坑之前踩过）。
 */
import { buildChatRequest, isAiTask } from './src/lib/aiPrompts';

interface Env {
  /** 静态资源绑定，由 wrangler.jsonc 的 assets 配置注入 */
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  AI_API_KEY?: string;
  AI_API_BASE?: string;
  AI_MODEL?: string;
}

const DEFAULT_BASE = 'https://api.siliconflow.cn/v1';
const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

/** 单次输入上限，防止有人把整本书粘进来把免费额度烧光。 */
const MAX_INPUT = 6000;

const json = (body: unknown, status: number, extra?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });

function mask(key: string): string {
  return key.length <= 8 ? '****' : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** GET /api/ai-config —— 只报告是否已配置，**绝不回 key 本身**。 */
function aiConfig(env: Env): Response {
  const key = env.AI_API_KEY ?? '';
  return json(
    {
      configured: Boolean(key),
      hint: key ? mask(key) : '',
      base: env.AI_API_BASE || DEFAULT_BASE,
      model: env.AI_MODEL || DEFAULT_MODEL,
      // 线上一律不允许网页改密钥：这个接口没有服务端鉴权，
      // 开着等于任何人都能把社团的额度指到别处。改密钥请在 Cloudflare 控制台配。
      writable: false,
    },
    200
  );
}

/** POST /api/ai —— 中转到上游大模型，密钥只在这里出现。 */
async function aiProxy(req: Request, env: Env): Promise<Response> {
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

  const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    return json(
      {
        error:
          'AI 能力尚未配置：请在 Cloudflare 控制台 Settings → Variables and Secrets 里加 AI_API_KEY。',
      },
      503
    );
  }

  const base = (env.AI_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
  const model = env.AI_MODEL || DEFAULT_MODEL;

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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (pathname === '/api/ai') return aiProxy(req, env);
    if (pathname === '/api/ai-config') {
      return req.method === 'GET'
        ? aiConfig(env)
        : json({ error: '线上不允许通过网页改密钥，请在 Cloudflare 控制台配置' }, 403);
    }
    // 其余一律交给静态资源
    return env.ASSETS.fetch(req);
  },
};
