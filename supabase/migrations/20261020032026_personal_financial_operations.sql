begin;
-- A per-user lock serializes financial operations; request keys make retries safe.
create table moneyspace_private.financial_requests (
 owner_id uuid not null references public.profiles(id), request_key uuid not null,
 action text not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(owner_id,request_key)
);
alter table moneyspace_private.financial_requests enable row level security;
revoke all on moneyspace_private.financial_requests from public,anon,authenticated;
create table public.transaction_versions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 transaction_id uuid not null, action text not null, before_value jsonb, after_value jsonb,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(transaction_id,owner_id) references public.transactions(id,owner_id)
);
alter table public.transaction_versions enable row level security;
revoke all on public.transaction_versions from public,anon,authenticated;
grant select on public.transaction_versions to authenticated;
create policy versions_own on public.transaction_versions for select to authenticated using(owner_id=(select auth.uid()));
create index transaction_versions_owner_tx on public.transaction_versions(owner_id,transaction_id,created_at desc);
create function moneyspace_private.version_transaction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.transaction_versions(owner_id,transaction_id,action,before_value,after_value)
 values(new.owner_id,new.id,case when tg_op='INSERT' then 'created' when old.deleted_at is null and new.deleted_at is not null then 'deleted' else 'edited' end,case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
revoke all on function moneyspace_private.version_transaction() from public,anon,authenticated;
create trigger transaction_history after insert or update on public.transactions for each row execute function moneyspace_private.version_transaction();

create function moneyspace_private.balance(p_owner uuid,p_account uuid) returns numeric language sql stable security invoker set search_path='' as $$
 select a.opening_balance+coalesce((select sum(case when t.account_id=a.id then case when t.kind in ('income','refund') then t.amount else -t.amount end else t.amount end) from public.transactions t where t.owner_id=p_owner and t.household_id is null and t.deleted_at is null and (t.account_id=a.id or t.destination_account_id=a.id)),0)
 from public.accounts a where a.id=p_account and a.owner_id=p_owner and a.household_id is null and a.deleted_at is null
$$;
create function moneyspace_private.envelope_remaining(p_owner uuid,p_envelope uuid,p_month date) returns numeric language sql stable security invoker set search_path='' as $$
 select coalesce((select b.amount+b.rollover_amount from public.budget_allocations b join public.budget_periods p on p.id=b.budget_period_id where b.owner_id=p_owner and b.envelope_id=p_envelope and p.month_start=p_month and p.household_id is null),0)
 -coalesce((select sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end) from public.transactions t where t.owner_id=p_owner and t.household_id is null and t.deleted_at is null and t.envelope_id=p_envelope and t.occurred_on>=p_month and t.occurred_on<(p_month+interval '1 month')::date),0)
$$;
create function moneyspace_private.rollovers(p_owner uuid) returns void language plpgsql security invoker set search_path='' as $$
declare p record; e record; carried numeric;
begin
 for p in select id,month_start from public.budget_periods where owner_id=p_owner and household_id is null order by month_start loop
  for e in select id,rollover_mode from public.envelopes where owner_id=p_owner and household_id is null and deleted_at is null loop
   carried:=case when e.rollover_mode='none' then 0 else moneyspace_private.envelope_remaining(p_owner,e.id,(p.month_start-interval '1 month')::date) end;
   if e.rollover_mode='positive' then carried:=greatest(0,carried); end if;
   insert into public.budget_allocations(owner_id,budget_period_id,envelope_id,amount,rollover_amount) values(p_owner,p.id,e.id,0,carried)
   on conflict(budget_period_id,envelope_id) do update set rollover_amount=excluded.rollover_amount where public.budget_allocations.rollover_amount is distinct from excluded.rollover_amount;
  end loop;
 end loop;
end $$;
create function moneyspace_private.ensure_month(p_owner uuid,p_month date) returns void language plpgsql security invoker set search_path='' as $$
declare first_month date;last_month date;
begin
 if p_month<>date_trunc('month',p_month)::date or p_month<'2000-01-01'::date or p_month>date_trunc('month',timezone('Asia/Bangkok',now()))::date then raise exception 'INVALID_MONTH'; end if;
 select least(coalesce(min(month_start),p_month),p_month),greatest(coalesce(max(month_start),p_month),date_trunc('month',timezone('Asia/Bangkok',now()))::date) into first_month,last_month from public.budget_periods where owner_id=p_owner and household_id is null;
 insert into public.budget_periods(owner_id,month_start) select p_owner,d::date from generate_series(first_month::timestamp,last_month::timestamp,interval '1 month') d on conflict do nothing;
 perform moneyspace_private.rollovers(p_owner);
end $$;
create function moneyspace_private.unallocated(p_owner uuid) returns numeric language sql stable security invoker set search_path='' as $$
 select coalesce((select sum(moneyspace_private.balance(p_owner,a.id)) from public.accounts a where a.owner_id=p_owner and a.household_id is null and a.kind<>'debt' and a.deleted_at is null),0)
 -coalesce((select sum(greatest(0,moneyspace_private.envelope_remaining(p_owner,e.id,date_trunc('month',timezone('Asia/Bangkok',now()))::date))) from public.envelopes e where e.owner_id=p_owner and e.household_id is null and e.deleted_at is null),0)
 -coalesce((select sum(c.amount) from public.goal_contributions c where c.owner_id=p_owner and c.deleted_at is null),0)
$$;
revoke all on function moneyspace_private.balance(uuid,uuid),moneyspace_private.envelope_remaining(uuid,uuid,date),moneyspace_private.rollovers(uuid),moneyspace_private.ensure_month(uuid,date),moneyspace_private.unallocated(uuid) from public,anon,authenticated;

-- Only this function can mutate personal financial rows. Shared operations remain closed until M5.
create function moneyspace_private.write_finances(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); existing moneyspace_private.financial_requests%rowtype; result jsonb;
 amount numeric; account_id uuid; destination_id uuid; category_id uuid; envelope_id uuid; entity_id uuid; period_id uuid; goal_id uuid;
 d date; k text; old_tx public.transactions%rowtype; original public.transactions%rowtype; cat public.categories%rowtype; label text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_key is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'INVALID_REQUEST'; end if;
 perform 1 from public.profiles where id=uid and onboarding_completed_at is not null for update;
 if not found then raise exception 'ONBOARDING_REQUIRED' using errcode='42501'; end if;
 select * into existing from moneyspace_private.financial_requests where owner_id=uid and request_key=p_key;
 if found then
  if existing.action<>p_action or existing.payload<>p_data then raise exception 'REQUEST_KEY_REUSED'; end if;
  return existing.result;
 end if;
 if p_data ? 'amount' then
  amount:=(p_data->>'amount')::numeric;
  if amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<0 or amount>999999999999.99 or amount<>round(amount,2) then raise exception 'INVALID_AMOUNT'; end if;
 end if;
 if p_action='create_account' then
  if coalesce(p_data->>'kind','bank') not in ('bank','cash','ewallet') or amount is null then raise exception 'INVALID_ACCOUNT'; end if;
  insert into public.accounts(owner_id,name,kind,opening_balance) values(uid,btrim(p_data->>'name'),coalesce(p_data->>'kind','bank'),amount) returning id into entity_id;
 elsif p_action='create_envelope' then
  if coalesce(p_data->>'rollover','none') not in ('none','positive','full') then raise exception 'INVALID_ROLLOVER'; end if;
  insert into public.envelopes(owner_id,name,rollover_mode) values(uid,btrim(p_data->>'name'),coalesce(p_data->>'rollover','none')) returning id into entity_id;
 elsif p_action='open_month' then
  d:=(p_data->>'month')::date;
  if d is null then raise exception 'INVALID_MONTH'; end if;
  perform moneyspace_private.ensure_month(uid,d);
 elsif p_action='allocate' then
  d:=(p_data->>'month')::date;envelope_id:=(p_data->>'envelope_id')::uuid;
  if d is null or amount is null or not exists(select 1 from public.envelopes e where e.id=envelope_id and e.owner_id=uid and e.household_id is null and e.deleted_at is null) then raise exception 'INVALID_ENVELOPE' using errcode='42501'; end if;
  perform moneyspace_private.ensure_month(uid,d);
  select id into period_id from public.budget_periods where owner_id=uid and household_id is null and month_start=d;
  insert into public.budget_allocations(owner_id,budget_period_id,envelope_id,amount) values(uid,period_id,envelope_id,amount) on conflict on constraint budget_allocations_budget_period_id_envelope_id_key do update set amount=excluded.amount;
 elsif p_action='link_category' then
  category_id:=(p_data->>'category_id')::uuid;envelope_id:=nullif(p_data->>'envelope_id','')::uuid;
  if envelope_id is not null and not exists(select 1 from public.envelopes e where e.id=envelope_id and e.owner_id=uid and e.household_id is null and e.deleted_at is null) then raise exception 'INVALID_ENVELOPE' using errcode='42501'; end if;
  update public.categories set default_envelope_id=envelope_id where id=category_id and owner_id=uid and deleted_at is null;
  if not found then raise exception 'INVALID_CATEGORY' using errcode='42501'; end if;
 elsif p_action in ('add_transaction','edit_transaction','delete_transaction') then
  if p_action<>'add_transaction' then
   select * into old_tx from public.transactions where id=(p_data->>'id')::uuid and owner_id=uid and household_id is null and deleted_at is null for update;
   if not found then raise exception 'TRANSACTION_NOT_FOUND' using errcode='42501'; end if;
   if old_tx.updated_at is distinct from (p_data->>'version')::timestamptz then raise exception 'STALE_VERSION'; end if;
   if old_tx.kind='settlement' or exists(select 1 from public.transactions t where t.refund_of_id=old_tx.id and t.deleted_at is null) or exists(select 1 from public.goal_contributions c where c.transaction_id=old_tx.id and c.deleted_at is null) then raise exception 'LINKED_TRANSACTION'; end if;
   if p_action='edit_transaction' and old_tx.kind='refund' then raise exception 'REFUND_DELETE_AND_RECREATE'; end if;
  end if;
  if p_action='delete_transaction' then
   update public.transactions set deleted_at=clock_timestamp() where id=old_tx.id returning id into entity_id;
  else
   k:=p_data->>'kind'; account_id:=(p_data->>'account_id')::uuid;destination_id:=nullif(p_data->>'destination_id','')::uuid;
   category_id:=nullif(p_data->>'category_id','')::uuid;d:=(p_data->>'date')::date;
   if k not in ('income','expense','transfer','refund') or k is null or amount is null or amount<=0 or d is null or d<'2000-01-01'::date or d>timezone('Asia/Bangkok',now())::date then raise exception 'INVALID_TRANSACTION'; end if;
   if not exists(select 1 from public.accounts a where a.id=account_id and a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null) then raise exception 'INVALID_ACCOUNT' using errcode='42501'; end if;
   if k='transfer' then
    if destination_id is null or destination_id=account_id or not exists(select 1 from public.accounts a where a.id=destination_id and a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null) then raise exception 'INVALID_DESTINATION' using errcode='42501'; end if;
    category_id:=null;envelope_id:=null;
   else
    if destination_id is not null then raise exception 'INVALID_DESTINATION'; end if;
    if category_id is not null then
     select * into cat from public.categories c where c.id=category_id and c.owner_id=uid and c.deleted_at is null;
     if not found then raise exception 'INVALID_CATEGORY' using errcode='42501'; end if;
    end if;
    if k='expense' and category_id is null then raise exception 'CATEGORY_REQUIRED'; end if;
    envelope_id:=case when p_data ? 'envelope_id' then nullif(p_data->>'envelope_id','')::uuid else cat.default_envelope_id end;
    if k='income' then envelope_id:=null;category_id:=null; end if;
    if envelope_id is not null and not exists(select 1 from public.envelopes e where e.id=envelope_id and e.owner_id=uid and e.household_id is null and e.deleted_at is null) then raise exception 'INVALID_ENVELOPE' using errcode='42501'; end if;
   end if;
   if k='refund' then
    if p_action<>'add_transaction' then raise exception 'INVALID_REFUND'; end if;
    select * into original from public.transactions t where t.id=(p_data->>'refund_of_id')::uuid and t.owner_id=uid and t.household_id is null and t.kind='expense' and t.deleted_at is null;
    if not found or original.account_id<>account_id or d<original.occurred_on then raise exception 'INVALID_REFUND'; end if;
    if amount+coalesce((select sum(t.amount) from public.transactions t where t.refund_of_id=original.id and t.deleted_at is null),0)>original.amount then raise exception 'REFUND_EXCEEDS_EXPENSE'; end if;
    category_id:=original.category_id;envelope_id:=original.envelope_id;
   end if;
   label:=coalesce(nullif(btrim(p_data->>'merchant'),''),cat.name,case k when 'income' then 'รายรับ' when 'transfer' then 'โอนเงิน' when 'refund' then 'คืนเงิน' else 'รายจ่าย' end);
   perform moneyspace_private.ensure_month(uid,date_trunc('month',d)::date);
   if p_action='edit_transaction' then
    if k<>old_tx.kind then raise exception 'TYPE_CHANGE_NOT_ALLOWED'; end if;
    update public.transactions set account_id=write_finances.account_id,destination_account_id=destination_id,category_id=write_finances.category_id,envelope_id=write_finances.envelope_id,amount=write_finances.amount,merchant=label,notes=p_data->>'notes',tag=case when k='expense' then coalesce(p_data->>'tag',cat.default_tag,'need') else null end,occurred_on=d where id=old_tx.id returning id into entity_id;
   else
    insert into public.transactions(owner_id,account_id,destination_account_id,kind,amount,category_id,envelope_id,merchant,notes,tag,occurred_on,refund_of_id,idempotency_key)
    values(uid,account_id,destination_id,k,amount,category_id,envelope_id,label,p_data->>'notes',case when k='expense' then coalesce(p_data->>'tag',cat.default_tag,'need') else null end,d,case when k='refund' then original.id else null end,p_key) returning id into entity_id;
   end if;
  end if;
 elsif p_action='create_goal' then
  if amount is null or amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.goals(owner_id,name,target_amount,target_date) values(uid,btrim(p_data->>'name'),amount,nullif(p_data->>'date','')::date) returning id into entity_id;
 elsif p_action='earmark_goal' then
  goal_id:=(p_data->>'goal_id')::uuid;account_id:=(p_data->>'account_id')::uuid;
  if amount is null or amount<=0 or not exists(select 1 from public.goals g where g.id=goal_id and g.owner_id=uid and g.household_id is null and g.deleted_at is null) then raise exception 'INVALID_GOAL' using errcode='42501'; end if;
  if not exists(select 1 from public.accounts a where a.id=account_id and a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null) then raise exception 'INVALID_ACCOUNT' using errcode='42501'; end if;
  insert into public.goal_contributions(owner_id,goal_id,account_id,amount,kind) values(uid,goal_id,account_id,amount,'earmark') returning id into entity_id;
 elsif p_action='release_goal' then
  update public.goal_contributions set deleted_at=clock_timestamp() where id=(p_data->>'id')::uuid and owner_id=uid and kind='earmark' and deleted_at is null returning id into entity_id;
  if not found then raise exception 'INVALID_CONTRIBUTION' using errcode='42501'; end if;
 else raise exception 'UNKNOWN_ACTION';
 end if;
 perform moneyspace_private.rollovers(uid);
 -- Never spend earmarked savings, overdraw a physical account or reserve nonexistent money.
 if exists(select 1 from public.accounts a where a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null and moneyspace_private.balance(uid,a.id)<coalesce((select sum(c.amount) from public.goal_contributions c where c.owner_id=uid and c.account_id=a.id and c.deleted_at is null),0)) then raise exception 'ACCOUNT_FUNDS_RESERVED_OR_INSUFFICIENT'; end if;
 if moneyspace_private.unallocated(uid)<0 then raise exception 'INSUFFICIENT_UNALLOCATED'; end if;
 if (select coalesce(sum(moneyspace_private.balance(uid,a.id)),0) from public.accounts a where a.owner_id=uid and a.household_id is null and a.deleted_at is null)>90071992547409.91 then raise exception 'TOTAL_LIMIT_EXCEEDED'; end if;
 result:=jsonb_build_object('id',entity_id,'action',p_action,'confirmed',true);
 insert into moneyspace_private.financial_requests(owner_id,request_key,action,payload,result) values(uid,p_key,p_action,p_data,result);
 return result;
end $$;
revoke all on function moneyspace_private.write_finances(text,jsonb,uuid) from public,anon;
grant execute on function moneyspace_private.write_finances(text,jsonb,uuid) to authenticated;
create function public.moneyspace_write(p_action text,p_data jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select moneyspace_private.write_finances(p_action,p_data,p_key)$$;
revoke all on function public.moneyspace_write(text,jsonb,uuid) from public,anon;
grant execute on function public.moneyspace_write(text,jsonb,uuid) to authenticated;

-- Close the old direct INSERT route. Onboarding uses its own checked private function.
revoke insert(owner_id,name,kind,opening_balance) on public.accounts from authenticated;
create function moneyspace_private.onboard(p_display_name text,p_account_name text,p_opening_balance numeric) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item record;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_opening_balance is null or p_opening_balance::text in ('NaN','Infinity','-Infinity') or p_opening_balance<0 or p_opening_balance>999999999999.99 or p_opening_balance<>round(p_opening_balance,2) then raise exception 'Invalid balance'; end if;
 insert into public.profiles(id,display_name) values(uid,btrim(p_display_name)) on conflict(id) do nothing;
 perform 1 from public.profiles where id=uid for update;
 if exists(select 1 from public.profiles where id=uid and onboarding_completed_at is not null) then return; end if;
 insert into public.accounts(owner_id,name,opening_balance) values(uid,btrim(p_account_name),p_opening_balance);
 for item in select * from (values('อาหาร','🍜','need'),('เครื่องดื่ม','☕','want'),('เดินทาง','🚆','need'),('ช้อปปิ้ง','🛍️','want'),('บิลและบ้าน','🏠','need'),('สุขภาพ','🌿','need')) as x(name,icon,tag) loop
  insert into public.categories(owner_id,name,icon,default_tag) values(uid,item.name,item.icon,item.tag) on conflict do nothing;
 end loop;
 update public.profiles set onboarding_completed_at=now() where id=uid;
end $$;
revoke all on function moneyspace_private.onboard(text,text,numeric) from public,anon;
grant execute on function moneyspace_private.onboard(text,text,numeric) to authenticated;
create or replace function public.complete_onboarding(p_display_name text,p_account_name text,p_opening_balance numeric default 0) returns void language sql security invoker set search_path='' as $$select moneyspace_private.onboard(p_display_name,p_account_name,p_opening_balance)$$;

-- Read-only projections respect the caller's RLS. Numeric values cross the API as strings.
create view public.personal_account_balances with(security_invoker=true) as
select a.id,a.owner_id,a.name,a.kind,a.opening_balance,
a.opening_balance+coalesce((select sum(case when t.account_id=a.id then case when t.kind in ('income','refund') then t.amount else -t.amount end else t.amount end) from public.transactions t where t.owner_id=a.owner_id and t.household_id is null and t.deleted_at is null and (t.account_id=a.id or t.destination_account_id=a.id)),0) as balance
from public.accounts a where a.household_id is null and a.deleted_at is null;
revoke all on public.personal_account_balances from public,anon;
grant select on public.personal_account_balances to authenticated;
create function public.moneyspace_snapshot(p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date then raise exception 'INVALID_MONTH'; end if;
 select jsonb_build_object(
 'month',p_month,
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
