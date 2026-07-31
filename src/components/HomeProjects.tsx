/**
 * 首页「热门 AI 项目」——取最近三个已通过的项目，引流到开源社区的项目共享。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ProjectCard from './ProjectCard';
import { listProjects } from '../lib/store';
import type { AiProject } from '../types';

export default function HomeProjects() {
  const [rows, setRows] = useState<AiProject[]>([]);

  useEffect(() => {
    listProjects({ status: 'approved' }).then(list => setRows(list.slice(0, 3)));
  }, []);

  // 一个都没有时整块不渲染，比留一个空标题好看。
  if (rows.length === 0) return null;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">热门 AI 项目</h2>
            <p className="text-gray-600">成员的真实作品，代码与论文都可直达。</p>
          </div>
          <Link
            href="/community/projects"
            className="hidden sm:inline-flex items-center gap-1.5 text-blue-600 font-medium hover:text-blue-800"
          >
            浏览全部
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(p => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link href="/community/projects" className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
            浏览全部
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
