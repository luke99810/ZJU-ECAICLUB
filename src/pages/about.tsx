/**
 * 社团介绍。
 *
 * 内容来自《浙江大学工程师学院人工智能俱乐部介绍》，事实统一放在 `data/club.ts`。
 * 原来这一页是脚手架留下的占位内容（虚构的获奖、"500+ 会员"、四张外链头像），
 * 全部换掉了 —— 编的数据比没有数据更糟，看的人没法分辨哪句是真的。
 *
 * 核心团队不在这里重复列：`/team` 那一页读的是真实成员数据，会随后台维护更新。
 */
import Link from 'next/link';
import { ArrowRight, Compass, Target } from 'lucide-react';
import Layout from '../components/Layout';
import { CLUB, DEPARTMENT_INTRO, DUTIES, PHASES } from '../data/club';

export default function About() {
  return (
    <Layout>
      <section className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">社团介绍</h1>
          <p className="text-lg text-blue-100 leading-relaxed">
            {CLUB.name}（{CLUB.shortName} / {CLUB.enName}）成立于 {CLUB.founded}，
            {CLUB.affiliation}。
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {CLUB.motto.map(w => (
              <span
                key={w}
                className="px-3.5 py-1.5 rounded-full bg-white/15 text-white text-sm backdrop-blur-sm"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 宗旨 / 使命 —— 用社团自己的措辞，不另起一套说法 */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-6">
            <div className="w-11 h-11 rounded-xl bg-blue-50 grid place-items-center mb-4">
              <Target className="w-5 h-5 text-blue-700" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">核心使命</h2>
            <p className="text-gray-600 leading-relaxed mb-4">{CLUB.mission.join(' · ')}</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              社团宗旨是「{CLUB.motto.join(' · ')}」，四个词也对应着我们做事的顺序：
              先把前沿看明白，再动手做出来。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 p-6">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 grid place-items-center mb-4">
              <Compass className="w-5 h-5 text-indigo-700" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">战略定位</h2>
            <p className="text-gray-600 leading-relaxed">{CLUB.positioning}</p>
          </div>
        </div>
      </section>

      {/* 发展历程 —— 按技术范式分期，比按活动流水账更说明问题 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">发展历程</h2>
          <p className="text-gray-600 mb-10">
            八年正好跨过 CNN、大模型、Agent 三代范式。社团的每一次转向，
            基本就是这个领域自己的转向。
          </p>

          <ol className="relative border-l border-gray-200 pl-6 space-y-8">
            {PHASES.map(p => (
              <li key={p.index} className="relative">
                <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-gray-50" />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                  <span className="text-xs font-mono text-gray-400">{p.index}</span>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <span className="text-sm text-gray-500">{p.span}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                    {p.milestone}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{p.tech}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 四大职能 */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">我们在做什么</h2>
          <p className="text-gray-600 mb-10">
            四项核心职能，社团内部把它叫作「学 – 练 – 产 – 管」闭环。
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            {DUTIES.map(d => (
              <div key={d.tag} className="rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-600 text-white grid place-items-center text-sm font-semibold">
                    {d.tag}
                  </span>
                  <h3 className="font-semibold text-gray-900">{d.title}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 组织架构 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">组织架构</h2>
          <p className="text-gray-600 mb-10">
            管理层统筹，三个职能部门分工协作。成员背景不限于计算机专业 ——
            工程师学院本身就是交叉学科的地方。
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {DEPARTMENT_INTRO.map(d => (
              <div key={d.name} className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-1.5">{d.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-1.5">{d.duty}</p>
                <p className="text-xs text-gray-400">{d.role}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/team"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              看看社团成员
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-white"
            >
              加入我们
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
