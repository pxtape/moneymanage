begin;
-- Read-only, owner-scoped days for calendar footprints and the weekly postcard.
create function public.moneyspace_daily_activity(p_from date,p_through date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid();today date:=timezone('Asia/Bangkok',now())::date;result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_from is null or p_through is null or p_from<'2000-01-01'::date or p_through>today or p_through<p_from or p_through-p_from>61 then raise exception 'INVALID_DATE';end if;
 select coalesce(jsonb_agg(jsonb_build_object('date',x.report_date,'count',x.entry_count,'expenses',x.expenses::text,'income',x.income::text) order by x.report_date),'[]'::jsonb) into result from (
 select d::date as report_date,count(t.id) as entry_count,coalesce(sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end),0) expenses,coalesce(sum(case when t.kind='income' then t.amount else 0 end),0) income
 from generate_series(p_from::timestamp,p_through::timestamp,interval '1 day') d
 left join public.transactions t on t.occurred_on=d::date and t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.kind in ('income','expense','refund')
 group by d::date) x;
 return result;
end $$;
revoke all on function public.moneyspace_daily_activity(date,date) from public,anon;
grant execute on function public.moneyspace_daily_activity(date,date) to authenticated;
commit;
