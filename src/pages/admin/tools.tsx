/**
 * AI 写作助手（仅成员可用）。
 *
 * 一个输入区 + 选能力，支持粘贴与上传文档。
 * 与对外的 `/tools`（外部工具导航，只有链接）是两回事。
 */
import AdminShell from '../../components/admin/AdminShell';
import AiWorkbench from '../../components/AiWorkbench';

export default function AdminToolsPage() {
  return (
    <AdminShell title="AI 写作助手">
      <p className="text-sm text-gray-600 mb-6 max-w-3xl">
        内容放一处，上面切能力 —— 同一段文字可以先摘要再润色，不用重新粘。
        「项目简介」和「方向标签」也内嵌在
        <span className="text-gray-900">「我的项目」</span>的表单里，写项目时直接点即可。
      </p>
      <AiWorkbench />
    </AdminShell>
  );
}
