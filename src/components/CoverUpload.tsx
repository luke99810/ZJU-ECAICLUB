/**
 * 封面图上传。
 *
 * 之前是让人填 URL —— 学生手上通常只有本地图片，没有可用的图床，那个字段基本没人填。
 * 改成选文件、浏览器里自动压缩（最长边 600px、JPEG）、存 data URL。
 */
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { IMAGE_ACCEPT, ImageError, compressImage } from '../lib/compressImage';

interface CoverUploadProps {
  /** 当前值（data URL 或旧数据里的 http URL）。 */
  value: string;
  onChange: (dataUrl: string) => void;
}

export default function CoverUpload({ value, onChange }: CoverUploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const take = async (file: File) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await compressImage(file);
      onChange(r.dataUrl);
      setInfo(`已压缩到 ${r.width}×${r.height}，约 ${Math.round(r.bytes / 1024)}KB`);
    } catch (e) {
      setError(e instanceof ImageError ? e.message : `处理失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">封面图</span>

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="封面预览"
            className="h-32 rounded-lg border border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={() => {
              onChange('');
              setInfo(null);
              setError(null);
            }}
            aria-label="移除封面"
            className="absolute -top-2 -right-2 p-1 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-gray-900 shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void take(f);
          }}
          disabled={busy}
          className={`w-full flex flex-col items-center justify-center gap-1.5 h-32 rounded-lg border-2 border-dashed transition-colors ${
            dragging
              ? 'border-blue-400 bg-blue-50/50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <ImagePlus className="w-5 h-5 text-gray-400" />
          )}
          <span className="text-sm text-gray-500">
            {busy ? '压缩中…' : '点击选择图片，或拖进来'}
          </span>
          <span className="text-xs text-gray-400">自动压缩到 600px / JPEG，选填</span>
        </button>
      )}

      <input
        ref={ref}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void take(f);
          e.target.value = '';
        }}
      />

      {info && <p className="mt-1.5 text-xs text-gray-500">{info}</p>}
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
