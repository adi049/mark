-- ============================================================================
-- MARKIPIE · 0002 · Google Drive integration, event media and client gallery
--
-- Adds:
--   * Drive folder link and sync stamp on events
--   * Folder nesting (parent_id) plus availability status on event_folders
--   * Mime type, availability and size on media
--   * drive_connections: private token storage, service role only
--   * drive_jobs: import/sync job progress, service role only
--   * Public gallery RPCs (security definer, code gated):
--       get_event_folders, get_event_media, set_reaction, clear_reaction
--   * Admin gallery RPCs (admin gated): admin_media_overview,
--       admin_event_media_stats
--
-- Security notes:
--   * drive_connections and drive_jobs have NO policies for anon or
--     authenticated users. Only the service role (the Drive edge function)
--     can read or write them, so refresh tokens never reach any browser.
--   * The public RPCs are the only anonymous door into folders, media and
--     reactions, and each validates the event access code or QR token first.
--   * The media bytes themselves are streamed by the Drive edge function
--     after validating the same code, so no Drive URLs or ids are exposed.
-- ============================================================================

-- ---------------------------------------------------------------- events ---
alter table public.events
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_name text,
  add column if not exists drive_folder_url text,
  add column if not exists drive_synced_at timestamptz;

-- --------------------------------------------------------- event_folders ---
alter table public.event_folders
  add column if not exists parent_id uuid references public.event_folders (id) on delete cascade,
  add column if not exists status text not null default 'available'
    check (status in ('available', 'unavailable'));

create index if not exists idx_event_folders_parent on public.event_folders (parent_id);
create index if not exists idx_event_folders_external on public.event_folders (external_folder_id);
create unique index if not exists uq_event_folders_external
  on public.event_folders (event_id, external_folder_id);

-- ----------------------------------------------------------------- media ---
alter table public.media
  add column if not exists mime_type text,
  add column if not exists status text not null default 'available'
    check (status in ('available', 'unavailable')),
  add column if not exists file_size bigint;

create index if not exists idx_media_external on public.media (external_file_id);
-- One row per Drive file per event: importing twice cannot duplicate media.
create unique index if not exists uq_media_external
  on public.media (event_id, external_file_id);

-- ------------------------------------------------------- drive_connections ---
-- Stores the studio Google account refresh token. Service role only.
create table if not exists public.drive_connections (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drive_connections enable row level security;
revoke all on public.drive_connections from anon, authenticated;

-- ------------------------------------------------------------- drive_jobs ---
-- Import and sync progress. Service role writes, the edge function reads it
-- back to the admin who started the job after verifying their session.
create table if not exists public.drive_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('import', 'sync')),
  event_id uuid references public.events (id) on delete cascade,
  phase text not null default 'connecting',
  message text,
  done boolean not null default false,
  error text,
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drive_jobs enable row level security;
revoke all on public.drive_jobs from anon, authenticated;

-- ============================================================================
-- Public gallery RPCs (security definer, gated by event code or QR token)
-- ============================================================================

-- Top level folders of an active event with subtree photo/video counts.
create or replace function public.get_event_folders(p_code text)
returns table (
  id uuid,
  name text,
  folder_type text,
  sort_order integer,
  photos bigint,
  videos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive ev as (
    select e.id from public.events e
    where e.status = 'active'
      and (upper(e.access_code) = upper(nullif(p_code, '')) or e.qr_token = nullif(p_code, ''))
    limit 1
  ),
  top as (
    select f.id, f.name, f.folder_type, f.sort_order
    from public.event_folders f
    where f.event_id = (select id from ev)
      and f.parent_id is null
      and f.status = 'available'
  ),
  tree as (
    select t.id as root_id, f.id as folder_id
    from top t
    join public.event_folders f on f.id = t.id
    union all
    select tr.root_id, f.id
    from tree tr
    join public.event_folders f on f.parent_id = tr.folder_id
  )
  select
    t.id, t.name, t.folder_type, t.sort_order,
    (select count(*) from tree tr
      join public.media m on m.folder_id = tr.folder_id
      where tr.root_id = t.id and m.file_type = 'image' and m.status = 'available'),
    (select count(*) from tree tr
      join public.media m on m.folder_id = tr.folder_id
      where tr.root_id = t.id and m.file_type = 'video' and m.status = 'available')
  from top t
  order by t.sort_order nulls last, t.name;
$$;

-- Subfolders of one folder (dynamic structure: Photos/Videos or anything).
create or replace function public.get_event_subfolders(p_code text, p_folder_id uuid)
returns table (id uuid, name text, folder_type text, sort_order integer)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select e.id from public.events e
    where e.status = 'active'
      and (upper(e.access_code) = upper(nullif(p_code, '')) or e.qr_token = nullif(p_code, ''))
    limit 1
  )
  select f.id, f.name, f.folder_type, f.sort_order
  from public.event_folders f
  where f.parent_id = p_folder_id
    and f.event_id = (select id from ev)
    and f.status = 'available'
  order by f.sort_order nulls last, f.name;
$$;

-- One page of media for a folder, plus the caller's own reaction per item.
create or replace function public.get_event_media(
  p_code text,
  p_folder_id uuid,
  p_limit integer,
  p_offset integer,
  p_session_id text default null
)
returns table (
  id uuid,
  file_name text,
  file_type text,
  sort_order integer,
  my_reaction text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select e.id from public.events e
    where e.status = 'active'
      and (upper(e.access_code) = upper(nullif(p_code, '')) or e.qr_token = nullif(p_code, ''))
    limit 1
  ),
  scoped as (
    select m.id, m.file_name, m.file_type, m.sort_order, m.created_at
    from public.media m
    where m.folder_id = p_folder_id
      and m.event_id = (select id from ev)
      and m.status = 'available'
  ),
  page as (
    select * from scoped
    order by sort_order nulls last, created_at
    limit greatest(coalesce(p_limit, 24), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    page.id, page.file_name, page.file_type, page.sort_order,
    (select r.reaction from public.reactions r
      where r.media_id = page.id and r.session_id = p_session_id),
    (select count(*) from scoped)
  from page
  order by page.sort_order nulls last, page.file_name;
$$;

-- Set or replace this session's reaction on one media item. The event code
-- gates the call; only the event's own media can be reacted to, and only
-- when the event has reactions enabled.
create or replace function public.set_reaction(
  p_code text,
  p_media_id uuid,
  p_session_id text,
  p_reaction text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_media public.media;
begin
  if p_reaction is not null and p_reaction not in ('like', 'dislike') then
    raise exception 'invalid reaction';
  end if;
  if coalesce(length(p_session_id), 0) < 8 then
    raise exception 'invalid session';
  end if;

  select * into v_event from public.events e
  where e.status = 'active'
    and (upper(e.access_code) = upper(nullif(p_code, '')) or e.qr_token = nullif(p_code, ''));
  if not found then
    return 'invalid';
  end if;
  if not v_event.reaction_enabled then
    return 'disabled';
  end if;

  select * into v_media from public.media m
  where m.id = p_media_id and m.event_id = v_event.id;
  if not found then
    return 'invalid';
  end if;

  if p_reaction is null then
    delete from public.reactions
    where media_id = p_media_id and session_id = p_session_id;
  else
    insert into public.reactions (media_id, event_id, session_id, reaction)
    values (p_media_id, v_event.id, p_session_id, p_reaction)
    on conflict (media_id, session_id)
    do update set reaction = excluded.reaction, updated_at = now();
  end if;

  return coalesce(p_reaction, 'none');
end;
$$;

-- ============================================================================
-- Admin gallery RPCs (admin gated)
-- ============================================================================

-- Every event with its folder, photo and video totals, for the admin picker.
create or replace function public.admin_media_overview()
returns table (
  event_id uuid,
  event_name text,
  client_name text,
  status text,
  drive_folder_name text,
  drive_synced_at timestamptz,
  folders bigint,
  photos bigint,
  videos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.name, c.name, e.status, e.drive_folder_name, e.drive_synced_at,
    (select count(*) from public.event_folders f where f.event_id = e.id),
    (select count(*) from public.media m where m.event_id = e.id and m.file_type = 'image' and m.status = 'available'),
    (select count(*) from public.media m where m.event_id = e.id and m.file_type = 'video' and m.status = 'available')
  from public.events e
  join public.clients c on c.id = e.client_id
  where public.is_admin()
  order by e.created_at desc;
$$;

-- Folder level stats for one event, including unavailable counts.
create or replace function public.admin_event_media_stats(p_event_id uuid)
returns table (
  id uuid,
  name text,
  parent_id uuid,
  folder_type text,
  sort_order integer,
  status text,
  photos bigint,
  videos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select f.id, f.name, f.parent_id, f.folder_type, f.sort_order, f.status, f.id as root_id
    from public.event_folders f
    where f.event_id = p_event_id and f.parent_id is null
    union all
    select f.id, f.name, f.parent_id, f.folder_type, f.sort_order, f.status, tr.root_id
    from public.event_folders f
    join tree tr on f.parent_id = tr.id
  ),
  top as (
    select * from tree where parent_id is null
  )
  select
    t.id, t.name, t.parent_id, t.folder_type, t.sort_order, t.status,
    (select count(*) from tree tr
      join public.media m on m.folder_id = tr.id
      where tr.root_id = t.id and m.file_type = 'image' and m.status = 'available'),
    (select count(*) from tree tr
      join public.media m on m.folder_id = tr.id
      where tr.root_id = t.id and m.file_type = 'video' and m.status = 'available')
  from tree t
  where public.is_admin()
  order by t.parent_id nulls first, t.sort_order nulls last, t.name;
$$;
