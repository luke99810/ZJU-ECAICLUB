/**
 * 小艾的密钥配置接口。
 *
 *   GET  → 报告当前是否已配置（只回状态，绝不回 key 本身）
 *   POST → 把 key 写进 .env.local
 *
 * ⚠️ **POST 只在本地开发时开放**（`NODE_ENV !== 'production'`）。两个原因：
 *
 *   1. 这个演示版没有服务端鉴权 —— 前端那套登录是浏览器里跑的，服务端无从验证
 *      «你真的是管理员»。线上开着它，等于让任何人都能改站点的 AI 密钥、
 *      把社团的额度指到别处，或者把请求引到自己的服务器。
 *   2. Cloudflare Pages 的文件系统只读，写 .env.local 本来也不会成功。
 *
 * 所以线上正确的配置方式是 Cloudflare 控制台的环境变量；后台那一页会照实说明。
 * 等接了 Supabase Auth（服务端能验管理员身份）再把这条打开也不迟。
 *
 * ## 为什么 fs / path 是动态 import
 *
 * 这个文件要能在 **Cloudflare Pages 的边缘运行时**里被打包 —— 那里没有 Node API，
 * 顶层 `import 'node:fs'` 会直接让构建失败。而 fs 只在**本地开发的 POST 分支**里用到，
 * 所以挪进函数体按需加载：线上根本走不到那一行，也就不会去 require 它。
 */
import type { NextApiRequest, NextApiResponse } from 'next';

function mask(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** 只改目标键，其余行原样保留 —— 别把用户手写的注释和其他变量冲掉。 */
function upsertEnvLine(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  return content.replace(/\s*$/, '\n') + line + '\n';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const key = process.env.AI_API_KEY ?? '';
    return res.status(200).json({
      configured: Boolean(key),
      hint: key ? mask(key) : '',
      base: process.env.AI_API_BASE || 'https://api.siliconflow.cn/v1',
      model: process.env.AI_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
      // 前端据此决定「保存」按钮是显示还是换成「去控制台配」的说明。
      writable: process.env.NODE_ENV !== 'production',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: '只接受 GET / POST' });
  }

  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error:
        '线上不允许通过网页改密钥（这个接口没有服务端鉴权）。请在 Cloudflare Pages 的 Settings → Environment variables 里配置 AI_API_KEY。',
    });
  }

  const { apiKey, base, model } = (req.body ?? {}) as {
    apiKey?: unknown;
    base?: unknown;
    model?: unknown;
  };
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'apiKey 不能为空' });
  }

  try {
    // 只有本地开发会走到这里，此时一定在 Node 运行时，动态 import 是安全的
    const [fs, path] = await Promise.all([import('node:fs'), import('node:path')]);
    const ENV_FILE = path.join(process.cwd(), '.env.local');
    let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';
    content = upsertEnvLine(content, 'AI_API_KEY', apiKey.trim());
    if (typeof base === 'string' && base.trim()) {
      content = upsertEnvLine(content, 'AI_API_BASE', base.trim());
    }
    if (typeof model === 'string' && model.trim()) {
      content = upsertEnvLine(content, 'AI_MODEL', model.trim());
    }
    fs.writeFileSync(ENV_FILE, content, 'utf-8');
  } catch (err) {
    return res.status(500).json({ error: `写入 .env.local 失败：${(err as Error).message}` });
  }

  // Next 在启动时读取 .env.local，运行中改动不会自动生效。照实告诉用户要重启。
  return res.status(200).json({
    ok: true,
    notice: '已写入 .env.local。需要重启 dev server（Ctrl+C 后重新 npx next dev）才会生效。',
  });
}
