-- ⚠️ 历史增量：只用于**已经建好**的库。
--    建新库请直接执行 ../schema.sql，它已经包含这里的全部内容。

-- 增量迁移 001：成员邀请表 + 注册时自动建档
--
-- 在 schema.sql 已经执行成功之后再跑这一段。它是**纯新增**，不动已有的表与数据。
--
-- ── 为什么需要它 ──────────────────────────────────────────────────────────
--
-- `members.id` 是 `auth.users.id` 的外键 —— 这样 RLS 里的 `auth.uid()` 才能对上人。
-- 但由此带来一个死结：**管理员在后台加成员时，那个人还没有 auth 账号**，
-- 于是没有 id 可填，插不进去。
--
-- 创建 auth 账号需要 Admin API，而 Admin API 要 service_role key ——
-- 那个 key 一旦进前端就等于把整个数据库交出去，绝不能这么做。
--
-- 解法是把「名册」和「账号」拆开：
--
--   1. 管理员在后台加人 → 写进 `member_invites`（只是一条待激活的名册记录）；
--   2. 本人用这个邮箱在登录页自助设置口令 → Supabase 建 auth 账号；
--   3. 下面的触发器发现邮箱在名册里 → 自动建 `members` 行（id 对上 auth 用户），
--      并删掉邀请记录。
--
-- 好处：名册可以先建好（CSV 批量导入照常用），账号由本人激活，
-- 全程不需要 service_role key。邮箱不在名册里的人即使注册了 auth 账号，
-- 也没有 members 行，进不了后台。

-- ── 邀请表 ────────────────────────────────────────────────────────────────
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

-- 只有管理员能看和管名册。**匿名一律读不到** ——
-- 否则这张表就成了「社团有哪些人、邮箱是什么」的公开名录。
drop policy if exists member_invites_admin on public.member_invites;
create policy member_invites_admin on public.member_invites
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 注册时自动建档 ────────────────────────────────────────────────────────
-- security definer：要能写 members、读 member_invites，绕过两张表的 RLS。
-- 注意它**不做任何权限判断之外的事**：邮箱不在名册里就什么都不做，
-- 于是那个人有账号但没有成员身份，后台照样进不去。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.member_invites%rowtype;
begin
  select * into inv from public.member_invites where lower(email) = lower(new.email);
  if not found then
    return new;
  end if;

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

-- ── 判断邮箱能不能自助激活 ────────────────────────────────────────────────
-- 登录页要在**注册之前**告诉对方「你的邮箱不在名册里，请先联系管理员」，
-- 否则他注册成功却进不去后台，只会一头雾水。
--
-- 这个函数只回答是/否，不返回任何名册内容，所以可以放给匿名调用 ——
-- 拿它当「某邮箱是否是社团成员」的探测器，代价是知道一个已知邮箱的成员身份，
-- 比公开整张名册轻得多，是可以接受的取舍。
drop function if exists public.can_activate(text);

create or replace function public.can_activate(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.member_invites where lower(email) = lower(p_email));
$$;

grant execute on function public.can_activate(text) to anon, authenticated;
