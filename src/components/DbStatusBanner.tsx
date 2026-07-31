/**
 * 数据库连接状态提示条。
 *
 * 只在**接了 Supabase 但连不上/没权限**时出现，其余情况完全不渲染。
 *
 * 为什么需要它：数据层出错时页面是「正常渲染但一条内容都没有」——
 * 看起来像社团还没发内容，而不是像出了故障。建库那天最容易踩的几个坑
 * （URL 填错、schema.sql 没执行、RLS 把匿名读也挡了）表现都是这一种，
 * 不给提示的话只能靠开控制台才看得出来。
 *
 * 探测用 `tool_links` 这张表：它是**匿名可读**的（RLS 里 `for select using (true)`），
 * 所以读得到就说明「连得上 + 表建好了 + 策略正常」，读不到才是真有问题。
 * 用 members 之类的表探测会把「没登录」误报成故障。
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { explain, supabase, isSupabaseConfigured } from '../lib/supabase';

export default function DbStatusBanner() {
  const [problem, setProblem] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    supabase
      .from('tool_links')
      .select('id')
      .limit(1)
      .then(({ error }) => {
        if (cancelled) return;
        if (error) setProblem(explain(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!problem || dismissed) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] bg-rose-950 text-rose-50 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-300" />
        <div className="flex-grow text-sm leading-relaxed">
          <p className="font-medium mb-0.5">数据库连不上，页面看到的内容可能是空的</p>
          <p className="text-rose-200 break-words">{problem}</p>
          <p className="text-rose-300/80 text-xs mt-1.5">
            排查顺序：<code>.env.local</code> 里的 URL 与 anon key 是否正确 →
            <code className="mx-1">supabase/schema.sql</code>
            是否已在 SQL Editor 执行过 → 网络能否访问 Supabase。详见「上线指南」第二节。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="关闭提示"
          className="shrink-0 text-rose-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
