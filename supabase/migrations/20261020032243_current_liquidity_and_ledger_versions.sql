begin;
create or replace function moneyspace_private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=clock_timestamp();return new;end $$;
grant execute on function moneyspace_private.envelope_remaining(uuid,uuid,date) to authenticated;
create or replace function public.moneyspace_snapshot(p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date then raise exception 'INVALID_MONTH'; end if;
 select jsonb_build_object(
 'month',p_month,
 'cash',coalesce((select sum(a.balance) from public.personal_account_balances a where a.owner_id=uid and a.kind<>'debt'),0)::text,
 'savings',coalesce((select sum(c.amount) from public.goal_contributions c where c.owner_id=uid and c.deleted_at is null),0)::text,
 'reserved_current',coalesce((select sum(greatest(0,moneyspace_private.envelope_remaining(uid,e.id,date_trunc('month',timezone('Asia/Bangkok',now()))::date))) from public.envelopes e where e.owner_id=uid and e.household_id is null and e.deleted_at is null),0)::text,
 'period_exists',exists(select 1 from public.budget_periods where owner_id=uid and household_id is null and month_start=p_month),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'kind',a.kind,'balance',a.balance::text,'opening_balance',a.opening_balance::text) order by a.id) from public.personal_account_balances a where a.owner_id=uid),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'icon',c.icon,'tag',c.default_tag,'envelope',c.default_envelope_id) order by c.created_at) from public.categories c where c.owner_id=uid and c.deleted_at is null),'[]'::jsonb),
 'envelopes',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'rollover',e.rollover_mode,'allocated',coalesce(b.amount,0)::text,'carried',coalesce(b.rollover_amount,0)::text,'spent',coalesce(s.spent,0)::text,'remaining',(coalesce(b.amount,0)+coalesce(b.rollover_amount,0)-coalesce(s.spent,0))::text) order by e.created_at)
 from public.envelopes e left join public.budget_periods p on p.owner_id=uid and p.household_id is null and p.month_start=p_month left join public.budget_allocations b on b.budget_period_id=p.id and b.envelope_id=e.id left join lateral(select sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end) spent from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.envelope_id=e.id and t.occurred_on>=p_month and t.occurred_on<(p_month+interval '1 month')::date) s on true where e.owner_id=uid and e.household_id is null and e.deleted_at is null),'[]'::jsonb),
 'income',coalesce((select sum(amount) from public.transactions where owner_id=uid and household_id is null and deleted_at is null and kind='income' and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date),0)::text,
 'expenses',coalesce((select sum(case when kind='expense' then amount when kind='refund' then -amount else 0 end) from public.transactions where owner_id=uid and household_id is null and deleted_at is null and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date),0)::text,
 'goals',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'target',g.target_amount::text,'saved',coalesce(s.saved,0)::text) order by g.created_at) from public.goals g left join lateral(select sum(c.amount) saved from public.goal_contributions c where c.owner_id=uid and c.goal_id=g.id and c.deleted_at is null) s on true where g.owner_id=uid and g.household_id is null and g.deleted_at is null),'[]'::jsonb),
 'contributions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'goal_id',c.goal_id,'account_id',c.account_id,'amount',c.amount::text) order by c.created_at desc) from public.goal_contributions c where c.owner_id=uid and c.deleted_at is null),'[]'::jsonb),
 'transaction_count',(select count(*) from public.transactions where owner_id=uid and household_id is null and deleted_at is null and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date),
 'transactions',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_on desc,x.created_at desc) from (select id,account_id,destination_account_id,kind,amount::text,category_id,envelope_id,merchant,notes,tag,occurred_on,refund_of_id,updated_at,created_at from public.transactions where owner_id=uid and household_id is null and deleted_at is null and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date order by occurred_on desc,created_at desc limit 100) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.moneyspace_snapshot(date) from public,anon;
grant execute on function public.moneyspace_snapshot(date) to authenticated;
commit;
