/**
 * 作品集卡片。作品集页与后台「我的项目」共用，保证两处展示一致。
 */
import { ExternalLink, FileText } from 'lucide-react';
import GithubIcon from './icons/GithubIcon';
import { ORIGIN_LABEL, type AiProject, type SubmissionOrigin } from '../types';

interface ProjectCardProps {
  project: AiProject;
  /** 后台里额外挂的操作区（编辑/删除、审核按钮）。 */
  actions?: React.ReactNode;
  /** 是否显示审核状态徽标 —— 对外的作品集页不显示（那里只有已通过的）。 */
  showStatus?: boolean;
}

const STATUS_STYLE: Record<AiProject['status'], { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: '已通过', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: '已驳回', cls: 'bg-rose-100 text-rose-800' },
};

/** 三种外链共用一个渲染，缺的自动不显示 —— 学生项目常常只有 GitHub。 */
function LinkChip({
  href,
  icon,
  label,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs hover:bg-gray-200 transition-colors"
    >
      {icon}
      {label}
    </a>
  );
}

/** 校友与校外用不同底色，扫一眼列表就能看出社团内外的比例。 */
const ORIGIN_STYLE: Record<SubmissionOrigin, string> = {
  member: '',
  alumni: 'bg-amber-50 text-amber-700',
  external: 'bg-violet-50 text-violet-700',
};

export default function ProjectCard({ project, actions, showStatus }: ProjectCardProps) {
  const status = STATUS_STYLE[project.status];
  const origin: SubmissionOrigin = project.origin ?? 'member';

  return (
    <article className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {project.cover_url ? (
        // 封面是选填的；没有就用渐变占位，避免卡片高度参差不齐。
        <img
          src={project.cover_url}
          alt={project.title}
          className="w-full h-40 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
          <span className="text-white/90 text-2xl font-bold tracking-wide">
            {project.title.slice(0, 2)}
          </span>
        </div>
      )}

      <div className="flex flex-col flex-grow p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 leading-snug">{project.title}</h3>
          {showStatus && (
            <span className={`shrink-0 px-2 py-0.5 rounded text-xs ${status.cls}`}>
              {status.label}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-3 flex-grow">{project.summary}</p>

        {project.status === 'rejected' && project.review_note && (
          <p className="text-xs text-rose-700 bg-rose-50 rounded-md px-2.5 py-2 mb-3">
            驳回原因：{project.review_note}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {/* 功能场景放最前 —— 找项目的人先看「能帮我干什么」 */}
          {(project.functions ?? []).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs">
              {t}
            </span>
          ))}
          {project.tags.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
              {t}
            </span>
          ))}
          {project.stack.map(s => (
            <span key={s} className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 text-xs">
              {s}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <LinkChip href={project.github_url} icon={<GithubIcon size={13} />} label="代码" />
          <LinkChip href={project.blog_url} icon={<ExternalLink size={13} />} label="推文 / 博客" />
          <LinkChip href={project.paper_url} icon={<FileText size={13} />} label="论文" />
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span className="min-w-0 truncate">
            {origin !== 'member' && (
              <span className={`mr-1.5 px-1.5 py-0.5 rounded ${ORIGIN_STYLE[origin]}`}>
                {ORIGIN_LABEL[origin]}
              </span>
            )}
            {project.author_name}
            {project.submitter_org ? `·${project.submitter_org}` : ''}
          </span>
          <span className="shrink-0">{project.created_at.slice(0, 10)}</span>
        </div>

        {actions && <div className="mt-3 flex gap-2">{actions}</div>}
      </div>
    </article>
  );
}
