/**
 * AI 工具导航维护页。
 *
 * 和「社团新闻」一个路子：任何登录成员都能增改（这份清单越勤更新越有用，
 * 卡在管理员手上反而没人维护），**删除留给管理员** —— 误删一条别人加的推荐
 * 不好恢复，而改错随时能改回来。
 *
 * 这里没有审核流程：工具导航不接受外部投稿，是社团自己整理的索引，
 * 前台读的就是这份数据，存下即生效。
 */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { getSession, isAdmin, onAuthStateChange, type MaybeSession } from '../../lib/auth';
import { createToolLink, deleteToolLink, listToolLinks, updateToolLink } from '../../lib/store';
import {
  TOOL_ACCESS_LABEL,
  TOOL_CATEGORIES,
  type ToolAccess,
  type ToolCategory,
  type ToolLink,
} from '../../types';

interface FormState {
  name: string;
  note: string;
  url: string;
  category: ToolCategory;
  access: ToolAccess;
  cnFriendly: boolean;
  /** 输入框里是字符串，存的时候再转数字 */
  sort: string;
}

const EMPTY: FormState = {
  name: '',
  note: '',
  url: '',
  category: '对话与写作',
  access: 'free',
  cnFriendly: false,
  sort: '',
};

const ACCESS_OPTIONS: ToolAccess[] = ['free', 'trial', 'paid'];

export default function ToolNavPage() {
  // undefined = 会话还没判定完（Supabase 恢复登录是异步的），null = 确定未登录
  const [session, setSession] = useState<MaybeSession>(undefined);
  const [rows, setRows] = useState<ToolLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  /** 正在编辑的条目 id；null 表示新建。 */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setRows(await listToolLinks());
    setLoading(false);
  }, []);

  useEffect(() => {
    setSession(getSession());
    return onAuthStateChange(setSession);
    void reload();
  }, [reload]);

  const admin = isAdmin(session);

  const openNew = () => {
    setEditingId(null);
    // 新条目默认排在最后，不打乱现有顺序
    setForm({ ...EMPTY, sort: String((rows.at(-1)?.sort ?? rows.length * 10) + 10) });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (t: ToolLink) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      note: t.note,
      url: t.url,
      category: t.category,
      access: t.access,
      cnFriendly: !!t.cnFriendly,
      sort: t.sort === undefined ? '' : String(t.sort),
    });
    setError(null);
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    const url = form.url.trim();
    if (!name || !form.note.trim() || !url) {
      setError('名称、一句话说明、链接都要填。');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError('链接要以 http:// 或 https:// 开头，否则前台点开会跳到站内。');
      return;
    }
    // 同名重复通常是两个人各加了一遍，提示一下但不阻断（可能确实是不同产品线）
    const dup = rows.find(t => t.id !== editingId && t.name.trim() === name);

    setBusy(true);
    const payload = {
      name,
      note: form.note.trim(),
      url,
      category: form.category,
      access: form.access,
      ...(form.cnFriendly ? { cnFriendly: true } : { cnFriendly: false }),
      ...(form.sort.trim() ? { sort: Number(form.sort) } : {}),
    };
    if (editingId) await updateToolLink(editingId, payload);
    else await createToolLink(payload);
    setBusy(false);
    setShowForm(false);
    setEditingId(null);
    await reload();
    setError(dup ? `已保存。提醒：清单里已经有一条叫「${name}」的，注意是否重复。` : null);
  };

  const remove = async (id: string) => {
    setBusy(true);
    await deleteToolLink(id);
    setBusy(false);
    setConfirmId(null);
    await reload();
  };

  const field = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <AdminShell title="AI 工具导航">
      <div className="flex items-start justify-between gap-4 mb-6">
        <p className="text-sm text-gray-600">
          维护对外的 <span className="text-gray-900">/tools</span> 清单，存下即生效，没有审核环节。
          <br />
          任何成员都能新增和编辑{admin ? '，你是管理层，还可以删除' : '；删除需要管理员'}。
        </p>
        <button
          type="button"
          onClick={openNew}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          添加工具
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={submit} className="mb-6 bg-white rounded-xl border border-blue-300 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{editingId ? '编辑工具' : '添加工具'}</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">名称 *</span>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={field}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">链接 *</span>
              <input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://…"
                className={field}
              />
            </label>
          </div>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">一句话说明 *</span>
            <input
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="说清它解决什么问题，别抄官网标语"
              className={field}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">分类</span>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as ToolCategory }))}
                className={field}
              >
                {TOOL_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">收费情况</span>
              <select
                value={form.access}
                onChange={e => setForm(f => ({ ...f, access: e.target.value as ToolAccess }))}
                className={field}
              >
                {ACCESS_OPTIONS.map(a => (
                  <option key={a} value={a}>
                    {TOOL_ACCESS_LABEL[a].text}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">排序</span>
              <input
                type="number"
                value={form.sort}
                onChange={e => setForm(f => ({ ...f, sort: e.target.value }))}
                placeholder="越小越靠前"
                className={field}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 mb-5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.cnFriendly}
              onChange={e => setForm(f => ({ ...f, cnFriendly: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300"
            />
            国内直连顺畅（学生最关心这一点，能确认再勾）
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
      )}

      {loading ? (
        <p className="text-gray-500">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-gray-500">
          清单是空的，点「添加工具」加第一条。
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">排序</th>
                <th className="text-left font-medium px-4 py-2.5">名称</th>
                <th className="text-left font-medium px-4 py-2.5">说明</th>
                <th className="text-left font-medium px-4 py-2.5">分类</th>
                <th className="text-left font-medium px-4 py-2.5">收费</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 text-gray-400">{t.sort ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-gray-900 hover:text-blue-600"
                    >
                      {t.name}
                      <ExternalLink className="w-3 h-3 text-gray-300" />
                    </a>
                    {t.cnFriendly && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                        国内直连
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-md">{t.note}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{t.category}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${TOOL_ACCESS_LABEL[t.access].cls}`}
                    >
                      {TOOL_ACCESS_LABEL[t.access].text}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    {confirmId === t.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-rose-700">确定删除？</span>
                        <button
                          type="button"
                          onClick={() => void remove(t.id)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-50"
                        >
                          删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="px-2.5 py-1 rounded-md border border-gray-300 text-xs text-gray-700"
                        >
                          取消
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="w-3 h-3" />
                          编辑
                        </button>
                        {admin && (
                          <button
                            type="button"
                            onClick={() => setConfirmId(t.id)}
                            aria-label={`删除 ${t.name}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            删除
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
