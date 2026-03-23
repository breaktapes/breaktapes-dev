create table if not exists public.app_state (
  id text primary key,
  races jsonb not null default '[]'::jsonb,
  athlete jsonb,
  next_race jsonb,
  upcoming_races jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.touch_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists app_state_updated_at on public.app_state;
create trigger app_state_updated_at
before update on public.app_state
for each row
execute function public.touch_app_state_updated_at();

insert into public.app_state (id)
values ('default')
on conflict (id) do nothing;

alter table public.app_state disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.app_state to anon, authenticated;
