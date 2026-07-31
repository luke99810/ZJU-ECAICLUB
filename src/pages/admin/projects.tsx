/**
 * 我的 AI 项目管理：新增 / 编辑 / 删除自己的项目。
 *
 * 表单里嵌了两个 AI 助手按钮（生成简介、自动打标签）—— 方案里「AI 项目简介生成器」
 * 和「AI 标签自动生成」的落点就在这里，而不是另开一个页面：写项目介绍的当口
 * 才是这两个功能真正有用的时刻。
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import ProjectCard from '../../components/ProjectCard';
import CoverUpload from '../../components/CoverUpload';
import { getSession } from '../../lib/auth';
import { AiNotConfiguredError, runAi } from '../../lib/ai';
import { createProject, deleteProject, listProjects, updateProject } from '../../lib/store';
import {
  AI_TAGS,
  FUNCTION_TAGS,
  type AiProject,
  type AiTag,
  type FunctionTag,
  type Member,
} from '../../types';

interface FormState {
  title: string;
  summary: string;
  stack: string;
  tags: AiTag[];
  functions: FunctionTag[];
  cover_url: string;
  github_url: string;
  blog_url: string;
  paper_url: string;
}

const EMPTY: FormState = {
  title: '',
  summary: '',
  stack: '',
  tags: [],
  functions: [],
  cover_url: '',
  github_url: '',
  blog_url: '',
  paper_url: '',
};

function toForm(p: AiProject): FormState {
  return {
    title: p.title,
    summary: p.summary,
    stack: p.stack.join(', '),
    tags: p.tags,
    functions: p.functions ?? [],
    cover_url: p.cover_url ?? '',
    github_url: p.github_url ?? '',
    blog_url: p.blog_url ?? '',
    paper_url: p.paper_url ?? '',
  };
}

/** 空字符串不要写进库 —— 否则卡片会渲染出一个指向 "" 的死链。 */
function orUndefined(v: string): string | undefined {
  const t = v.trim();
  return t ? t : undefined;
}

export default function MyProjectsPage() {
  const [member, setMember] = useState<Member | null>(null);
  const [rows, setRows] = useState<AiProject[]>([]);
  const [editing, setEditing] = useState<AiProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<'intro' | 'tags' | 'functions' | null>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);

  const reload = useCallback(async (id: string) => {
    setRows(await listProjects({ authorId: id }));
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) return;
    setMember(s.member);
    void reload(s.member.id);
  }, [reload]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setAiHint(null);
    setShowForm(true);
  };

  const openEdit = (p: AiProject) => {
    setEditing(p);
    setForm(toForm(p));
    setAiHint(null);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || saving) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      stack: form.stack
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean),
      tags: form.tags,
      functions: form.functions,
      cover_url: orUndefined(form.cover_url),
      github_url: orUndefined(form.github_url),
      blog_url: orUndefined(form.blog_url),
      paper_url: orUndefined(form.paper_url),
    };
    if (editing) {
      await updateProject(editing.id, payload);
    } else {
      await createProject({ ...payload, author_id: member.id, author_name: member.name });
    }
    await reload(member.id);
    setSaving(false);
    setShowForm(false);
  };

  const remove = async (p: AiProject) => {
    if (!member) return;
    if (!window.confirm(`删除「${p.title}」？此操作不可撤销。`)) return;
    await deleteProject(p.id);
    await reload(member.id);
  };

  /** 用项目要点生成简介；没填要点就拿标题当要点，总比什么都不做好。 */
  const genIntro = async () => {
    const seedText = form.summary.trim() || form.title.trim();
    if (!seedText) {
      setAiHint('先填一点项目要点或标题，再让 AI 帮你写简介。');
      return;
    }
    setAiBusy('intro');
    setAiHint(null);
    try {
      const r = await runAi('intro', seedText);
      setForm(f => ({ ...f, summary: r.text }));
    } catch (e) {
      setAiHint(
        e instanceof AiNotConfiguredError ? e.message : `生成失败：${(e as Error).message}`
      );
    } finally {
      setAiBusy(null);
    }
  };

  const genTags = async () => {
    const seedText = `${form.title}\n${form.summary}`.trim();
    if (!seedText) {
      setAiHint('先填标题或简介，AI 才有依据打标签。');
      return;
    }
    setAiBusy('tags');
    setAiHint(null);
    try {
      const r = await runAi('tags', seedText);
      // 模型偶尔会带上解释或用中文逗号，这里按多种分隔切开，再与白名单求交集。
      const picked = r.text
        .split(/[,，、\n]/)
        .map(s => s.trim())
        .filter((s): s is AiTag => (AI_TAGS as readonly string[]).includes(s));
      if (picked.length === 0) {
        setAiHint(`AI 没给出可用标签（原始输出：${r.text.slice(0, 40)}），请手动勾选。`);
        return;
      }
      setForm(f => ({ ...f, tags: Array.from(new Set(picked)).slice(0, 3) }));
    } catch (e) {
      setAiHint(
        e instanceof AiNotConfiguredError ? e.message : `生成失败：${(e as Error).message}`
      );
    } finally {
      setAiBusy(null);
    }
  };

  const genFunctions = async () => {
    const seedText = `${form.title}
${form.summary}`.trim();
    if (!seedText) {
      setAiHint('先填标题或简介，AI 才有依据判断用途。');
      return;
    }
    setAiBusy('functions');
    setAiHint(null);
    try {
      const r = await runAi('functions', seedText);
      const picked = r.text
        .split(/[,，、\n]/)
        .map(x => x.trim())
        .filter((x): x is FunctionTag => (FUNCTION_TAGS as readonly string[]).includes(x));
      if (picked.length === 0) {
        setAiHint(`AI 没给出可用的功能标签（原始输出：${r.text.slice(0, 40)}），请手动勾选。`);
        return;
      }
      setForm(f => ({ ...f, functions: Array.from(new Set(picked)).slice(0, 3) }));
    } catch (e) {
      setAiHint(
        e instanceof AiNotConfiguredError ? e.message : `生成失败：${(e as Error).message}`
      );
    } finally {
      setAiBusy(null);
    }
  };

  const toggleFunction = (t: FunctionTag) => {
    setForm(f => ({
      ...f,
      functions: f.functions.includes(t)
        ? f.functions.filter(x => x !== t)
        : [...f.functions, t],
    }));
  };

  const toggleTag = (t: AiTag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
    }));
  };

  return (
    <AdminShell title="我的项目">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-600">
          提交后进入待审核，管理员通过后才会出现在对外的作品集页。
        </p>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          新增项目
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-gray-600 mb-1">还没有项目</p>
          <p className="text-sm text-gray-400">点右上角「新增项目」把你的作品放上来。</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              showStatus
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={save}
            onClick={e => e.stopPropagation()}
            className="mx-auto my-8 w-full max-w-xl bg-white rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">
                {editing ? '编辑项目' : '新增项目'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editing?.status === 'approved' && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                这个项目已通过审核。保存修改后会重新进入待审核状态。
              </p>
            )}

            <label className="block mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">项目名称 *</span>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">项目简介 *</span>
                <button
                  type="button"
                  onClick={() => void genIntro()}
                  disabled={aiBusy !== null}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {aiBusy === 'intro' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  AI 帮我写
                </button>
              </div>
              <textarea
                value={form.summary}
                onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                rows={4}
                required
                placeholder="先写几个要点也行，然后点「AI 帮我写」润成完整简介。"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">功能场景 *</span>
                <button
                  type="button"
                  onClick={() => void genFunctions()}
                  disabled={aiBusy !== null}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {aiBusy === 'functions' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  AI 自动判断
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                别人拿它能做什么 —— 作品集里主要按这个找项目。
              </p>
              <div className="flex flex-wrap gap-2">
                {FUNCTION_TAGS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleFunction(t)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      form.functions.includes(t)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">技术标签 *</span>
                <button
                  type="button"
                  onClick={() => void genTags()}
                  disabled={aiBusy !== null}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {aiBusy === 'tags' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  AI 自动打标签
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {AI_TAGS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      form.tags.includes(t)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {aiHint && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 leading-relaxed">
                {aiHint}
              </p>
            )}

            <label className="block mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">
                技术栈（逗号分隔）
              </span>
              <input
                value={form.stack}
                onChange={e => setForm(f => ({ ...f, stack: e.target.value }))}
                placeholder="PyTorch, LangChain, Next.js"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <CoverUpload
              value={form.cover_url}
              onChange={v => setForm(f => ({ ...f, cover_url: v }))}
            />

            {(
              [
                ['github_url', 'GitHub 链接'],
                ['blog_url', '推文 / 博客链接'],
                ['paper_url', '论文链接'],
              ] as Array<[keyof FormState, string]>
            ).map(([key, label]) => (
              <label key={key} className="block mb-4">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
                <input
                  type="url"
                  value={form[key] as string}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="https://…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || form.tags.length === 0 || form.functions.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? '保存' : '提交审核'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              {(form.tags.length === 0 || form.functions.length === 0) && (
                <span className="self-center text-xs text-gray-400">
                  功能场景与技术标签各至少选一个
                </span>
              )}
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
