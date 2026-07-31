/**
 * Supabase 客户端。
 *
 * **没配环境变量时导出 null，而不是抛错** —— 数据层据此在「本地演示」和「真库」
 * 之间切换（见 `src/lib/store/index.ts`）。这样在建好 Supabase 项目之前，
 * 站点仍然能完整跑起来，不会因为少两个环境变量就白屏。
 *
 * anon key 是**公开**的，写进前端没问题 —— 数据安全靠数据库里的 RLS 策略，
 * 不靠把 key 藏起来。真正不能外泄的是 service_role key，它有绕过 RLS 的能力，
 * **任何情况下都不要放进前端代码或 NEXT_PUBLIC_ 开头的环境变量**。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

/** 两个都填了才算配好。只填一个多半是漏了，按没配处理。 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // 会话存 localStorage 并自动续期。接入 Auth 后 auth.ts 直接用它。
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/** 调用处拿到的一定是非空 client；配置缺失时提前报错，不要让 null 传下去。 */
export function db(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase 尚未配置：请在 .env.local 填 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  return supabase;
}

/**
 * 把 Supabase 的报错翻译成人能看懂的话。
 *
 * 最常见的一类是 RLS 拒绝：**接了数据库但还没接 Auth 时，后台的读写都会被拒**——
 * 因为策略里的 `auth.uid()` 是 null，`is_member()` 判定为 false。
 * 原始报错只说 "new row violates row-level security policy"，看的人很难联想到
 * 「是不是还没做上线指南的第三步」，所以这里直接把话说明白。
 */
export function explain(error: { message?: string; code?: string } | null): string {
  const msg = error?.message ?? '未知错误';
  if (/row-level security|permission denied|JWT/i.test(msg)) {
    return `没有权限：${msg}。如果后台操作全都失败，多半是数据库已接入但登录还没换成 Supabase Auth（见「上线指南」第三步）。`;
  }
  if (error?.code === '23505') return '已存在同样的记录（学号或邮箱重复）';
  if (/Failed to fetch|NetworkError/i.test(msg)) return `连不上 Supabase：${msg}`;
  return msg;
}
