/**
 * 我的账号：编辑个人资料 + 修改口令。
 *
 * 资料改完直接反映到对外的团队页 —— 这是成员自助维护自己那张卡片的唯一入口。
 * 学号/邮箱/权限不在这里改（属于账号管理，走「成员管理」）。
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { changePassword, getSession, updateProfile, usesDefaultPassword } from '../../lib/auth';
import { MIN_PASSWORD_LENGTH } from '../../lib/password';
import { DEPARTMENTS, AI_TAGS, type AiTag, type Member } from '../../types';

export default function AccountPage() {
  const [member, setMember] = useState<Member | null>(null);

  // 资料表单
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<string>('技术部');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [tags, setTags] = useState<AiTag[]>([]);
  const [interests, setInterests] = useState('');
  const [pBusy, setPBusy] = useState(false);
  const [pErr, setPErr] = useState<string | null>(null);
  const [pDone, setPDone] = useState(false);

  // 口令表单
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const m = getSession()?.member ?? null;
    setMember(m);
    if (m) {
      setName(m.name);
      setDepartment(m.department);
      setBio(m.bio ?? '');
      setAvatar(m.avatar_url ?? '');
      setTags(m.tags);
      setInterests(m.interests ?? '');
    }
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || pBusy) return;
    setPBusy(true);
    setPErr(null);
    setPDone(false);
    const { ok, error: err } = await updateProfile(member.id, {
      name,
      department,
      bio,
      avatar_url: avatar,
      tags,
      interests,
    });
    setPBusy(false);
    if (!ok) {
      setPErr(err ?? '保存失败');
      return;
    }
    setMember(getSession()?.member ?? member);
    setPDone(true);
    setTimeout(() => setPDone(false), 2000);
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError('两次输入的新口令不一致');
      return;
    }
    setBusy(true);
    const { ok, error: err } = await changePassword(current, next);
    setBusy(false);
    if (!ok) {
      setError(err ?? '修改失败');
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setMember(getSession()?.member ?? null);
    setDone(true);
  };

  const toggleTag = (t: AiTag) =>
    setTags(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]));

  return (
    <AdminShell title="我的账号">
      <div className="space-y-6">
        {member && usesDefaultPassword(member) && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
            你还在用初始口令。初始口令是公开可推测的（成员为学号），请现在就改掉。
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* ── 个人资料 ─────────────────────────────── */}
          <form onSubmit={saveProfile} className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">个人资料</h2>
          <p className="text-sm text-gray-500 mb-4">
            保存后立即反映到对外的<span className="text-gray-800">团队成员</span>页。
          </p>

          {member && (
            <dl className="grid grid-cols-3 gap-y-1.5 text-sm mb-5 bg-gray-50 rounded-lg px-3 py-2.5">
              <dt className="text-gray-500">学号</dt>
              <dd className="col-span-2 text-gray-900 font-mono text-xs">{member.student_id}</dd>
              <dt className="text-gray-500">邮箱</dt>
              <dd className="col-span-2 text-gray-900">{member.email}</dd>
              <dt className="text-gray-500">权限</dt>
              <dd className="col-span-2 text-gray-900">
                {member.role === 'admin' ? '管理员（管理层）' : '成员'}
                <span className="text-gray-400 text-xs">
                  （学号与邮箱需管理员在「成员管理」修改；权限由部门决定）
                </span>
              </dd>
            </dl>
          )}

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
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
              <span className="block text-sm font-medium text-gray-700 mb-1.5">部门</span>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              技术标签（社团成员页按这个找人）
            </span>
            <div className="flex flex-wrap gap-2">
              {AI_TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    tags.includes(t)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">兴趣方向</span>
            <input
              value={interests}
              onChange={e => setInterests(e.target.value)}
              placeholder="如：智慧交通、柔性直流输电、科研辅助工具链"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="block text-xs text-gray-500 mt-1.5">
              自由填写，会显示在社团成员页。研究方向落在上面标签词表之外时填这里。
            </span>
          </label>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">简介</span>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder="一两句话介绍自己的方向与在社团做的事。"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">头像 URL</span>
            <input
              type="url"
              value={avatar}
              onChange={e => setAvatar(e.target.value)}
              placeholder="留空则用姓氏首字占位"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {pErr && (
            <p className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-4">{pErr}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pBusy}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {pBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              保存资料
            </button>
            {pDone && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                已保存
              </span>
            )}
          </div>
        </form>

          {/* ── 修改口令 ─────────────────────────────── */}
          <form onSubmit={savePassword} className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">修改口令</h2>

          {(
            [
              ['current', '当前口令', current, setCurrent, 'current-password'],
              ['next', '新口令', next, setNext, 'new-password'],
              ['confirm', '再输一次新口令', confirm, setConfirm, 'new-password'],
            ] as Array<[string, string, string, (v: string) => void, string]>
          ).map(([key, label, value, setter, autoComplete]) => (
            <label key={key} className="block mb-4">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
              <input
                type="password"
                value={value}
                onChange={e => setter(e.target.value)}
                required
                autoComplete={autoComplete}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          ))}

          <p className="text-xs text-gray-500 mb-4">
            至少 {MIN_PASSWORD_LENGTH} 位，且不能全是数字（否则跟学号一样好猜）。
          </p>

          {error && (
            <p className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}
          {done && (
            <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-4">
              <CheckCircle2 className="w-4 h-4" />
              口令已更新
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            保存口令
          </button>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
