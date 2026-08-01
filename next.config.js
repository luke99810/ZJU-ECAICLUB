/** @type {import('next').NextConfig} */

// 静态导出只在 Cloudflare 构建时开（scripts/build-cf.mjs 会设这个变量）。
// 本地 `next dev` / `next build` 保持普通模式，API route 照常可用。
const isCloudflare = process.env.CF_BUILD === '1';

const nextConfig = {
  reactStrictMode: true,
  ...(isCloudflare
    ? {
        // 全站没有 getServerSideProps，数据都在客户端拉，所以能整站静态导出。
        // 产物 out/ 由 Workers 当静态资源伺服，/api/* 交给 worker.ts。
        output: 'export',
        images: { unoptimized: true },
      }
    : {}),
};

module.exports = nextConfig;
