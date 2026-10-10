create table if not exists public.gallery_access_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  visitor_name text not null check (char_length(trim(visitor_name)) between 2 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  access_method text not null check (access_method in ('code', 'qr', 'face')),
  created_at timestamptz not null default now()
);

create index if not exists gallery_access_logs_event_id_idx
  on public.gallery_access_logs(event_id, created_at desc);

alter table public.gallery_access_logs enable row level security;

revoke all on public.gallery_access_logs from anon, authenticated;

create or replace function public.record_gallery_access(
  p_code text,
  p_name text,
  p_phone text,
  p_method text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_method text := lower(trim(coalesce(p_method, '')));
begin
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Invalid name';
  end if;

  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Invalid phone number';
  end if;

  if v_method not in ('code', 'qr', 'face') then
    raise exception 'Invalid access method';
  end if;

  select e.id
    into v_event_id
  from public.events e
  where e.status = 'active'
    and (
      upper(e.access_code) = upper(nullif(trim(coalesce(p_code, '')), ''))
      or e.qr_token = nullif(trim(coalesce(p_code, '')), '')
    )
  limit 1;

  if v_event_id is null then
    raise exception 'Invalid or expired access code';
  end if;

  insert into public.gallery_access_logs(event_id, visitor_name, phone, access_method)
  values (v_event_id, v_name, v_phone, v_method);

  return true;
end;
$function$;

revoke all on function public.record_gallery_access(text, text, text, text) from public;
grant execute on function public.record_gallery_access(text, text, text, text) to anon, authenticated;