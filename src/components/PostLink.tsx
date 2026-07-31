/**
 * 活动 / 成果的外部链接。
 *
 * 社团的活动回顾基本都在微信公众号上，所以这里对常见来源做了识别，
 * 让访客点之前就知道会跳去哪 —— 尤其公众号链接在微信外打开体验不同，
 * 提前标明比点开才发现好。
 */
import { ExternalLink } from 'lucide-react';

/** 按域名猜一个说得过去的默认文案。 */
export function inferLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (host.includes('mp.weixin.qq.com')) return '公众号推文';
    if (host.includes('zhihu.com')) return '知乎';
    if (host.includes('bilibili.com')) return 'B 站视频';
    if (host.includes('github.com')) return 'GitHub';
    if (host.includes('arxiv.org')) return '论文';
    if (host.includes('xiaohongshu.com')) return '小红书';
    return '查看原文';
  } catch {
    return '查看原文';
  }
}

interface PostLinkProps {
  url?: string;
  label?: string;
  className?: string;
}

export default function PostLink({ url, label, className }: PostLinkProps) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      // 卡片整体可能已经是链接/按钮，阻止冒泡避免触发外层行为
      onClick={e => e.stopPropagation()}
      className={
        className ??
        'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition-colors'
      }
    >
      <ExternalLink className="w-3 h-3" />
      {label?.trim() || inferLinkLabel(url)}
    </a>
  );
}
