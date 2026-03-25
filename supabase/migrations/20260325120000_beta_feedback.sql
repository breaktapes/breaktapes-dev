-- Beta feedback from staging testers
create table if not exists public.beta_feedback (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  rating      smallint check (rating between 1 and 5),
  message     text,
  page        text,
  created_at  timestamptz default now() not null
);

-- RLS: authenticated users can insert their own feedback; no client-side reads
alter table public.beta_feedback enable row level security;

create policy "beta_feedback_auth_insert"
  on public.beta_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant insert on public.beta_feedback to authenticated;
