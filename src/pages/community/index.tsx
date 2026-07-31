/**
 * 开源社区首页 —— 三个板块的入口：学习资料 / 项目共享 / AI 论坛。
 *
 * 三类内容的规则一致（任何人可投稿，审核后公开），所以入口页把这条规则说在
 * 前面，而不是让人点进去三次才发现。卡片上的数字是真实的已通过条数，空板块
 * 也照样显示 —— 让人知道这里缺内容，正好去补。
 *
 * **投稿入口就放在这一页**：三类内容都能投，所以入口应该在社区这一层，而不是
 * 只藏在项目共享里。板块页里也各留了自己的投稿按钮，方便看着列表顺手就投。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, MessagesSquare, Rocket, Upload } from 'lucide-react';
import Layout from '../../components/Layout';
import SubmitContentModal from '../../components/SubmitContentModal';
import SubmitProjectModal from '../../components/SubmitProjectModal';
import { listForumPosts, listProjects, listResources } from '../../lib/store';
import { CONTENT_KIND_LABEL, type ContentKind } from '../../types';

const BOARDS: Array<{
  kind: ContentKind;
  icon: React.ReactNode;
  desc: string;
  href: string;
  unit: string;
  accent: string;
}> = [
  {
    kind: 'resource',
    icon: <BookOpen className="w-7 h-7" />,
    desc: '课程、书、仓库、笔记。按入门 / 进阶 / 专项分层，写清楚适合谁看。',
    href: '/community/resources',
    unit: '份资料',
    accent: 'bg-blue-50 text-blue-700',
  },
  {
    kind: 'project',
    icon: <Rocket className="w-7 h-7" />,
    desc: '成员与投稿人的真实作品，带技术标签和功能标签，代码与论文可直达。',
    href: '/community/projects',
    unit: '个项目',
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    kind: 'forum',
    icon: <MessagesSquare className="w-7 h-7" />,
    desc: '提问、分享、讨论。发帖需审核，评论不用 —— 未登录的访客也能直接回复。',
    href: '/community/forum',
    unit: '个帖子',
    accent: 'bg-indigo-50 text-indigo-700',
  },
];

const SUBMIT_COPY: Record<ContentKind, string> = {
  resource: '推荐一份课程 / 书 / 仓库',
  project: '提交自己或团队的作品',
  forum: '提问、分享或发起讨论',
};

export default function CommunityPage() {
  const [counts, setCounts] = useState<Record<ContentKind, number | null>>({
    resource: null,
    project: null,
    forum: null,
  });
  /** 当前打开的投稿弹窗；null 表示没开。 */
  const [submitting, setSubmitting] = useState<ContentKind | null>(null);

  useEffect(() => {
    Promise.all([
      listResources({ status: 'approved' }),
      listProjects({ status: 'approved' }),
      listForumPosts({ status: 'approved' }),
    ]).then(([r, p, f]) =>
      setCounts({ resource: r.length, project: p.length, forum: f.length })
    );
  }, []);

  return (
    <Layout>
      <section className="pt-24 pb-14 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">开源社区</h1>
          <p className="text-gray-600 leading-relaxed max-w-2xl">
            学习资料、项目共享、AI 论坛三个板块。
            <span className="text-gray-900">任何人都可以投稿，不需要登录</span>
            ；社团成员审核校友与校外投稿，管理层审核全部，通过后才在这里公开。
          </p>
        </div>
      </section>

      <section className="pb-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {BOARDS.map(b => {
              const n = counts[b.kind];
              return (
                <Link
                  key={b.kind}
                  href={b.href}
                  className="group flex flex-col bg-white rounded-2xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-lg transition-all"
                >
                  <div
                    className={`w-14 h-14 rounded-xl grid place-items-center mb-5 ${b.accent}`}
                  >
                    {b.icon}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {CONTENT_KIND_LABEL[b.kind]}
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed grow mb-5">{b.desc}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {n === null ? '统计中…' : `${n} ${b.unit}`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                      进入
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-10 rounded-2xl border border-blue-200 bg-blue-50/60 p-6">
            <div className="flex items-start gap-3 mb-4">
              <Upload className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold text-gray-900">我要投稿</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  三类内容都能投，
                  <span className="text-gray-900">社团成员和校外同学都不用先注册</span>
                  ；成员登录后提交会自动带上身份，不必再填联系方式。
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['resource', 'project', 'forum'] as ContentKind[]).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSubmitting(k)}
                  className="text-left bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <span className="block font-medium text-gray-900 mb-0.5">
                    投 {CONTENT_KIND_LABEL[k]}
                  </span>
                  <span className="block text-xs text-gray-500">{SUBMIT_COPY[k]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-gray-50 border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">投稿会怎么处理</h2>
            <ol className="grid gap-4 sm:grid-cols-3 text-sm">
              {[
                ['01', '提交', '在对应板块点投稿按钮。校内邮箱归「校友投稿」，其他后缀归「校外投稿」。'],
                ['02', '审核', '社团成员审公开投稿，管理层审全部。驳回一定会写原因。'],
                ['03', '公开', '通过后立刻出现在板块列表里，任何人都能看到。'],
              ].map(([step, title, desc]) => (
                <li key={step}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs grid place-items-center">
                      {step}
                    </span>
                    <span className="font-medium text-gray-900">{title}</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 项目字段多（标签/链接/封面上传），单独一个弹窗；资料与发帖字段少，合用一个 */}
      {submitting === 'project' && <SubmitProjectModal onClose={() => setSubmitting(null)} />}
      {(submitting === 'resource' || submitting === 'forum') && (
        <SubmitContentModal kind={submitting} onClose={() => setSubmitting(null)} />
      )}
    </Layout>
  );
}
