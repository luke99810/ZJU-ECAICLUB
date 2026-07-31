-- 管理员登不上时的诊断与重设。在 Supabase 控制台 SQL Editor 里执行。
--
-- ⚠️ **用完把口令改回占位符**。这个文件会跟着项目走（交接、打包、以后接了 git），
--    真口令留在里面等于写在明处 —— 执行是在控制台粘贴的，本地留底没有意义。
--
-- 背景：口令由 Supabase Auth 以 bcrypt 保管，**不可逆**，谁也读不出原文。
-- 所以「找回」是不存在的，只能重设。
--
-- 另外提醒一句：`AICLUB.2026` 是**本地演示实现**里写死的出厂口令
-- （src/lib/password.ts），从来没有同步到 Supabase。接了真登录之后，
-- 口令只有一个来源：你在控制台建账号时输入的那个。

-- ── 第一步：先看账号到底什么状态 ─────────────────────────────────────────
-- 重点看三列：
--   email               是不是你以为的那个邮箱（登录现在只认邮箱，不认学号）
--   email_confirmed_at  为 null 说明**没确认**，这种账号登录会被拒
--   last_sign_in_at     从来没成功登录过就是 null
select
  id,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at
from auth.users
order by created_at;

-- 顺便确认 members 表里有没有对应的成员记录（没有的话登录成功也进不了后台）
select m.id, m.email, m.name, m.department, m.role
from public.members m;

-- ── 第二步之一：邮箱没确认的话，先确认掉 ─────────────────────────────────
-- 建用户时没勾 "Auto Confirm User" 就会是这种情况。
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where id = '粘贴-auth-用户的-UUID';

-- ── 第二步之二：重设口令 ─────────────────────────────────────────────────
-- 把 '换成你要的口令' 改掉再执行。至少 8 位（前端有校验，这里没有）。
-- 用的是 pgcrypto 的 bcrypt，与 Supabase Auth 自己的算法一致。
update auth.users
set
  encrypted_password = crypt('换成你要的口令', gen_salt('bf')),
  updated_at = now()
where id = '粘贴-auth-用户的-UUID';

-- ── 第三步：确认改成功了 ─────────────────────────────────────────────────
-- 应当返回 t（口令匹配）。把 '换成你要的口令' 换成上面填的同一个。
select
  email,
  (encrypted_password = crypt('换成你要的口令', encrypted_password)) as 口令是否匹配,
  email_confirmed_at is not null as 邮箱已确认
from auth.users
where id = '粘贴-auth-用户的-UUID';
