/**
 * 让 `import '../styles/globals.css'` 这种副作用导入通过类型检查。
 *
 * Next 自带的 next-env.d.ts 只 reference 了 `next` 和 `next/image-types/global`，
 * 并不声明裸 CSS 导入；TypeScript 6 新增的 TS2882 会因此报错
 * （老版本 TS 不检查，所以以前没暴露）。Next 的构建管线本身能处理 CSS，
 * 这里只是补一条类型声明，让 `tsc --noEmit` 干净。
 */
declare module '*.css';
declare module '*.scss';
