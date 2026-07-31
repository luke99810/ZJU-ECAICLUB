/**
 * AI 写作助手 —— **一个输入区 + 选能力**。
 *
 * 之前是五个能力各一个面板、各一个输入框，把同一段文字换个处理方式就得重新粘一遍。
 * 现在内容只放一处，上面切能力。
 *
 * 输入有两个来源，可混用：直接粘贴，或上传文档（PDF / Word / Markdown / txt…）。
 * 文件在浏览器里解析，只有提取出的文字会发出去 —— 见 `lib/extractText.ts`。
 *
 * 布局是左右两栏：左边编辑，右边预览/结果。上传一份长文档后，输入框那点高度
 * 根本看不全内容，右侧给一整屏来通读，并且能在「原文」与「结果」之间切换对照。
 */
import { useCallback, useRef, useState } from 'react';
import {
  Copy,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AiNotConfiguredError, runAi } from '../lib/ai';
import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  UnsupportedFileError,
  describeSupported,
  extractTextFromFile,
} from '../lib/extractText';
import { AI_CAPABILITIES } from '../data/aiTools';

interface Attached {
  name: string;
  chars: number;
  truncated: boolean;
  originalLength: number;
}

export default function AiWorkbench() {
  const [taskIndex, setTaskIndex] = useState(0);
  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<Attached | null>(null);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pane, setPane] = useState<'source' | 'result'>('source');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const capability = AI_CAPABILITIES[taskIndex];
  const overLimit = input.length > MAX_TEXT_CHARS;

  const takeFile = useCallback(async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const r = await extractTextFromFile(file);
      // 覆盖而不是追加：多数场景是「换个文件重新处理」，追加会串味。
      setInput(r.text);
      setAttached({
        name: file.name,
        chars: r.text.length,
        truncated: r.truncated,
        originalLength: r.originalLength,
      });
      setOutput('');
    } catch (e) {
      setError(
        e instanceof UnsupportedFileError
          ? e.message
          : `解析失败：${(e as Error).message}。可以把文字直接粘贴进来。`
      );
    } finally {
      setParsing(false);
    }
  }, []);

  const run = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNotConfigured(null);
    setOutput('');
    try {
      const r = await runAi(capability.task, input.slice(0, MAX_TEXT_CHARS));
      setOutput(r.text);
      setPane('result');
    } catch (e) {
      if (e instanceof AiNotConfiguredError) setNotConfigured(e.message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板被拒：用户可以自己选中复制 */
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      {/* ── 左栏：编辑 ─────────────────────────────── */}
      <div className="min-w-0">
      {/* ── 选能力 ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3">
        {AI_CAPABILITIES.map((c, i) => (
          <button
            key={c.task}
            type="button"
            onClick={() => {
              setTaskIndex(i);
              setOutput('');
              setNotConfigured(null);
              setError(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              i === taskIndex
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-5">{capability.description}</p>

      {/* ── 输入区 ─────────────────────────────────── */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void takeFile(f);
        }}
        className={`rounded-xl border-2 transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50/50' : 'border-transparent'
        }`}
      >
        <textarea
          value={input}
          onChange={e => {
            setInput(e.target.value);
            // 手动编辑后那个「来自某文件」的标签就不准了
            if (attached) setAttached(null);
          }}
          onPaste={e => {
            const f = e.clipboardData.files[0];
            if (f) {
              e.preventDefault();
              void takeFile(f);
            }
          }}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              void run();
            }
          }}
          placeholder={capability.placeholder}
          rows={10}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-2 mb-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {parsing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
          {parsing ? '解析中…' : '上传文档'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void takeFile(f);
            e.target.value = '';
          }}
        />

        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
          <Upload className="w-3.5 h-3.5" />
          也可以拖进来或直接粘贴文件
        </span>

        <span className={`ml-auto text-xs ${overLimit ? 'text-amber-700' : 'text-gray-400'}`}>
          {input.length} / {MAX_TEXT_CHARS} 字
          {overLimit && '（超出部分不会提交）'}
        </span>
      </div>

      {attached && (
        <div className="flex items-start gap-2 mb-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
          <FileText className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
          <div className="min-w-0 flex-grow text-xs">
            <p className="text-gray-800 truncate">{attached.name}</p>
            <p className="text-gray-500">
              提取 {attached.chars} 字
              {attached.truncated &&
                `（原文 ${attached.originalLength} 字，已截到前 ${MAX_TEXT_CHARS} 字）`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAttached(null);
              setInput('');
              setOutput('');
            }}
            aria-label="清空"
            className="shrink-0 p-1 text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || parsing || !input.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? '生成中…' : `生成${capability.title}`}
        </button>
        <span className="text-xs text-gray-400">Ctrl / ⌘ + Enter</span>
        {input && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              setAttached(null);
              setOutput('');
            }}
            className="inline-flex items-center gap-1.5 ml-auto text-xs text-gray-500 hover:text-gray-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        支持 {describeSupported()}，单个文件不超过 {MAX_FILE_BYTES / 1024 / 1024}MB。
        文件在你的浏览器里解析，只有提取出的文字会发给模型，原文件不上传。
      </p>

      {notConfigured && (
        <div className="mt-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-900 font-medium mb-1">AI 能力尚未接入</p>
          <p className="text-xs text-amber-800 leading-relaxed">{notConfigured}</p>
        </div>
      )}
      {error && (
        <p className="mt-5 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
      </div>

      {/* ── 右栏：预览 / 结果 ───────────────────────── */}
      <div className="min-w-0 lg:sticky lg:top-6">
        <div className="flex items-center gap-1 mb-2">
          {(
            [
              ['source', '原文预览', input.length],
              ['result', `${capability.title}结果`, output.length],
            ] as Array<['source' | 'result', string, number]>
          ).map(([key, label, len]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPane(key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pane === key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              {len > 0 && <span className="ml-1 opacity-60 text-xs">{len}</span>}
            </button>
          ))}
          {pane === 'result' && output && (
            <button
              type="button"
              onClick={() => void copy()}
              className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? '已复制' : '复制'}
            </button>
          )}
        </div>

        <div className="h-[560px] overflow-auto rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          {pane === 'source' ? (
            input ? (
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 leading-relaxed font-sans">
                {input}
              </pre>
            ) : (
              <div className="h-full grid place-items-center text-center">
                <div>
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">
                    左边粘贴内容或上传文档，这里看全文。
                  </p>
                </div>
              </div>
            )
          ) : busy ? (
            <div className="h-full grid place-items-center text-gray-400">
              <span className="inline-flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中…
              </span>
            </div>
          ) : output ? (
            <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 leading-relaxed font-sans">
              {output}
            </pre>
          ) : (
            <div className="h-full grid place-items-center text-center">
              <div>
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">生成后结果显示在这里。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
