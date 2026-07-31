/**
 * 内容审核 —— 项目共享 / 学习资料 / AI 论坛三类投稿都在这里过审。
 *
 * 权限分两档（三类内容一视同仁）：
 *   - **管理员（管理层）**：审全部 —— 成员提交的 + 校友 / 校外投稿。
 *   - **普通成员**：只审**公开投稿**（校友 / 校外）。成员自己的内容一律由管理层
 *     把关，这样「自己提交自己通过」的口子从根上就不存在，不需要额外的回避判断。
 *
 * 驳回必须填原因（提交人能看到，否则改无从改）。
 * 论坛**评论**不在这里 —— 评论不审核，任何人（含未登录访客）都能直接发。
 *
 * 三类内容字段差得远，但审核动作完全一样，所以这里用一个 `ReviewRow` 把它们
 * 归一化成「标题 / 摘要 / 元信息 / 状态」，审核按钮那一套只写一遍。
 */
import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, ExternalLink, Loader2, MessagesSquare, Rocket, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { getSession, isAdmin, onAuthStateChange, type MaybeSession } from '../../lib/auth';
import {
  listForumPosts,
  listProjects,
  listResources,
  reviewForumPost,
  reviewProject,
  reviewResource,
} from '../../lib/store';
import {
  CONTENT_KIND_LABEL,
  ORIGIN_LABEL,
  type ContentKind,
  type ReviewStatus,
  type SubmissionOrigin,
} from '../../types';

/** 归一化后的一行，界面只认这个形状。 */
interface ReviewRow {
  id: string;
  title: string;
  /** 正文 / 简介，截断显示。 */
  summary: string;
  /** 分类、难度、标签之类的小标签。 */
  chips: string[];
  /** 外链（项目仓库、资料地址），论坛帖没有。 */
  url?: string;
  origin: SubmissionOrigin;
  author_name: string;
  submitter_org?: string;
  submitter_contact?: string;
  status: ReviewStatus;
  review_note?: string;
  created_at: string;
}

const STATUS_TABS: Array<{ key: ReviewStatus; label: string }> = [
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' },
];

const KIND_TABS: Array<{ key: ContentKind; icon: React.ReactNode }> = [
  { key: 'project', icon: <Rocket className="w-4 h-4" /> },
  { key: 'resource', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'forum', icon: <MessagesSquare className="w-4 h-4" /> },
];

const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 border-rose-200',
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

/** 各类内容的取数与写回，按 kind 分派。 */
async function fetchRows(
  kind: ContentKind,
  status: ReviewStatus,
  asAdmin: boolean
): Promise<ReviewRow[]> {
  // 普通成员只看得到公开投稿（校友 + 校外）—— 在数据层就过滤掉，而不是拉全量
  // 再在界面上禁用，免得成员看到一堆自己动不了的卡片。
  const q = asAdmin
    ? { status }
    : { status, origins: ['alumni', 'external'] as SubmissionOrigin[] };

  if (kind === 'project') {
    return (await listProjects(q)).map(p => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      // 去重：技术栈里可能又写了一遍标签（如 LLM），重复的 chip key 会撞
      chips: [...new Set<string>([...(p.functions ?? []), ...p.tags, ...p.stack])],
      url: p.github_url || p.blog_url || p.paper_url,
      origin: p.origin ?? 'member',
      author_name: p.author_name,
      submitter_org: p.submitter_org,
      submitter_contact: p.submitter_contact,
      status: p.status,
      review_note: p.review_note,
      created_at: p.created_at,
    }));
  }
  if (kind === 'resource') {
    return (await listResources(q)).map(r => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      chips: [r.level, ...r.tags],
      url: r.url,
      origin: r.origin ?? 'member',
      author_name: r.author_name,
      submitter_org: r.submitter_org,
      submitter_contact: r.submitter_contact,
      status: r.status,
      review_note: r.review_note,
      created_at: r.created_at,
    }));
  }
  return (await listForumPosts(q)).map(p => ({
    id: p.id,
    title: p.title,
    summary: p.body,
    chips: [p.category],
    origin: p.origin ?? 'member',
    author_name: p.author_name,
    submitter_contact: p.submitter_contact,
    status: p.status,
    review_note: p.review_note,
    created_at: p.created_at,
  }));
}

async function writeReview(
  kind: ContentKind,
  id: string,
  status: ReviewStatus,
  note?: string
): Promise<void> {
  if (kind === 'project') await reviewProject(id, status, note);
  else if (kind === 'resource') await reviewResource(id, status, note);
  else await reviewForumPost(id, status, note);
}

export default function ReviewPage() {
  // undefined = 会话还没判定完（Supabase 恢复登录是异步的），null = 确定未登录
  const [session, setSession] = useState<MaybeSession>(undefined);
  const [kind, setKind] = useState<ContentKind>('project');
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** 各类待审数量，直接显示在标签上 —— 不点进去也知道哪边积压了。 */
  const [pendingCounts, setPendingCounts] = useState<Record<ContentKind, number>>({
    project: 0,
    resource: 0,
    forum: 0,
  });
  /** 正在填驳回原因的条目 id */
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    setSession(getSession());
    return onAuthStateChange(setSession);
  }, []);

  const admin = isAdmin(session);

  // session 要先定下来才知道该拉哪些数据，所以 admin 作为入参而不是闭包捕获。
  const reload = useCallback(async (k: ContentKind, status: ReviewStatus, asAdmin: boolean) => {
    setLoading(true);
    const [list, ...counts] = await Promise.all([
      fetchRows(k, status, asAdmin),
      fetchRows('project', 'pending', asAdmin),
      fetchRows('resource', 'pending', asAdmin),
      fetchRows('forum', 'pending', asAdmin),
    ]);
    setRows(list);
    setPendingCounts({
      project: counts[0].length,
      resource: counts[1].length,
      forum: counts[2].length,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload(kind, tab, admin);
  }, [kind, tab, admin, reload]);

  const approve = async (row: ReviewRow) => {
    setBusyId(row.id);
    await writeReview(kind, row.id, 'approved');
    setBusyId(null);
    await reload(kind, tab, admin);
  };

  const doReject = async (row: ReviewRow) => {
    if (!note.trim()) return;
    setBusyId(row.id);
    await writeReview(kind, row.id, 'rejected', note.trim());
    setBusyId(null);
    setRejecting(null);
    setNote('');
    await reload(kind, tab, admin);
  };

  return (
    <AdminShell title="内容审核">
      <p className="text-sm text-gray-600 mb-5">
        项目共享、学习资料、论坛发帖都要过审，通过后才在前台公开。论坛评论不审核。
        <br />
        {admin ? (
          <span className="text-gray-900">
            你是管理层，可以审核全部内容（成员提交 + 校友 / 校外投稿）。
          </span>
        ) : (
          <span className="text-gray-900">
            你可以审核校友与校外投稿；社团成员自己提交的内容由管理层审核。
          </span>
        )}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {KIND_TABS.map(k => (
          <button
            key={k.key}
            type="button"
            onClick={() => {
              setKind(k.key);
              setRejecting(null);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
              kind === k.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {k.icon}
            {CONTENT_KIND_LABEL[k.key]}
            {pendingCounts[k.key] > 0 && (
              <span
                className={`ml-0.5 px-1.5 rounded-full text-xs ${
                  kind === k.key ? 'bg-white/25' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {pendingCounts[k.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setRejecting(null);
            }}
            className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${
              tab === t.key
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-gray-500">
          {tab === 'pending'
            ? `队列是空的，没有待审的${CONTENT_KIND_LABEL[kind]}。`
            : `这个分类下没有${CONTENT_KIND_LABEL[kind]}。`}
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map(row => (
            <li key={row.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span
                  className={`px-2 py-0.5 rounded border text-xs ${STATUS_STYLE[row.status]}`}
                >
                  {STATUS_LABEL[row.status]}
                </span>
                {row.origin !== 'member' && (
                  <span className="px-2 py-0.5 rounded bg-gray-900 text-white text-xs">
                    {ORIGIN_LABEL[row.origin]}
                  </span>
                )}
                <time className="text-xs text-gray-400">{row.created_at.slice(0, 10)}</time>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1">{row.title}</h3>
              {/* 正文可能很长，审核只需要看个大概，点外链或前台看全文 */}
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-4 mb-2">
                {row.summary}
              </p>

              {row.chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {row.chips.map(c => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {row.url && (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline break-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  {row.url}
                </a>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3 justify-between">
                <div className="text-xs text-gray-600">
                  <span className="text-gray-900">{row.author_name}</span>
                  {row.submitter_org ? ` · ${row.submitter_org}` : ''}
                  {/* 联系方式只有审核人看得到，前台不展示 */}
                  {row.submitter_contact && (
                    <span className="text-gray-400 break-all"> · {row.submitter_contact}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  {row.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => void approve(row)}
                      disabled={busyId === row.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyId === row.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      通过
                    </button>
                  )}
                  {row.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejecting(row.id);
                        setNote('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs hover:bg-rose-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      驳回
                    </button>
                  )}
                </div>
              </div>

              {row.status === 'rejected' && row.review_note && (
                <p className="mt-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  驳回原因：{row.review_note}
                </p>
              )}

              {rejecting === row.id && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="填写驳回原因，提交人会看到这句话…"
                    className="w-full px-2.5 py-1.5 rounded-md border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => void doReject(row)}
                      disabled={!note.trim() || busyId === row.id}
                      className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-50"
                    >
                      确认驳回
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(null)}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-white"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
