
# 浙江大学工程师学院人工智能俱乐部官网 - 产品需求文档

## 1. 项目概述

### 1.1 项目背景
浙江大学工程师学院人工智能俱乐部（以下简称"AI俱乐部"）需要一个官方网站，用于展示社团形象、发布新闻动态、分享学习资源、促进成员交流。该网站将托管在GitHub Pages等平台上，支持中英文双语切换。

### 1.2 目标用户
- 俱乐部成员（学生、研究生、导师）
- 潜在成员（对AI感兴趣的学生）
- 合作单位与企业
- 社会公众

### 1.3 技术选型
- **框架**: Next.js 14 (React)
- **语言**: TypeScript
- **样式**: Tailwind CSS 3
- **国际化**: next-i18next
- **图标**: Lucide React
- **部署**: GitHub Pages

### 1.4 数据存储方案
由于GitHub Pages为静态托管，无法运行后端服务，采用以下方案：
1. **静态内容**: 社团介绍、历史等使用Markdown文件管理
2. **项目/资料上传**: 通过Google Forms表单收集，存储到Google Sheets
3. **AI论坛**: 使用GitHub Issues作为后端，通过GitHub API展示和提交

---

## 2. 功能需求

### 2.1 核心功能模块

| 模块 | 功能描述 | 优先级 |
|------|----------|--------|
| 首页 | 社团概览、快速导航、动态轮播 | 高 |
| 社团介绍 | 社团宗旨、组织结构、发展历程 | 高 |
| 历任负责人 | 展示历任主席、部长信息 | 高 |
| 社团新闻 | 新闻列表、新闻详情 | 高 |
| 联系我们 | 联系方式、地图定位 | 高 |
| 开源社区 | 学习资料、项目共享、AI论坛 | 高 |

### 2.2 详细功能需求

#### 2.2.1 首页
- 顶部导航栏（中英文切换、导航菜单）
- Hero区域（社团名称、口号、CTA按钮）
- 新闻动态预览（最近3条新闻）
- 特色项目展示
- 底部信息

#### 2.2.2 社团介绍
- 社团宗旨与愿景
- 组织结构图
- 发展历程时间线
- 荣誉与成就展示

#### 2.2.3 历任负责人
- 按年份展示历任负责人
- 每位负责人的简介和照片
- 任期时间

#### 2.2.4 社团新闻
- 新闻列表（分页/滚动加载）
- 新闻分类筛选
- 新闻详情页面
- 分享功能

#### 2.2.5 联系我们
- 联系方式（邮箱、电话、地址）
- 地图嵌入
- 联系表单（提交咨询）

#### 2.2.6 开源社区

**学习资料**
- 资料分类（入门、进阶、专项）
- 资料列表展示（标题、简介、标签、上传者）
- 资料详情（下载/跳转链接）

**项目共享**
- 项目列表展示（卡片式）
- 项目筛选（按分类、热度）
- 项目上传表单（姓名、单位、是否会员、项目简介、GitHub链接）
- 项目详情页面

**AI论坛**
- 帖子列表（按时间/热度排序）
- 帖子分类（问答、分享、讨论）
- 发帖功能（标题、内容、分类）
- 评论功能（通过GitHub Issues评论）

### 2.3 国际化需求
- 中英文双语切换
- 全站内容支持双语
- 语言切换按钮在导航栏

---

## 3. 非功能需求

### 3.1 性能要求
- 首屏加载时间 < 3秒
- 响应式设计，支持移动端

### 3.2 设计要求
- 现代简洁的UI风格
- 主色调：浙大蓝（#1a73e8）
- 符合高校官网气质

### 3.3 安全性要求
- 表单提交防注入
- 敏感信息加密传输

---

## 4. 页面结构

```
/                          # 首页
/about                     # 社团介绍
/leadership                # 历任负责人
/news                      # 社团新闻
/news/[slug]               # 新闻详情
/community                 # 开源社区首页
/community/resources       # 学习资料
/community/projects        # 项目共享
/community/forum           # AI论坛
/community/forum/[id]      # 帖子详情
/contact                   # 联系我们
```

---

## 5. 数据模型

### 5.1 新闻数据
```typescript
interface News {
  id: string;
  title: { zh: string; en: string };
  content: { zh: string; en: string };
  category: string;
  date: string;
  author: string;
  coverImage?: string;
}
```

### 5.2 负责人数据
```typescript
interface Leader {
  id: string;
  name: { zh: string; en: string };
  position: { zh: string; en: string };
  term: string; // "2023-2024"
  avatar: string;
  bio: { zh: string; en: string };
}
```

### 5.3 项目数据
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  authorName: string;
  organization: string;
  isMember: boolean;
  githubUrl: string;
  createdAt: string;
  tags: string[];
}
```

### 5.4 学习资料数据
```typescript
interface Resource {
  id: string;
  title: string;
  description: string;
  category: 'beginner' | 'intermediate' | 'advanced';
  url: string;
  uploader: string;
  uploaderOrg: string;
  isMember: boolean;
  tags: string[];
  createdAt: string;
}
```

### 5.5 论坛帖子数据
```typescript
interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: 'question' | 'share' | 'discussion';
  author: {
    name: string;
    avatar: string;
  };
  createdAt: string;
  comments: number;
  reactions: {
    thumbsUp: number;
    heart: number;
  };
}
```

---

## 6. API接口设计

### 6.1 静态数据接口
- `/api/news` - 获取新闻列表
- `/api/leaders` - 获取负责人列表

### 6.2 外部集成
- **Google Forms**: 处理项目/资料上传
- **GitHub API**: 获取Issues作为论坛帖子
- **Google Sheets API**: 获取上传的项目/资料数据

---

## 7. 部署方案

1. 使用Next.js静态导出
2. 托管到GitHub Pages
3. 自定义域名（可选）
4. 配置GitHub Actions自动部署

---

## 8. 开发计划

| 阶段 | 时间 | 任务 |
|------|------|------|
| 第一阶段 | 1周 | 项目初始化、基础配置、国际化设置 |
| 第二阶段 | 1周 | 首页、社团介绍、历任负责人页面 |
| 第三阶段 | 1周 | 社团新闻、联系我们页面 |
| 第四阶段 | 2周 | 开源社区模块（学习资料、项目共享、AI论坛） |
| 第五阶段 | 1周 | 测试、优化、部署 |
