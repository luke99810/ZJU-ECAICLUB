/**
 * AI 工具导航。
 *
 * 这一页**不提供 AI 能力**，只是一份分类整理的外部工具清单 —— 卡片点开就是官网。
 * 站点自己的 AI 能力在右下角的「AI 客服」里（问答、找项目、搜新闻）。
 */
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import Layout from '../components/Layout';
import { listToolLinks } from '../lib/store';
import {
  TOOL_ACCESS_LABEL,
  TOOL_CATEGORIES,
  type ToolCategory,
  type ToolLink,
} from '../types';

export default function ToolsPage() {
  // 清单改成从数据层读 —— 后台「AI 工具导航」页能直接增删改，不必改代码发版。
  const [tools, setTools] = useState<ToolLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ToolCategory | '全部'>('全部');
  const [keyword, setKeyword] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyCn, setOnlyCn] = useState(false);

  useEffect(() => {
    listToolLinks()
      .then(setTools)
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return tools.filter(t => {
      if (category !== '全部' && t.category !== category) return false;
      if (onlyFree && t.access !== 'free') return false;
      if (onlyCn && !t.cnFriendly) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.note.toLowerCase().includes(q);
    });
  }, [tools, category, keyword, onlyFree, onlyCn]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    tools.forEach(t => m.set(t.category, (m.get(t.category) ?? 0) + 1));
    return m;
  }, [tools]);

  return (
    <Layout>
      <section className="pt-24 pb-16 bg-gradient-to-b from-indigo-50 to-white min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">AI 工具导航</h1>
          <p className="text-gray-600 max-w-2xl mb-2">
            社团整理的常用 AI 工具，按用途分类。点卡片直接跳工具官网 ——
            这里只做索引，不代理任何服务。
          </p>
          <p className="text-sm text-gray-500 mb-8">
            想问社团的事、找项目、查新闻？用右下角的 <span className="text-gray-800">AI 客服</span>。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="搜工具名或用途…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOnlyFree(v => !v)}
                className={`px-3.5 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  onlyFree
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                只看有免费额度
              </button>
              <button
                type="button"
                onClick={() => setOnlyCn(v => !v)}
                className={`px-3.5 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  onlyCn
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                只看国内直连
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button
              type="button"
              onClick={() => setCategory('全部')}
              className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${
                category === '全部'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              全部 {tools.length}
            </button>
            {TOOL_CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c === category ? '全部' : c)}
                className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${
                  category === c
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {c} {counts.get(c) ?? 0}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : visible.length === 0 ? (
            <p className="text-gray-500">
              {tools.length === 0 ? '还没有收录工具。' : '这个筛选下没有工具，换个条件试试。'}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map(t => {
                const access = TOOL_ACCESS_LABEL[t.access];
                return (
                  <a
                    key={t.id}
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                        {t.name}
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-1 text-gray-300 group-hover:text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed flex-grow mb-3">{t.note}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        {t.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${access.cls}`}>
                        {access.text}
                      </span>
                      {t.cnFriendly && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                          国内直连
                        </span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          <p className="mt-10 text-sm text-gray-500">
            漏了好用的工具？社团成员登录后台后，在「AI 工具导航」里就能加一条。
          </p>
        </div>
      </section>
    </Layout>
  );
}
