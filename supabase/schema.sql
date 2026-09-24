-- Run in your Supabase project's SQL Editor. Safe to rerun for this app's schema.
begin;
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  "foodType" text not null check (length(trim("foodType")) between 1 and 200),
  category text not null check (length(category) <= 200),
  "photoUrl" text not null default '' check ("photoUrl" = '' or "photoUrl" like 'https://%'),
  notes text not null default '' check (length(notes) <= 5000),
  "postedAt" bigint not null,
  "stockDate" date not null,
  "stockLevel" text not null check ("stockLevel" in ('low', 'moderate', 'high')),
  quantity integer not null check (quantity >= 0),
  status text not null default 'available' check (status = 'available'),
  "postedBy" text not null
);
create index if not exists listings_stock_date_idx on public.listings ("stockDate");

-- Read the confirmed email from Auth, never from user-editable metadata.
create or replace function public.pantry_access(require_staff boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and email_confirmed_at is not null
      and lower(email) like '%@calpoly.edu'
      and (not require_staff or lower(email) = 'pantry-staff@calpoly.edu')
  );
$$;
revoke all on function public.pantry_access(boolean) from public, anon;
grant execute on function public.pantry_access(boolean) to authenticated;

alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;
grant select, insert, update, delete on public.listings to authenticated;

drop policy if exists pantry_read on public.listings;
create policy pantry_read on public.listings for select to authenticated
using ((select public.pantry_access(false)));
drop policy if exists pantry_insert on public.listings;
create policy pantry_insert on public.listings for insert to authenticated
with check ((select public.pantry_access(true)) and lower("postedBy") = lower(auth.jwt() ->> 'email'));
drop policy if exists pantry_update on public.listings;
create policy pantry_update on public.listings for update to authenticated
using ((select public.pantry_access(true)))
with check ((select public.pantry_access(true)));
drop policy if exists pantry_delete on public.listings;
create policy pantry_delete on public.listings for delete to authenticated
using ((select public.pantry_access(true)));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listings') then
    alter publication supabase_realtime add table public.listings;
  end if;
end $$;
commit;
