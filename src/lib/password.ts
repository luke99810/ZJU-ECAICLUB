/**
 * 口令哈希。
 *
 * ⚠️ 这是**演示级**实现：SHA-256 + 每账号随机盐。它能保证 localStorage 里不出现
 * 明文口令，但**不能**当生产方案 —— SHA-256 算得太快，离线爆破成本极低；真正该用
 * 的是 bcrypt / argon2 这类慢哈希，而那必须在服务端做。
 *
 * 正式上线请把整套登录换成 Supabase Auth（它自己管口令，前端根本碰不到），
 * 这个文件届时可以删掉。见 README「接 Supabase」。
 */

const ENC = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 16 字节随机盐，hex 编码。 */
export function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ENC.encode(`${salt}:${password}`));
  return toHex(digest);
}

/**
 * 定时安全的比较。JS 里做不到真正的常量时间，但至少不要因为「首字符不同就立刻
 * 返回」而漏出长度/前缀信息。
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 初始管理员的出厂口令。首次登录后应立即修改。 */
export const INITIAL_ADMIN_PASSWORD = 'AICLUB.2026';

/** 口令强度下限 —— 别让人把口令改成 "1"。 */
export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `口令至少 ${MIN_PASSWORD_LENGTH} 位`;
  if (/^\d+$/.test(pw)) return '口令不能全是数字';
  return null;
}
