alter table public.race_catalog
  add column if not exists source_page text;

do $$
declare
  current_type text;
begin
  select data_type
    into current_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'race_catalog'
    and column_name = 'source_page';

  if current_type = 'integer' then
    alter table public.race_catalog
      alter column source_page type text using source_page::text;
  end if;
end $$;
