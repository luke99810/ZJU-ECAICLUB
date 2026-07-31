/**
 * 从上传的文件里提取纯文本。
 *
 * **全部在浏览器里做，文件不上传服务端** —— 只有提取出的文字会随 AI 请求发出去。
 * 这么选有三个理由：没有上传体积限制、不占服务端算力、Cloudflare 的边缘运行时
 * 跑不了 pdf/docx 那些 Node 解析库。
 *
 * 解析器是**按需动态 import** 的：pdfjs 和 mammoth 加起来一两兆，不该让每个
 * 只想粘贴文字的人都先下载它们。
 */

/** 单个文件大小上限。再大就该让人先自己摘重点了。 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 提取后交给模型的字数上限，与 `/api/ai` 的 MAX_INPUT 对齐。 */
export const MAX_TEXT_CHARS = 6000;

export interface ExtractResult {
  text: string;
  /** 原始提取长度；被截断时 UI 要如实告知。 */
  originalLength: number;
  truncated: boolean;
}

export class UnsupportedFileError extends Error {}

const TEXT_EXT = /\.(md|markdown|txt|csv|json|ya?ml|log|html?|tex)$/i;

function extname(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

/** 供 <input accept> 用。 */
export const ACCEPT_ATTR = '.pdf,.docx,.md,.markdown,.txt,.csv,.json,.yml,.yaml,.log,.tex';

export function describeSupported(): string {
  return 'PDF、Word（.docx）、Markdown、txt、csv、json 等纯文本格式';
}

async function extractPdf(file: File): Promise<string> {
  // pdfjs 6.x 是 ESM，worker 从 public/ 取 —— 比让 webpack 处理 worker URL 稳。
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // items 里混着 TextItem 与 TextMarkedContent，只有前者有 str
    const line = content.items
      .map(it => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) parts.push(line);
    // 已经够长了就别继续解析剩下的页，省时间也省内存
    if (parts.join('\n').length > MAX_TEXT_CHARS * 2) break;
  }
  // pdfjs 6.x 的 PDFDocumentProxy 用 cleanup() 释放页面资源（没有 destroy）
  await doc.cleanup();
  return parts.join('\n\n');
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value;
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new UnsupportedFileError(
      `文件 ${(file.size / 1024 / 1024).toFixed(1)}MB，超过 ${MAX_FILE_BYTES / 1024 / 1024}MB 上限`
    );
  }

  const ext = extname(file.name);
  let raw: string;

  if (ext === '.pdf') {
    raw = await extractPdf(file);
  } else if (ext === '.docx') {
    raw = await extractDocx(file);
  } else if (ext === '.doc') {
    // 老的二进制 .doc 不是 zip，mammoth 也不支持，直说而不是给一堆乱码。
    throw new UnsupportedFileError('旧版 .doc 不支持，请另存为 .docx 再上传');
  } else if (TEXT_EXT.test(file.name) || file.type.startsWith('text/')) {
    raw = await file.text();
  } else {
    throw new UnsupportedFileError(`不支持 ${ext || '这个'} 格式。支持：${describeSupported()}`);
  }

  const cleaned = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) {
    throw new UnsupportedFileError(
      '没提取到文字。如果是扫描版 PDF（图片），需要先做 OCR；也可以直接粘贴文字。'
    );
  }

  return {
    text: cleaned.slice(0, MAX_TEXT_CHARS),
    originalLength: cleaned.length,
    truncated: cleaned.length > MAX_TEXT_CHARS,
  };
}
