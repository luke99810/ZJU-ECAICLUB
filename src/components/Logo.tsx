/**
 * 社团 Logo。
 *
 * 原图是**为深色背景画的**：「A」「Club」和机器人是白色，只有「I」和装饰是粉色。
 * 所以同一个 logo 备了两版笔画：
 *
 *   - `logo-mark.png` / `logo.png`         白色笔画，只能放深色底（首页 Hero）
 *   - `logo-mark-ink.png` / `logo-ink.png` 白色部分改成深蓝、粉色保留，放浅色底
 *
 * 页头、页脚、后台这些地方用浅蓝圆角底 + 深色笔画版：浅蓝比深色底更贴合原图的
 * 透明底质感，也和站点的蓝色主色一致；如果直接把白色笔画放浅蓝上会整个糊掉，
 * 所以必须配 ink 版，两者不能拆开用。
 */
interface LogoProps {
  /** 方块边长（px）。默认 40，对应页头。 */
  size?: number;
  /** 用含 Club 字样的完整版。只在 96px 以上才建议开，小了糊成一团。 */
  full?: boolean;
  /**
   * 不垫底色，直接放白色笔画的原图。**只在本来就是深色的背景上用**
   * （首页 Hero 那种），否则笔画会消失。
   */
  bare?: boolean;
  className?: string;
}

export default function Logo({ size = 40, full = false, bare = false, className = '' }: LogoProps) {
  const src = bare
    ? full
      ? '/logo.png'
      : '/logo-mark.png'
    : full
      ? '/logo-ink.png'
      : '/logo-mark-ink.png';

  const img = (
    <img
      src={src}
      alt="AI Club"
      width={bare ? size : Math.round(size * 0.84)}
      height={bare ? size : Math.round(size * 0.84)}
      className="object-contain"
    />
  );

  if (bare) return <span className={`inline-block shrink-0 ${className}`}>{img}</span>;

  return (
    <span
      className={`inline-grid place-items-center rounded-lg bg-blue-100 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {img}
    </span>
  );
}
