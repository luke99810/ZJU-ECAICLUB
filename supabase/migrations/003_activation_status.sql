-- ⚠️ 历史增量：只用于**已经建好**的库。
--    建新库请直接执行 ../schema.sql，它已经包含这里的全部内容。

-- 增量迁移 003：把 can_activate 从「能不能激活」改成「为什么不能」
--
-- 起因：在控制台手工建的管理员账号去点「首次设置口令」，会被告知
-- 「这个邮箱不在社团名册里，请先联系管理员把你加进成员管理」——
-- 但他本来就是管理员，这句提示把人绕进去了。
--
-- 根因是原来的函数只回 true/false，分不清三种情况：
--   ok          名册里有，可以激活
--   exists      已经开通过账号了，应该直接登录
--   not_invited 名册里没有，要先请管理员加人
--
-- 只回 true/false 时，后两种被压成同一句话，而它们的下一步动作完全相反。

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
    -- 先判「已经是成员」：这类人点错按钮的概率最高，要优先给出正确指引
    when exists (select 1 from public.members where lower(email) = lower(p_email)) then 'exists'
    when exists (select 1 from public.member_invites where lower(email) = lower(p_email)) then 'ok'
    else 'not_invited'
  end;
$$;

grant execute on function public.can_activate(text) to anon, authenticated;

-- 说明：这个函数仍然只回答状态、不返回任何名册内容。
-- 代价是能拿它探测「某个已知邮箱是不是社团成员」——
-- 比公开整张名册轻得多，换来的是一句说得清的错误提示，值得。
