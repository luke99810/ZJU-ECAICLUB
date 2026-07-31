-- ⚠️ 历史增量：只用于**已经建好**的库。
--    建新库请直接执行 ../schema.sql，它已经包含这里的全部内容。

-- 增量迁移 004：把「据名册建档」从触发器改成可调用的函数（并保留触发器）
--
-- ── 为什么改 ──────────────────────────────────────────────────────────────
--
-- 001 用的是 `auth.users` 上的 after-insert 触发器。这条路有两个弱点：
--
--   1. **在 auth schema 上建触发器需要足够权限**，有的项目建不上，而且失败时
--      很难察觉 —— 注册照样成功，只是没建档，表现为「设了口令却进不去后台」。
--   2. **时序写死了**：只有「先有邀请、后注册」才生效。人先注册、管理员后加名册，
--      就永远补不上，只能手工进库补一行。
--
-- 改成一个**登录后自己调**的函数：谁调就给谁建档，与注册时刻无关。
-- 触发器保留不动 —— 两条路都通，先到先得（函数里有 on conflict 兜底）。
--
-- 这个函数只认**当前登录用户自己的**身份（auth.uid() / auth.email()），
-- 不接受传入的邮箱，所以拿不到「替别人建档」的能力。

create or replace function public.claim_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  mail  text := auth.email();
  inv   public.member_invites%rowtype;
begin
  if uid is null then
    return 'not_authenticated';
  end if;

  -- 已经有成员记录了，什么都不用做
  if exists (select 1 from public.members where id = uid) then
    return 'already_member';
  end if;

  select * into inv from public.member_invites where lower(email) = lower(mail);
  if not found then
    return 'not_invited';
  end if;

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

-- ── 顺带把 can_activate 也升到三态（等同 003，重复执行无害）────────────────
-- 返回类型从 boolean 改成 text，`create or replace` 做不到（会报 42P13），
-- 必须先 drop。加 if exists 是为了在全新库上也能直接跑。
drop function if exists public.can_activate(text);

create or replace function public.can_activate(p_email text)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.members where lower(email) = lower(p_email)) then 'exists'
    when exists (select 1 from public.member_invites where lower(email) = lower(p_email)) then 'ok'
    else 'not_invited'
  end;
$$;

grant execute on function public.can_activate(text) to anon, authenticated;
