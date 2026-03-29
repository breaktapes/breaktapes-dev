create or replace function public.delete_my_account(confirm_text text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(confirm_text, '') <> 'DELETE' then
    raise exception 'Confirmation text mismatch';
  end if;

  delete from public.beta_feedback
  where user_id = uid;

  delete from auth.users
  where id = uid;
end;
$$;

revoke all on function public.delete_my_account(text) from public;
grant execute on function public.delete_my_account(text) to authenticated;
