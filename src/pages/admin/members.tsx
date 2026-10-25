/**
 * 成员管理（仅管理员）：录入学号 + 邮箱开通账号，初始口令即学号。
 * 也能把忘记口令的成员重置回学号。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, KeyRound, Loader2, Pencil, Plus, Upload, X } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import {
  MAX_ADMINS,
  addMember,
  resetMemberPassword,
  updateMember,
  usesDefaultPassword,
} from '../../lib/auth';
import { listMembers } from '../../lib/store';
import { usingRealAuth } from '../../lib/auth';
import {
  IMPORT_ACCEPT,
  MAX_IMPORT_ROWS,
  buildTemplateCsv,
  importMembers,
  parseMemberFile,
  type ParseReport,
} from '../../lib/memberImport';
import {
  ACTIVE_YEARS,
  ADMIN_DEPARTMENT,
  AI_TAGS,
  DEPARTMENTS,
  isAlumniMember,
  type AiTag,
  type Member,
} from '../../types';

interface FormState {
  name: string;
  student_id: string;
  email: string;
  department: string;
  tags: AiTag[];
  /** 兴趣方向，自由文本 —— 研究方向常落在固定标签词表之外 */
  interests: string;
  bio: string;
  joinedYear: number;
}

/** 供年份下拉用：今年往前 8 年，够覆盖在读+往届。 */
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => CURRENT_YEAR - i);

const EMPTY: FormState = {
  name: '',
  student_id: '',
  email: '',
  // 默认落在技术部 —— 绝大多数新人进这里，也避免手滑把人加成管理员。
  department: '技术部',
  tags: [],
  interests: '',
  bio: '',
  joinedYear: CURRENT_YEAR,
};

export default function MembersPage() {
  const [rows, setRows] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  /** 正在编辑的成员 id；null 表示新增。同一套表单两用，字段才不会两边对不齐。 */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * 批量导入分两步：先解析出预览报告让管理员看清楚，确认后再落库。
   * 不做「选了文件就直接写」—— 名单是要对人负责的数据。
   */
  const [report, setReport] = useState<ParseReport | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => setRows(await listMembers()), []);
  const adminCount = rows.filter(m => m.role === 'admin').length;
  const adminSlotsFull = adminCount >= MAX_ADMINS;

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (editingId) {
      // 管理员可改任意成员的全部资料字段，以及学号（登录标识之一）。
      // 邮箱是登录账号，不在这里开放修改。动到学号前弹确认窗口，防止误改换掉登录入口。
      const original = rows.find(m => m.id === editingId);
      const accountChanged =
        original !== undefined &&
        original.student_id !== form.student_id.trim();
      if (accountChanged) {
        if (!window.confirm(`确认修改「${form.name}」的学号？\n\n学号是登录标识之一，改它等于换账号。`)) {
          setBusy(false);
          return;
        }
      }
      const { member, error: err } = await updateMember(editingId, {
        name: form.name,
        student_id: form.student_id,
        email: form.email,
        department: form.department,
        tags: form.tags,
        interests: form.interests,
        bio: form.bio,
        joinedYear: form.joinedYear,
      });
      setBusy(false);
      if (!member) {
        setError(err ?? '保存失败');
        return;
      }
      setNotice(
        `已更新 ${member.name} 的资料${accountChanged ? '（含学号）' : ''}，社团成员页刷新即可看到。`
      );
    } else {
      const { member, error: err } = await addMember({
        name: form.name,
        student_id: form.student_id,
        email: form.email,
        department: form.department,
        tags: form.tags,
        interests: form.interests,
        bio: form.bio,
        joinedYear: form.joinedYear,
      });
      setBusy(false);
      if (!member) {
        setError(err ?? '添加失败');
        return;
      }
      setNotice(
        `已开通 ${member.name}（${member.student_id}）—— 初始口令就是学号，请通知本人登录后修改。`
      );
    }

    setForm(EMPTY);
    setEditingId(null);
    setShowForm(false);
    await reload();
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
    setShowForm(true);
  };

  const reset = async (m: Member) => {
    // 真登录模式下前端拿不到 Admin API，只能发重置邮件；本地演示才是「改回学号」。
    // 确认语要说清楚实际会发生什么，不能两种模式共用一句。
    const ask = usingRealAuth
      ? `给 ${m.name}（${m.email}）发一封口令重置邮件？`
      : `把 ${m.name} 的口令重置为学号 ${m.student_id}？`;
    if (!window.confirm(ask)) return;
    const { ok, error: err } = await resetMemberPassword(m.id);
    if (!ok) {
      setError(err ?? '重置失败');
      return;
    }
    setNotice(
      usingRealAuth
        ? `重置邮件已发往 ${m.email}，请提醒本人查收（可能在垃圾箱）。`
        : `${m.name} 的口令已重置为学号 ${m.student_id}。`
    );
    await reload();
  };

  /**
   * 编辑成员资料。原来这里是连着弹四个 window.prompt —— 能用，但没法选标签、
   * 填错了要从头再来，而且前台展示的字段（兴趣方向）根本没地方填。改成复用新增表单。
   */
  const editProfile = (m: Member) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      student_id: m.student_id,
      email: m.email,
      department: m.department,
      tags: m.tags,
      interests: m.interests ?? '',
      bio: m.bio ?? '',
      joinedYear: Number(m.joined_at.slice(0, 4)) || CURRENT_YEAR,
    });
    setError(null);
    setNotice(null);
    setShowForm(true);
  };

  const pickFile = async (file: File) => {
    setError(null);
    setNotice(null);
    try {
      setReport(await parseMemberFile(file));
    } catch (e) {
      setError(`解析失败：${(e as Error).message}`);
    }
  };

  const runImport = async () => {
    if (!report || importing) return;
    setImporting(true);
    const { added, updated, failures } = await importMembers(report.rows);
    setImporting(false);
    setReport(null);
    await reload();
    setNotice(
      `导入完成：新增 ${added} 人，覆盖 ${updated} 人${failures.length ? `，${failures.length} 条未导入` : ''}。` +
        (added ? '新增的初始口令都是本人学号，请通知各位登录后修改。' : '')
    );
    // 失败原因逐条给出来，管理员才知道该改表格哪一行
    setError(failures.length ? failures.join('；') : null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '成员导入模板.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toggleTag = (t: AiTag) =>
    setForm(f => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
    }));

  return (
    <AdminShell title="成员管理" adminOnly>
      <div className="flex items-start justify-between gap-4 mb-6">
        <p className="text-sm text-gray-600">
          {usingRealAuth ? (
            <>
              录入学号与邮箱即把人加进名册，口令由本人自助设定（见下方蓝框）。
            </>
          ) : (
            <>
              录入学号与邮箱即开通账号，初始口令为
              <span className="font-medium text-gray-900">学号</span>，成员登录后可自行修改。
            </>
          )}
          部门选「管理层」即为管理员，名额 {adminCount}/{MAX_ADMINS}。
          <br />
          人多时用 CSV / XLSX 批量导入，单次上限 {MAX_IMPORT_ROWS} 行；管理层需单独添加。
          <br />
          这里改的资料（部门 / 兴趣方向 / 技术标签 / 简介 / 加入年份）会直接反映到对外的
          <span className="text-gray-900">社团成员</span>页。
          <span className="text-gray-900">往届按加入年份自动判定</span>
          （距今满 {ACTIVE_YEARS} 年即归入往届），不需要手工标记。
        </p>
        <div className="shrink-0 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            下载模板
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <input
            ref={importRef}
            type="file"
            accept={IMPORT_ACCEPT}
            hidden
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void pickFile(f);
              // 清空，否则连续选同一个文件不会触发 change
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            添加成员
          </button>
        </div>
      </div>

      {notice && (
        <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {/* 真登录模式下加人只是「登记名册」，账号要本人自助激活 —— 不说清楚，
          管理员会以为加完就能用，然后奇怪为什么对方登不上。 */}
      {usingRealAuth && (
        <p className="mb-4 text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          这里加人是<span className="font-medium">登记名册</span>，不会直接开通账号。
          加完请通知本人：用登记的邮箱到登录页点「首次登录？点这里设置口令」自助激活，
          激活后才会出现在下面的列表里。
        </p>
      )}

      {report && (
        <div className="mb-6 bg-white rounded-xl border border-blue-300 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">导入预览</h2>
          <p className="text-sm text-gray-600 mb-3">
            识别到 <span className="text-gray-900">{report.rows.length}</span> 行可导入
            {report.ignored.length > 0 && (
              <span className="text-gray-400">（未识别的列已忽略：{report.ignored.join('、')}）</span>
            )}
            。确认无误再写入，初始口令都是本人学号。
          </p>

          {report.rows.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 mb-3">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">行</th>
                    <th className="text-left font-medium px-3 py-2">姓名</th>
                    <th className="text-left font-medium px-3 py-2">学号</th>
                    <th className="text-left font-medium px-3 py-2">邮箱</th>
                    <th className="text-left font-medium px-3 py-2">部门</th>
                    <th className="text-left font-medium px-3 py-2">标签</th>
                    <th className="text-left font-medium px-3 py-2">兴趣方向</th>
                    <th className="text-left font-medium px-3 py-2">年份</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.rows.map(r => (
                    <tr key={r.line}>
                      <td className="px-3 py-1.5 text-gray-400">{r.line}</td>
                      <td className="px-3 py-1.5 text-gray-900">{r.name}</td>
                      <td className="px-3 py-1.5 font-mono">{r.student_id}</td>
                      <td className="px-3 py-1.5">{r.email}</td>
                      <td className="px-3 py-1.5">{r.department}</td>
                      <td className="px-3 py-1.5">{r.tags.join('、') || '—'}</td>
                      <td className="px-3 py-1.5">{r.interests || '—'}</td>
                      <td className="px-3 py-1.5">{r.joinedYear ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.errors.length > 0 && (
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 max-h-40 overflow-auto">
              <p className="text-xs font-medium text-amber-900 mb-1">
                {report.errors.length} 处问题（这些行不会导入）
              </p>
              <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                {report.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing || report.rows.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              导入这 {report.rows.length} 人
            </button>
            <button
              type="button"
              onClick={() => setReport(null)}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">姓名</th>
              <th className="text-left font-medium px-4 py-2.5">学号</th>
              <th className="text-left font-medium px-4 py-2.5">邮箱</th>
              <th className="text-left font-medium px-4 py-2.5">部门</th>
              <th className="text-left font-medium px-4 py-2.5">加入年份</th>
              <th className="text-left font-medium px-4 py-2.5">兴趣方向</th>
              <th className="text-left font-medium px-4 py-2.5">权限</th>
              <th className="text-left font-medium px-4 py-2.5">口令</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(m => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 text-gray-900">
                  {m.name}
                  {isAlumniMember(m) && (
                    <span className="ml-1.5 text-xs text-gray-400">往届</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{m.student_id}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.email}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.department}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.joined_at.slice(0, 4)}</td>
                <td className="px-4 py-2.5 text-gray-600 max-w-[12rem] truncate">
                  {m.interests || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  {m.role === 'admin' ? (
                    <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-xs">
                      管理员
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">成员</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {usesDefaultPassword(m) ? (
                    <span className="text-amber-700 text-xs">
                      {usingRealAuth ? '待激活' : '仍是初始口令'}
                    </span>
                  ) : (
                    <span className="text-emerald-700 text-xs">已自行设定</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => void editProfile(m)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 mr-1.5 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    改资料
                  </button>
                  <button
                    type="button"
                    onClick={() => void reset(m)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    重置口令
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={submit}
            onClick={e => e.stopPropagation()}
            className="mx-auto my-8 w-full max-w-lg bg-white rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">
                {editingId ? '编辑成员资料' : '添加成员'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">姓名 *</span>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">学号 *</span>
                <input
                  value={form.student_id}
                  onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
                  required
                  placeholder="22451001"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <label className="block mt-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">邮箱 *</span>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                disabled={!!editingId}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
              {editingId && (
                <span className="block text-xs text-gray-500 mt-1.5">
                  邮箱是登录账号，这里不开放修改；学号可改，改动会弹出确认窗口。
                </span>
              )}
            </label>

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">部门</span>
                <select
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DEPARTMENTS.map(d => (
                    <option
                      key={d}
                      value={d}
                      disabled={d === ADMIN_DEPARTMENT && adminSlotsFull}
                    >
                      {d}
                      {d === ADMIN_DEPARTMENT
                        ? adminSlotsFull
                          ? `（管理员·名额已满 ${MAX_ADMINS}/${MAX_ADMINS}）`
                          : '（= 管理员）'
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <p className="text-xs text-gray-500 leading-relaxed pb-2">
                  选「管理层」即为管理员，不需要另设权限。
                  {adminSlotsFull && (
                    <span className="text-amber-700">
                      {' '}
                      当前管理层已满 {MAX_ADMINS}/{MAX_ADMINS}。
                    </span>
                  )}
                </p>
              </div>
            </div>

            <label className="block mt-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">加入年份</span>
              <select
                value={form.joinedYear}
                onChange={e => setForm(f => ({ ...f, joinedYear: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
              <span className="block text-xs text-gray-500 mt-1.5">
                按学年记，统一存为该年 9 月 1 日。
              </span>
            </label>

            <div className="mt-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">技术标签</span>
              <div className="flex flex-wrap gap-2">
                {AI_TAGS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1.5 rounded-full text-sm ${
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

            <label className="block mt-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">兴趣方向</span>
              <input
                value={form.interests}
                onChange={e => setForm(f => ({ ...f, interests: e.target.value }))}
                placeholder="如：智慧交通、柔性直流输电、科研辅助工具链"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="block text-xs text-gray-500 mt-1.5">
                自由填写，会显示在社团成员页。研究方向落在上面标签词表之外时填这里。
              </span>
            </label>

            <label className="block mt-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">简介</span>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            {!editingId && (
              <p className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                {usingRealAuth
                  ? '保存后这个人进入名册，还没有账号。请通知本人用这个邮箱到登录页自助设置口令。'
                  : '开通后初始口令 = 学号。请提醒本人首次登录后立即修改。'}
              </p>
            )}

            {error && (
              <p className="mt-3 text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                开通账号
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
