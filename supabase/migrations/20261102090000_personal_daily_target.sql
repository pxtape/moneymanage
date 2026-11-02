begin;
alter table public.profiles add column daily_spending_target numeric(12,2) not null default 0 check (daily_spending_target >= 0 and daily_spending_target <= 999999999.99);
create or replace function moneyspace_private.daily_target(p_amount numeric default null)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); saved numeric;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_amount is not null then
  if p_amount < 0 or p_amount > 999999999.99 or p_amount <> trunc(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_AMOUNT'; end if;
  update public.profiles set daily_spending_target=p_amount,updated_at=clock_timestamp() where id=uid returning daily_spending_target into saved;
 else
  select daily_spending_target into saved from public.profiles where id=uid;
 end if;
 if saved is null then raise exception 'PROFILE_NOT_FOUND' using errcode='42501'; end if;
 return saved::text;
end $$;
revoke all on function moneyspace_private.daily_target(numeric) from public,anon;
grant execute on function moneyspace_private.daily_target(numeric) to authenticated;
create or replace function public.moneyspace_daily_target(p_amount numeric default null)
returns text language sql security invoker set search_path='' as $$ select moneyspace_private.daily_target(p_amount) $$;
revoke all on function public.moneyspace_daily_target(numeric) from public,anon;
grant execute on function public.moneyspace_daily_target(numeric) to authenticated;
commit;
