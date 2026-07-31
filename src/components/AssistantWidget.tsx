/**
 * AI 客服 —— 右下角悬浮，全站可用。
 *
 * 每问一句都先在站内检索（项目 / 活动成果 / 新闻 / 成员），把命中的条目
 * 一并作为可点结果卡显示，再把它们作为资料交给模型作答。
 *
 * **没配 AI key 也能用**：此时不调模型，直接把检索结果摆出来 —— 对「有没有做 CV
 * 的项目」这类问题，一份准确的清单比一段生成的话更有用。
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { AiNotConfiguredError, runAi } from '../lib/ai';
import { retrieve, type Hit } from '../lib/assistant';
import { DEFAULT_ASSISTANT, getAssistantSettings, type AssistantSettings } from '../lib/settings';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  hits?: Hit[];
  /** 检索到了东西但没有模型可用时，标记一下，UI 上说明白。 */
  retrievalOnly?: boolean;
}

export default function AssistantWidget() {
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_ASSISTANT);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  // 设置存在 localStorage，SSR 阶段拿不到；首帧先用默认值，挂载后再校正，
  // 顺便用校正后的欢迎语初始化对话。
  useEffect(() => {
    getAssistantSettings().then(s => {
      setSettings(s);
      setTurns([{ role: 'assistant', text: s.welcome }]);
    });
  }, []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, open]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setDraft('');
    setTurns(t => [...t, { role: 'user', text: q }]);
    setBusy(true);

    // 先检索 —— 无论有没有模型，这一步都要做。
    const { hits, context } = await retrieve(q);

    try {
      // 资料文档拼在检索结果后面：检索命中的是「具体条目」，资料文档是「常识背景」，
      // 两者都要给，缺一样就会答不全或者答错。
      const merged = settings.knowledge.trim()
        ? `${context}

【社团资料文档】
${settings.knowledge.trim()}`
        : context;
      const { text } = await runAi('assistant', q, {
        context: merged,
        systemExtra: settings.persona,
      });
      setTurns(t => [...t, { role: 'assistant', text, hits }]);
    } catch (e) {
      if (e instanceof AiNotConfiguredError) {
        setTurns(t => [
          ...t,
          {
            role: 'assistant',
            hits,
            retrievalOnly: true,
            text: hits.length
              ? `站内找到 ${hits.length} 条相关内容：`
              : '站内没有检索到相关内容。可以去「联系我们」直接问社团。',
          },
        ]);
      } else {
        setTurns(t => [
          ...t,
          { role: 'assistant', text: `出错了：${(e as Error).message}`, hits },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`打开 ${settings.name}`}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium">问{settings.name}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[min(92vw,380px)] h-[min(70vh,560px)] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-100 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-medium">{settings.name}</span>
          <span className="text-xs text-white/70">社团 AI 客服</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="关闭"
          className="p-1 rounded hover:bg-white/15"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-grow overflow-y-auto px-4 py-3 space-y-3">
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[88%] text-left px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                t.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {t.text}
            </div>

            {t.hits && t.hits.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {t.hits.map((h, j) => {
                  const body = (
                    <>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                          {h.kind}
                        </span>
                        <span className="text-xs font-medium text-gray-900 truncate">
                          {h.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-2">{h.snippet}</p>
                    </>
                  );
                  return h.href ? (
                    <Link
                      key={j}
                      href={h.href}
                      onClick={() => setOpen(false)}
                      className="block text-left rounded-lg border border-gray-200 px-2.5 py-2 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={j} className="rounded-lg border border-gray-200 px-2.5 py-2 text-left">
                      {body}
                    </div>
                  );
                })}
              </div>
            )}

            {t.retrievalOnly && (
              <p className="mt-1.5 text-[11px] text-amber-700 text-left">
                AI 生成尚未接入（管理员填 AI_API_KEY 后即可），当前只做站内检索。
              </p>
            )}
          </div>
        ))}

        {busy && (
          <p className="inline-flex items-center gap-1.5 text-sm text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在查…
          </p>
        )}

        {turns.length === 1 && (
          <div className="pt-2 space-y-1.5">
            {settings.suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="block w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-2.5 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
          rows={1}
          placeholder="问点什么…"
          className="flex-grow resize-none px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => void ask(draft)}
          disabled={busy || !draft.trim()}
          aria-label="发送"
          className="shrink-0 p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
