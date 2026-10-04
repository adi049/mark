-- MARKIPIE marketing repair migration 0011
-- The admin panel uses stable keys for the three editable marketing offers.
-- Older databases did not have this column, so the panel could show no
-- editable rows even though marketing_services existed.

alter table public.marketing_services
  add column if not exists key text;

create unique index if not exists idx_marketing_services_key
  on public.marketing_services (key)
  where key is not null;

alter table public.marketing_services enable row level security;

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

grant select on public.marketing_services to anon, authenticated;
grant insert, update, delete on public.marketing_services to authenticated;

-- Repair/seed the three rows expected by Admin > Marketing.
insert into public.marketing_services
  (key, title, description, starting_price, content, active, sort_order)
values
  ('social-media-marketing', 'Social Media Management',
   'Planning, shooting and running social content for brands.',
   '₹15,000', 'Starting per month. Includes video shoot and editing.', true, 1),
  ('video-editing', 'Video Editing',
   'Your footage, cut and finished by the studio editing team.',
   '₹1,500', 'Starting price.', true, 2),
  ('graphic-design', 'Graphic Design',
   'Design work for invitations, albums and brand assets.',
   '₹700', 'Starting price.', true, 3)
on conflict (key) where key is not null do update set
  title = excluded.title,
  description = excluded.description,
  starting_price = excluded.starting_price,
  content = excluded.content,
  active = true,
  sort_order = excluded.sort_order,
  updated_at = now();
