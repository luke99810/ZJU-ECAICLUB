/**
 * 留言管理 —— 官网「联系我们」提交的留言都落在这里。
 *
 * **所有登录成员都能看和处理**，不限管理员：留言积压比误处理更糟，
 * 招新季一天几十条，卡在三个管理员手上根本回不过来。只有删除留给管理员。
 *
 * 状态是 待处理 / 已处理 / 已忽略，不是投稿那套 pending / approved ——
 * 留言压根不对外展示，它是个待办队列，不是发布流程。
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, Loader2, Mail, RotateCcw, Trash2, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { getSession, isAdmin, onAuthStateChange, type MaybeSession } from '../../lib/auth';
import { deleteMessage, listMessages, markMessage } from '../../lib/store';
import {
  MESSAGE_STATUS_LABEL,
  type Message,
  type MessageStatus,
} from '../../types';

const TABS: Array<{ key: MessageStatus | 'all'; label: string }> = [
  { key: 'new', label: '待处理' },
  { key: 'handled', label: '已处理' },
  { key: 'ignored', label: '已忽略' },
  { key: 'all', label: '全部' },
];

const STATUS_STYLE: Record<MessageStatus, string> = {
  new: 'bg-amber-50 text-amber-800 border-amber-200',
  handled: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ignored: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function MessagesPage() {
  // undefined = 会话还没判定完（Supabase 恢复登录是异步的），null = 确定未登录
  const [session, setSession] = useState<MaybeSession>(undefined);
  const [tab, setTab] = useState<MessageStatus | 'all'>('new');
  const [rows, setRows] = useState<Message[]>([]);
  const [counts, setCounts] = useState<Record<MessageStatus, number>>({
    new: 0,
    handled: 0,
    ignored: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(async (t: MessageStatus | 'all') => {
    setLoading(true);
    const [list, all] = await Promise.all([
      t === 'all' ? listMessages() : listMessages(t),
      listMessages(),
    ]);
    setRows(list);
    setCounts({
      new: all.filter(m => m.status === 'new').length,
      handled: all.filter(m => m.status === 'handled').length,
      ignored: all.filter(m => m.status === 'ignored').length,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    setSession(getSession());
    return onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    void reload(tab);
  }, [tab, reload]);

  const mark = async (m: Message, status: MessageStatus) => {
    setBusyId(m.id);
    await markMessage(m.id, status, session?.member.name);
    setBusyId(null);
    await reload(tab);
  };

  const remove = async (id: string) => {
    setBusyId(id);
    await deleteMessage(id);
    setBusyId(null);
    setConfirmId(null);
    await reload(tab);
  };

  const admin = isAdmin(session);

  return (
    <AdminShell title="留言管理">
      <p className="text-sm text-gray-600 mb-5">
        官网<span className="text-gray-900">「联系我们」</span>页提交的留言。
        任何登录成员都可以处理，处理人会记在留言下面。
        {admin ? '你是管理层，还可以删除留言。' : '删除需要管理员。'}
        <br />
        回复请直接发邮件到留言人邮箱 —— 站点本身不发信。
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => {
          const n = t.key === 'all' ? counts.new + counts.handled + counts.ignored : counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setConfirmId(null);
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
              {n > 0 && (
                <span
                  className={`px-1.5 rounded-full text-xs ${
                    tab === t.key
                      ? 'bg-white/25'
                      : t.key === 'new'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-gray-500">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">
            {tab === 'new' ? '没有待处理的留言。' : '这个分类下没有留言。'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map(m => (
            <li key={m.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded border text-xs ${STATUS_STYLE[m.status]}`}>
                  {MESSAGE_STATUS_LABEL[m.status]}
                </span>
                <span className="font-medium text-gray-900">{m.name}</span>
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent('回复：AI Club 官网留言')}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline break-all"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {m.email}
                </a>
                <time className="text-xs text-gray-400 ml-auto">{m.created_at.slice(0, 10)}</time>
              </div>

              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">
                {m.body}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                {m.status !== 'handled' && (
                  <button
                    type="button"
                    onClick={() => void mark(m, 'handled')}
                    disabled={busyId === m.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === m.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    标记已处理
                  </button>
                )}
                {m.status !== 'ignored' && (
                  <button
                    type="button"
                    onClick={() => void mark(m, 'ignored')}
                    disabled={busyId === m.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    忽略
                  </button>
                )}
                {m.status !== 'new' && (
                  <button
                    type="button"
                    onClick={() => void mark(m, 'new')}
                    disabled={busyId === m.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    重新打开
                  </button>
                )}

                {m.handled_by && m.status !== 'new' && (
                  <span className="text-xs text-gray-400">
                    由 {m.handled_by} 于 {m.handled_at?.slice(0, 10)} 处理
                  </span>
                )}

                {admin && (
                  <span className="ml-auto">
                    {confirmId === m.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-rose-700">删除后无法恢复</span>
                        <button
                          type="button"
                          onClick={() => void remove(m.id)}
                          disabled={busyId === m.id}
                          className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-50"
                        >
                          确认删除
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
                      <button
                        type="button"
                        onClick={() => setConfirmId(m.id)}
                        aria-label={`删除 ${m.name} 的留言`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
