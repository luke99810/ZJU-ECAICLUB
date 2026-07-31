-- ⚠️ 历史增量：只用于**已经建好**的库。
--    建新库请直接执行 ../schema.sql，它已经包含这里的全部内容。

-- 增量迁移 005：站点设置表
--
-- 让「AI 客服配置」页改的人设与资料文档对**所有访客**生效。
-- 在此之前它只存在管理员自己的浏览器里 —— 管理员看到自己改的版本、
-- 访客看到代码里的默认值，改了没生效还很难发现。

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select using (true);

drop policy if exists site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());
