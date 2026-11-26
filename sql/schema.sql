-- ============================================================
-- schema.sql —— 夜神笔记 数据库建表脚本
-- ------------------------------------------------------------
-- 使用方法：
--   1. 登录 Supabase，进入你的项目
--   2. 左侧菜单选 "SQL Editor" → "New query"
--   3. 把本文件全部内容粘贴进去，点 "Run"
--   4. 看到 "Success. No rows returned" 就表示建表成功
--
-- 设计说明（学习点）：
--   - 数据库字段用 snake_case（如 category_id），前端 JS 用 camelCase
--     （如 categoryId），在 storage.js 里做转换。这是前后端协作的惯例。
--   - RLS（Row Level Security）行级安全：决定谁能读、谁能写。
--     这里规则是：所有人能看已发布的笔记，只有登录的作者能增删改。
-- ============================================================

-- ---------- 1. 分类表 ----------
create table if not exists categories (
  id    text primary key,          -- 分类标识，如 'frontend'
  name  text not null,             -- 显示名，如 '前端'
  icon  text,                      -- emoji 图标
  sort  int default 0              -- 排序，越小越靠前
);

-- ---------- 2. 笔记表 ----------
create table if not exists notes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category_id  text references categories(id) on delete set null,
  content      text,                          -- Markdown 原文
  excerpt      text,                          -- 摘要（列表卡片用）
  is_published boolean default true,          -- 是否公开（访客可见）
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ---------- 3. updated_at 自动更新触发器 ----------
-- 每次 update 笔记时，自动把 updated_at 刷新为当前时间
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notes_updated on notes;
create trigger trg_notes_updated
  before update on notes
  for each row execute function set_updated_at();

-- ---------- 4. 开启 RLS（行级安全） ----------
alter table categories enable row level security;
alter table notes      enable row level security;

-- 分类：所有人可读，登录后可写
drop policy if exists "categories readable by all" on categories;
create policy "categories readable by all" on categories
  for select using (true);

drop policy if exists "categories writable by auth" on categories;
create policy "categories writable by auth" on categories
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 笔记：所有人能看"已发布"的；登录后能看全部（含未发布）并能增删改
drop policy if exists "notes public read" on notes;
create policy "notes public read" on notes
  for select using (is_published = true or auth.role() = 'authenticated');

drop policy if exists "notes auth write" on notes;
create policy "notes auth write" on notes
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------- 5. 表级权限（GRANT）----------
-- 新版 Supabase 项目创建的表，默认不给 anon / authenticated 角色任何权限，
-- 只靠 RLS 策略是不够的：必须先 GRANT 访问权限，RLS 才会生效。
-- 否则表现为：查分类返回空、保存笔记失败（permission denied for table xxx）。
grant usage on schema public to anon, authenticated;

-- 访客（anon）：能读分类、能读笔记（具体读哪些行由 RLS 决定）
grant select on public.categories to anon, authenticated;
grant select on public.notes      to anon, authenticated;

-- 登录用户（authenticated）：能增删改
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.notes      to authenticated;

-- ---------- 6. 开启实时订阅（Realtime）----------
-- 这样列表页能在笔记变化时自动刷新，不用手动刷新页面
-- 用 DO 块包裹：重复执行时不报错（否则整段 SQL 会回滚）
do $$
begin
  alter publication supabase_realtime add table notes;
exception when duplicate_object then null;
end $$;

-- ---------- 7. 种子数据（分类） ----------
insert into categories (id, name, icon, sort) values
  ('frontend',     '前端',     '🎨', 1),
  ('backend',      '后端',     '⚙️', 2),
  ('database',     '数据库',   '🗄️', 3),
  ('framework',    '框架',     '🧩', 4),
  ('price-action', '价格行为', '📈', 5)
on conflict (id) do nothing;
