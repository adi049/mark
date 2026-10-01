-- ============================================================================
-- MARKIPIE · Database schema (Phase 5)
--
-- Run this file in the Supabase SQL editor (or via the Supabase CLI:
-- supabase db push). It creates every table, index, trigger, helper
-- function and row level security policy the Markipie platform needs.
--
-- Security model:
--   * Every table has row level security enabled.
--   * Admin users (rows in public.admins linked to auth.users) get full
--     CRUD on studio tables through the is_admin() helper.
--   * Anonymous visitors can only read published blogs and active
--     services and marketing services.
--   * Anonymous visitors can never read the clients, events, folders,
--     media or reactions tables directly. Public event access goes
--     through lookup_event_by_code(), a security definer function that
--     returns only the minimum fields of an active event matching an
--     access code or QR token.
--   * The service role key is never used in the frontend; the anon key
--     plus these policies are the only frontend credentials.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- Tables
-- ============================================================================

-- Admin users. Populated automatically when a user is created in
-- Supabase Authentication (see handle_new_admin trigger below).
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

-- Clients of the studio.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  client_code text not null unique,
  event_name text,
  event_type text,
  event_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Events. A client can have several (engagement, haldi, mehendi, wedding,
-- reception). access_code is what the client types in Client Access;
-- qr_token is the secret inside the QR link. The four permission flags
-- will drive the client gallery in later phases.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  event_type text,
  event_date date,
  access_code text not null unique,
  qr_token text unique,
  watermark_enabled boolean not null default true,
  download_enabled boolean not null default true,
  face_scan_enabled boolean not null default false,
  reaction_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Google Drive folder metadata (structure only; Drive integration is a
-- later phase).
create table if not exists public.event_folders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  folder_type text,
  external_folder_id text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Media metadata. external_* fields will point at Google Drive objects;
-- no media is stored in Supabase itself.
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  folder_id uuid references public.event_folders (id) on delete set null,
  file_name text,
  file_type text,
  external_file_id text,
  external_url text,
  thumbnail_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Client reactions on gallery media. One reaction per media per session.
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  session_id text not null,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_id, session_id)
);

-- Blog posts for the public journal.
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

-- Studio services, managed from the admin panel.
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  image text,
  price text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Marketing services (social media management, video editing, graphic
-- design), managed from the admin panel.
create table if not exists public.marketing_services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starting_price text,
  content text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists idx_events_client_id on public.events (client_id);
create index if not exists idx_events_status on public.events (status);
create index if not exists idx_event_folders_event_id on public.event_folders (event_id);
create index if not exists idx_media_event_id on public.media (event_id);
create index if not exists idx_media_folder_id on public.media (folder_id);
create index if not exists idx_reactions_media_id on public.reactions (media_id);
create index if not exists idx_blogs_published on public.blogs (published, published_at desc);
create index if not exists idx_services_active on public.services (active, sort_order);
create index if not exists idx_marketing_active on public.marketing_services (active, sort_order);
create index if not exists idx_clients_status on public.clients (status);

-- ============================================================================
-- Helper functions
-- ============================================================================

-- Keeps updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True when the current authenticated user is a Markipie admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

-- Adds every new Supabase auth user to public.admins. Create admin users
-- from the Supabase dashboard (Authentication > Users > Add user); do not
-- allow public signups.
create or replace function public.handle_new_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admins (user_id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_admin();

-- Public event lookup by access code or QR token. Returns only the
-- minimum fields a visitor needs, and only for active events. This is the
-- only door into the events data for anonymous visitors.
create or replace function public.lookup_event_by_code(p_code text)
returns table (
  id uuid,
  name text,
  event_type text,
  event_date date,
  client_name text,
  watermark_enabled boolean,
  download_enabled boolean,
  face_scan_enabled boolean,
  reaction_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.name, e.event_type, e.event_date, c.name,
    e.watermark_enabled, e.download_enabled, e.face_scan_enabled, e.reaction_enabled
  from public.events e
  join public.clients c on c.id = e.client_id
  where e.status = 'active'
    and (upper(e.access_code) = upper(nullif(p_code, '')) or e.qr_token = nullif(p_code, ''))
  limit 1;
$$;

-- updated_at triggers
drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at before update on public.clients
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at before update on public.events
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_reactions_updated_at on public.reactions;
create trigger set_reactions_updated_at before update on public.reactions
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_blogs_updated_at on public.blogs;
create trigger set_blogs_updated_at before update on public.blogs
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at before update on public.services
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_mark_services_updated_at on public.marketing_services;
create trigger set_mark_services_updated_at before update on public.marketing_services
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- Row level security
-- ============================================================================

alter table public.admins enable row level security;
alter table public.clients enable row level security;
alter table public.events enable row level security;
alter table public.event_folders enable row level security;
alter table public.media enable row level security;
alter table public.reactions enable row level security;
alter table public.blogs enable row level security;
alter table public.services enable row level security;
alter table public.marketing_services enable row level security;

-- admins: an authenticated user can read their own row; admins can read
-- all rows. Writes happen only through the handle_new_admin trigger.
drop policy if exists "read own or any admin row" on public.admins;
create policy "read own or any admin row"
  on public.admins for select
  to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- Studio tables: full access for admins only. No anonymous policies exist,
-- so anonymous requests are denied by default.
drop policy if exists "admin manages clients" on public.clients;
create policy "admin manages clients"
  on public.clients for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manages events" on public.events;
create policy "admin manages events"
  on public.events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manages event folders" on public.event_folders;
create policy "admin manages event folders"
  on public.event_folders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manages media" on public.media;
create policy "admin manages media"
  on public.media for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manages reactions" on public.reactions;
create policy "admin manages reactions"
  on public.reactions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Public content: anyone can read published blogs and active services and
-- marketing services. Only admins can write them.
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

drop policy if exists "public reads active services" on public.services;
create policy "public reads active services"
  on public.services for select
  to anon, authenticated
  using (active = true);

drop policy if exists "admin manages services" on public.services;
create policy "admin manages services"
  on public.services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "public reads active marketing" on public.marketing_services;
create policy "public reads active marketing"
  on public.marketing_services for select
  to anon, authenticated
  using (active = true);

drop policy if exists "admin manages marketing" on public.marketing_services;
create policy "admin manages marketing"
  on public.marketing_services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- Notes for later phases (intentionally not enabled yet)
--
--   * Anonymous reaction inserts: add a policy on public.reactions
--     (for insert to anon with check (reaction in ('like','dislike')))
--     when the client gallery ships.
--   * lookup_event_by_code already enforces "active events only"; extend
--     it to return media folders when the Drive integration lands.
--   * Media and event_folders have no anon policies on purpose: gallery
--     delivery will go through dedicated security definer functions.
-- ============================================================================
