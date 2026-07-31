/**
 * 社团成员页 —— 按部门分组（管理层 / 技术部 / 组织部 / 宣传部）+ 往届成员。
 *
 * 数据与后台「成员管理」是同一张表：那边改完，这边刷新就变。卡片上展示的每一项
 * （姓名 / 部门 / 加入年份 / 兴趣方向 / 简介 / 技术标签）后台都能编辑，
 * 不存在「前台显示了但没地方改」的字段。
 *
 * 管理层就是管理员账号，所以这一组同时也是「谁能审内容、谁能加人」的答案。
 * 「历任负责人」页已删除：换届信息放在关于我们里讲更合适，单开一页维护不起来。
 */
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { listMembers } from '../lib/store';
import { DEPARTMENTS, isAlumniMember, type Member } from '../types';

function Avatar({ member }: { member: Member }) {
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.name}
        className="w-14 h-14 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  // 没头像就用姓氏首字，比放一个通用灰头像更好认。
  return (
    <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">
      {member.name.slice(0, 1)}
    </div>
  );
}

function MemberCard({ member }: { member: Member }) {
  return (
    <div className="flex gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <Avatar member={member} />
      <div className="min-w-0 flex-grow">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-gray-900">{member.name}</h3>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          {member.department} · {member.joined_at.slice(0, 7)} 加入
        </p>
        {member.interests && (
          <p className="text-sm text-gray-700 mb-1.5">
            <span className="text-gray-400">兴趣方向　</span>
            {member.interests}
          </p>
        )}
        {member.bio && (
          <p className="text-sm text-gray-600 leading-relaxed mb-2">{member.bio}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {member.tags.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Group({ title, hint, members }: { title: string; hint?: string; members: Member[] }) {
  if (members.length === 0) return null;
  return (
    <div className="mb-12">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          {title} <span className="text-gray-400 font-normal text-base">{members.length}</span>
        </h2>
        {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {members.map(m => (
          <MemberCard key={m.id} member={m} />
        ))}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMembers()
      .then(setMembers)
      .finally(() => setLoading(false));
  }, []);

  // 往届不是手工勾的字段，按加入年份推 —— 每年自动滚动，不用有人挨个去改名单
  const current = members.filter(m => !isAlumniMember(m));
  const alumni = members.filter(m => isAlumniMember(m));
  // 按部门固定顺序分组（管理层在前），空部门由 Group 自己不渲染。
  const byDepartment = DEPARTMENTS.map(d => ({
    name: d,
    members: current.filter(m => m.department === d),
  }));

  return (
    <Layout>
      <section className="pt-24 pb-16 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">社团成员</h1>
          <p className="text-gray-600 max-w-2xl mb-10">
            按兴趣方向与技术标签认人，比按职位更实用 —— 想找人一起做 Agent 或 CV 的，
            直接看标签；研究方向落在词表之外的，看兴趣方向那一行。
          </p>

          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : (
            <>
              {byDepartment.map(g => (
                <Group key={g.name} title={g.name} members={g.members} />
              ))}
              <Group
                title="往届优秀成员"
                hint="按加入年份自动归入，仍是社团的技术后盾。"
                members={alumni}
              />
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
