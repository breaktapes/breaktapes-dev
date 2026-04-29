create table if not exists contact_submissions (
  id          uuid        default gen_random_uuid() primary key,
  name        text        not null check (length(name) <= 200),
  email       text        not null check (length(email) <= 320),
  subject     text        not null check (length(subject) <= 200),
  message     text        not null check (length(message) <= 5000),
  created_at  timestamptz default now()
);

alter table contact_submissions enable row level security;

-- Anyone (incl. unauthenticated) can submit; only service role can read
create policy "contact_anon_insert"
  on contact_submissions for insert
  to anon
  with check (true);
