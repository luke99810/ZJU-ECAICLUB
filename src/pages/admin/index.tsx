/**
 * 后台概览：自己项目的审核进度 + 待处理留言 + 全站统计视图。
 *
 * 上面一排卡片是**要我干活的事**（我的项目、我的待审、待处理留言），
 * 下面的图表是**社团现在什么样**。两者性质不同，所以分开摆，中间有分隔。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageSquare } from 'lucide-react';
import AdminShell from '../../components/admin/AdminShell';
import { BarChart, DonutChart, LineChart, PALETTE } from '../../components/charts';
import { getSession, isAdmin, onAuthStateChange, type MaybeSession } from '../../lib/auth';
import { listMessages, listProjects, resetLocalData, usingSupabase } from '../../lib/store';
import { getStats, RANGES, type Contributor, type RangeKey, type Stats } from '../../lib/stats';
import { CONTENT_KIND_LABEL, ORIGIN_LABEL, type AiProject, type ContentKind, type Session } from '../../types';

function Stat({
  label,
  value,
  tone,
  href,
  hint,
}: {
  label: string;
  value: number;
  tone?: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone ?? 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </>
  );
  const cls = 'bg-white rounded-xl border border-gray-200 px-5 py-4';
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <Link href={href} className={`${cls} block hover:border-blue-300 hover:shadow-sm transition-all`}>
      {body}
    </Link>
  );
}

function Panel({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {desc && <p className="text-xs text-gray-500 mt-0.5 mb-4">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </div>
  );
}

/** 贡献榜的取值维度：全部或某一类内容。 */
type ContribKind = ContentKind | 'all';

const CONTRIB_TABS: Array<{ key: ContribKind; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'project', label: CONTENT_KIND_LABEL.project },
  { key: 'resource', label: CONTENT_KIND_LABEL.resource },
  { key: 'forum', label: CONTENT_KIND_LABEL.forum },
];

const pick = (c: Contributor, kind: ContribKind) =>
  kind === 'all' ? c.total : c[kind];

/**
 * 内容贡献榜。
 *
 * 默认看前 5 —— 社团规模下前 5 就能说明问题，一屏放得下；要看更多再展开到 10。
 * 名次后面画一条占比条：只给数字的话，「3 条」是多是少全凭感觉，
 * 有条子才知道跟第一名差多少。
 */
function Leaderboard({ rows }: { rows: Contributor[] }) {
  const [kind, setKind] = useState<ContribKind>('all');
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(
    () =>
      rows
        .filter(c => pick(c, kind) > 0)
        .sort((a, b) => pick(b, kind) - pick(a, kind) || a.name.localeCompare(b.name)),
    [rows, kind]
  );

  const limit = expanded ? 10 : 5;
  const shown = ranked.slice(0, limit);
  const max = shown.length > 0 ? pick(shown[0], kind) : 0;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CONTRIB_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setKind(t.key)}
            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
              kind === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="h-40 grid place-items-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          这个范围内还没有人发布过{kind === 'all' ? '内容' : CONTENT_KIND_LABEL[kind]}
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {shown.map((c, i) => {
              const v = pick(c, kind);
              return (
                <li key={c.key} className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 shrink-0 rounded grid place-items-center text-[11px] font-semibold ${
                      i === 0
                        ? 'bg-amber-100 text-amber-800'
                        : i === 1
                          ? 'bg-gray-200 text-gray-700'
                          : i === 2
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-900 truncate max-w-[7rem]">{c.name}</span>
                  {c.origin !== 'member' && (
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] shrink-0">
                      {ORIGIN_LABEL[c.origin]}
                    </span>
                  )}
                  <span className="flex-grow h-1.5 rounded-full bg-gray-100 overflow-hidden ml-1">
                    <span
                      className="block h-full rounded-full bg-blue-500"
                      style={{ width: `${max > 0 ? (v / max) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="text-sm font-medium text-gray-900 w-6 text-right shrink-0">
                    {v}
                  </span>
                </li>
              );
            })}
          </ol>

          {ranked.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              {expanded ? '收起' : `展开前 10（共 ${ranked.length} 人）`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminHome() {
  const [mine, setMine] = useState<AiProject[]>([]);
  const [pending, setPending] = useState<AiProject[]>([]);
  const [newMessages, setNewMessages] = useState(0);
  const [range, setRange] = useState<RangeKey>(12);
  const [stats, setStats] = useState<Stats | null>(null);

  const loadStats = useCallback((r: RangeKey) => {
    void getStats(r).then(setStats);
  }, []);

  // undefined = 会话还没判定完（Supabase 恢复登录是异步的），null = 确定未登录
  const [session, setSession] = useState<MaybeSession>(undefined);

  useEffect(() => {
    setSession(getSession());
    return onAuthStateChange(setSession);
  }, []);

  // 数据要等会话到位再拉：挂载时取一次的话，Supabase 模式下拿到的还是 undefined
  useEffect(() => {
    if (!session) return;
    listProjects({ authorId: session.member.id }).then(setMine);
    listMessages('new').then(list => setNewMessages(list.length));
    if (isAdmin(session)) listProjects({ status: 'pending' }).then(setPending);
  }, [session]);

  useEffect(() => {
    loadStats(range);
  }, [range, loadStats]);

  const admin = isAdmin(session);

  // 月份标签在图上只显示「月」，年份放在图的说明里 —— 全写成 2026-03 会挤成一团
  const monthLabels = useMemo(
    () => (stats ? stats.months.map(m => m.slice(2).replace('-', '/')) : []),
    [stats]
  );

  return (
    <AdminShell title="概览">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Stat label="我的项目" value={mine.length} href="/admin/projects" />
        <Stat
          label="我的待审核"
          value={mine.filter(p => p.status === 'pending').length}
          tone="text-amber-600"
          href="/admin/projects"
        />
        <Stat
          label="我的已通过"
          value={mine.filter(p => p.status === 'approved').length}
          tone="text-emerald-600"
          href="/admin/projects"
        />
        <Stat
          label="待处理留言"
          value={newMessages}
          tone={newMessages > 0 ? 'text-rose-600' : 'text-gray-900'}
          href="/admin/messages"
          hint={newMessages > 0 ? '来自官网「联系我们」' : '没有积压'}
        />
      </div>

      {admin && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">全站待审核</h2>
            <Link href="/admin/review" className="text-sm text-blue-600 hover:underline">
              去审核
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-gray-500">队列是空的。</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pending.slice(0, 5).map(p => (
                <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-800 truncate">{p.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.author_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── 统计视图 ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 pt-2 border-t border-gray-200">
        <div className="pt-5">
          <h2 className="font-semibold text-gray-900">社团数据</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            只统计<span className="text-gray-700">已通过</span>
            的内容；时间范围作用于所有内容类图表，「成员部门分布」是人员现状，始终看全量。
          </p>
        </div>
        <div className="flex gap-1.5 pt-5">
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                range === r.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!stats ? (
        <p className="text-gray-500">统计中…</p>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6 mb-6">
            {[
              { label: '现任成员', value: stats.totals.activeMembers },
              { label: '项目', value: stats.totals.projects },
              { label: '学习资料', value: stats.totals.resources },
              { label: '论坛帖子', value: stats.totals.forumPosts },
              { label: '导航工具', value: stats.totals.tools },
              { label: '社团新闻', value: stats.totals.posts },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Panel
                title="内容累计增长"
                desc="三类社区内容的累计条数。起点带上了时间窗之前的存量，所以线不会从 0 开始。"
              >
                <LineChart
                  labels={monthLabels}
                  unit=" 条"
                  series={[
                    { name: '项目共享', values: stats.cumulative.projects, color: PALETTE[0] },
                    { name: '学习资料', values: stats.cumulative.resources, color: PALETTE[1] },
                    { name: 'AI 论坛', values: stats.cumulative.forum, color: PALETTE[2] },
                  ]}
                />
              </Panel>
            </div>

            <Panel title="每月新增内容" desc="三类内容当月新增之和，看哪几个月在发力。">
              <BarChart
                labels={monthLabels}
                unit=" 条"
                series={[{ name: '新增', values: stats.monthlyNew, color: PALETTE[3] }]}
              />
            </Panel>

            <Panel title="成员部门分布" desc="只统计现任成员；往届按加入年份自动排除。">
              <DonutChart slices={stats.byDepartment} />
            </Panel>

            <Panel
              title="内容来源构成"
              desc="社团成员自己发的，和校友、校外投稿各占多少 —— 看开放投稿这条路走通了没有。"
            >
              <DonutChart slices={stats.byOrigin} size={150} />
            </Panel>

            <Panel title="内容贡献榜" desc="谁发得最多。可按内容类型切换，跟随上方的时间范围。">
              <Leaderboard rows={stats.contributors} />
            </Panel>
          </div>
        </>
      )}

      {/* 数据存在哪里，是看这一页的人最该先知道的事，所以直接写在页面上 */}
      {usingSupabase ? (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 mt-8">
          <h2 className="font-semibold text-gray-900 mb-2">数据已接入 Supabase</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            内容存在云端数据库里，所有人看到的是同一份，清缓存也不会丢。
            <br />
            备份与恢复在 Supabase 控制台 → Database → Backups，建议每学期手动导出一次。
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-amber-200 p-5 mt-8">
          <h2 className="font-semibold text-gray-900 mb-2">当前是本地演示数据</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            项目、成员、活动、留言都存在这台浏览器的 localStorage 里，
            <span className="text-gray-900">换浏览器或清缓存就会回到初始状态</span>。
            在 <code>.env.local</code> 填上 Supabase 的两个环境变量并重启，数据层会自动切到云端 ——
            页面代码不用改。步骤见「上线指南」第二节。
          </p>
          <button
            type="button"
            onClick={() => {
              resetLocalData();
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            重置为初始演示数据
          </button>
        </div>
      )}

      {newMessages > 0 && (
        <Link
          href="/admin/messages"
          className="mt-6 flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <MessageSquare className="w-4 h-4" />
          有 {newMessages} 条留言待处理
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </AdminShell>
  );
}
