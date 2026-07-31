/**
 * 首页「社团动态」+ 招新入口。
 *
 * 两块合在一个 section：看完我们在做什么，紧接着就是加入的入口，转化路径最短。
 * 活动与成果已并入社团新闻，所以「查看全部」指向 /news（公告不在首页露出）。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Award, CalendarDays } from 'lucide-react';
import PostLink from './PostLink';
import { listPosts } from '../lib/store';
import type { Post } from '../types';

export default function HomeActivities() {
  const [rows, setRows] = useState<Post[]>([]);

  useEffect(() => {
    listPosts().then(list => setRows(list.filter(p => p.kind !== 'notice').slice(0, 4)));
  }, []);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-end justify-between mb-6">
              <h2 className="text-3xl font-bold text-gray-900">社团动态</h2>
              <Link
                href="/news"
                className="inline-flex items-center gap-1.5 text-blue-600 font-medium hover:text-blue-800"
              >
                查看全部
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {rows.length === 0 ? (
              <p className="text-gray-500">还没有活动记录。</p>
            ) : (
              <ul className="divide-y divide-gray-100 border-y border-gray-100">
                {rows.map(p => (
                  <li key={p.id} className="py-4 flex gap-4">
                    <div
                      className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${
                        p.kind === 'award' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {p.kind === 'award' ? (
                        <Award className="w-4 h-4" />
                      ) : (
                        <CalendarDays className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-gray-900">{p.title}</h3>
                        {p.award && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px]">
                            {p.award}
                          </span>
                        )}
                        <time className="text-xs text-gray-400">{p.date}</time>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{p.body}</p>
                      <div className="mt-1.5">
                        <PostLink url={p.link_url} label={p.link_label} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 p-7 flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-3">正在招新</h2>
            <p className="text-blue-100 text-sm leading-relaxed mb-6 flex-grow">
              技术部、宣传部、组织部同步招新。不限年级专业，不考算法题 ——
              聊你做过什么就行。零基础也欢迎。
            </p>
            <Link
              href="/join"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              了解招新详情
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/tools"
              className="mt-3 text-center text-sm text-blue-100 hover:text-white underline underline-offset-4"
            >
              先试试我们的 AI 工具
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
