begin;

alter table public.profiles
  add column if not exists month_cycle_day smallint not null default 1
  check (month_cycle_day between 1 and 28);

create or replace function moneyspace_private.cycle_start(p_date date,p_day integer)
returns date language sql immutable strict set search_path='' as $$
 with candidate as (
  select make_date(extract(year from p_date)::integer,extract(month from p_date)::integer,p_day) d
 )
 select case when p_date >= d then d else (d-interval '1 month')::date end from candidate
$$;
revoke all on function moneyspace_private.cycle_start(date,integer) from public,anon,authenticated;
grant execute on function moneyspace_private.cycle_start(date,integer) to authenticated;

create or replace function moneyspace_private.set_cycle_day(p_day integer)
returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); saved integer;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_day is null or p_day<1 or p_day>28 then raise exception 'INVALID_CYCLE_DAY'; end if;
 update public.profiles set month_cycle_day=p_day,updated_at=clock_timestamp()
 where id=uid returning month_cycle_day into saved;
 if saved is null then raise exception 'PROFILE_NOT_FOUND' using errcode='42501'; end if;
 return saved;
end $$;
revoke all on function moneyspace_private.set_cycle_day(integer) from public,anon;
grant execute on function moneyspace_private.set_cycle_day(integer) to authenticated;
create or replace function public.moneyspace_set_cycle_day(p_day integer)
returns integer language sql security invoker set search_path='' as $$
 select moneyspace_private.set_cycle_day(p_day)
$$;
revoke all on function public.moneyspace_set_cycle_day(integer) from public,anon;
grant execute on function public.moneyspace_set_cycle_day(integer) to authenticated;

create or replace function public.moneyspace_home(p_date date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 uid uuid:=auth.uid(); selected_date date; today date:=timezone('Asia/Bangkok',now())::date;
 cycle_day integer; cycle_from date; cycle_through date; budget_month date;
 week_from date; week_through date; previous_week_from date; previous_week_through date;
 year_start date; result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 selected_date:=coalesce(p_date,today);
 if selected_date<'2000-01-01'::date or selected_date>today then raise exception 'INVALID_DATE'; end if;
 select month_cycle_day into cycle_day from public.profiles where id=uid;
 if cycle_day is null then raise exception 'PROFILE_NOT_FOUND' using errcode='42501'; end if;
 cycle_from:=moneyspace_private.cycle_start(selected_date,cycle_day);
 cycle_through:=(cycle_from+interval '1 month'-interval '1 day')::date;
 budget_month:=date_trunc('month',cycle_from)::date;
 week_from:=selected_date-extract(dow from selected_date)::integer;
 week_through:=week_from+6;
 previous_week_from:=week_from-7; previous_week_through:=week_from-1;
 year_start:=make_date(extract(year from selected_date)::integer,1,1);

 with
 saved_now as (
  select coalesce(sum(c.amount),0) amount from public.goal_contributions c
  where c.owner_id=uid and timezone('Asia/Bangkok',c.created_at)::date<=selected_date
   and (c.deleted_at is null or timezone('Asia/Bangkok',c.deleted_at)::date>selected_date)
 ),
 money_now as (
  select coalesce(sum(a.opening_balance),0)+coalesce((select sum(case when t.kind in ('income','refund') then t.amount when t.kind in ('expense','settlement') then -t.amount else 0 end) from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.occurred_on<=selected_date),0) amount
  from public.accounts a where a.owner_id=uid and a.household_id is null and a.deleted_at is null and a.kind<>'debt'
 ),
 cycle_totals as (
  select coalesce(sum(case when kind='income' then amount else 0 end),0) income,
   coalesce(sum(case when kind='expense' then amount when kind='refund' then -amount else 0 end),0) expenses
  from public.transactions where owner_id=uid and household_id is null and deleted_at is null
   and occurred_on between cycle_from and least(cycle_through,selected_date)
 ),
 budget as (
  select e.id,e.name,coalesce(e.icon,'👛') icon,coalesce(b.amount,0) target,
   coalesce((select sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end) from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.envelope_id=e.id and t.occurred_on between cycle_from and least(cycle_through,selected_date)),0) spent
  from public.envelopes e
  left join public.budget_periods p on p.owner_id=uid and p.household_id is null and p.month_start=budget_month
  left join public.budget_allocations b on b.budget_period_id=p.id and b.envelope_id=e.id
  where e.owner_id=uid and e.household_id is null and e.deleted_at is null
 ),
 day_rows as (
  select t.id,t.kind,t.amount,t.merchant,coalesce(t.category_name_snapshot,'ไม่ระบุหมวด') category,
   coalesce(t.category_icon_snapshot,'✳️') icon,t.created_at
  from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.occurred_on=selected_date
 ),
 day_categories as (
  select category,icon,sum(case when kind='expense' then amount when kind='refund' then -amount else 0 end) amount
  from day_rows where kind in ('expense','refund') group by category,icon
 ),
 day_types as (
  select case when kind='income' then coalesce(nullif(merchant,''),'รายรับ') else category end name,
   case when kind='income' then 'income' else 'expense' end type,
   sum(case when kind='income' then amount when kind='expense' then amount when kind='refund' then -amount else 0 end) amount
  from day_rows where kind in ('income','expense','refund') group by 1,2
 ),
 weekly as (
  select d::date report_date,
   coalesce((select sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end) from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.occurred_on=d::date),0) current,
   coalesce((select sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end) from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.occurred_on=(d::date-7)),0) previous
  from generate_series(week_from::timestamp,week_through::timestamp,interval '1 day') d
 ),
 annual as (
  select m::date nominal,moneyspace_private.cycle_start(m::date,cycle_day) period_from,
   (moneyspace_private.cycle_start(m::date,cycle_day)+interval '1 month'-interval '1 day')::date period_through
  from generate_series(year_start::timestamp,(year_start+interval '11 months')::timestamp,interval '1 month') m
 ),
 annual_rows as (
  select a.nominal,a.period_from,a.period_through,
   coalesce((select sum(t.amount) from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.kind='income' and t.occurred_on between a.period_from and least(a.period_through,selected_date)),0) income,
   coalesce((select sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end) from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.occurred_on between a.period_from and least(a.period_through,selected_date)),0) expenses,
   coalesce((select sum(c.amount) from public.goal_contributions c where c.owner_id=uid and timezone('Asia/Bangkok',c.created_at)::date<=least(a.period_through,selected_date) and (c.deleted_at is null or timezone('Asia/Bangkok',c.deleted_at)::date>least(a.period_through,selected_date))),0) savings
  from annual a where a.period_from<=selected_date
 )
 select jsonb_build_object(
  'selected_date',selected_date,'cycle_day',cycle_day,'cycle_from',cycle_from,'cycle_through',cycle_through,
  'money',jsonb_build_object('total',(select amount::text from money_now),'savings',(select amount::text from saved_now),'spendable',((select amount from money_now)-(select amount from saved_now))::text),
  'cycle',jsonb_build_object('income',(select income::text from cycle_totals),'expenses',(select expenses::text from cycle_totals),'budget_total',coalesce((select sum(target) from budget),0)::text,'budget_spent',coalesce((select sum(spent) from budget),0)::text),
  'daily',jsonb_build_object(
   'target',(coalesce((select sum(target) from budget),0)/greatest(1,cycle_through-cycle_from+1))::text,
   'expenses',coalesce((select sum(case when kind='expense' then amount when kind='refund' then -amount else 0 end) from day_rows),0)::text,
   'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'amount',amount::text,'merchant',merchant,'category',category,'icon',icon) order by created_at desc) from day_rows),'[]'::jsonb),
   'categories',coalesce((select jsonb_agg(jsonb_build_object('name',category,'icon',icon,'amount',amount::text) order by amount desc) from day_categories where amount<>0),'[]'::jsonb),
   'types',coalesce((select jsonb_agg(jsonb_build_object('name',name,'type',type,'amount',amount::text) order by type,name) from day_types where amount<>0),'[]'::jsonb)
  ),
  'weekly',jsonb_build_object('from',week_from,'through',week_through,'previous_from',previous_week_from,'previous_through',previous_week_through,'days',coalesce((select jsonb_agg(jsonb_build_object('date',report_date,'current',current::text,'previous',previous::text) order by report_date) from weekly),'[]'::jsonb)),
  'monthly',jsonb_build_object('budgets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'icon',icon,'target',target::text,'spent',spent::text,'remaining',(target-spent)::text) order by target desc,name) from budget),'[]'::jsonb)),
  'yearly',coalesce((select jsonb_agg(jsonb_build_object('month',nominal,'from',period_from,'through',period_through,'income',income::text,'expenses',expenses::text,'savings',savings::text) order by nominal) from annual_rows),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.moneyspace_home(date) from public,anon;
grant execute on function public.moneyspace_home(date) to authenticated;

commit;
