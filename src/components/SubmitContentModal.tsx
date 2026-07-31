/**
 * 投稿弹窗（学习资料 / 论坛发帖）—— **不需要登录**，提交后进审核队列。
 *
 * 与项目投稿共用同一套来源判定（`lib/submission.ts`）：邮箱决定归「校友投稿」
 * 还是「校外投稿」，在册成员的邮箱会被拦下来让他登录提交。
 *
 * 项目投稿字段多得多（标签/链接/封面），单独放在 `SubmitProjectModal`；
 * 这两类字段少，合成一个组件按 kind 切换即可，不值得再拆。
 */
import { useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { createForumPost, createResource } from '../lib/store';
import { getSession } from '../lib/auth';
import { CAMPUS_EMAIL_DOMAIN, classifySubmission } from '../lib/submission';
import {
  AI_TAGS,
  FORUM_CATEGORIES,
  ORIGIN_LABEL,
  RESOURCE_LEVELS,
  type AiTag,
  type ForumCategory,
  type ResourceLevel,
  type SubmissionOrigin,
} from '../types';

type Kind = 'resource' | 'forum';

interface SubmitContentModalProps {
  kind: Kind;
  onClose: () => void;
  /** 提交成功且已审核状态变化时让父页刷新（当前一律进待审，父页可用于提示）。 */
  onSubmitted?: () => void;
}

const COPY: Record<Kind, { title: string; hint: string; bodyLabel: string; bodyHint: string }> = {
  resource: {
    title: '推荐一份学习资料',
    hint: '课程、书、仓库、笔记都行。审核通过后出现在学习资料页。',
    bodyLabel: '简介 *',
    bodyHint: '说清它讲什么、适合谁看、你觉得好在哪。',
  },
  forum: {
    title: '发一个帖子',
    hint: '提问、分享或讨论。审核通过后出现在论坛列表。',
    bodyLabel: '正文 *',
    bodyHint: '把问题或经验讲清楚，别人才好接话。',
  },
};

export default function SubmitContentModal({ kind, onClose, onSubmitted }: SubmitContentModalProps) {
  const session = getSession();
  const copy = COPY[kind];

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [level, setLevel] = useState<ResourceLevel>('入门');
  const [category, setCategory] = useState<ForumCategory>('问答');
  const [tags, setTags] = useState<AiTag[]>([]);
  // 登录成员不用重填身份，直接用会话里的
  const [name, setName] = useState(session?.member.name ?? '');
  const [org, setOrg] = useState('');
  const [contact, setContact] = useState(session?.member.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [origin, setOrigin] = useState<SubmissionOrigin>('external');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (kind === 'resource' && tags.length === 0) {
      setError('至少选一个技术标签');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 已登录成员直接算 member，不必再按邮箱判定。
      let kindOrigin: SubmissionOrigin = 'member';
      if (!session) {
        const r = await classifySubmission(contact);
        if (r.isRegisteredMember) {
          setError('这个邮箱已经是社团成员账号，请先登录再提交。');
          setBusy(false);
          return;
        }
        kindOrigin = r.origin;
      }
      setOrigin(kindOrigin);

      const identity = {
        origin: kindOrigin,
        ...(session ? { author_id: session.member.id } : {}),
        author_name: name.trim(),
        ...(session ? {} : { submitter_contact: contact.trim() }),
      };

      if (kind === 'resource') {
        await createResource({
          title: title.trim(),
          summary: body.trim(),
          url: url.trim(),
          level,
          tags,
          submitter_org: org.trim() || undefined,
          ...identity,
        });
      } else {
        await createForumPost({
          title: title.trim(),
          body: body.trim(),
          category,
          ...identity,
        });
      }
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(`提交失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
        <div
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-white rounded-2xl p-8 text-center"
        >
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
          <h2 className="font-semibold text-gray-900 mb-2">提交成功</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            已归为
            <span className="mx-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-800">
              {ORIGIN_LABEL[origin]}
            </span>
            ，进入审核队列。通过后就会公开显示。
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            知道了
          </button>
        </div>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="mx-auto my-8 w-full max-w-xl bg-white rounded-2xl p-6"
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-semibold text-gray-900">{copy.title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">{copy.hint}</p>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1.5">标题 *</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {kind === 'resource' && (
          <>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">资料链接 *</span>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                placeholder="https://…"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div className="mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">难度</span>
              <div className="flex flex-wrap gap-2">
                {RESOURCE_LEVELS.map(l => (
                  <button key={l} type="button" onClick={() => setLevel(l)} className={chip(level === l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">技术标签 *</span>
              <div className="flex flex-wrap gap-2">
                {AI_TAGS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setTags(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]))
                    }
                    className={chip(tags.includes(t))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {kind === 'forum' && (
          <div className="mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">分类</span>
            <div className="flex flex-wrap gap-2">
              {FORUM_CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={chip(category === c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1.5">{copy.bodyLabel}</span>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={kind === 'forum' ? 6 : 4}
            required
            placeholder={copy.bodyHint}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <div className="border-t border-gray-100 pt-4 mb-4">
          {session ? (
            <p className="text-sm text-gray-600">
              以社团成员身份提交：
              <span className="text-gray-900">
                {session.member.name}（{session.member.department}）
              </span>
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 mb-3">关于你</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">姓名 *</span>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                {kind === 'resource' && (
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">
                      学校 / 单位
                    </span>
                    <input
                      value={org}
                      onChange={e => setOrg(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                )}
              </div>
              <label className="block mt-4">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">联系邮箱 *</span>
                <input
                  type="email"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="block text-xs text-gray-500 mt-1.5">
                  用 <code className="px-1 rounded bg-gray-100">{CAMPUS_EMAIL_DOMAIN}</code>{' '}
                  邮箱归为「校友投稿」，其他后缀归为「校外投稿」。只有审核成员看得到。
                </span>
              </label>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            提交
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
