/**
 * 极简图表组件：折线图 / 柱状图 / 环形图，纯 SVG 手绘，**零依赖**。
 *
 * 为什么不装 recharts / chart.js：这三种图加起来两百来行，而图表库要拖进 100KB+，
 * 而且这个项目已经因为 `lucide-react` 大版本删接口把整站打成过 500 —— 后台统计这种
 * 非核心功能，不值得再多背一个可能突然变脸的依赖。等要做交互式钻取再换不迟。
 *
 * 三个图都用 viewBox 缩放，父容器给宽度就行；配色统一走 PALETTE，
 * 免得每个图各配一套颜色，看起来像三个不同的产品拼在一起。
 */

/** 统一配色。顺序即取色顺序，前四个对应最常出现的四类内容。 */
export const PALETTE = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

export interface Series {
  name: string;
  color?: string;
  /** 与 labels 一一对应 */
  values: number[];
}

/** 没有数据时统一显示这块，而不是画一张空坐标系让人以为图挂了。 */
function Empty({ hint }: { hint: string }) {
  return (
    <div className="h-48 grid place-items-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
      {hint}
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

interface AxisChartProps {
  labels: string[];
  series: Series[];
  height?: number;
  /** 纵轴单位后缀，如「条」。只在提示文本里出现。 */
  unit?: string;
}

/**
 * 折线图。适合看**趋势**（累计增长、逐月新增）。
 * 多条线时自动出图例。
 */
export function LineChart({ labels, series, height = 200, unit = '' }: AxisChartProps) {
  if (labels.length === 0 || series.every(s => s.values.every(v => v === 0))) {
    return <Empty hint="这个时间范围内没有数据" />;
  }

  const W = 640;
  const H = height;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = niceMax(Math.max(...series.flatMap(s => s.values), 1));
  // 只有一个点时除数会是 0，退化成把点画在最左边
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));
  // 标签太密就隔几个显示一个，否则底部会糊成一团
  const labelStep = Math.ceil(labels.length / 8);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="趋势折线图">
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
              {t}
            </text>
          </g>
        ))}

        {series.map((s, si) => {
          const color = s.color ?? PALETTE[si % PALETTE.length];
          const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={color}>
                  <title>{`${labels[i]} · ${s.name} ${v}${unit}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {labels.map((l, i) =>
          i % labelStep === 0 ? (
            <text
              key={l}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-gray-400 text-[10px]"
            >
              {l}
            </text>
          ) : null
        )}
      </svg>

      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-2 justify-center">
          {series.map((s, si) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: s.color ?? PALETTE[si % PALETTE.length] }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 柱状图（单序列）。适合看**逐期的量**，比折线更能表达「这个月发了几条」。
 */
export function BarChart({ labels, series, height = 200, unit = '' }: AxisChartProps) {
  const s = series[0];
  if (!s || labels.length === 0 || s.values.every(v => v === 0)) {
    return <Empty hint="这个时间范围内没有数据" />;
  }

  const W = 640;
  const H = height;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = niceMax(Math.max(...s.values, 1));
  const slot = innerW / labels.length;
  const barW = Math.min(slot * 0.6, 36);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map(f => Math.round(max * f));
  const labelStep = Math.ceil(labels.length / 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="柱状图">
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
            {t}
          </text>
        </g>
      ))}

      {s.values.map((v, i) => {
        const cx = padL + slot * i + slot / 2;
        return (
          <g key={i}>
            <rect
              x={cx - barW / 2}
              y={y(v)}
              width={barW}
              height={Math.max(padT + innerH - y(v), v > 0 ? 2 : 0)}
              rx="3"
              fill={s.color ?? PALETTE[0]}
              opacity={v === 0 ? 0.15 : 1}
            >
              <title>{`${labels[i]} ${v}${unit}`}</title>
            </rect>
            {i % labelStep === 0 && (
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export interface Slice {
  name: string;
  value: number;
  color?: string;
}

/**
 * 环形图。适合看**构成比例**（部门分布、投稿来源）。
 * 用环而不是实心饼：中间能放总数，一眼知道基数多大 —— 只有比例没有基数容易误读。
 */
export function DonutChart({ slices, size = 180 }: { slices: Slice[]; size?: number }) {
  const data = slices.filter(s => s.value > 0);
  const total = data.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <Empty hint="暂无数据" />;

  const R = 70;
  const r = 44;
  const C = 100;

  // 只有一个分类时画不出扇形（起止角重合），直接画整环
  const single = data.length === 1;

  let angle = -Math.PI / 2;
  const paths = data.map((s, i) => {
    const frac = s.value / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const color = s.color ?? PALETTE[i % PALETTE.length];
    if (single) {
      return { d: '', color, s, frac, ring: true };
    }
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, ang: number) => `${C + rad * Math.cos(ang)},${C + rad * Math.sin(ang)}`;
    const d = [
      `M${p(R, a0)}`,
      `A${R},${R} 0 ${large} 1 ${p(R, a1)}`,
      `L${p(r, a1)}`,
      `A${r},${r} 0 ${large} 0 ${p(r, a0)}`,
      'Z',
    ].join(' ');
    return { d, color, s, frac, ring: false };
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg
        viewBox="0 0 200 200"
        style={{ width: size, height: size }}
        className="shrink-0"
        role="img"
        aria-label="构成环形图"
      >
        {paths.map(p =>
          p.ring ? (
            <g key={p.s.name}>
              <circle
                cx={C}
                cy={C}
                r={(R + r) / 2}
                fill="none"
                stroke={p.color}
                strokeWidth={R - r}
              />
              <title>{`${p.s.name} ${p.s.value}`}</title>
            </g>
          ) : (
            <path key={p.s.name} d={p.d} fill={p.color}>
              <title>{`${p.s.name} ${p.s.value}（${Math.round(p.frac * 100)}%）`}</title>
            </path>
          )
        )}
        <text x={C} y={C - 2} textAnchor="middle" className="fill-gray-900 text-[26px] font-bold">
          {total}
        </text>
        <text x={C} y={C + 16} textAnchor="middle" className="fill-gray-400 text-[11px]">
          合计
        </text>
      </svg>

      <ul className="space-y-1.5 min-w-[8rem]">
        {paths.map(p => (
          <li key={p.s.name} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-gray-700 flex-grow">{p.s.name}</span>
            <span className="text-gray-900 font-medium">{p.s.value}</span>
            <span className="text-gray-400 text-xs w-9 text-right">
              {Math.round(p.frac * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
