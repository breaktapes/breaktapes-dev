-- Community medal photos table
-- First uploader's photo becomes the community photo for that race+variant.
-- Users with no personal upload automatically see the community photo.

create table if not exists public.race_medal_photos (
  id          bigint generated always as identity primary key,
  race_key    text not null,           -- e.g. "dubai-marathon-2026"
  variant     text,                    -- null for most races; "gold","silver","bill-rowan","bronze","vic-clapham","back" for Comrades
  photo_url   text not null,           -- Supabase Storage public URL
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now() not null
);

-- First-upload-wins: one photo per (race_key) for standard races
create unique index if not exists race_medal_photos_key_idx
  on public.race_medal_photos (race_key)
  where variant is null;

-- One photo per (race_key, variant) for tiered races (Comrades, etc.)
create unique index if not exists race_medal_photos_key_variant_idx
  on public.race_medal_photos (race_key, variant)
  where variant is not null;

create index if not exists race_medal_photos_race_key_idx
  on public.race_medal_photos (race_key);

-- RLS: anyone can read, only authenticated users can insert
alter table public.race_medal_photos enable row level security;

create policy "race_medal_photos_public_read"
  on public.race_medal_photos for select
  to anon, authenticated
  using (true);

create policy "race_medal_photos_auth_insert"
  on public.race_medal_photos for insert
  to authenticated
  with check (uploaded_by = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.race_medal_photos to anon, authenticated;
grant insert on public.race_medal_photos to authenticated;

-- ─── Storage bucket for medal photos ────────────────────────────────────────
-- Public bucket so photo_url is directly accessible via CDN

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medal-photos',
  'medal-photos',
  true,
  5242880,   -- 5 MB limit per file
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Storage RLS: anyone can read objects in this bucket
create policy "medal_photos_storage_public_read"
  on storage.objects for select
  using (bucket_id = 'medal-photos');

-- Storage RLS: authenticated users can insert
create policy "medal_photos_storage_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'medal-photos');
