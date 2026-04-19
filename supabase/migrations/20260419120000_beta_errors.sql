-- beta_errors: client-side crash reports from RootErrorBoundary
-- Worker POST /api/error-report writes here via anon key
-- RLS: anon can insert, authenticated can select (for debugging)

create table if not exists beta_errors (
  id          uuid primary key default gen_random_uuid(),
  message     text,
  stack       text,
  url         text,
  env         text,
  ts          timestamptz default now(),
  created_at  timestamptz default now()
);

-- Enable RLS
alter table beta_errors enable row level security;

-- Anon can insert (Worker uses anon key)
create policy "beta_errors_anon_insert"
  on beta_errors for insert
  to anon
  with check (true);

-- Authenticated users can read (for debugging)
create policy "beta_errors_auth_select"
  on beta_errors for select
  to authenticated
  using (true);
