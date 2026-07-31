/**
 * 成员登录。账号可填**学号或邮箱**，口令按社团规则：
 *   - 初始管理员：账号 admin，口令 AICLUB.2026
 *   - 管理员录入的成员：初始口令就是自己的学号
 * 登录后如果还在用出厂口令，后台会提示去改。
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '../../components/Logo';
import { activateAccount, getSession, onAuthStateChange, signIn, usingRealAuth, type MaybeSession } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * 首次激活：管理员把人加进名册后，本人用这个邮箱自助设口令。
   * 只有真登录模式才有这一步 —— 本地演示模式的初始口令是学号，不需要激活。
   */
  const [mode, setMode] = useState<'signin' | 'activate'>('signin');
  const [notice, setNotice] = useState<string | null>(null);

  const next = typeof router.query.next === 'string' ? router.query.next : '/admin';

  useEffect(() => {
    // 会话可能还在恢复中（Supabase 是异步的），所以要订阅而不是只判一次
    if (getSession()) void router.replace(next);
    return onAuthStateChange((sess: MaybeSession) => {
      if (sess) void router.replace(next);
    });
  }, [router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === 'activate') {
      const r = await activateAccount(identifier, password);
      setBusy(false);
      if (!r.ok) {
        setError(r.error ?? '设置失败');
        return;
      }
      if (r.needsConfirm) {
        setNotice('口令已设置。请到邮箱点确认链接，然后回来登录。');
        setMode('signin');
        return;
      }
      void router.replace(next);
      return;
    }

    const { session, error: err } = await signIn(identifier, password);
    setBusy(false);
    if (!session) {
      setError(err ?? '登录失败');
      return;
    }
    void router.replace(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Logo size={36} />
          <span className="font-semibold text-gray-900">AI Club 成员后台</span>
        </Link>

        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              {usingRealAuth ? '邮箱' : '学号 / 邮箱'}
            </span>
            <input
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="22451001 或 you@aiclub.zju"
              required
              autoFocus
              autoComplete="username"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">口令</span>
            <div className="relative">
              <input
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pr-10 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setReveal(v => !v)}
                aria-label={reveal ? '隐藏口令' : '显示口令'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              >
                {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="block text-xs text-gray-500 mt-1.5">
              {!usingRealAuth
                ? '首次登录请用初始口令：成员为本人学号，管理员见社团内部通知。'
                : mode === 'activate'
                  ? '用管理员登记的那个邮箱，自己设一个口令（至少 8 位）。邮箱不在名册里会提示你先联系管理员。'
                  : '用社团给你开通的邮箱登录。忘记口令可以让管理员发一封重置邮件。'}
            </span>
          </label>

          {notice && (
            <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 mb-4">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'activate' ? '设置口令并进入' : '登录'}
          </button>

          {/* 只有真登录模式需要激活这一步：管理员把人加进名册后，本人自助设口令 */}
          {usingRealAuth && (
            <button
              type="button"
              onClick={() => {
                setMode(m => (m === 'signin' ? 'activate' : 'signin'));
                setError(null);
                setNotice(null);
              }}
              className="w-full mt-3 text-xs text-blue-600 hover:underline"
            >
              {mode === 'signin'
                ? '管理员刚把我加进名册，还没有口令 →'
                : '← 已经有账号了，去登录'}
            </button>
          )}
        </form>

        {/* 切到真登录之后这块必须消失 —— 线上还挂着「改 localStorage 就能绕过」
            会让人以为正式环境也不安全。 */}
        {!usingRealAuth && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-medium text-amber-900 mb-1">演示环境提示</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              当前口令校验在浏览器本地完成（SHA-256 + 盐，不存明文），仅供演示 ——
              改一改 localStorage 就能绕过。填上 Supabase 环境变量即可切换到真实登录。
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          {usingRealAuth
            ? '忘记口令请联系社团管理员发送重置邮件。'
            : '忘记口令请联系社团管理员重置为学号。'}
        </p>
      </div>
    </div>
  );
}
