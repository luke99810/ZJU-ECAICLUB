/**
 * 社团新闻 —— 新闻 / 活动 / 赛事成果 / 公告统一在这里。
 *
 * 原来「社团新闻」和「活动与成果」是两个页面，内容性质其实一样（都是社团动态），
 * 分两处只会让人不知道该发哪边。合并后用 kind 当分类筛选，`/activities` 已删除。
 * 数据也从静态的 `src/data/news.ts` 换成了 posts 表，这样后台能维护。
 */
import { useEffect, useMemo, useState } from 'react';
import { Award, CalendarDays, Megaphone, Newspaper } from 'lucide-react';
import Layout from '../components/Layout';
import PostLink from '../components/PostLink';
import Pagination from '../components/Pagination';
import { listPosts } from '../lib/store';
import { POST_KIND_LABEL, type Post, type PostKind } from '../types';

const PAGE_SIZE = 8;

const KIND_META: Record<PostKind, { icon: React.ReactNode; cls: string }> = {
  news: { icon: <Newspaper className="w-4 h-4" />, cls: 'bg-blue-50 text-blue-700' },
  activity: { icon: <CalendarDays className="w-4 h-4" />, cls: 'bg-indigo-50 text-indigo-700' },
  award: { icon: <Award className="w-4 h-4" />, cls: 'bg-amber-50 text-amber-700' },
  notice: { icon: <Megaphone className="w-4 h-4" />, cls: 'bg-gray-100 text-gray-700' },
};

const FILTERS: Array<PostKind | 'all'> = ['all', 'news', 'activity', 'award', 'notice'];

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<PostKind | 'all'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    listPosts()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => (kind === 'all' ? posts : posts.filter(p => p.kind === kind)),
    [posts, kind]
  );
  useEffect(() => setPage(1), [kind]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    posts.forEach(p => m.set(p.kind, (m.get(p.kind) ?? 0) + 1));
    return m;
  }, [posts]);

  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout>
      <section className="pt-24 pb-16 bg-gradient-to-b from-blue-50 to-white min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">社团新闻</h1>
          <p className="text-gray-600 mb-8">新闻、活动、赛事成果与公告，按时间倒序。</p>

          <div className="flex flex-wrap gap-2 mb-8">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setKind(f)}
                className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${
                  kind === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f === 'all'
                  ? `全部 ${posts.length}`
                  : `${POST_KIND_LABEL[f]} ${counts.get(f) ?? 0}`}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : visible.length === 0 ? (
            <p className="text-gray-500">这个分类下还没有内容。</p>
          ) : (
            // 左侧竖线串成时间线，比一堆平铺卡片更能看出「持续在做事」
            <ol className="relative border-l border-gray-200 pl-6 space-y-8">
              {pageItems.map(p => {
                const meta = KIND_META[p.kind];
                return (
                  <li key={p.id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-50" />
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${meta.cls}`}
                      >
                        {meta.icon}
                        {POST_KIND_LABEL[p.kind]}
                      </span>
                      {p.award && (
                        <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-xs">
                          {p.award}
                        </span>
                      )}
                      <time className="text-xs text-gray-400">{p.date}</time>
                    </div>
                    {p.cover_url && (
                      <img
                        src={p.cover_url}
                        alt={p.title}
                        className="w-full max-w-md h-40 object-cover rounded-lg border border-gray-200 mb-2"
                        loading="lazy"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">{p.body}</p>
                    <PostLink url={p.link_url} label={p.link_label} />
                  </li>
                );
              })}
            </ol>
          )}

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={visible.length}
            onChange={setPage}
            unit="条"
          />
        </div>
      </section>
    </Layout>
  );
}
