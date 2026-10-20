begin;
-- Aggregate all private transactions in the selected six-month window, not the ledger's 100-row preview.
create function public.moneyspace_analytics(p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); today date:=timezone('Asia/Bangkok',now())::date; result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_month<'2000-01-01'::date or p_month>date_trunc('month',today)::date then raise exception 'INVALID_MONTH';end if;
 with facts as (
 select t.occurred_on as date,t.category_id,coalesce(c.name,'ไม่ระบุหมวด') as category_name,
 case when t.kind='refund' then original.tag else t.tag end as tag,t.kind,sum(t.amount)::text as amount,count(*)::integer as count
 from public.transactions t
 left join public.categories c on c.id=t.category_id and c.owner_id=uid
 left join public.transactions original on original.id=t.refund_of_id and original.owner_id=uid and original.household_id is null
 where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.kind in ('income','expense','refund')
 and t.occurred_on>=(p_month-interval '5 months')::date and t.occurred_on<(p_month+interval '1 month')::date
 group by t.occurred_on,t.category_id,c.name,case when t.kind='refund' then original.tag else t.tag end,t.kind
 ), savings as (
 select month_start::date as month,
 coalesce((select sum(case when timezone('Asia/Bangkok',c.created_at)::date>=month_start::date and timezone('Asia/Bangkok',c.created_at)::date<(month_start+interval '1 month')::date then c.amount else 0 end-case when timezone('Asia/Bangkok',c.deleted_at)::date>=month_start::date and timezone('Asia/Bangkok',c.deleted_at)::date<(month_start+interval '1 month')::date then c.amount else 0 end) from public.goal_contributions c where c.owner_id=uid),0)::text as amount
 from generate_series((p_month-interval '5 months')::timestamp,p_month::timestamp,interval '1 month') month_start
 )
 select jsonb_build_object('month',p_month,'today',today,'facts',coalesce((select jsonb_agg(to_jsonb(f) order by f.date) from facts f),'[]'::jsonb),'savings',coalesce((select jsonb_agg(to_jsonb(s) order by s.month) from savings s),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.moneyspace_analytics(date) from public,anon;
grant execute on function public.moneyspace_analytics(date) to authenticated;
commit;
