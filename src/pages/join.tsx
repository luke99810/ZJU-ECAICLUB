/**
 * 招新页 —— 部门介绍、报名入口、面试须知。
 *
 * 报名入口刻意做成「外部表单链接 + 邮箱兜底」：社团招新是季节性的，
 * 用问卷/表单收集比自建一套报名后端务实得多。链接写在 RECRUIT_FORM_URL，
 * 每季换一次即可；留空时自动退化为「邮件报名」。
 */
import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import Layout from '../components/Layout';
import { CONTACT } from '../data/club';

/** 换季只改这一行；留空则页面只显示邮箱报名。 */
const RECRUIT_FORM_URL = '';
// 联系方式统一从 data/club.ts 取，避免三个页面各写一份改漏
const CONTACT_EMAIL = CONTACT.email;

const DEPARTMENTS = [
  {
    name: '技术部',
    tagline: '写代码、做项目、打比赛',
    detail:
      '主攻 LLM 应用、Agent、RAG 与 CV。参与社团开源项目，成果直接进作品集。适合想动手做出东西的同学。',
    tags: ['LLM', 'Agent', 'RAG', 'CV'],
  },
  {
    name: '宣传部',
    tagline: '内容、视觉、对外发声',
    detail:
      '负责活动海报、公众号内容、技术推文。会用多模态生成工具是加分项，社团也会带着学。',
    tags: ['Multimodal'],
  },
  {
    name: '组织部',
    tagline: '把活动真正办起来',
    detail:
      '策划讲座与工作坊、联系外部讲师、维护成员社群。适合喜欢组织协调、想认识更多人的同学。',
    tags: [],
  },
];

const INTERVIEW_NOTES = [
  '不考算法题，不背概念。聊你做过什么、怎么想的。',
  '有作品最好 —— GitHub、博客、课程项目、甚至一个跑起来的小脚本都算。',
  '完全零基础也可以投技术部，说清楚你想学什么方向即可。',
  '一轮面试，20 分钟左右，线上线下都行。',
];

export default function JoinPage() {
  return (
    <Layout>
      <section className="pt-24 pb-16 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">加入我们</h1>
          <p className="text-gray-600 max-w-2xl mb-10">
            三个部门同步招新。不限年级、不限专业，对 AI 有兴趣、愿意动手就够了。
          </p>

          <h2 className="text-xl font-bold text-gray-900 mb-4">部门介绍</h2>
          <div className="grid gap-5 md:grid-cols-3 mb-12">
            {DEPARTMENTS.map(d => (
              <div key={d.name} className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900">{d.name}</h3>
                <p className="text-sm text-blue-600 mb-2">{d.tagline}</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">{d.detail}</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.tags.map(t => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-4">面试须知</h2>
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-12">
            {INTERVIEW_NOTES.map(n => (
              <li key={n} className="px-5 py-3.5 text-sm text-gray-700">
                {n}
              </li>
            ))}
          </ul>

          <div className="rounded-xl bg-blue-600 px-6 py-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">报名</h2>
            <p className="text-blue-100 text-sm mb-6">
              {RECRUIT_FORM_URL
                ? '填一份简短表单，我们会在三天内回复面试安排。'
                : '本季报名表单还没开放，先发邮件给我们，开放后第一时间通知你。'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {RECRUIT_FORM_URL && (
                <a
                  href={RECRUIT_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  填写报名表 <ArrowRight className="w-4 h-4" />
                </a>
              )}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('AI Club 招新咨询')}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 border-2 border-white text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-8">
            想先看看我们在做什么？去{' '}
            <Link href="/community/projects" className="text-blue-600 hover:underline">
              项目共享
            </Link>{' '}
            或{' '}
            <Link href="/news" className="text-blue-600 hover:underline">
              社团新闻
            </Link>
            。
          </p>
        </div>
      </section>
    </Layout>
  );
}
