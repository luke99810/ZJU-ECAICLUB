-- AI Club 官网数据库。在 Supabase 控制台 SQL Editor 里整段执行即可。
--
-- **这个文件是唯一来源** —— 建一个全新的库只需要执行它（可选再执行 seed.sql）。
-- `migrations/` 里那几个是给**已经建好的库**做增量用的历史记录，新库不必跑。
--
-- ⚠️ 表用的是 `create table if not exists`：**改了列定义之后重新执行不会生效**，
--    因为表已经存在。建库阶段要改结构，先执行下面这段清空（会删掉所有数据，
--    只在还没有真实内容时用）：
--
--    drop trigger  if exists on_auth_user_created on auth.users;
--    drop view     if exists public.public_members;
--    drop table    if exists public.forum_comments, public.forum_posts, public.resources,
--                            public.ai_projects, public.posts, public.tool_links,
--                            public.messages, public.member_invites, public.site_settings,
--                            public.members cascade;
--    drop function if exists public.guard_review_status() cascade;
--    drop function if exists public.handle_new_user() cascade;
--    drop function if exists public.claim_invite() cascade;
--    drop function if exists public.can_activate(text) cascade;
--    drop function if exists public.is_admin() cascade;
--    drop function if exists public.is_member() cascade;
--
-- 表与前端 `src/types/index.ts` 一一对应，顺序也一致：
--   1 members       社团成员（管理层 = 管理员）
--   2 ai_projects   项目共享
--   3 posts         社团新闻（新闻 / 活动 / 赛事成果 / 公告合并后的单表）
--   4 resources     学习资料
--   5 forum_posts   AI 论坛帖子
--   6 forum_comments论坛评论（**不审核**，未登录访客也能发）
--   7 tool_links    AI 工具导航（社团自己维护的外部工具索引）
--   8 messages      官网「联系我们」的留言（后台待办队列，不对外展示）
--   9 member_invites 成员名册（账号未激活的那一半）+ 建档函数
--  10 site_settings  站点设置（目前只有 AI 客服「小艾」的人设与资料）
--
-- 权限模型（方案要求「普通成员只能改自己项目，管理员全局管理」）用 RLS 实现：
-- 前端的路由拦截只是体验层，真正拦得住的是这里的策略。
--
-- 三类投稿内容（项目 / 资料 / 帖子）共享同一套字段与规则：
--   origin  member=社团成员 / alumni=校友投稿 / external=校外投稿，按投稿邮箱后缀判定
--   status  pending → approved / rejected，只有 approved 对外可见
-- 审核权限：管理员审全部；普通成员只审 alumni + external（成员自己的必须管理层审，
-- 从根上堵死「自己提交自己通过」）。

-- ── 表 1：members ──────────────────────────────────────────────────────────
-- id 直接复用 auth.users.id，这样 RLS 里 auth.uid() 就能对上人。
-- 注意：本地演示版在浏览器里做口令校验（见 src/lib/password.ts），接上 Supabase
-- 之后口令交给 Supabase Auth，password_salt / password_hash 这两列不要迁过来。
create table if not exists public.members (
  id          uuid primary key references auth.users (id) on delete cascade,
  student_id  text not null unique,
  email       text not null unique,
  name        text not null,
  -- 管理层即管理员，最多 3 人；数量上限由应用层控制（见 lib/auth.ts MAX_ADMINS）
  department  text not null default '技术部'
                check (department in ('管理层', '技术部', '组织部', '宣传部')),
  avatar_url  text,
  role        text not null default 'member' check (role in ('member', 'admin')),
  -- 技术标签，固定词表，用来按技术筛人
  tags        text[] not null default '{}',
  -- 兴趣方向，自由文本（如「智慧交通」）。研究方向常落在固定标签之外，两者不能合并。
  interests   text,
  bio         text,
  -- 加入年份决定是不是「往届」（见 src/types 的 isAlumniMember），
  -- 所以**没有 is_alumni 列** —— 手工标记必然会忘记维护。
  joined_at   date not null default current_date,
  -- 是否已自行设过口令。false 表示还在用初始口令，登录后提示去改。
  -- 口令本身归 Supabase Auth 管，这里只留这一个标记。
  password_set boolean not null default false
);

-- 登录允许用学号或邮箱，两列都要能快速命中
create index if not exists members_student_id_idx on public.members (student_id);

-- ── 表 2：ai_projects ─────────────────────────────────────────────────────
create table if not exists public.ai_projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  summary     text not null,
  stack       text[] not null default '{}',
  -- 技术标签：LLM/Agent/RAG/MCP/Multimodal/NLP/CV/RL/Robot/Deployment
  tags        text[] not null default '{}',
  -- 功能标签：内容创作/图像视频生成/数据挖掘/智能对话/代码开发/科研辅助/…
  -- 面向研究生找「能拿来干什么」，和技术标签是两个维度，别合并
  functions   text[] not null default '{}',
  cover_url   text,
  github_url  text,
  blog_url    text,
  paper_url   text,
  origin      text not null default 'member'
                check (origin in ('member', 'alumni', 'external')),
  -- 公开投稿没有账号，所以可空；成员投稿时必填
  author_id   uuid references public.members (id) on delete set null,
  author_name text not null,
  submitter_org     text,
  -- 投稿人联系方式只给审核人看，前台任何页面都不要 select 这一列
  submitter_contact text,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 列表页按 status 过滤 + 按时间倒序，这个索引正对着那条查询
create index if not exists ai_projects_status_created_idx
  on public.ai_projects (status, created_at desc);
create index if not exists ai_projects_author_idx on public.ai_projects (author_id);

-- ── 表 3：posts ───────────────────────────────────────────────────────────
-- 「社团新闻」与「活动成果」原是两个页面，内容性质相同，合并成一张表用 kind 区分。
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('news', 'activity', 'award', 'notice')),
  title      text not null,
  body       text not null,
  cover_url  text,
  -- 外部链接，通常是公众号推文
  link_url   text,
  link_label text,
  date       date not null,
  award      text,
  -- 谁都能改，所以要留痕
  edited_by  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_date_idx on public.posts (date desc);

-- ── 表 4：resources ───────────────────────────────────────────────────────
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  summary     text not null,
  url         text not null,
  level       text not null check (level in ('入门', '进阶', '专项')),
  tags        text[] not null default '{}',
  origin      text not null default 'member'
                check (origin in ('member', 'alumni', 'external')),
  author_id   uuid references public.members (id) on delete set null,
  author_name text not null,
  submitter_org     text,
  submitter_contact text,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resources_status_created_idx
  on public.resources (status, created_at desc);

-- ── 表 5：forum_posts ─────────────────────────────────────────────────────
create table if not exists public.forum_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  category    text not null check (category in ('问答', '分享', '讨论')),
  origin      text not null default 'member'
                check (origin in ('member', 'alumni', 'external')),
  author_id   uuid references public.members (id) on delete set null,
  author_name text not null,
  submitter_contact text,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists forum_posts_status_created_idx
  on public.forum_posts (status, created_at desc);

-- ── 表 6：forum_comments ──────────────────────────────────────────────────
-- 刻意**没有** status 列：评论不审核，未登录访客也能发。
-- 这是「外部访问只能评论」的落点 —— 门槛低，但发帖仍要过审。
create table if not exists public.forum_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.forum_posts (id) on delete cascade,
  body        text not null,
  author_name text not null default '访客',
  -- 登录成员评论时带上，用于显示「成员」标记；访客为 null
  author_id   uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists forum_comments_post_idx on public.forum_comments (post_id, created_at);

-- ── 表 7：tool_links ──────────────────────────────────────────────────────
-- AI 工具导航。不接受外部投稿，所以没有 origin / status —— 社团成员在后台直接维护，
-- 存下即对外生效。
create table if not exists public.tool_links (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  note        text not null,
  url         text not null,
  category    text not null
                check (category in ('对话与写作', '代码', '绘画与设计', '论文与阅读', '音视频', '模型与部署')),
  access      text not null default 'free' check (access in ('free', 'trial', 'paid')),
  cn_friendly boolean not null default false,
  sort        integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 表 8：messages ────────────────────────────────────────────────────────
-- 官网「联系我们」的留言。**不是投稿**：它不对外展示，只是一个待办队列，
-- 所以状态是 new / handled / ignored，而不是 pending / approved。
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  body        text not null,
  status      text not null default 'new' check (status in ('new', 'handled', 'ignored')),
  -- 处理人姓名，留痕用 —— 任何成员都能处理，不记就说不清是谁点的
  handled_by  text,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists messages_status_created_idx
  on public.messages (status, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.members        enable row level security;
alter table public.ai_projects    enable row level security;
alter table public.posts          enable row level security;
alter table public.resources      enable row level security;
alter table public.forum_posts    enable row level security;
alter table public.forum_comments enable row level security;
alter table public.tool_links     enable row level security;
alter table public.messages       enable row level security;

-- 判断当前用户是不是管理员。标成 security definer 才能绕过 members 表自身的
-- RLS 去读 role，否则策略会自我递归。
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.id = auth.uid() and m.role = 'admin'
  );
$$;

-- 是不是在册成员（用来放行「成员可审核公开投稿」）。
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.members m where m.id = auth.uid());
$$;

-- members：**只有登录成员能读整张表**。
--
-- 这里刻意不是 `using (true)`：那样虽然对外页面正常，但任何人都能通过 REST 接口
-- 把全社团的邮箱、学号拉走 —— 界面上没显示不等于没给出去。
-- 对外的社团成员页改读下面那个只含公开字段的视图。
drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (public.is_member());

-- 对外公开的成员信息视图：**不含邮箱与学号**。
-- 社团成员页（/team）读这个，匿名访客也能看到姓名、部门、方向与简介。
--
-- `security_invoker = off` 是刻意的：视图以属主权限执行，从而绕过上面那条
-- 「只有成员可读」的 RLS，让匿名访客也能看到这几列。Supabase 的检查器会把它
-- 标成 SECURITY DEFINER 视图并给一个提示，这里是有意为之 —— 视图本身只暴露
-- 公开字段，邮箱和学号根本不在 select 列表里。
create or replace view public.public_members
with (security_invoker = off) as
  select id, name, department, avatar_url, tags, interests, bio, joined_at
  from public.members;

grant select on public.public_members to anon, authenticated;

drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists members_admin_write on public.members;
create policy members_admin_write on public.members
  for insert with check (public.is_admin());

-- ── 三类投稿内容的通用策略 ────────────────────────────────────────────────
-- 读：匿名只看 approved；作者能看自己的全部；成员/管理员看全部（要审核）。
-- 插：任何人都能投（含匿名），但只能落到 pending —— 这条最关键，
--     否则外部投稿可以直接带着 status='approved' 插进来，审核就形同虚设。
-- 改：管理员改全部；成员只能改 alumni / external 的（即审核公开投稿）；
--     作者能改自己的。
-- 删：只有管理员。

drop policy if exists ai_projects_read on public.ai_projects;
create policy ai_projects_read on public.ai_projects
  for select using (
    status = 'approved' or author_id = auth.uid() or public.is_member()
  );

drop policy if exists ai_projects_insert_pending on public.ai_projects;
create policy ai_projects_insert_pending on public.ai_projects
  for insert with check (status = 'pending');

drop policy if exists ai_projects_update on public.ai_projects;
create policy ai_projects_update on public.ai_projects
  for update using (
    public.is_admin()
    or author_id = auth.uid()
    or (public.is_member() and origin in ('alumni', 'external'))
  );

drop policy if exists ai_projects_delete_admin on public.ai_projects;
create policy ai_projects_delete_admin on public.ai_projects
  for delete using (public.is_admin());

drop policy if exists resources_read on public.resources;
create policy resources_read on public.resources
  for select using (
    status = 'approved' or author_id = auth.uid() or public.is_member()
  );

drop policy if exists resources_insert_pending on public.resources;
create policy resources_insert_pending on public.resources
  for insert with check (status = 'pending');

drop policy if exists resources_update on public.resources;
create policy resources_update on public.resources
  for update using (
    public.is_admin()
    or author_id = auth.uid()
    or (public.is_member() and origin in ('alumni', 'external'))
  );

drop policy if exists resources_delete_admin on public.resources;
create policy resources_delete_admin on public.resources
  for delete using (public.is_admin());

drop policy if exists forum_posts_read on public.forum_posts;
create policy forum_posts_read on public.forum_posts
  for select using (
    status = 'approved' or author_id = auth.uid() or public.is_member()
  );

drop policy if exists forum_posts_insert_pending on public.forum_posts;
create policy forum_posts_insert_pending on public.forum_posts
  for insert with check (status = 'pending');

drop policy if exists forum_posts_update on public.forum_posts;
create policy forum_posts_update on public.forum_posts
  for update using (
    public.is_admin()
    or author_id = auth.uid()
    or (public.is_member() and origin in ('alumni', 'external'))
  );

drop policy if exists forum_posts_delete_admin on public.forum_posts;
create policy forum_posts_delete_admin on public.forum_posts
  for delete using (public.is_admin());

-- forum_comments：所有人可读、**任何人可写**（不审核），只有管理员能删。
-- 唯一的限制是评论必须挂在已通过的帖子上，免得有人拿未公开的帖子 id 灌评论。
drop policy if exists forum_comments_read on public.forum_comments;
create policy forum_comments_read on public.forum_comments
  for select using (true);

drop policy if exists forum_comments_insert_anyone on public.forum_comments;
create policy forum_comments_insert_anyone on public.forum_comments
  for insert with check (
    exists (
      select 1 from public.forum_posts p
      where p.id = post_id and p.status = 'approved'
    )
  );

drop policy if exists forum_comments_delete_admin on public.forum_comments;
create policy forum_comments_delete_admin on public.forum_comments
  for delete using (public.is_admin());

-- posts：所有人可读；任何成员可增改（活动要及时发），仅管理员可删。
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (true);

drop policy if exists posts_member_write on public.posts;
create policy posts_member_write on public.posts
  for insert with check (public.is_member());

drop policy if exists posts_member_update on public.posts;
create policy posts_member_update on public.posts
  for update using (public.is_member());

drop policy if exists posts_delete_admin on public.posts;
create policy posts_delete_admin on public.posts
  for delete using (public.is_admin());

-- tool_links：所有人可读；成员可增改，仅管理员可删（和 posts 同一套逻辑）。
drop policy if exists tool_links_read on public.tool_links;
create policy tool_links_read on public.tool_links for select using (true);

drop policy if exists tool_links_member_write on public.tool_links;
create policy tool_links_member_write on public.tool_links
  for insert with check (public.is_member());

drop policy if exists tool_links_member_update on public.tool_links;
create policy tool_links_member_update on public.tool_links
  for update using (public.is_member());

drop policy if exists tool_links_delete_admin on public.tool_links;
create policy tool_links_delete_admin on public.tool_links
  for delete using (public.is_admin());

-- messages：**任何人可写**（官网表单不要求登录），但**只有成员能读** ——
-- 留言里有访客的邮箱和诉求，不该对外可见。删除限管理员。
-- 注意 insert 策略强制 status='new'：否则外部可以直接塞一条「已处理」进来把自己藏掉。
drop policy if exists messages_insert_anyone on public.messages;
create policy messages_insert_anyone on public.messages
  for insert with check (status = 'new');

drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages
  for select using (public.is_member());

drop policy if exists messages_update_member on public.messages;
create policy messages_update_member on public.messages
  for update using (public.is_member());

drop policy if exists messages_delete_admin on public.messages;
create policy messages_delete_admin on public.messages
  for delete using (public.is_admin());

-- ── 上线前务必补上：审核状态的写保护 ──────────────────────────────────────
-- 上面的 update 策略允许作者改自己的投稿，也就允许作者把 status 直接改成
-- approved —— 审核就白做了。用 trigger 卡住：非管理员、且不是「成员审公开投稿」
-- 的情形，一律不许动 status / review_note。
create or replace function public.guard_review_status()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if (new.status is distinct from old.status
      or new.review_note is distinct from old.review_note) then
    if not (
      public.is_admin()
      or (public.is_member() and old.origin in ('alumni', 'external'))
    ) then
      raise exception '只有管理员可以修改审核状态；成员仅可审核校友与校外投稿';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ai_projects_guard_status on public.ai_projects;
create trigger ai_projects_guard_status before update on public.ai_projects
  for each row execute function public.guard_review_status();

drop trigger if exists resources_guard_status on public.resources;
create trigger resources_guard_status before update on public.resources
  for each row execute function public.guard_review_status();

drop trigger if exists forum_posts_guard_status on public.forum_posts;
create trigger forum_posts_guard_status before update on public.forum_posts
  for each row execute function public.guard_review_status();


-- ══════════════════════════════════════════════════════════════════════════
-- 表 9：member_invites —— 成员名册（账号还没激活的那一半）
-- ══════════════════════════════════════════════════════════════════════════
--
-- `members.id` 是 `auth.users.id` 的外键 —— RLS 里的 `auth.uid()` 靠它认人。
-- 由此产生一个死结：**管理员加人时那个人还没有 auth 账号**，没有 id 可填。
-- 而建 auth 账号要 service_role key，绝不能进前端。
--
-- 所以把「名册」和「账号」拆开：管理员加人 → 写进 member_invites →
-- 本人用该邮箱自助设口令 → 建档（两条路，见下）。

create table if not exists public.member_invites (
  email       text primary key,
  student_id  text not null unique,
  name        text not null,
  department  text not null default '技术部'
                check (department in ('管理层', '技术部', '组织部', '宣传部')),
  role        text not null default 'member' check (role in ('member', 'admin')),
  tags        text[] not null default '{}',
  interests   text,
  bio         text,
  joined_at   date not null default current_date,
  created_at  timestamptz not null default now()
);

alter table public.member_invites enable row level security;

-- 只有管理员能看和管名册。匿名一律读不到 ——
-- 否则这张表就成了「社团有哪些人、邮箱是什么」的公开名录。
drop policy if exists member_invites_admin on public.member_invites;
create policy member_invites_admin on public.member_invites
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 建档路径一：注册时的触发器 ────────────────────────────────────────────
-- ⚠️ 在 auth schema 上建触发器需要足够权限，**不是每个项目都建得上**，
--    而且失败时毫无征兆（注册照样成功，只是没建档）。所以还有路径二兜底。
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.member_invites%rowtype;
begin
  select * into inv from public.member_invites where lower(email) = lower(new.email);
  if not found then return new; end if;
  insert into public.members
    (id, student_id, email, name, department, role, tags, interests, bio, joined_at, password_set)
  values
    (new.id, inv.student_id, inv.email, inv.name, inv.department, inv.role,
     inv.tags, inv.interests, inv.bio, inv.joined_at, true)
  on conflict (id) do nothing;
  delete from public.member_invites where email = inv.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 建档路径二：登录后自助认领（**实际生效的那条**）──────────────────────
-- 谁调就给谁建档，与注册时刻无关，也不需要 auth schema 的权限。
-- 前端在注册后、登录时、恢复会话时各补一刀，拿不到成员记录就先试着建档。
-- 只认当前登录用户自己（auth.uid() / auth.email()），替不了别人建档。
create or replace function public.claim_invite()
returns text language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  mail text := auth.email();
  inv  public.member_invites%rowtype;
begin
  if uid is null then return 'not_authenticated'; end if;
  if exists (select 1 from public.members where id = uid) then return 'already_member'; end if;
  select * into inv from public.member_invites where lower(email) = lower(mail);
  if not found then return 'not_invited'; end if;
  insert into public.members
    (id, student_id, email, name, department, role, tags, interests, bio, joined_at, password_set)
  values
    (uid, inv.student_id, mail, inv.name, inv.department, inv.role,
     inv.tags, inv.interests, inv.bio, inv.joined_at, true)
  on conflict (id) do nothing;
  delete from public.member_invites where email = inv.email;
  return 'created';
end $$;

grant execute on function public.claim_invite() to authenticated;

-- ── 登录页用：这个邮箱现在能不能自助激活 ──────────────────────────────────
--   ok / exists / not_invited 三态。只回答状态，不返回名册内容。
-- 必须先 drop：返回类型变过（早期版本是 boolean），`create or replace` 改不了返回类型。
drop function if exists public.can_activate(text);

create or replace function public.can_activate(p_email text)
returns text language sql security definer set search_path = public as $$
  select case
    when exists (select 1 from public.members where lower(email) = lower(p_email)) then 'exists'
    when exists (select 1 from public.member_invites where lower(email) = lower(p_email)) then 'ok'
    else 'not_invited'
  end;
$$;

grant execute on function public.can_activate(text) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 表 10：site_settings —— 站点设置
-- ══════════════════════════════════════════════════════════════════════════
--
-- 目前只放 AI 客服「小艾」的名字、欢迎语、角色设定、资料文档、推荐问题。
--
-- 为什么必须进数据库：这些配置是**给访客看的**。存在管理员自己的浏览器里，
-- 结果就是管理员看到自己改的版本、访客看到代码里的默认值 ——
-- 改了半天没生效，还很难发现。
--
-- 用 key/jsonb 而不是给每个字段开一列：设置项会随功能增加，
-- 每加一项就改表结构不划算；而且这张表天然只有个位数行，查询没有性能问题。
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- 所有人可读（访客要拿到小艾的人设），只有管理员能改。
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select using (true);

drop policy if exists site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());
