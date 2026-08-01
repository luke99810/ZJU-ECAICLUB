/**
 * Cloudflare 构建：整站静态导出到 out/。
 *
 * 为什么要个脚本而不是直接 `next build`：
 *
 * `output: 'export'` **不允许 API route 存在**（Next 会直接报错）。但本地开发
 * 又需要 `src/pages/api/ai.ts` —— 少了它 `next dev` 就调不到 AI，写作助手和
 * 小艾都没法在本地试。
 *
 * 所以两边都要：构建时把 api 目录临时挪走，构建完再挪回来。
 * 线上那条 `/api/*` 由 `worker.ts` 接管，逻辑与 API route 共用同一份
 * `src/lib/aiPrompts.ts`，不会漂移。
 *
 * finally 里一定要挪回来 —— 构建失败时目录留在外面，下次 `next dev` 就少了接口，
 * 而且很难联想到是上一次构建没收尾。
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const API_DIR = 'src/pages/api';
const STASH = '.api-stash';

const hasApi = existsSync(API_DIR);

if (hasApi) {
  rmSync(STASH, { recursive: true, force: true });
  mkdirSync(STASH, { recursive: true });
  renameSync(API_DIR, `${STASH}/api`);
  console.log('· 已临时移出 src/pages/api（静态导出不允许 API route）');
}

try {
  rmSync('.next', { recursive: true, force: true });
  rmSync('out', { recursive: true, force: true });
  execSync('npx next build', { stdio: 'inherit', env: { ...process.env, CF_BUILD: '1' } });
  console.log('· 静态站点已导出到 out/');
} finally {
  if (hasApi) {
    renameSync(`${STASH}/api`, API_DIR);
    rmSync(STASH, { recursive: true, force: true });
    console.log('· 已还原 src/pages/api');
  }
}
