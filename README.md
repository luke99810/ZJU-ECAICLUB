# AI Club 社团官网

浙江大学工程师学院人工智能俱乐部官网。按 `AI Club 社团官网｜完整架构设计方案.md`
实现：**单站点、双模块**（对外展示 + `/admin` 成员后台），外加社团特色的 AI 工具。

**线上：** https://zju-ecaiclub.luke942021.workers.dev

> **要上线看这个** → [`上线指南.md`](上线指南.md)
> 建库、接登录、填密钥、部署的完整步骤，以及每一步真实踩过的坑。
> 本文件只讲现在有什么、怎么用。

## 跑起来

```bash
npm install
npx next dev -p 3007      # http://localhost:3007
```

AI 客服小艾需要一个免费大模型 key（不填也能跑，退化成站内检索）：

```bash
cp .env.example .env.local   # 填 AI_API_KEY，然后重启 dev server
```

## 页面

| 路径 | 内容 |
| --- | --- |
| `/` | Hero、社团简介、**热门 AI 项目**、**社团动态 + 招新入口** |
| `/about` `/contact` | 社团介绍、联系我们 |
| `/team` | **社团成员** —— 按四个部门分组（管理层/技术部/组织部/宣传部）+ 往届成员，展示兴趣方向与技术标签。内容全部来自后台「成员管理」，改完刷新即变 |
| `/news` | **社团新闻** —— 新闻 / 活动 / 赛事成果 / 公告合并成一条时间线，可分类筛选、可挂公众号推文链接 |
| `/community` | **开源社区总入口** —— 三个板块的实时条数 + **「我要投稿」（三类内容都在这里投）** |
| `/community/resources` | **学习资料** —— 按入门/进阶/专项分层，技术标签 + 关键词筛选、分页 |
| `/community/projects` | **项目共享** —— 功能标签 × 技术标签双维筛选 + 搜索 + 分页，含 GitHub / 推文 / 论文链接 |
| `/community/forum` | **AI 论坛** —— 发帖需审核；**评论不审核，未登录访客也能评** |
| `/join` | **招新** —— 部门介绍、面试须知、报名入口 |
| `/tools` | **AI 工具导航** —— 25 个外部工具，按用途分类，可筛「有免费额度」「国内直连」。只做索引，不代理服务，内容由后台维护 |
| `/admin` | 成员后台概览 —— 我的项目 / 待审 / **待处理留言** 四张卡片 + **统计视图**（折线 / 柱状 / 环形，可按时间筛选） |
| `/admin/projects` | 我的 AI 项目 —— 新增/编辑/删除，内嵌 AI 简介生成与自动打标签 |
| `/admin/messages` | **留言管理** —— 官网「联系我们」的留言，标记已处理 / 忽略；所有成员可处理，删除限管理员 |
| `/admin/review` | **内容审核** —— 项目共享 / 学习资料 / AI 论坛三个 tab，带各自待审数；驳回需填原因 |
| `/admin/tools` | **AI 写作助手** —— 一个输入区 + 选能力（项目简介 / 方向标签 / 润色 / 摘要 / 关键词），支持粘贴与**上传 PDF / Word / Markdown** |
| `/admin/toolnav` | **AI 工具导航维护** —— 增删改对外的工具清单，存下即生效；成员可增改，删除限管理员 |
| `/admin/posts` | **社团新闻管理** —— 新闻/活动/成果/公告的增删改，可挂外部链接（公众号推文等） |
| `/admin/members` | 成员管理（仅管理员）：录学号+邮箱开通账号、**CSV / XLSX 批量导入**、改资料、重置口令 |
| `/admin/account` | 我的账号：**编辑个人资料**（姓名/部门/方向标签/简介/头像）+ 修改口令 |
| `/admin/assistant` | AI 客服「小艾」配置（仅管理员）：人设、资料文档、密钥状态 |

站点自己的 AI 能力集中在右下角的 **AI 客服「小艾」**（全站悬浮）：先在站内检索
项目 / 学习资料 / 论坛帖 / 新闻 / 成员，再依据检索结果与资料文档作答，并把命中的条目
做成可点结果卡。**没有 AI key 时也能用** —— 退化成纯站内检索，照样能把项目找出来。

`/tools` 是**外部工具索引**（点卡片跳工具官网，本站不代理任何服务），
和上面的「小艾」是两回事 —— 前者是别人的能力，后者是本站的能力。

## 当前状态：已上线

Supabase（数据 + 登录）与 Cloudflare（部署）都已接通并验证。

- **数据**存在 Supabase，两个人看到同一份内容。
- **登录**走 Supabase Auth，口令校验在服务端，RLS 在数据库层兜底。
- **账号规则**：管理员在「成员管理」把人写进名册（`member_invites`），
  本人用那个邮箱在登录页自助设置口令，系统据名册自动建档。
  全程不需要 `service_role` key —— 那个 key 一旦进前端等于交出整个数据库。
  管理员最多 **3 个**，名额满时表单里的「管理员」选项会被禁用。

### 本地开发仍可脱库运行

不填 `NEXT_PUBLIC_SUPABASE_*` 时自动退回 localStorage + `src/data/seed.ts` 的演示数据，
`npm install && npx next dev` 就能把后台点通。这条路**只用于本地** ——
它的口令校验整套跑在浏览器里，改 localStorage 就能绕过。

两套实现靠一个编译期约束保持同步（`src/lib/store/index.ts`）：

```ts
type Backend = typeof local;
const _typecheck: Backend = remote;   // 少一个函数 / 签名不一致 → 编译报错
```

另有 `npm run check-schema` 比对 TS 接口字段与 `schema.sql` 的列 ——
这个脚本是在线上撞到 `column "interests" does not exist` 之后补的，
它当场又揪出 `posts` 少了两列。

两个解析库都是**按需动态 import**，只粘贴文字的人不会下载它们。

## 接 Supabase

完整步骤（含接 Auth、部署、检查清单）见 [`上线指南.md`](上线指南.md)，这里只列要点：

1. 建项目，在 SQL Editor 里执行 [`supabase/schema.sql`](supabase/schema.sql) —— 八张表
   （members / ai_projects / posts / resources / forum_posts / forum_comments /
   tool_links / messages）+ RLS 策略 + 审核状态写保护 trigger。
2. `.env.local` 填 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
3. **数据层不用改代码** —— `src/lib/store/` 下已经有两套实现（`local.ts` / `supabase.ts`），
   `index.ts` 按环境变量二选一，填了变量就走真库。`auth.ts` 仍需手动换成 Supabase Auth。
4. 可选：执行 [`supabase/seed.sql`](supabase/seed.sql) 带上那 25 条 AI 工具导航。

⚠️ **接完数据库紧接着就要接 Auth，中间不要对外发布。** 现在的口令校验整套跑在浏览器里，
改 localStorage 就能提权 —— 数据还在本地时这只是假数据，接了真库之后改的就是真库。

schema.sql 里有两处值得先看一眼再执行：

- 三类投稿的 **insert 策略强制 `status = 'pending'`**。少了这一条，外部投稿可以
  带着 `status='approved'` 直接插进来，审核就形同虚设。
- **`guard_review_status()` trigger** 卡住非管理员改 `status` / `review_note`，
  只对「成员审 alumni / external」这一种情形放行。光靠 update 策略挡不住 ——
  作者能改自己的行，也就能把自己的投稿改成已通过。

## 部署到 Cloudflare

**已上线，方案是「整站静态导出 + 一个自写 Worker」。**

```
out/          整站静态资源，由 Workers 静态资源伺服
worker.ts     只处理 /api/*（要读密钥，不能进浏览器）
```

```bash
npm run build:cf     # 导出到 out/（构建时临时移走 src/pages/api）
npx wrangler deploy
```

官方那两条路都试过，都不通：`@opennextjs/cloudflare` 要 Next ≥ 15.5（本项目 14.2）；
`@cloudflare/next-on-pages` 依赖 Vercel CLI，**在 Windows 上跑不起来**，
只能靠构建机试错。自写 Worker 的好处是每一步都能本地验证再推。
站点本来就全是客户端渲染、没有 `getServerSideProps`，静态导出等于没有代价。

**环境变量分两组，放错组不报错、只会静默用默认值：**

| 组 | 位置 | 变量 |
| --- | --- | --- |
| 构建时 | Settings → Build → Build variables | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 运行时 | Settings → Variables and Secrets | `AI_API_KEY`（Secret）、`AI_API_BASE`、`AI_MODEL` |

`NEXT_PUBLIC_*` 是**编译进前端包**的，运行时才配就来不及。

排错细节（`run_worker_first`、`.npmrc`、默认上游陷阱等）见
[`上线指南.md`](上线指南.md) 第五节。

### 换掉 workers.dev 里的个人用户名

`xxx.<子域名>.workers.dev` 的子域名是**账号级**的，改它影响账号下所有 Worker，
旧地址立刻失效。位置：Workers & Pages → Your subdomain → Change。

长期建议绑自有域名（Settings → Domains & Routes → Add Custom Domain）——
域名归社团所有，换人换平台都不受影响。
**换地址后必须回 Supabase 改 Site URL / Redirect URLs**，
否则重置口令的邮件链接会指向失效地址。

## 待办 / 已知问题

- [x] 接 Supabase（数据 + 真实登录）、部署 Cloudflare —— 均已完成并线上验证
- [ ] 招新报名表单链接：`src/pages/join.tsx` 的 `RECRUIT_FORM_URL` 每季更新，留空则只显示邮箱报名
- [ ] 替换演示内容：`src/data/seed.ts` 里的示例成员/项目只在本地模式用，真库里没有，但代码里还留着
- [ ] 绑自有域名，换掉 workers.dev 地址里的个人用户名
- [x] 小艾的人设/资料已存 `site_settings` 表，改完全站生效
- [ ] 线上改 AI 密钥的入口是关着的（见 `/admin/assistant` 页面上的说明）——
      要打开需要先有服务端能验证的管理员身份，即 Supabase Auth
- [x] 已加 RLS trigger 锁死非管理员改 `status`（`guard_review_status()`，三张投稿表都挂了）
- [x] 已清理：六个旧静态页、`next.tgz`、手动解压的 `package/`、
      `public/locales/*.json`（i18n 走内联资源，从来没被读过）、
      `data/{news,projects,forum,resources,leaders}.ts`、`components/{NewsSection,ProjectSection}.tsx`、
      `pages/{activities,leadership,test}.tsx`，以及 12 组没有引用方的 i18n 词条
