-- 激活没成功时的诊断。在 SQL Editor 里**逐段**执行，把输出发回来。
--
-- 现象：自助设置口令提示成功，但成员管理里没出现这个人，登录也进不去。
-- 说明 auth 账号建出来了，但 `handle_new_user` 触发器没有据名册建 members 行。
-- 下面按「触发器在不在 → 名册对不对 → 账号什么状态」的顺序查。

-- ── 1. 触发器到底建出来没有 ──────────────────────────────────────────────
-- 期望：返回 1 行 on_auth_user_created。
-- 返回 0 行 = 001 里那句 create trigger 没生效（在 auth.users 上建触发器
-- 需要足够权限，某些项目会被拦），后面全都免谈。
select tgname, tgenabled, pg_get_triggerdef(oid) as 定义
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- ── 2. 函数在不在 ────────────────────────────────────────────────────────
select proname, prosecdef as 是security_definer
from pg_proc
where proname in ('handle_new_user', 'can_activate');

-- ── 3. 名册里现在有谁 ────────────────────────────────────────────────────
-- 期望：能看到你刚加的那个人。
-- 如果是空的，说明「添加成员」根本没写进去（那是另一个问题）。
select email, student_id, name, department, created_at from public.member_invites;

-- ── 4. auth 账号什么状态 ─────────────────────────────────────────────────
-- 重点看 email_confirmed_at：null = 没确认，登录会被拒。
select id, email, email_confirmed_at, created_at from auth.users order by created_at;

-- ── 5. members 里有谁 ────────────────────────────────────────────────────
select id, email, name, department, role from public.members;

-- ── 6. 邮箱大小写 / 空格是否对得上 ───────────────────────────────────────
-- 触发器是按 lower(email) 匹配的，理论上不该错，但值得确认一眼。
select
  u.email                      as auth邮箱,
  i.email                      as 名册邮箱,
  lower(u.email) = lower(i.email) as 匹配
from auth.users u
full outer join public.member_invites i on lower(u.email) = lower(i.email);
