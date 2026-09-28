-- RepOne Platform — Event cover photo
-- Jonathan asked for the Events list to look like a card grid with a cover
-- image per event (reference: a competition-listing app screenshot he
-- shared), and for organizers to be able to upload that image themselves.
-- Mirrors 0005_athlete_photos_storage.sql's pattern exactly — a public
-- Storage bucket plus a URL column on the row being illustrated — just for
-- `events` instead of `athletes`.

alter table events add column cover_image_url text;

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

-- No `alter table storage.objects enable row level security` — see the
-- comment in 0005_athlete_photos_storage.sql: Supabase already has RLS on by
-- default there and the SQL Editor role can't change that setting. Only the
-- policies below are ours to manage; `drop policy if exists` keeps this safe
-- to re-run.

drop policy if exists "public read event_photos" on storage.objects;
create policy "public read event_photos" on storage.objects for select
  using (bucket_id = 'event-photos');

drop policy if exists "authenticated manage event_photos" on storage.objects;
create policy "authenticated manage event_photos" on storage.objects for all
  using (bucket_id = 'event-photos' and auth.uid() is not null)
  with check (bucket_id = 'event-photos' and auth.uid() is not null);
