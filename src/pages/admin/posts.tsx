/**
 * 活动 / 成果 / 公告管理。
 *
 * 权限：**任何登录成员都能新增和编辑** —— 社团内容以协作为主，办完活动的人
 * 顺手就能补一条，不必等管理员。代价是要留痕，所以每条记 `edited_by`。
 * **删除限管理员**：误删比误改难挽回得多。
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import PostLink from '../../components/PostLink';
import CoverUpload from '../../components/CoverUpload';
import Pagination from '../../components/Pagination';
import { getSession, isAdmin, onAuthStateChange, type MaybeSession } from '../../lib/auth';
import { createPost, deletePost, listPosts, updatePost } from '../../lib/store';
import type { Post, PostKind, Session } from '../../types';

const KINDS: Array<{ key: PostKind; label: string; hint: string }> = [
  { key: 'activity', label: '活动', hint: '讲座、工作坊、分享会' },
  { key: 'award', label: '赛事成果', hint: '竞赛获奖、公示' },
  { key: 'notice', label: '公告', hint: '招新、通知' },
];

interface FormState {
  kind: PostKind;
  title: string;
  body: string;
  date: string;
  award: string;
  link_url: string;
  link_label: string;
  cover_url: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY: FormState = {
  kind: 'activity',
  title: '',
  body: '',
  date: today(),
  award: '',
  link_url: '',
  link_label: '',
  cover_url: '',
};

const orUndefined = (v: string) => (v.trim() ? v.trim() : undefined);

export default function PostsAdminPage() {
  // undefined = 会话还没判定完（Supabase 恢复登录是异步的），null = 确定未登录
  const [session, setSession] = useState<MaybeSession>(undefined);
  const [rows, setRows] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const reload = useCallback(async () => {
    setRows(await listPosts());
    setLoading(false);
  }, []);

  useEffect(() => {
    setSession(getSession());
    return onAuthStateChange(setSession);
    void reload();
  }, [reload]);

  const admin = isAdmin(session);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (p: Post) => {
    setEditing(p);
    setForm({
      kind: p.kind,
      title: p.title,
      body: p.body,
      date: p.date,
      award: p.award ?? '',
      link_url: p.link_url ?? '',
      link_label: p.link_label ?? '',
      cover_url: p.cover_url ?? '',
    });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !session) return;
    setBusy(true);
    const payload = {
      kind: form.kind,
      title: form.title.trim(),
      body: form.body.trim(),
      date: form.date,
      // 奖项只对「赛事成果」有意义，换类型时别把旧值带过去
      award: form.kind === 'award' ? orUndefined(form.award) : undefined,
      link_url: orUndefined(form.link_url),
      link_label: orUndefined(form.link_label),
      cover_url: orUndefined(form.cover_url),
      edited_by: session.member.name,
    };
    if (editing) await updatePost(editing.id, payload);
    else await createPost(payload);
    await reload();
    setBusy(false);
    setShowForm(false);
  };

  const remove = async (p: Post) => {
    if (!window.confirm(`删除「${p.title}」？此操作不可撤销。`)) return;
    await deletePost(p.id);
    await reload();
  };

  return (
    <AdminShell title="社团新闻">
      <div className="flex items-center justify-between mb-6 gap-4">
        <p className="text-sm text-gray-600">
          新闻、活动、赛事成果、公告都在这里维护，改完立即出现在{' '}
          <span className="text-gray-900">/news</span> 和首页。
          任何成员都能新增和编辑{admin ? '' : '；删除需要管理员'}。
        </p>
        <button
          type="button"
          onClick={openNew}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          新增
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-gray-600 mb-1">还没有内容</p>
          <p className="text-sm text-gray-400">办过的活动、拿过的奖，补一条上去。</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(p => {
            const meta = KINDS.find(k => k.key === p.kind);
            return (
              <li
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start gap-3"
              >
                <div className="min-w-0 flex-grow">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                      {meta?.label ?? p.kind}
                    </span>
                    {p.award && (
                      <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-xs">
                        {p.award}
                      </span>
                    )}
                    <time className="text-xs text-gray-400">{p.date}</time>
                    {p.edited_by && (
                      <span className="text-xs text-gray-300">最后编辑：{p.edited_by}</span>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900">{p.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{p.body}</p>
                  <div className="mt-1.5">
                    <PostLink url={p.link_url} label={p.link_label} />
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  {admin && (
                    <button
                      type="button"
                      onClick={() => void remove(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />

      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={save}
            onClick={e => e.stopPropagation()}
            className="mx-auto my-8 w-full max-w-lg bg-white rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{editing ? '编辑' : '新增'}</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">类型</span>
              <div className="flex flex-wrap gap-2">
                {KINDS.map(k => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, kind: k.key }))}
                    title={k.hint}
                    className={`px-3.5 py-1.5 rounded-full text-sm ${
                      form.kind === k.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">标题 *</span>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">说明 *</span>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={3}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">日期 *</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              {form.kind === 'award' && (
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">奖项</span>
                  <input
                    value={form.award}
                    onChange={e => setForm(f => ({ ...f, award: e.target.value }))}
                    placeholder="一等奖"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              )}
            </div>

            <CoverUpload
              value={form.cover_url}
              onChange={v => setForm(f => ({ ...f, cover_url: v }))}
            />

            <label className="block mb-2">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">
                外部链接（公众号推文、活动回顾…）
              </span>
              <input
                type="url"
                value={form.link_url}
                onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                placeholder="https://mp.weixin.qq.com/s/..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">
                链接文案（留空自动识别）
              </span>
              <input
                value={form.link_label}
                onChange={e => setForm(f => ({ ...f, link_label: e.target.value }))}
                placeholder="公众号推文"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.link_url && (
                <span className="inline-block mt-2">
                  预览：<PostLink url={form.link_url} label={form.link_label} />
                </span>
              )}
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
