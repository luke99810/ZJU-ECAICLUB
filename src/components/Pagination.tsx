/**
 * 分页。
 *
 * 只有一页时整个组件不渲染 —— 社团刚起步时内容少，不该让页面底下挂一个
 * 永远点不动的「1」。
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** 「共 N 个项目」里的量词。 */
  unit?: string;
}

/** 生成页码，中间用 … 省略，避免几十页时按钮铺满一屏。 */
function pageList(current: number, last: number): Array<number | '…'> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(last - 1, current + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < last - 1) out.push('…');
  out.push(last);
  return out;
}

export default function Pagination({ page, pageSize, total, onChange, unit = '条' }: PaginationProps) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;

  const btn =
    'inline-flex items-center justify-center min-w-[34px] h-[34px] px-2 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 mt-10" aria-label="分页">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
        aria-label="上一页"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pageList(page, last).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-gray-400 text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${btn} ${
              p === page
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= last}
        className={`${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
        aria-label="下一页"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <span className="ml-2 text-xs text-gray-400">
        共 {total} {unit} · 第 {page}/{last} 页
      </span>
    </nav>
  );
}
