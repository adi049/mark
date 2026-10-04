-- MARKIPIE migration 0008: initial payment status
-- Separate studio label for the initial/advance payment.
alter table public.events
  add column if not exists initial_payment_status text not null default 'unpaid';

do $$
begin
  alter table public.events
    add constraint events_initial_payment_status_check
    check (initial_payment_status in ('unpaid', 'paid'));
exception
  when duplicate_object then null;
end $$;
