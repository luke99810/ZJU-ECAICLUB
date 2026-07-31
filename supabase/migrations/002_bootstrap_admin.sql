-- ⚠️ 历史增量：只用于**已经建好**的库。
--    建新库请直接执行 ../schema.sql，它已经包含这里的全部内容。

-- 增量迁移 002：建第一个管理员
--
-- 只需要执行一次。之后加人走后台的「成员管理」——
-- 管理员把人写进名册，本人自助激活，触发器自动建档（见 001）。
--
-- ── 为什么第一个管理员要手动建 ────────────────────────────────────────────
--
-- 001 那个触发器是「注册时按名册自动建档」，而名册（member_invites）
-- 只有管理员能写。第一个管理员之前没有任何管理员，是个先有鸡还是先有蛋的问题，
-- 只能从 SQL Editor 破一次局。
--
-- ── 用法 ──────────────────────────────────────────────────────────────────
--
-- 1. 先在 Authentication → Users → Add User 用社团邮箱建账号（勾 Auto Confirm User）
-- 2. 复制那个用户的 UUID，替换下面的 :admin_id
-- 3. 整段执行
--
-- 邮箱不用自己填 —— 直接从 auth.users 里取，避免手抄抄错导致改口令时验不过。

insert into public.members
  (id, student_id, email, name, department, role, tags, interests, bio, joined_at, password_set)
select
  u.id,
  '22564006',                    -- 学号，按实际改
  u.email,                       -- 从 auth.users 取，不手填
  '社团管理员',                   -- 姓名，登录后可在「我的账号」改
  '管理层',                       -- 管理层 = 管理员
  'admin',
  '{}',
  null,
  '社团账号与内容的第一责任人。',
  current_date,
  true                           -- 口令是本人在控制台设的，不再提示「请修改初始口令」
from auth.users u
where u.id = '粘贴-auth-用户的-UUID'
on conflict (id) do nothing;

-- 顺手清掉验证 RLS 时插入的两条测试数据
delete from public.ai_projects where title = '匿名投稿测试';
delete from public.messages     where email = 't@example.com';

-- 确认结果：应当返回 1 行，role = admin
select id, email, name, department, role from public.members;
