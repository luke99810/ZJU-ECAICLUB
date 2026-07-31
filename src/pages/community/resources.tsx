/**
 * 学习资料 —— 开源社区三大板块之一。任何人可推荐，审核通过后展示。
 */
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, Search } from 'lucide-react';
import Layout from '../../components/Layout';
import Pagination from '../../components/Pagination';
import SubmitContentModal from '../../components/SubmitContentModal';
import { listResources } from '../../lib/store';
import {
  AI_TAGS,
  ORIGIN_LABEL,
  RESOURCE_LEVELS,
  type Resource,
  type SubmissionOrigin,
} from '../../types';

const PAGE_SIZE = 12;

const LEVEL_STYLE: Record<string, string> = {
  入门: 'bg-emerald-50 text-emerald-700',
  进阶: 'bg-amber-50 text-amber-700',
  专项: 'bg-rose-50 text-rose-700',
};

export default function ResourcesPage() {
  const [rows, setRows] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('');
  const [tag, setTag] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [showSubmit, setShowSubmit] = useState(false);

  const load = () =>
    listResources({ status: 'approved' })
      .then(setRows)
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return rows.filter(r => {
      if (level && r.level !== level) return false;
      if (tag && !r.tags.includes(tag as never)) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q);
    });
  }, [rows, level, tag, keyword]);

  useEffect(() => setPage(1), [level, tag, keyword]);
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const chip = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-sm transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
    }`;

  return (
    <Layout>
      <section className="pt-24 pb-16 bg-gradient-to-b from-blue-50 to-white min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">学习资料</h1>
              <p className="text-gray-600 max-w-2xl">
                社团整理与推荐的课程、书、仓库。
                <span className="text-gray-900">任何人都可以推荐</span>，不用注册，审核通过后展示。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              推荐资料
            </button>
          </div>

          <div className="relative max-w-md mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜标题或简介…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" onClick={() => setLevel('')} className={chip(level === '')}>
              全部难度
            </button>
            {RESOURCE_LEVELS.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l === level ? '' : l)}
                className={chip(level === l)}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button type="button" onClick={() => setTag('')} className={chip(tag === '')}>
              全部标签
            </button>
            {AI_TAGS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t === tag ? '' : t)}
                className={chip(tag === t)}
              >
                {t}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <p className="text-gray-600 mb-1">
                {rows.length === 0 ? '还没有公开的资料。' : '这个筛选下没有资料。'}
              </p>
              <p className="text-sm text-gray-400">推荐一份好资料，审核通过后就会出现在这里。</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pageItems.map(r => {
                const origin: SubmissionOrigin = r.origin ?? 'member';
                return (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                        {r.title}
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-1 text-gray-300 group-hover:text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed flex-grow mb-3">
                      {r.summary}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${LEVEL_STYLE[r.level]}`}>
                        {r.level}
                      </span>
                      {r.tags.map(t => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-gray-100 text-xs text-gray-500 truncate">
                      {origin !== 'member' && (
                        <span className="mr-1.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {ORIGIN_LABEL[origin]}
                        </span>
                      )}
                      {r.author_name}
                      {r.submitter_org ? `·${r.submitter_org}` : ''}
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={visible.length}
            onChange={setPage}
            unit="份"
          />
        </div>
      </section>

      {showSubmit && (
        <SubmitContentModal kind="resource" onClose={() => setShowSubmit(false)} />
      )}
    </Layout>
  );
}
