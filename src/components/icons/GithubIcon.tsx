/**
 * GitHub 标记。
 *
 * lucide-react 从 1.x 起移除了全部品牌图标（商标授权原因），`Github` 这个导出
 * 不再存在——直接 import 会拿到 undefined，渲染时报
 * 「Element type is invalid ... got: undefined」把整页打成 500。
 * 这里用官方 mark 的 SVG 路径自己补一个，接口与 lucide 图标保持一致
 * （吃 className、size、以及其余 svg 属性）。
 */
import type { SVGProps } from 'react';

interface GithubIconProps extends SVGProps<SVGSVGElement> {
  /** 与 lucide 一致的尺寸快捷写法；className 上的宽高优先级更高。 */
  size?: number | string;
}

export default function GithubIcon({ size = 24, ...props }: GithubIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58l-.01-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}
