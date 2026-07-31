/**
 * 项目共享 —— 开源社区三大板块之一（另两个：学习资料、AI 论坛）。
 *
 * 原来在 /projects，按社团要求并入开源社区。三类内容规则一致：投稿 → 审核 → 发布。
 *
 * 只展示审核通过的项目。两套标签是正交的：
 *   - **技术标签**（LLM/RAG/CV/…）回答「用了什么」
 *   - **功能场景**（内容创作/科研辅助/…）回答「能帮我干什么」
 * 找工具的人多半按后者找，所以两行筛选都给，可叠加。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Send, Upload } from 'lucide-react';
import Layout from '../../components/Layout';
import ProjectCard from '../../components/ProjectCard';
import Pagination from '../../components/Pagination';
import SubmitProjectModal from '../../components/SubmitProjectModal';
import { listProjects } from '../../lib/store';
import { AI_TAGS, FUNCTION_TAGS, type AiProject } from '../../types';

const PAGE_SIZE = 9;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<AiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState('');
  const [fn, setFn] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    listProjects({ status: 'approved' })
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return projects.filter(p => {
      if (tag && !p.tags.includes(tag as never)) return false;
      if (fn && !(p.functions ?? []).includes(fn as never)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.stack.some(s => s.toLowerCase().includes(q))
      );
    });
  }, [projects, tag, fn, keyword]);

  // 筛选一变就回第一页，否则会停在一个不存在的页码上看到空白。
  useEffect(() => setPage(1), [tag, fn, keyword]);

  const counts = useMemo(() => {
    const t = new Map<string, number>();
    const f = new Map<string, number>();
    projects.forEach(p => {
      p.tags.forEach(x => t.set(x, (t.get(x) ?? 0) + 1));
      (p.functions ?? []).forEach(x => f.set(x, (f.get(x) ?? 0) + 1));
    });
    return { t, f };
  }, [projects]);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">AI 项目作品集</h1>
              <p className="text-gray-600 max-w-2xl">
                社团成员与校内外投稿的 AI 项目，含代码、推文与论文链接。
                <span className="text-gray-900">任何人都可以投稿</span>，不用注册，
                审核通过后公开。
              </p>
            </div>
            <div className="shrink-0 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowSubmit(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                投稿项目
              </button>
              <Link
                href="/admin/projects"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                成员登录提交
              </Link>
            </div>
          </div>

          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜项目名、简介或技术栈…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-2">按能帮你做什么筛</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFn('')} className={chip(fn === '')}>
                不限
              </button>
              {FUNCTION_TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFn(t === fn ? '' : t)}
                  className={chip(fn === t)}
                >
                  {t} {counts.f.get(t) ?? 0}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs font-medium text-gray-500 mb-2">按技术标签筛</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTag('')} className={chip(tag === '')}>
                不限
              </button>
              {AI_TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t === tag ? '' : t)}
                  className={chip(tag === t)}
                >
                  {t} {counts.t.get(t) ?? 0}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <p className="text-gray-600 mb-1">
                {projects.length === 0 ? '还没有公开的项目。' : '这个筛选下暂时没有项目。'}
              </p>
              <p className="text-sm text-gray-400">
                {projects.length === 0
                  ? '成员登录后台提交后，审核通过就会出现在这里。'
                  : '换个标签或清空搜索试试。'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {pageItems.map(p => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={visible.length}
                onChange={setPage}
                unit="个项目"
              />
            </>
          )}
        </div>
      </section>

      {showSubmit && <SubmitProjectModal onClose={() => setShowSubmit(false)} />}
    </Layout>
  );
}
