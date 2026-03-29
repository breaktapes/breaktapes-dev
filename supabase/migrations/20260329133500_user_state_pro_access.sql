alter table public.user_state
  add column if not exists pro_access boolean not null default false;
