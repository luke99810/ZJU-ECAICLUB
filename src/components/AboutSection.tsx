/**
 * 首页的社团简介块。
 *
 * 文案用社团自己的措辞（宗旨「求知·笃行·协作·创新」、使命「学习前沿·探索工具·
 * 激发应用·创造价值」），不另编一套 —— 原来那版是脚手架留的通用口号，
 * 放在哪个社团网站上都成立，等于什么也没说。
 */
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, Lightbulb, Rocket } from 'lucide-react';
import { CLUB } from '../data/club';

/** 使命四项各配一个图标，顺序与 CLUB.mission 一致 */
const MISSION_ICONS = [BookOpen, Compass, Lightbulb, Rocket];

export default function AboutSection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('aboutSection.title')}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {CLUB.name}成立于 {CLUB.founded}，宗旨是「{CLUB.motto.join(' · ')}」。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-14">
          {CLUB.mission.map((m, i) => {
            const Icon = MISSION_ICONS[i];
            return (
              <div key={m} className="rounded-2xl border border-gray-200 p-5 text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-50 grid place-items-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-blue-700" />
                </div>
                <h3 className="font-semibold text-gray-900">{m}</h3>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-8 text-center">
          <p className="text-gray-700 leading-relaxed max-w-3xl mx-auto mb-6">
            {CLUB.positioning}
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 text-blue-700 font-medium hover:text-blue-900"
          >
            了解社团的八年
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
