-- ============================================================================
-- MARKIPIE · migration 0004 · Instagram engagement gate (Phase 8)
--
-- Event-level Instagram gate. When a client opens an event gallery through
-- an event code or a QR link, a short engagement step shows the Markipie
-- Instagram profile before the gallery opens. The studio can turn the gate
-- off per event.
--
-- This is an engagement step, NOT a follow-verification system. A normal
-- website cannot verify whether a visitor actually followed the Instagram
-- account, and no such claim is made anywhere in the product.
-- ============================================================================

-- Gate is on by default; the studio can disable it per event.
alter table public.events
  add column if not exists instagram_gate_enabled boolean not null default true;

-- Public event lookup now also returns the gate flag so the client access
-- page knows whether to show the Instagram step. No other fields are
-- added: the lookup still returns only the minimum a visitor needs.
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
  reaction_enabled boolean,
  instagram_gate_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.name, e.event_type, e.event_date, c.name,
    e.watermark_enabled, e.download_enabled, e.face_scan_enabled,
    e.reaction_enabled, e.instagram_gate_enabled
  from public.events e
  join public.clients c on c.id = e.client_id
  where e.status = 'active'
    and (upper(e.access_code) = upper(nullif(p_code, '')) or e.qr_token = nullif(p_code, ''))
  limit 1;
$$;
