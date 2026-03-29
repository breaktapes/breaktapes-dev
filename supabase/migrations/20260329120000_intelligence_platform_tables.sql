create table if not exists public.race_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_id text not null,
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.race_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_id text,
  cache_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.season_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.race_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Comparison',
  race_ids jsonb not null default '[]'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_relationships (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  permission_profile text not null default 'review',
  invite_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_comments (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid references public.coach_relationships(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  race_id text,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.athlete_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  export_type text not null,
  export_format text not null default 'json',
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version_label text,
  version_reason text not null default 'manual',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists race_media_user_race_idx on public.race_media (user_id, race_id);
create index if not exists race_analysis_cache_user_key_idx on public.race_analysis_cache (user_id, cache_key);
create index if not exists season_plans_user_idx on public.season_plans (user_id);
create index if not exists race_comparisons_user_idx on public.race_comparisons (user_id);
create index if not exists coach_relationships_athlete_idx on public.coach_relationships (athlete_user_id);
create index if not exists coach_relationships_coach_idx on public.coach_relationships (coach_user_id);
create index if not exists coach_relationships_invite_email_idx on public.coach_relationships (invite_email);
create index if not exists coach_comments_relationship_idx on public.coach_comments (relationship_id);
create index if not exists athlete_exports_user_idx on public.athlete_exports (user_id);
create index if not exists app_state_versions_user_idx on public.app_state_versions (user_id);

alter table public.race_media enable row level security;
alter table public.race_analysis_cache enable row level security;
alter table public.season_plans enable row level security;
alter table public.race_comparisons enable row level security;
alter table public.coach_relationships enable row level security;
alter table public.coach_comments enable row level security;
alter table public.athlete_exports enable row level security;
alter table public.app_state_versions enable row level security;

create policy "race_media_owner"
  on public.race_media for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "race_analysis_cache_owner"
  on public.race_analysis_cache for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "season_plans_owner"
  on public.season_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "race_comparisons_owner"
  on public.race_comparisons for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "coach_relationships_visible_to_participants"
  on public.coach_relationships for all
  using (auth.uid() = athlete_user_id or auth.uid() = coach_user_id)
  with check (auth.uid() = athlete_user_id or auth.uid() = coach_user_id);

create policy "coach_comments_visible_to_participants"
  on public.coach_comments for all
  using (
    exists (
      select 1
      from public.coach_relationships rel
      where rel.id = relationship_id
        and (rel.athlete_user_id = auth.uid() or rel.coach_user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.coach_relationships rel
      where rel.id = relationship_id
        and (rel.athlete_user_id = auth.uid() or rel.coach_user_id = auth.uid())
    )
  );

create policy "athlete_exports_owner"
  on public.athlete_exports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "app_state_versions_owner"
  on public.app_state_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.race_media to authenticated;
grant select, insert, update, delete on public.race_analysis_cache to authenticated;
grant select, insert, update, delete on public.season_plans to authenticated;
grant select, insert, update, delete on public.race_comparisons to authenticated;
grant select, insert, update, delete on public.coach_relationships to authenticated;
grant select, insert, update, delete on public.coach_comments to authenticated;
grant select, insert, update, delete on public.athlete_exports to authenticated;
grant select, insert, update, delete on public.app_state_versions to authenticated;
