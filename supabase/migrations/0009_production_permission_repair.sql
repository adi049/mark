-- MARKIPIE production repair migration 0009
-- Safe to run once in Supabase SQL Editor. It repairs databases that were
-- created before the payment/permission migrations were applied.

alter table public.events
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists initial_payment_status text not null default 'unpaid',
  add column if not exists payment_updated_at timestamptz,
  add column if not exists payment_updated_by text,
  add column if not exists permissions_updated_at timestamptz,
  add column if not exists permissions_updated_by text,
  add column if not exists watermark_enabled boolean not null default true,
  add column if not exists download_enabled boolean not null default true,
  add column if not exists face_scan_enabled boolean not null default false,
  add column if not exists reaction_enabled boolean not null default true,
  add column if not exists instagram_gate_enabled boolean not null default true;

do $$
begin
  alter table public.events
    add constraint events_payment_status_check
    check (payment_status in ('unpaid', 'partial', 'paid'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.events
    add constraint events_initial_payment_status_check
    check (initial_payment_status in ('unpaid', 'paid'));
exception when duplicate_object then null;
end $$;

-- Admins must be able to update event controls from the frontend.
alter table public.events enable row level security;

drop policy if exists "admin manages events" on public.events;
create policy "admin manages events"
  on public.events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Keep the existing admin RPC available to the authenticated admin role.
grant execute on function public.admin_set_payment_status(uuid, text) to authenticated;

-- Make sure the initial-payment control has an admin-only RPC too.
create or replace function public.admin_set_initial_payment_status(
  p_event_id uuid,
  p_status text
)
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

  if p_status is null or p_status not in ('unpaid', 'paid') then
    raise exception 'Invalid initial payment status.';
  end if;

  update public.events
  set initial_payment_status = p_status,
      updated_at = now()
  where id = p_event_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  select jsonb_build_object(
    'initial_payment_status', initial_payment_status
  )
  into v_result
  from public.events
  where id = p_event_id;

  return v_result;
end;
$$;

revoke execute on function public.admin_set_initial_payment_status(uuid, text) from anon;
grant execute on function public.admin_set_initial_payment_status(uuid, text) to authenticated;
