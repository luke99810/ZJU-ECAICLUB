/**
 * 后台外壳：路由权限拦截 + 侧边导航。
 *
 * 方案要求「/admin 路由权限拦截，仅社团成员登录可见」。这里做的是**前端拦截**——
 * 未登录就跳登录页。真正的数据权限要靠 Supabase 的 RLS（普通成员只能改自己的项目），
 * 前端这层只负责别让人看见不该看的界面。
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  FolderKanban,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Bot,
  CalendarDays,
  Compass,
  MessageSquare,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react';
import Logo from '../Logo';
import { getSession, isAdmin, onAuthStateChange, signOut } from '../../lib/auth';
import type { Session } from '../../types';

interface AdminShellProps {
  title: string;
  children: React.ReactNode;
  /** 仅管理员可见的页面（审核）传 true。 */
  adminOnly?: boolean;
}

const NAV = [
  { href: '/admin', label: '概览', icon: LayoutDashboard, adminOnly: false },
  { href: '/admin/projects', label: '我的项目', icon: FolderKanban, adminOnly: false },
  { href: '/admin/posts', label: '社团新闻', icon: CalendarDays, adminOnly: false },
  { href: '/admin/tools', label: 'AI 写作助手', icon: Wrench, adminOnly: false },
  { href: '/admin/toolnav', label: 'AI 工具导航', icon: Compass, adminOnly: false },
  { href: '/admin/account', label: '我的账号', icon: UserCog, adminOnly: false },
  { href: '/admin/review', label: '内容审核', icon: ShieldCheck, adminOnly: false },
  { href: '/admin/messages', label: '留言管理', icon: MessageSquare, adminOnly: false },
  { href: '/admin/members', label: '成员管理', icon: Users, adminOnly: true },
  { href: '/admin/assistant', label: 'AI 客服配置', icon: Bot, adminOnly: true },
];

export default function AdminShell({ title, children, adminOnly }: AdminShellProps) {
  const router = useRouter();
  // undefined = 还没判定完（首屏 SSR 阶段读不到 localStorage），
  // null = 确定未登录。这两者必须分开，否则会闪一下登录页再跳回来。
  const [session, setSession] = useState<Session | undefined>(undefined);

  useEffect(() => {
    setSession(getSession());
    return onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      void router.replace(`/admin/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (adminOnly && !isAdmin(session)) void router.replace('/admin');
  }, [session, adminOnly, router]);

  if (session === undefined) {
    return <div className="min-h-screen grid place-items-center text-gray-500">加载中…</div>;
  }
  if (session === null || (adminOnly && !isAdmin(session))) {
    return <div className="min-h-screen grid place-items-center text-gray-500">跳转中…</div>;
  }

  const { member } = session;
  const nav = NAV.filter(n => !n.adminOnly || isAdmin(session));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-gray-200">
        <Link href="/" className="flex items-center gap-2 px-5 h-16 border-b border-gray-200">
          <Logo size={32} />
          <span className="font-semibold text-gray-900">成员后台</span>
        </Link>

        <nav className="flex-grow p-3 space-y-1">
          {nav.map(item => {
            const active = router.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {member.department}
              {isAdmin(session) ? ' · 管理员' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      <div className="flex-grow min-w-0">
        {/* 移动端没有侧栏，导航横向排在顶部 */}
        <header className="bg-white border-b border-gray-200 px-5 h-16 flex items-center justify-between">
          <h1 className="font-semibold text-gray-900">{title}</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
            返回官网
          </Link>
        </header>
        <nav className="md:hidden flex gap-1 overflow-x-auto bg-white border-b border-gray-200 px-3 py-2">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm ${
                router.pathname === item.href
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
