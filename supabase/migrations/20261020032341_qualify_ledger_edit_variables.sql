create or replace function moneyspace_private.write_finances(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
<<op>>
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
    update public.transactions set account_id=op.account_id,destination_account_id=destination_id,category_id=op.category_id,envelope_id=op.envelope_id,amount=op.amount,merchant=label,notes=p_data->>'notes',tag=case when k='expense' then coalesce(p_data->>'tag',cat.default_tag,'need') else null end,occurred_on=d where id=old_tx.id returning id into entity_id;
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
