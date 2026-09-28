-- RepOne Platform — Athlete photo storage
-- Public bucket for athlete profile photos. `athletes.photo_url` was already
-- reserved for this back in 0001_init.sql. Today this just backs a simple
-- profile picture shown in Admin; it's also the asset RepOne plans to match
-- against event recordings/IG history for highlight-clip identification
-- later (see architecture doc, Section 13 — ISO/post-event metadata is
-- explicitly deferred, this is only the athlete-photo input for that later).

insert into storage.buckets (id, name, public)
values ('athlete-photos', 'athlete-photos', true)
on conflict (id) do nothing;

-- No `alter table storage.objects enable row level security` here — Supabase
-- already has RLS enabled on that table by default, and the SQL Editor's
-- role isn't granted ownership to change that setting (attempting it fails
-- with "must be owner of table objects"). Only the policies below are ours
-- to manage. `drop policy if exists` makes this safe to re-run if a prior
-- attempt got partway through.

-- Public bucket: anyone can view a photo by URL (needed for it to render in
-- Admin/overlays without a signed-URL dance). Only authenticated users can
-- upload/replace/delete objects — fine-grained per-org control isn't
-- practical at the storage-object level without extra path conventions, so
-- this mirrors operator_actions' "any authenticated user" pattern; the real
-- gate is the athletes table's own RLS on who can attach a photo to a record.
drop policy if exists "public read athlete_photos" on storage.objects;
create policy "public read athlete_photos" on storage.objects for select
  using (bucket_id = 'athlete-photos');

drop policy if exists "authenticated manage athlete_photos" on storage.objects;
create policy "authenticated manage athlete_photos" on storage.objects for all
  using (bucket_id = 'athlete-photos' and auth.uid() is not null)
  with check (bucket_id = 'athlete-photos' and auth.uid() is not null);
