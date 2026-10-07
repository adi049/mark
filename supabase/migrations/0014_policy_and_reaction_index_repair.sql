-- MARKIPIE production repair 0014
-- Tighten public/admin policy overlap and finish reaction-query indexing.

drop policy if exists "public reads published blogs" on public.blogs;
create policy "public reads published blogs"
  on public.blogs for select
  to anon
  using (published = true);

drop policy if exists "public reads active marketing" on public.marketing_services;
create policy "public reads active marketing"
  on public.marketing_services for select
  to anon
  using (active = true);

drop policy if exists "public reads active services" on public.services;
create policy "public reads active services"
  on public.services for select
  to anon
  using (active = true);

drop policy if exists "admin manages blogs" on public.blogs;
create policy "admin manages blogs"
  on public.blogs for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin manages clients" on public.clients;
create policy "admin manages clients"
  on public.clients for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin manages event folders" on public.event_folders;
create policy "admin manages event folders"
  on public.event_folders for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin manages events" on public.events;
create policy "admin manages events"
  on public.events for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin manages marketing" on public.marketing_services;
create policy "admin manages marketing"
  on public.marketing_services for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin manages media" on public.media;
create policy "admin manages media"
  on public.media for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin manages reactions" on public.reactions;
create policy "admin manages reactions"
  on public.reactions for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin manages services" on public.services;
create policy "admin manages services"
  on public.services for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke execute on function public.admin_event_media_summary(uuid) from public, anon;
revoke execute on function public.admin_event_payment_album_summary(uuid) from public, anon;
grant execute on function public.admin_event_media_summary(uuid) to authenticated;
grant execute on function public.admin_event_payment_album_summary(uuid) to authenticated;

create index if not exists idx_reactions_event_media_updated
  on public.reactions (event_id, media_id, updated_at desc);
