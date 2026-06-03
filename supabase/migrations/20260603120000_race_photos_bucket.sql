-- Race / medal photo storage bucket.
--
-- Root cause it fixes: race & medal photos were stored as base64 data URLs
-- INSIDE each race object, which lives in the synced `user_state.state_json`
-- blob and in localStorage. Every save re-serialized the entire photo-laden
-- state synchronously (main-thread freeze) and re-uploaded it (slow / oversized),
-- and could blow the ~5 MB localStorage quota → tab crash. Photos now upload to
-- this bucket via the Worker (service role) and only the public URL is stored.
--
-- Public bucket: anyone can READ (profile photos are already public-ish and the
-- public profile SSR renders them). WRITES happen only through the Worker using
-- the service role key, which bypasses RLS — so no anon insert policy is needed.

insert into storage.buckets (id, name, public)
values ('race-photos', 'race-photos', true)
on conflict (id) do update set public = true;

-- Public read for objects in this bucket (idempotent: drop-then-create).
drop policy if exists "race_photos_public_read" on storage.objects;
create policy "race_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'race-photos');
