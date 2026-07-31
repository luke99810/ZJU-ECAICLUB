/**
 * 公开投稿 —— 官网前端直接提交项目，**不需要登录**。
 *
 * 邮箱是**必填**的：它不只是联系方式，还决定这条投稿归哪一档 ——
 * 学校域名（zju.edu.cn）但不在成员名单里算「校友投稿」，其他后缀算「校外投稿」，
 * 两者都由社团成员审核。如果邮箱本身就是在册成员，这里会拦下来让他登录提交，
 * 那样项目才会挂到他名下、出现在「我的项目」里。
 *
 * 联系方式只给审核界面看，绝不出现在对外页面。
 */
import { useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import CoverUpload from './CoverUpload';
import { createProject } from '../lib/store';
import { CAMPUS_EMAIL_DOMAIN, classifySubmission } from '../lib/submission';
import {
  AI_TAGS,
  FUNCTION_TAGS,
  ORIGIN_LABEL,
  type AiTag,
  type FunctionTag,
  type SubmissionOrigin,
} from '../types';

interface SubmitProjectModalProps {
  onClose: () => void;
}

const orUndefined = (v: string) => (v.trim() ? v.trim() : undefined);

export default function SubmitProjectModal({ onClose }: SubmitProjectModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [stack, setStack] = useState('');
  const [tags, setTags] = useState<AiTag[]>([]);
  const [functions, setFunctions] = useState<FunctionTag[]>([]);
  const [cover, setCover] = useState('');
  const [github, setGithub] = useState('');
  const [blog, setBlog] = useState('');
  const [paper, setPaper] = useState('');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** 提交成功后告诉投稿人归到了哪一档，别让人猜。 */
  const [origin, setOrigin] = useState<SubmissionOrigin>('external');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (functions.length === 0 || tags.length === 0) {
      setError('功能场景与技术标签各至少选一个');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { origin: kind, isRegisteredMember } = await classifySubmission(contact);
      if (isRegisteredMember) {
        setError(
          '这个邮箱已经是社团成员账号。请到「成员登录提交」入口登录后提交，项目会挂到你名下。'
        );
        setBusy(false);
        return;
      }
      setOrigin(kind);
      await createProject({
        title: title.trim(),
        summary: summary.trim(),
        stack: stack
          .split(/[,，]/)
          .map(s => s.trim())
          .filter(Boolean),
        tags,
        functions,
        cover_url: orUndefined(cover),
        github_url: orUndefined(github),
        blog_url: orUndefined(blog),
        paper_url: orUndefined(paper),
        origin: kind,
        // 公开投稿没有 author_id —— 审核权限就是靠 origin 区分的。
        author_name: name.trim(),
        submitter_org: orUndefined(org),
        submitter_contact: contact.trim(),
      });
      setDone(true);
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
          <p className="text-sm text-gray-600 leading-relaxed mb-2">
            已归为
            <span className="mx-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-800">
              {ORIGIN_LABEL[origin]}
            </span>
            ，进入审核队列。社团成员审核通过后会出现在作品集页。
          </p>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">有问题我们会用你留的邮箱联系。</p>
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

  const chip = (active: boolean, accent: 'blue' | 'emerald') =>
    `px-3 py-1.5 rounded-full text-sm transition-colors ${
      active
        ? accent === 'blue'
          ? 'bg-blue-600 text-white'
          : 'bg-emerald-600 text-white'
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
          <h2 className="font-semibold text-gray-900">投稿一个 AI 项目</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          不用注册。社团成员审核通过后，你的项目会出现在作品集页。
        </p>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1.5">项目名称 *</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1.5">项目简介 *</span>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={4}
            required
            placeholder="做什么、怎么做、有什么效果。"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <div className="mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1.5">功能场景 *</span>
          <p className="text-xs text-gray-500 mb-2">别人拿它能做什么。</p>
          <div className="flex flex-wrap gap-2">
            {FUNCTION_TAGS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setFunctions(cur =>
                    cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]
                  )
                }
                className={chip(functions.includes(t), 'emerald')}
              >
                {t}
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
                className={chip(tags.includes(t), 'blue')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1.5">
            技术栈（逗号分隔）
          </span>
          <input
            value={stack}
            onChange={e => setStack(e.target.value)}
            placeholder="PyTorch, LangChain, Next.js"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <CoverUpload value={cover} onChange={setCover} />

        {(
          [
            ['GitHub 链接', github, setGithub],
            ['推文 / 博客链接', blog, setBlog],
            ['论文链接', paper, setPaper],
          ] as Array<[string, string, (v: string) => void]>
        ).map(([label, value, setter]) => (
          <label key={label} className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
            <input
              type="url"
              value={value}
              onChange={e => setter(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        ))}

        <div className="border-t border-gray-100 pt-4 mb-4">
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
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">学校 / 单位</span>
              <input
                value={org}
                onChange={e => setOrg(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <label className="block mt-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">联系邮箱 *</span>
            <input
              type="email"
              value={contact}
              onChange={e => setContact(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="block text-xs text-gray-500 mt-1.5">
              用 <code className="px-1 rounded bg-gray-100">{CAMPUS_EMAIL_DOMAIN}</code>{' '}
              邮箱会归为「校友投稿」，其他后缀归为「校外投稿」。
              邮箱只有审核成员看得到，不会出现在公开页面。
            </span>
          </label>
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
            提交投稿
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
