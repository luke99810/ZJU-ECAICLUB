/**
 * AI 工具导航的种子数据 —— 首次访问时写入 localStorage，之后由后台维护。
 *
 * 原来这份清单是写死的常量（`data/aiToolLinks.ts`），改一条得发一次版；
 * 现在它只是初始内容，「AI 工具导航」后台页可以增删改。
 * 类型与分类词表已移到 `src/types`，因为数据层和页面都要用。
 */
import type { ToolLink } from '../types';

/** 种子统一用一个固定时间，避免每次读种子都生成新的 created_at。 */
const AT = '2026-07-01T00:00:00.000Z';

/** 少写一堆重复字段。sort 用 10 的倍数，方便以后往中间插。 */
function tool(
  id: string,
  name: string,
  note: string,
  url: string,
  category: ToolLink['category'],
  access: ToolLink['access'],
  cnFriendly = false
): ToolLink {
  return {
    id,
    name,
    note,
    url,
    category,
    access,
    ...(cnFriendly ? { cnFriendly: true } : {}),
    sort: Number(id.slice(2)) * 10,
    created_at: AT,
    updated_at: AT,
  };
}

export const seedToolLinks: ToolLink[] = [
  // ── 对话与写作 ──────────────────────────────────────────────────────
  tool('t-1', 'ChatGPT', '通用对话与写作，生态与插件最全。', 'https://chat.openai.com', '对话与写作', 'free'),
  tool('t-2', 'Claude', '长文本处理与代码分析见长，适合读整份论文或整个仓库。', 'https://claude.ai', '对话与写作', 'free'),
  tool('t-3', 'Kimi', '超长上下文，中文资料整理顺手，国内直连。', 'https://kimi.moonshot.cn', '对话与写作', 'free', true),
  tool('t-4', '通义千问', '阿里的通用模型，有免费额度，API 也好接。', 'https://tongyi.aliyun.com', '对话与写作', 'free', true),
  tool('t-5', 'DeepSeek', '推理与数学表现强，API 价格低，适合做课程项目。', 'https://chat.deepseek.com', '对话与写作', 'free', true),

  // ── 代码 ───────────────────────────────────────────────────────────
  tool('t-6', 'GitHub Copilot', 'IDE 内补全与对话。学生认证后免费。', 'https://github.com/features/copilot', '代码', 'free'),
  tool('t-7', 'Cursor', '以 AI 为中心重做的编辑器，跨文件改代码比补全好用。', 'https://cursor.com', '代码', 'trial'),
  tool('t-8', 'Claude Code', '命令行里的编码 Agent，能自己读仓库、跑测试、提交。', 'https://claude.com/claude-code', '代码', 'trial'),
  tool('t-9', '通义灵码', '国内可直连的编码助手，支持主流 IDE。', 'https://lingma.aliyun.com', '代码', 'free', true),

  // ── 绘画与设计 ─────────────────────────────────────────────────────
  tool('t-10', 'Midjourney', '出图质量的标杆，风格控制最成熟。', 'https://midjourney.com', '绘画与设计', 'paid'),
  tool('t-11', 'Stable Diffusion / ComfyUI', '本地部署、完全可控，社团海报生成器就是基于它。', 'https://github.com/comfyanonymous/ComfyUI', '绘画与设计', 'free'),
  tool('t-12', '即梦 AI', '中文提示词友好，做活动海报和封面快。', 'https://jimeng.jianying.com', '绘画与设计', 'free', true),
  tool('t-13', 'Canva AI', '排版模板 + AI 生成，非设计专业也能出得去手的物料。', 'https://www.canva.cn', '绘画与设计', 'free', true),

  // ── 论文与阅读 ─────────────────────────────────────────────────────
  tool('t-14', 'Semantic Scholar', '按引用关系找论文，比关键词搜准。', 'https://www.semanticscholar.org', '论文与阅读', 'free'),
  tool('t-15', 'Connected Papers', '把一篇论文的相关工作画成图谱，开题时用。', 'https://www.connectedpapers.com', '论文与阅读', 'free'),
  tool('t-16', 'NotebookLM', '把一堆 PDF 喂进去做带出处的问答，读文献综述效率高。', 'https://notebooklm.google.com', '论文与阅读', 'free'),
  tool('t-17', 'Zotero', '文献管理老牌工具，配 AI 插件可自动摘要。', 'https://www.zotero.org', '论文与阅读', 'free'),

  // ── 音视频 ─────────────────────────────────────────────────────────
  tool('t-18', 'Whisper', 'OpenAI 的开源语音识别，讲座录音转文字首选。', 'https://github.com/openai/whisper', '音视频', 'free'),
  tool('t-19', 'CapCut / 剪映', '自动字幕与配音，做社团活动视频够用。', 'https://www.capcut.cn', '音视频', 'free', true),
  tool('t-20', 'Suno', '文字生成音乐，做活动预热片头用。', 'https://suno.com', '音视频', 'trial'),

  // ── 模型与部署 ─────────────────────────────────────────────────────
  tool('t-21', 'Hugging Face', '模型与数据集的集散地，还能白嫖 Spaces 跑 demo。', 'https://huggingface.co', '模型与部署', 'free'),
  tool('t-22', 'Ollama', '一条命令在自己电脑上跑开源模型，断网也能用。', 'https://ollama.com', '模型与部署', 'free'),
  tool('t-23', '硅基流动', '国内的模型 API 聚合，注册即有免费额度。', 'https://siliconflow.cn', '模型与部署', 'free', true),
  tool('t-24', 'ModelScope 魔搭', '阿里的模型社区，中文模型和教程多。', 'https://modelscope.cn', '模型与部署', 'free', true),
  tool('t-25', 'Google Colab', '免费 GPU 跑 notebook，做课程实验不用自己配环境。', 'https://colab.research.google.com', '模型与部署', 'free'),
];
