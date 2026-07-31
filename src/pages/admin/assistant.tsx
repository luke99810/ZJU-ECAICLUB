/**
 * AI 客服「小艾」配置（仅管理员）。
 *
 * 分两块，性质不同：
 *   - **人设与资料**：存在站点设置里，改完立即生效（接 Supabase 前只对本浏览器生效）。
 *   - **API 密钥**：属于服务端机密。本地开发可以直接写进 .env.local；线上必须去
 *     Cloudflare 控制台配 —— 页面上把原因写清楚，而不是假装能改。
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, ShieldAlert } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { usingSupabase } from '../../lib/store';
import {
  DEFAULT_ASSISTANT,
  getAssistantSettings,
  resetAssistantSettings,
  saveAssistantSettings,
  type AssistantSettings,
} from '../../lib/settings';

interface KeyStatus {
  configured: boolean;
  hint: string;
  base: string;
  model: string;
  writable: boolean;
}

export default function AssistantConfigPage() {
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_ASSISTANT);
  const [saved, setSaved] = useState(false);

  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [base, setBase] = useState('');
  const [model, setModel] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [keyErr, setKeyErr] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = (await (await fetch('/api/ai-config')).json()) as KeyStatus;
      setStatus(s);
      setBase(s.base);
      setModel(s.model);
    } catch {
      /* 接口不可用时下面会显示 status === null 的分支 */
    }
  }, []);

  useEffect(() => {
    getAssistantSettings().then(setSettings);
    void loadStatus();
  }, [loadStatus]);

  const [saveErr, setSaveErr] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveErr(null);
    try {
      await saveAssistantSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // 存进真库会失败（权限、网络），不能让「已保存」在没存上时亮起来
      setSaveErr((err as Error).message);
    }
  };

  const saveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (keyBusy) return;
    setKeyBusy(true);
    setKeyMsg(null);
    setKeyErr(null);
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, base, model }),
      });
      const body = (await res.json()) as { notice?: string; error?: string };
      if (!res.ok) setKeyErr(body.error ?? `保存失败（${res.status}）`);
      else {
        setKeyMsg(body.notice ?? '已保存');
        setApiKey('');
      }
    } catch (err) {
      setKeyErr((err as Error).message);
    } finally {
      setKeyBusy(false);
      void loadStatus();
    }
  };

  const field = (
    label: string,
    key: keyof Omit<AssistantSettings, 'suggestions'>,
    rows: number,
    hint?: string
  ) => (
    <label className="block mb-5">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
      {rows === 1 ? (
        <input
          value={settings[key]}
          onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <textarea
          value={settings[key]}
          onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
          rows={rows}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {hint && <span className="block text-xs text-gray-500 mt-1.5">{hint}</span>}
    </label>
  );

  return (
    <AdminShell title="AI 客服配置" adminOnly>
      <div className="max-w-3xl space-y-8">
        {/* ── 人设与资料 ─────────────────────────────────── */}
        <form onSubmit={save} className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">人设与资料</h2>
          <p className="text-sm text-gray-500 mb-5">
            小艾回答时会依据「站内检索结果 + 下面这份资料」，资料里没有的不会编。
          </p>

          {field('名字', 'name', 1)}
          {field('欢迎语', 'welcome', 3, '访客打开对话框看到的第一句话。')}
          {field(
            '角色设定（追加到系统提示词）',
            'persona',
            4,
            '决定语气与边界。会拼在内置提示词后面，不会覆盖「不许编造」这类硬约束。'
          )}
          {field(
            '资料文档',
            'knowledge',
            14,
            '社团制度、招新 FAQ、学习路线等。纯文本即可，小艾把它当作答依据。'
          )}

          <label className="block mb-5">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              推荐问题（一行一个）
            </span>
            <textarea
              value={settings.suggestions.join('\n')}
              onChange={e =>
                setSettings(s => ({
                  ...s,
                  suggestions: e.target.value.split('\n').map(v => v.trim()).filter(Boolean),
                }))
              }
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              保存
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('恢复成默认人设与资料？当前内容会丢失。')) return;
                setSaveErr(null);
                try {
                  await resetAssistantSettings();
                  setSettings(DEFAULT_ASSISTANT);
                } catch (err) {
                  setSaveErr((err as Error).message);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" />
              恢复默认
            </button>
            {saveErr && (
              <span className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-1.5">
                保存失败：{saveErr}
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                已保存
              </span>
            )}
          </div>

          {usingSupabase ? (
            <p className="mt-4 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-relaxed">
              这份配置存在数据库里，<span className="font-medium">保存后对所有访客生效</span>。
            </p>
          ) : (
            <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
              当前是本地演示模式，这份配置只存在
              <span className="font-medium">你这台浏览器</span>里，访客看到的仍是默认人设。
              填上 Supabase 环境变量后会自动改存数据库。
            </p>
          )}
        </form>

        {/* ── 密钥 ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">AI 密钥</h2>
          <p className="text-sm text-gray-500 mb-5">
            没有密钥时小艾仍然可用，只是退化成站内检索（把相关项目/活动列出来），不生成回答。
          </p>

          {status === null ? (
            <p className="text-sm text-gray-400">读取状态中…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-5 text-sm">
                <span className="text-gray-500">当前状态：</span>
                {status.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    已配置（{status.hint}）
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800">
                    <ShieldAlert className="w-4 h-4" />
                    未配置
                  </span>
                )}
                <span className="text-gray-400 text-xs">
                  {status.base} · {status.model}
                </span>
              </div>

              {status.writable ? (
                <form onSubmit={saveKey}>
                  <label className="block mb-4">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">
                      API Key
                    </span>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={status.configured ? '留空则不改动' : 'sk-…'}
                      autoComplete="off"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">
                        接口地址
                      </span>
                      <input
                        value={base}
                        onChange={e => setBase(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">模型</span>
                      <input
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>

                  {keyMsg && (
                    <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 mb-4">
                      {keyMsg}
                    </p>
                  )}
                  {keyErr && (
                    <p className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-4">
                      {keyErr}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={keyBusy || !apiKey.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {keyBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                    写入 .env.local
                  </button>
                  <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                    密钥写进服务端的 .env.local，不会下发到浏览器。保存后需重启 dev server 生效。
                  </p>
                </form>
              ) : (
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                  <p className="text-sm text-gray-800 font-medium mb-1">线上请在托管平台配置</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    这一页不提供线上改密钥的入口 —— 当前的登录校验跑在浏览器里，服务端无法确认
                    «请求者真的是管理员»，开放写入等于让任何人都能改掉社团的 AI 密钥。请到
                    Cloudflare Pages 的 Settings → Environment variables 配置{' '}
                    <code className="px-1 py-0.5 rounded bg-white border text-[11px]">
                      AI_API_KEY
                    </code>
                    。接入 Supabase Auth 之后可以再把这个入口打开。
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
