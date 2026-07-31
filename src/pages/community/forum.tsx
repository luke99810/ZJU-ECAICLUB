/**
 * AI 论坛 —— 开源社区三大板块之一。
 *
 * 两条不同的规则，这是本页的关键：
 *   - **发帖**要审核（任何人可发，通过后才公开）；
 *   - **评论不审核，未登录访客也能评** —— 社团要的「外部访问只能评论」。
 *     所以评论区永远开着，发帖按钮对谁都显示，但帖子内容要过审。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Plus, Search, Send } from 'lucide-react';
import Layout from '../../components/Layout';
import Pagination from '../../components/Pagination';
import SubmitContentModal from '../../components/SubmitContentModal';
import { getSession, onAuthStateChange, type MaybeSession } from '../../lib/auth';
import { countComments, createComment, listComments, listForumPosts } from '../../lib/store';
import {
  FORUM_CATEGORIES,
  ORIGIN_LABEL,
  type ForumComment,
  type ForumPost,
  type Session,
  type SubmissionOrigin,
} from '../../types';

const PAGE_SIZE = 10;

const CAT_STYLE: Record<string, string> = {
  问答: 'bg-blue-50 text-blue-700',
  分享: 'bg-emerald-50 text-emerald-700',
  讨论: 'bg-indigo-50 text-indigo-700',
};

function CommentSection({ post, session }: { post: ForumPost; session: MaybeSession }) {
  const [rows, setRows] = useState<ForumComment[]>([]);
  const [body, setBody] = useState('');
  const [name, setName] = useState(session?.member.name ?? '');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listComments(post.id).then(setRows);
  }, [post.id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    // 未登录也能评 —— 只要求留个称呼，没填就记「访客」。
    await createComment({
      post_id: post.id,
      body: body.trim(),
      author_name: (session?.member.name ?? name).trim() || '访客',
      ...(session ? { author_id: session.member.id } : {}),
    });
    setBody('');
    setBusy(false);
    load();
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      {rows.length > 0 && (
        <ul className="space-y-3 mb-4">
          {rows.map(c => (
            <li key={c.id} className="text-sm">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-gray-800">{c.author_name}</span>
                {c.author_id && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px]">
                    成员
                  </span>
                )}
                <time className="text-xs text-gray-400">{c.created_at.slice(0, 10)}</time>
              </div>
              <p className="text-gray-600 leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={send} className="space-y-2">
        {!session && (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="你的称呼（选填）"
            className="w-full sm:w-48 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <div className="flex gap-2">
          <input
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={session ? '写下你的回复…' : '未登录也能评论，说说你的看法…'}
            className="flex-grow px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={busy || !body.trim()}
            aria-label="发送评论"
            className="shrink-0 p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ForumPage() {
  // undefined = 会话还没判定完（Supabase 恢复登录是异步的），null = 确定未登录
  const [session, setSession] = useState<MaybeSession>(undefined);
  const [rows, setRows] = useState<ForumPost[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    setSession(getSession());
    return onAuthStateChange(setSession);
    Promise.all([listForumPosts({ status: 'approved' }), countComments()])
      .then(([posts, c]) => {
        setRows(posts);
        setCounts(c);
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return rows.filter(p => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
    });
  }, [rows, category, keyword]);

  useEffect(() => setPage(1), [category, keyword]);
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">AI 论坛</h1>
              <p className="text-gray-600">
                提问、分享、讨论。
                <span className="text-gray-900">发帖需审核，评论不用</span> ——
                未登录也可以直接回复。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              发帖
            </button>
          </div>

          <div className="relative max-w-md mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜帖子…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button type="button" onClick={() => setCategory('')} className={chip(category === '')}>
              全部 {rows.length}
            </button>
            {FORUM_CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c === category ? '' : c)}
                className={chip(category === c)}
              >
                {c} {rows.filter(p => p.category === c).length}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <p className="text-gray-600 mb-1">
                {rows.length === 0 ? '还没有公开的帖子。' : '这个筛选下没有帖子。'}
              </p>
              <p className="text-sm text-gray-400">发一个帖子，审核通过后就会出现在这里。</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pageItems.map(p => {
                const origin: SubmissionOrigin = p.origin ?? 'member';
                const open = openId === p.id;
                return (
                  <li key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs ${CAT_STYLE[p.category]}`}>
                        {p.category}
                      </span>
                      {origin !== 'member' && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                          {ORIGIN_LABEL[origin]}
                        </span>
                      )}
                      <time className="text-xs text-gray-400">{p.created_at.slice(0, 10)}</time>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {p.body}
                    </p>
                    <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                      <span>{p.author_name}</span>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : p.id)}
                        className="inline-flex items-center gap-1.5 hover:text-blue-600"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {open ? '收起评论' : `评论 ${counts.get(p.id) ?? 0}`}
                      </button>
                    </div>
                    {open && <CommentSection post={p} session={session} />}
                  </li>
                );
              })}
            </ul>
          )}

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={visible.length}
            onChange={setPage}
            unit="帖"
          />
        </div>
      </section>

      {showSubmit && <SubmitContentModal kind="forum" onClose={() => setShowSubmit(false)} />}
    </Layout>
  );
}
