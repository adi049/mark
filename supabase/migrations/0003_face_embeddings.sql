-- ============================================================================
-- MARKIPIE · migration 0003 · AI face scan (Phase 7)
--
-- Face embeddings for event-scoped face search.
--
--   * face_embeddings stores 128-dimension descriptors produced by the
--     browser face engine (TensorFlow.js face-api style nets) during admin
--     indexing. One row per detected face.
--   * face_index_state remembers which images the index has already
--     processed, including images with no detectable face, so incremental
--     reindexing only ever touches genuinely new photos.
--   * The table has RLS enabled with no anon/authenticated policies: only
--     the service role (the drive edge function and admin RPCs) can touch
--     it directly. Clients never read embeddings.
--   * search_event_faces is the only public entry point. It is a security
--     definer function gated by the event access code or QR token, active
--     status and the face_scan_enabled flag, and it returns media rows
--     only, never embeddings.
--
-- The embedding parameter of the search function is text (the JSON style
-- "[0.12,-0.44,...]" string) because PostgREST passes RPC arguments as
-- JSON and a text vector travels cleanly from supabase-js; it is cast to
-- vector(128) inside the function.
-- ============================================================================

create extension if not exists vector with schema extensions;

-- ------------------------------------------------------------------ table --
create table if not exists public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  face_index integer not null default 0,
  embedding vector(128) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.face_embeddings enable row level security;
revoke all on public.face_embeddings from anon, authenticated;

create index if not exists face_embeddings_event_idx on public.face_embeddings (event_id);
create index if not exists face_embeddings_media_idx on public.face_embeddings (media_id);
create index if not exists face_embeddings_created_idx on public.face_embeddings (created_at desc);

-- Approximate nearest neighbour index for Euclidean distance searches.
-- ivfflat needs a small number of rows before it is effective; on a fresh
-- table the index exists but the planner will prefer a seq scan until the
-- index has been trained (run `reindex ...` after bulk loads if needed).
create index if not exists face_embeddings_embedding_idx
  on public.face_embeddings using ivfflat (embedding vector_l2_ops) with (lists = 100);

-- One row per image the face index has already processed (a photo with no
-- detectable face is still "done": it simply has no embedding row).
create table if not exists public.face_index_state (
  media_id uuid primary key references public.media (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  indexed_at timestamptz not null default now()
);

alter table public.face_index_state enable row level security;
revoke all on public.face_index_state from anon, authenticated;

create index if not exists face_index_state_event_idx on public.face_index_state (event_id);

-- ----------------------------------------------------------------- search --
create or replace function public.search_event_faces(
  p_code text,
  p_embedding text,
  p_threshold float default 0.5,
  p_session_id text default null
)
returns table (
  id uuid,
  file_name text,
  file_type text,
  my_reaction text,
  distance float
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
begin
  if p_embedding is null or length(p_embedding) < 10 then
    raise exception 'A face scan is required before searching.';
  end if;

  select * into v_event
  from public.events e
  where (e.access_code = p_code or e.qr_token = p_code)
    and e.status = 'active'
  limit 1;

  if not found then
    raise exception 'Invalid or expired access code.';
  end if;

  if not v_event.face_scan_enabled then
    raise exception 'Face scan is not enabled for this event.';
  end if;

  -- Keep the threshold inside a sane band so a tampered client cannot
  -- widen it into a bulk embedding oracle.
  if p_threshold is null or p_threshold < 0.2 or p_threshold > 0.9 then
    p_threshold := 0.5;
  end if;

  return query
  select
    m.id,
    m.file_name,
    m.file_type,
    (select r.reaction from public.reactions r
      where r.media_id = m.id and r.session_id = p_session_id
      limit 1),
    d.dist::float
  from (
    select
      fe.media_id,
      min(fe.embedding <-> (p_embedding)::vector) as dist
    from public.face_embeddings fe
    where fe.event_id = v_event.id
      and (fe.embedding <-> (p_embedding)::vector) < p_threshold
    group by fe.media_id
  ) d
  join public.media m
    on m.id = d.media_id
   and m.event_id = v_event.id
   and m.status = 'available'
  order by d.dist asc
  limit 240;
end;
$$;

grant execute on function public.search_event_faces(text, text, float, text) to anon, authenticated;

-- ------------------------------------------------------- admin functions --
create or replace function public.admin_event_media_list(p_event_id uuid)
returns table (
  media_id uuid,
  file_name text,
  file_type text,
  sort_order integer,
  indexed boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  return query
  select
    m.id,
    m.file_name,
    m.file_type,
    m.sort_order,
    exists (select 1 from public.face_index_state fis where fis.media_id = m.id)
  from public.media m
  where m.event_id = p_event_id
    and m.file_type = 'image'
    and m.status = 'available'
  order by m.sort_order asc, m.created_at asc;
end;
$$;

create or replace function public.admin_store_face_embeddings(
  p_event_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  -- Every media id in the batch is marked as processed, even when the
  -- image had no detectable face (embedding is null in that case).
  insert into public.face_index_state (media_id, event_id)
  select (r ->> 'media_id')::uuid, p_event_id
  from jsonb_array_elements(p_rows) r
  where exists (
    select 1 from public.media m
    where m.id = (r ->> 'media_id')::uuid
      and m.event_id = p_event_id
      and m.file_type = 'image'
  )
  on conflict (media_id) do update set indexed_at = now();

  -- Replace semantics: re-indexing a media item drops its previous
  -- embeddings first so rebuilds stay exact.
  delete from public.face_embeddings
  where event_id = p_event_id
    and media_id in (
      select (r ->> 'media_id')::uuid
      from jsonb_array_elements(p_rows) r
      where r ->> 'embedding' is not null
    );

  insert into public.face_embeddings (event_id, media_id, face_index, embedding)
  select
    p_event_id,
    (r ->> 'media_id')::uuid,
    coalesce((r ->> 'face_index')::integer, 0),
    (r ->> 'embedding')::text::vector
  from jsonb_array_elements(p_rows) r
  where r ->> 'embedding' is not null
    and exists (
      select 1 from public.media m
      where m.id = (r ->> 'media_id')::uuid
        and m.event_id = p_event_id
        and m.file_type = 'image'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_clear_face_index(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  delete from public.face_embeddings where event_id = p_event_id;
  get diagnostics v_count = row_count;
  delete from public.face_index_state where event_id = p_event_id;
  return v_count;
end;
$$;

create or replace function public.admin_face_index_stats(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select jsonb_build_object(
    'images_total', (
      select count(*) from public.media m
      where m.event_id = p_event_id and m.file_type = 'image' and m.status = 'available'
    ),
    'images_indexed', (
      -- Only photos that are still available in the gallery: a photo the
      -- Drive sync marked unavailable cannot be searched, so it should not
      -- count towards "indexed" either.
      select count(*) from public.face_index_state fis
      join public.media m on m.id = fis.media_id
      where fis.event_id = p_event_id
        and m.status = 'available'
    ),
    'faces_detected', (
      select count(*) from public.face_embeddings fe where fe.event_id = p_event_id
    ),
    'last_indexed_at', (
      select max(fis.indexed_at)::text from public.face_index_state fis
      where fis.event_id = p_event_id
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_event_media_list(uuid) from anon, authenticated;
revoke execute on function public.admin_store_face_embeddings(uuid, jsonb) from anon, authenticated;
revoke execute on function public.admin_clear_face_index(uuid) from anon, authenticated;
revoke execute on function public.admin_face_index_stats(uuid) from anon, authenticated;
