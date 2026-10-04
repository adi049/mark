-- MARKIPIE blog repair migration 0010
-- Ensures the live database has the blog table, indexes and admin/public
-- policies required by the Admin > Blogs panel and public /blogs page.

create extension if not exists pgcrypto;

create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  cover_image text,
  category text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blogs_published
  on public.blogs (published, published_at desc);

drop trigger if exists set_blogs_updated_at on public.blogs;
create trigger set_blogs_updated_at
  before update on public.blogs
  for each row execute procedure public.set_updated_at();

alter table public.blogs enable row level security;

drop policy if exists "public reads published blogs" on public.blogs;
create policy "public reads published blogs"
  on public.blogs for select
  to anon, authenticated
  using (published = true);

drop policy if exists "admin manages blogs" on public.blogs;
create policy "admin manages blogs"
  on public.blogs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.blogs to anon, authenticated;
grant insert, update, delete on public.blogs to authenticated;
