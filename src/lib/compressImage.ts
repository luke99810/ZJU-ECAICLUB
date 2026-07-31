/**
 * 图片压缩 —— 在浏览器里把用户选的图缩到合适尺寸，转成 data URL 直接入库。
 *
 * 为什么不上传到服务端：这个站现在没有对象存储（Supabase Storage 还没开通），
 * 而封面图只是卡片顶部那一条，600px 宽足够。压完通常只有几十 KB，
 * 塞进数据行里比为它单独搭一套上传链路划算得多。
 *
 * 接了 Supabase 之后应该换成 Storage 上传、库里只存 URL —— data URL 的问题是
 * 它会随每次查询一起传输，图多了会拖慢列表。届时改这个文件即可。
 */

/** 输出的最长边。封面卡片实际显示宽度约 380px，600 足够应付 2x 屏。 */
const MAX_EDGE = 600;

/** 压缩后仍超过这个大小就认为不合适 —— localStorage 总共只有 ~5MB。 */
const MAX_OUTPUT_BYTES = 400 * 1024;

/** 输入文件大小上限，先挡一道，避免拿 50MB 的原图去解码把标签页卡死。 */
export const MAX_IMAGE_INPUT_BYTES = 15 * 1024 * 1024;

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export class ImageError extends Error {}

export interface CompressedImage {
  /** `data:image/jpeg;base64,…`，可直接放进 <img src>。 */
  dataUrl: string;
  width: number;
  height: number;
  /** data URL 的近似字节数，用于在界面上告知体积。 */
  bytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError('这个文件不像是图片，或者格式不被浏览器支持。'));
    };
    img.src = url;
  });
}

/** data URL 里 base64 部分的实际字节数。 */
function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('请选择图片文件（PNG / JPG / WebP）。');
  }
  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    throw new ImageError(
      `图片 ${(file.size / 1024 / 1024).toFixed(1)}MB，超过 ${MAX_IMAGE_INPUT_BYTES / 1024 / 1024}MB 上限。`
    );
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('浏览器不支持 canvas，无法压缩图片。');
  // 统一铺白底：PNG 透明区转成 JPEG 后会变黑，铺一层白比留黑块好看
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // 逐步降质量直到达标 —— 一次定死质量的话，照片和截图的体积差很远。
  let dataUrl = '';
  let bytes = 0;
  for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    dataUrl = canvas.toDataURL('image/jpeg', q);
    bytes = dataUrlBytes(dataUrl);
    if (bytes <= MAX_OUTPUT_BYTES) break;
  }
  if (bytes > MAX_OUTPUT_BYTES) {
    throw new ImageError(
      `压到最低质量后仍有 ${Math.round(bytes / 1024)}KB，请换一张更简单的图。`
    );
  }

  return { dataUrl, width: w, height: h, bytes };
}
