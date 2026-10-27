begin;
-- Retire bill/template commands without deleting real expenses, receipts or audit history.
create or replace function moneyspace_private.write_finances(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
<<op>>
declare uid uuid:=auth.uid(); existing moneyspace_private.financial_requests%rowtype; result jsonb;
 amount numeric; account_id uuid; destination_id uuid; category_id uuid; envelope_id uuid; entity_id uuid; period_id uuid; goal_id uuid;
 monthly_plan public.monthly_cashflow_plans%rowtype; income_item jsonb; income_total numeric:=0; normalized_incomes jsonb:='[]'::jsonb;
 d date; k text; old_tx public.transactions%rowtype; original public.transactions%rowtype; cat public.categories%rowtype; label text; plan_item jsonb; plan_amount numeric; plan_category uuid; plan_name text; plan_group text;
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
 -- Advance the calendar before any funding decision, including earmarks.
 perform moneyspace_private.ensure_month(uid,date_trunc('month',timezone('Asia/Bangkok',now()))::date);
 if p_data ? 'amount' then
  amount:=(p_data->>'amount')::numeric;
  if amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<0 or amount>999999999999.99 or amount<>round(amount,2) then raise exception 'INVALID_AMOUNT'; end if;
 end if;
 if p_action in ('create_bill','update_bill','stop_bill','pay_bill','create_template','update_template','delete_template') then
  raise exception 'FEATURE_REMOVED';
 elsif p_action='pin_category' then
  select * into cat from public.categories c where c.id=(p_data->>'category_id')::uuid and c.owner_id=uid and c.deleted_at is null for update;
  if not found then raise exception 'INVALID_CATEGORY' using errcode='42501';end if;
  if cat.updated_at is distinct from (p_data->>'version')::timestamptz then raise exception 'STALE_VERSION';end if;
  if jsonb_typeof(p_data->'favorite') is distinct from 'boolean' then raise exception 'INVALID_CATEGORY';end if;
  update public.categories set is_favorite=(p_data->>'favorite')::boolean where id=cat.id returning id into entity_id;
 elsif p_action in ('set_salary','receive_salary') then
  raise exception 'FEATURE_REMOVED';
 elsif p_action='save_month_plan' then
  d:=(p_data->>'month')::date;
  if d is null or d<>date_trunc('month',d)::date or d<'2000-01-01'::date or d>date_trunc('month',timezone('Asia/Bangkok',now()))::date then raise exception 'INVALID_MONTH';end if;
  select * into monthly_plan from public.monthly_cashflow_plans where owner_id=uid and month_start=d for update;
  if (found and monthly_plan.updated_at is distinct from nullif(p_data->>'version','')::timestamptz) or (not found and nullif(p_data->>'version','') is not null) then raise exception 'STALE_VERSION';end if;
  if jsonb_typeof(p_data->'incomes') is distinct from 'array' then raise exception 'INVALID_MONTH_PLAN';end if;
  if jsonb_array_length(p_data->'incomes')>20 or amount is null then raise exception 'INVALID_MONTH_PLAN';end if;
  for income_item in select value from jsonb_array_elements(p_data->'incomes') loop
   if jsonb_typeof(income_item) is distinct from 'object' or coalesce(income_item->>'name','')='' or char_length(btrim(income_item->>'name')) not between 1 and 60 or jsonb_typeof(income_item->'amount') is distinct from 'string' or coalesce(income_item->>'amount','') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'INVALID_MONTH_PLAN';end if;
   plan_amount:=(income_item->>'amount')::numeric;
   if plan_amount>999999999999.99 then raise exception 'INVALID_AMOUNT';end if;
   normalized_incomes:=normalized_incomes||jsonb_build_array(jsonb_build_object('name',btrim(income_item->>'name'),'amount',plan_amount::text));
   income_total:=income_total+plan_amount;
  end loop;
  if income_total>90071992547409.91 then raise exception 'TOTAL_LIMIT_EXCEEDED';end if;
  insert into public.monthly_cashflow_plans(owner_id,month_start,incomes,savings_target) values(uid,d,normalized_incomes,amount)
  on conflict(owner_id,month_start) do update set incomes=excluded.incomes,savings_target=excluded.savings_target returning id into entity_id;
 elsif p_action='setup_plan' then
  if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')>12 then raise exception 'INVALID_PLAN';end if;
  for plan_item in select value from jsonb_array_elements(p_data->'items') loop
   plan_name:=normalize(btrim(plan_item->>'name'),NFC);plan_group:=coalesce(plan_item->>'group','other');plan_amount:=(plan_item->>'amount')::numeric;
   if plan_name is null or char_length(plan_name) not between 1 and 40 or plan_group not in ('food','drink','other') or plan_amount is null or plan_amount::text in ('NaN','Infinity','-Infinity') or plan_amount<0 or plan_amount>999999999999.99 or plan_amount<>round(plan_amount,2) then raise exception 'INVALID_PLAN';end if;
   if exists(select 1 from public.envelopes e where e.owner_id=uid and e.household_id is null and e.deleted_at is null and lower(normalize(btrim(e.name),NFC))=lower(plan_name)) then raise exception 'PLAN_ALREADY_EXISTS';end if;
   select c.id into plan_category from public.categories c where c.owner_id=uid and c.deleted_at is null and lower(normalize(btrim(c.name),NFC))=lower(plan_name);
   if found then
    if exists(select 1 from public.categories c where c.id=plan_category and c.default_envelope_id is not null) then raise exception 'CATEGORY_ALREADY_BUDGETED';end if;
   else
    insert into public.categories(owner_id,name,icon,default_tag,spending_group) values(uid,plan_name,coalesce(nullif(plan_item->>'icon',''),'✳️'),case when plan_item->>'tag'='want' then 'want' else 'need' end,plan_group) returning id into plan_category;
   end if;
   insert into public.envelopes(owner_id,name,rollover_mode,monthly_target) values(uid,plan_name,'none',plan_amount) returning id into entity_id;
   update public.categories c set default_envelope_id=entity_id where c.id=plan_category;
  end loop;
  if nullif(p_data->>'goal_amount','') is not null then
   plan_amount:=(p_data->>'goal_amount')::numeric;
   if plan_amount::text in ('NaN','Infinity','-Infinity') or plan_amount<=0 or plan_amount>999999999999.99 or plan_amount<>round(plan_amount,2) then raise exception 'INVALID_AMOUNT';end if;
   if exists(select 1 from public.goals g where g.owner_id=uid and g.household_id is null and g.deleted_at is null and g.name='เงินเก็บ') then raise exception 'PLAN_ALREADY_EXISTS';end if;
   insert into public.goals(owner_id,name,target_amount) values(uid,'เงินเก็บ',plan_amount) returning id into entity_id;
  end if;
  if jsonb_array_length(p_data->'items')=0 and nullif(p_data->>'goal_amount','') is null then raise exception 'INVALID_PLAN';end if;
 elsif p_action='create_account' then
  raise exception 'SINGLE_MONEY_LOG';
 elsif p_action='create_envelope' then
  if amount is null then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.envelopes(owner_id,name,rollover_mode,monthly_target) values(uid,btrim(p_data->>'name'),'none',amount) returning id into entity_id;
  envelope_id:=entity_id;
 elsif p_action='open_month' then
  d:=(p_data->>'month')::date;
  if d is null then raise exception 'INVALID_MONTH'; end if;
  perform moneyspace_private.ensure_month(uid,d);
 elsif p_action='allocate' then
  d:=(p_data->>'month')::date;envelope_id:=(p_data->>'envelope_id')::uuid;
  if d is null or amount is null or not exists(select 1 from public.envelopes e where e.id=envelope_id and e.owner_id=uid and e.household_id is null and e.deleted_at is null) then raise exception 'INVALID_ENVELOPE' using errcode='42501'; end if;
  if p_data ? 'version' and not exists(select 1 from public.envelopes e where e.id=op.envelope_id and e.updated_at=(p_data->>'version')::timestamptz) then raise exception 'STALE_VERSION';end if;
  if p_data ? 'name' then update public.envelopes e set name=btrim(p_data->>'name') where e.id=op.envelope_id;end if;
  perform moneyspace_private.ensure_month(uid,d);
  select id into period_id from public.budget_periods where owner_id=uid and household_id is null and month_start=d;
  insert into public.budget_allocations(owner_id,budget_period_id,envelope_id,amount) values(uid,period_id,envelope_id,amount) on conflict on constraint budget_allocations_budget_period_id_envelope_id_key do update set amount=excluded.amount;
  -- Editing a historical month is an override; current-month edits set the recurring target.
  if d=date_trunc('month',timezone('Asia/Bangkok',now()))::date then
   update public.envelopes e set monthly_target=op.amount where e.id=op.envelope_id;
  end if;
 elsif p_action='delete_envelope' then
  envelope_id:=(p_data->>'envelope_id')::uuid;
  perform 1 from public.envelopes e where e.id=op.envelope_id and e.owner_id=uid and e.household_id is null and e.deleted_at is null and e.updated_at=(p_data->>'version')::timestamptz for update;
  if not found then raise exception 'STALE_VERSION';end if;
  update public.categories c set default_envelope_id=null where c.owner_id=uid and c.default_envelope_id=op.envelope_id;
  update public.envelopes e set deleted_at=clock_timestamp() where e.id=op.envelope_id;
  entity_id:=envelope_id;
 elsif p_action in ('update_category','delete_category') then
  category_id:=(p_data->>'category_id')::uuid;
  select * into cat from public.categories c where c.id=op.category_id and c.owner_id=uid and c.deleted_at is null for update;
  if not found then raise exception 'INVALID_CATEGORY' using errcode='42501';end if;
  if cat.updated_at is distinct from (p_data->>'version')::timestamptz then raise exception 'STALE_VERSION';end if;
  if p_action='delete_category' then
   update public.categories c set deleted_at=clock_timestamp(),default_envelope_id=null where c.id=op.category_id;
  else
   if nullif(btrim(p_data->>'name'),'') is null or char_length(btrim(p_data->>'name'))>40 or nullif(btrim(p_data->>'icon'),'') is null or char_length(p_data->>'icon')>12 then raise exception 'INVALID_CATEGORY';end if;
   if exists(select 1 from public.categories c where c.owner_id=uid and c.deleted_at is null and c.id<>op.category_id and lower(normalize(btrim(c.name),NFC))=lower(normalize(btrim(p_data->>'name'),NFC))) then raise exception 'CATEGORY_NAME_EXISTS';end if;
   if p_data ? 'spending_group' and coalesce(p_data->>'spending_group','') not in ('food','drink','other') then raise exception 'INVALID_CATEGORY';end if;
   if p_data ? 'tag' and coalesce(p_data->>'tag','') not in ('need','want') then raise exception 'INVALID_CATEGORY';end if;
   update public.categories c set default_tag=coalesce(p_data->>'tag',c.default_tag),name=normalize(btrim(p_data->>'name'),NFC),icon=btrim(p_data->>'icon'),spending_group=case when p_data ? 'spending_group' then p_data->>'spending_group' when p_data->>'food_drink'='false' then 'other' when p_data->>'food_drink'='true' and c.spending_group='other' then case when c.name ~* 'เครื่องดื่ม|กาแฟ|drink|coffee|tea' then 'drink' else 'food' end else c.spending_group end,is_food_drink=case when p_data ? 'spending_group' then p_data->>'spending_group'<>'other' else coalesce((p_data->>'food_drink')::boolean,c.is_food_drink) end where c.id=op.category_id;
  end if;
  entity_id:=category_id;
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
   k:=p_data->>'kind'; account_id:=coalesce(nullif(p_data->>'account_id','')::uuid,(select a.id from public.accounts a where a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null order by a.created_at,a.id limit 1));destination_id:=nullif(p_data->>'destination_id','')::uuid;
   category_id:=nullif(p_data->>'category_id','')::uuid;d:=(p_data->>'date')::date;
   if k='transfer' then raise exception 'SINGLE_MONEY_LOG'; end if;
   if k not in ('income','expense','refund') or k is null or amount is null or amount<=0 or d is null or d<'2000-01-01'::date or d>timezone('Asia/Bangkok',now())::date then raise exception 'INVALID_TRANSACTION'; end if;
   if not exists(select 1 from public.accounts a where a.id=account_id and a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null) then raise exception 'INVALID_ACCOUNT' using errcode='42501'; end if;
   if k='transfer' then
    if destination_id is null or destination_id=account_id or not exists(select 1 from public.accounts a where a.id=destination_id and a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null) then raise exception 'INVALID_DESTINATION' using errcode='42501'; end if;
    category_id:=null;envelope_id:=null;
   else
    if destination_id is not null then raise exception 'INVALID_DESTINATION'; end if;
    if category_id is not null then
     select * into cat from public.categories c where c.id=category_id and c.owner_id=uid and (c.deleted_at is null or (p_action='edit_transaction' and old_tx.category_id=op.category_id));
     if not found then raise exception 'INVALID_CATEGORY' using errcode='42501'; end if;
    end if;
    if k='expense' and category_id is null then raise exception 'CATEGORY_REQUIRED'; end if;
    envelope_id:=case when p_data ? 'envelope_id' then nullif(p_data->>'envelope_id','')::uuid else cat.default_envelope_id end;
    if k='income' then envelope_id:=null;category_id:=null; end if;
    if envelope_id is not null and not exists(select 1 from public.envelopes e where e.id=envelope_id and e.owner_id=uid and e.household_id is null and (e.deleted_at is null or (p_action='edit_transaction' and old_tx.envelope_id=op.envelope_id))) then raise exception 'INVALID_ENVELOPE' using errcode='42501'; end if;
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
    update public.transactions set account_id=op.account_id,destination_account_id=destination_id,category_id=op.category_id,envelope_id=op.envelope_id,amount=op.amount,merchant=label,notes=p_data->>'notes',tag=case when k='expense' then coalesce(p_data->>'tag',old_tx.tag,cat.default_tag,'need') else null end,occurred_on=d where id=old_tx.id returning id into entity_id;
   else
    insert into public.transactions(owner_id,account_id,destination_account_id,kind,amount,category_id,envelope_id,merchant,notes,tag,occurred_on,refund_of_id,idempotency_key)
    values(uid,account_id,destination_id,k,amount,category_id,envelope_id,label,p_data->>'notes',case when k='expense' then coalesce(p_data->>'tag',cat.default_tag,'need') else null end,d,case when k='refund' then original.id else null end,p_key) returning id into entity_id;
   end if;
  end if;
 elsif p_action='create_goal' then
  if amount is null or amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.goals(owner_id,name,target_amount,target_date) values(uid,btrim(p_data->>'name'),amount,nullif(p_data->>'date','')::date) returning id into entity_id;
 elsif p_action in ('update_goal','delete_goal') then
  goal_id:=(p_data->>'goal_id')::uuid;
  perform 1 from public.goals g where g.id=op.goal_id and g.owner_id=uid and g.household_id is null and g.deleted_at is null for update;
  if not found then raise exception 'INVALID_GOAL' using errcode='42501';end if;
  if not exists(select 1 from public.goals g where g.id=op.goal_id and g.updated_at=(p_data->>'version')::timestamptz) then raise exception 'STALE_VERSION';end if;
  if p_action='delete_goal' then
   if exists(select 1 from public.goal_contributions c where c.goal_id=op.goal_id and c.owner_id=uid and c.deleted_at is null and c.kind<>'earmark') then raise exception 'LINKED_TRANSACTION';end if;
   update public.goal_contributions c set deleted_at=clock_timestamp() where c.goal_id=op.goal_id and c.owner_id=uid and c.deleted_at is null and c.kind='earmark';
   update public.goals g set deleted_at=clock_timestamp() where g.id=op.goal_id;
  else
   if amount is null or amount<=0 then raise exception 'INVALID_AMOUNT';end if;
   update public.goals g set name=btrim(p_data->>'name'),target_amount=op.amount,target_date=nullif(p_data->>'date','')::date where g.id=op.goal_id;
  end if;
  entity_id:=goal_id;
 elsif p_action='earmark_goal' then
  goal_id:=(p_data->>'goal_id')::uuid;account_id:=coalesce(nullif(p_data->>'account_id','')::uuid,(select a.id from public.accounts a where a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null order by a.created_at,a.id limit 1));
  if amount is null or amount<=0 or not exists(select 1 from public.goals g where g.id=goal_id and g.owner_id=uid and g.household_id is null and g.deleted_at is null) then raise exception 'INVALID_GOAL' using errcode='42501'; end if;
  if not exists(select 1 from public.accounts a where a.id=account_id and a.owner_id=uid and a.household_id is null and a.kind<>'debt' and a.deleted_at is null) then raise exception 'INVALID_ACCOUNT' using errcode='42501'; end if;
  insert into public.goal_contributions(owner_id,goal_id,account_id,amount,kind) values(uid,goal_id,account_id,amount,'earmark') returning id into entity_id;
  update public.goals g set updated_at=clock_timestamp() where g.id=op.goal_id;
 elsif p_action='release_goal' then
  update public.goal_contributions c set deleted_at=clock_timestamp() where c.id=(p_data->>'id')::uuid and c.owner_id=uid and c.kind='earmark' and c.deleted_at is null returning c.id,c.goal_id into entity_id,goal_id;
  if not found then raise exception 'INVALID_CONTRIBUTION' using errcode='42501'; end if;
  update public.goals g set updated_at=clock_timestamp() where g.id=op.goal_id;
 else raise exception 'UNKNOWN_ACTION';
 end if;
 if p_action in ('create_envelope','allocate') and p_data ? 'cadence' then
  if coalesce(p_data->>'cadence','') not in ('daily','bill','flexible') then raise exception 'INVALID_CADENCE';end if;
  update public.envelopes e set spending_cadence=p_data->>'cadence' where e.id=op.envelope_id and e.owner_id=uid;
 end if;
 if p_action in ('create_envelope','allocate') then
  if p_data ? 'color' and (p_data->>'color' is null or p_data->>'color' !~ '^#[0-9a-fA-F]{6}$') then raise exception 'INVALID_POCKET_STYLE';end if;
  if p_data ? 'pocket_icon' and (p_data->>'pocket_icon' is null or char_length(btrim(p_data->>'pocket_icon')) not between 1 and 12) then raise exception 'INVALID_POCKET_STYLE';end if;
  if p_data ? 'cover' and coalesce(p_data->>'cover','') not in ('waves','dots','leaves','plain') then raise exception 'INVALID_POCKET_STYLE';end if;
  if p_data ?| array['color','pocket_icon','cover'] then
   update public.envelopes e set color=case when p_data ? 'color' then p_data->>'color' else e.color end,icon=case when p_data ? 'pocket_icon' then btrim(p_data->>'pocket_icon') else e.icon end,cover=case when p_data ? 'cover' then p_data->>'cover' else e.cover end where e.id=op.envelope_id and e.owner_id=uid;
  end if;
 end if;
 if p_action in ('create_envelope','allocate') and p_data ? 'category_ids' then
  if jsonb_typeof(p_data->'category_ids')<>'array' then raise exception 'INVALID_CATEGORY'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_data->'category_ids') x(id) where not exists(select 1 from public.categories c where c.id=x.id::uuid and c.owner_id=uid and c.deleted_at is null)) then raise exception 'INVALID_CATEGORY' using errcode='42501'; end if;
  update public.categories c set default_envelope_id=null where c.owner_id=uid and c.default_envelope_id=op.envelope_id;
  update public.categories c set default_envelope_id=op.envelope_id where c.owner_id=uid and c.id in(select x::uuid from jsonb_array_elements_text(p_data->'category_ids') x);
 end if;
 perform moneyspace_private.rollovers(uid);
 -- Budgets are targets, never reserves. Truthful expenses may make the log negative.
 -- New savings earmarks must be backed by tracked money, independent of budgets.
 if p_action='earmark_goal' and moneyspace_private.unallocated(uid)<0 then raise exception 'SAVINGS_EXCEED_MONEY'; end if;
 if abs((select coalesce(sum(moneyspace_private.balance(uid,a.id)),0) from public.accounts a where a.owner_id=uid and a.household_id is null and a.deleted_at is null))>90071992547409.91 then raise exception 'TOTAL_LIMIT_EXCEEDED'; end if;
 result:=jsonb_build_object('id',entity_id,'action',p_action,'confirmed',true);
 insert into moneyspace_private.financial_requests(owner_id,request_key,action,payload,result) values(uid,p_key,p_action,p_data,result);
 return result;
end $$;


create or replace function public.moneyspace_snapshot(p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date then raise exception 'INVALID_MONTH'; end if;
 select jsonb_build_object(
 'month',p_month,
 'cash',coalesce((select sum(a.balance) from public.personal_account_balances a where a.owner_id=uid and a.kind<>'debt'),0)::text,
 'savings',coalesce((select sum(c.amount) from public.goal_contributions c where c.owner_id=uid and c.deleted_at is null),0)::text,
 'savings_change',coalesce((select sum(case when timezone('Asia/Bangkok',c.created_at)::date>=p_month and timezone('Asia/Bangkok',c.created_at)::date<(p_month+interval '1 month')::date then c.amount else 0 end - case when timezone('Asia/Bangkok',c.deleted_at)::date>=p_month and timezone('Asia/Bangkok',c.deleted_at)::date<(p_month+interval '1 month')::date then c.amount else 0 end) from public.goal_contributions c where c.owner_id=uid),0)::text,
 'current_period_exists',exists(select 1 from public.budget_periods where owner_id=uid and household_id is null and month_start=date_trunc('month',timezone('Asia/Bangkok',now()))::date),
 'period_exists',exists(select 1 from public.budget_periods where owner_id=uid and household_id is null and month_start=p_month),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'kind',a.kind,'balance',a.balance::text,'opening_balance',a.opening_balance::text) order by a.id) from public.personal_account_balances a where a.owner_id=uid),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'icon',c.icon,'favorite',c.is_favorite,'tag',c.default_tag,'updated_at',c.updated_at,'foodDrink',c.is_food_drink,'spendingGroup',c.spending_group,'envelope',c.default_envelope_id) order by c.created_at) from public.categories c where c.owner_id=uid and c.deleted_at is null),'[]'::jsonb),
 'envelopes',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'updated_at',e.updated_at,'color',e.color,'icon',e.icon,'cover',e.cover,'cadence',e.spending_cadence,'monthly_target',e.monthly_target::text,'rollover','none','allocated',coalesce(b.amount,0)::text,'carried',coalesce(b.rollover_amount,0)::text,'spent',coalesce(s.spent,0)::text,'remaining',(coalesce(b.amount,0)+coalesce(b.rollover_amount,0)-coalesce(s.spent,0))::text) order by e.created_at)
 from public.envelopes e left join public.budget_periods p on p.owner_id=uid and p.household_id is null and p.month_start=p_month left join public.budget_allocations b on b.budget_period_id=p.id and b.envelope_id=e.id left join lateral(select sum(case when t.kind='expense' then t.amount when t.kind='refund' then -t.amount else 0 end) spent from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.envelope_id=e.id and t.occurred_on>=p_month and t.occurred_on<(p_month+interval '1 month')::date) s on true where e.owner_id=uid and e.household_id is null and e.deleted_at is null),'[]'::jsonb),
 'income',coalesce((select sum(amount) from public.transactions where owner_id=uid and household_id is null and deleted_at is null and kind='income' and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date),0)::text,
 'monthly_plan',(select jsonb_build_object('month',p.month_start,'incomes',p.incomes,'savings_target',p.savings_target::text,'updated_at',p.updated_at) from public.monthly_cashflow_plans p where p.owner_id=uid and p.month_start=p_month),
 'previous_month_plan',(select jsonb_build_object('month',p.month_start,'incomes',p.incomes,'savings_target',p.savings_target::text,'updated_at',p.updated_at) from public.monthly_cashflow_plans p where p.owner_id=uid and p.month_start<p_month order by p.month_start desc limit 1),
 'expenses',coalesce((select sum(case when kind='expense' then amount when kind='refund' then -amount else 0 end) from public.transactions where owner_id=uid and household_id is null and deleted_at is null and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date),0)::text,
 'goals',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'updated_at',g.updated_at,'target_date',g.target_date,'target',g.target_amount::text,'saved',coalesce(s.saved,0)::text) order by g.created_at) from public.goals g left join lateral(select sum(c.amount) saved from public.goal_contributions c where c.owner_id=uid and c.goal_id=g.id and c.deleted_at is null) s on true where g.owner_id=uid and g.household_id is null and g.deleted_at is null),'[]'::jsonb),
 'contributions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'goal_id',c.goal_id,'goal_name_snapshot',c.goal_name_snapshot,'account_id',c.account_id,'amount',c.amount::text) order by c.created_at desc) from public.goal_contributions c where c.owner_id=uid and c.deleted_at is null),'[]'::jsonb),
 'transaction_count',(select count(*) from public.transactions where owner_id=uid and household_id is null and deleted_at is null and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date),
 'transactions',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_on desc,x.created_at desc) from (select id,account_id,destination_account_id,kind,amount::text,category_id,category_name_snapshot,category_icon_snapshot,food_drink_snapshot,spending_group_snapshot,envelope_id,envelope_name_snapshot,merchant,notes,tag,occurred_on,refund_of_id,updated_at,created_at from public.transactions where owner_id=uid and household_id is null and deleted_at is null and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date order by occurred_on desc,created_at desc limit 100) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.moneyspace_snapshot(date) from public,anon;
grant execute on function public.moneyspace_snapshot(date) to authenticated;




revoke execute on function public.moneyspace_bill_status(date),public.moneyspace_bill_candidates(uuid,date) from authenticated,anon,public;
revoke select on public.expense_templates,public.bill_payments from authenticated,anon,public;

-- One explicitly provisioned pair; no member discovery, arbitrary user IDs, or raw-ledger sharing API.
create table moneyspace_private.comparison_links (
 id uuid primary key default gen_random_uuid(),user_a uuid not null unique references public.profiles(id) on delete restrict,user_b uuid not null unique references public.profiles(id) on delete restrict,
 share_a boolean not null default false,share_b boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default clock_timestamp(),check(user_a<>user_b)
);
create unique index comparison_pair_unique on moneyspace_private.comparison_links(least(user_a,user_b),greatest(user_a,user_b));
alter table moneyspace_private.comparison_links enable row level security;
revoke all on moneyspace_private.comparison_links from public,anon,authenticated;
create trigger audit_change after insert or update or delete on moneyspace_private.comparison_links for each row execute function moneyspace_private.audit_change();

-- Only these two pre-provisioned logins can be paired. The CI Auth stub has no email column.
do $$begin
 if exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email') then
 execute $seed$insert into moneyspace_private.comparison_links(user_a,user_b)
 select a.id,b.id from auth.users a join public.profiles pa on pa.id=a.id cross join auth.users b join public.profiles pb on pb.id=b.id
 where lower(a.email)='tape@moneyspace.invalid' and lower(b.email)='pat@moneyspace.invalid'
 on conflict do nothing$seed$;
 end if;
end $$;
create function moneyspace_private.set_comparison_consent(p_enabled boolean,p_version timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();pair moneyspace_private.comparison_links%rowtype;mine boolean;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_enabled is null then raise exception 'INVALID_CONSENT';end if;
 select * into pair from moneyspace_private.comparison_links where uid in (user_a,user_b) for update;
 if not found then raise exception 'COMPARISON_NOT_AVAILABLE' using errcode='42501';end if;
 mine:=case when uid=pair.user_a then pair.share_a else pair.share_b end;
 -- Uncertain-response retry is harmless; a stale enable cannot undo a later disable.
 if mine=p_enabled then return jsonb_build_object('confirmed',true);end if;
 if p_version is null or p_version<>pair.updated_at then raise exception 'STALE_VERSION';end if;
 update moneyspace_private.comparison_links set share_a=case when uid=pair.user_a then p_enabled else share_a end,share_b=case when uid=pair.user_b then p_enabled else share_b end,updated_at=clock_timestamp() where id=pair.id;
 return jsonb_build_object('confirmed',true);
end $$;
revoke all on function moneyspace_private.set_comparison_consent(boolean,timestamptz) from public,anon;grant execute on function moneyspace_private.set_comparison_consent(boolean,timestamptz) to authenticated;
create function public.moneyspace_comparison_consent(p_enabled boolean,p_version timestamptz) returns jsonb language sql security invoker set search_path='' as $$select moneyspace_private.set_comparison_consent(p_enabled,p_version)$$;
revoke all on function public.moneyspace_comparison_consent(boolean,timestamptz) from public,anon;grant execute on function public.moneyspace_comparison_consent(boolean,timestamptz) to authenticated;

-- This narrow definer is required to aggregate the peer's rows. Authorization is enforced
-- before reading transactions; only predefined members and reciprocal consent are accepted.
create function moneyspace_private.read_comparison(p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();pair moneyspace_private.comparison_links%rowtype;through date;today date:=timezone('Asia/Bangkok',now())::date;cm date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;status jsonb;people jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_month<'2000-01-01' or p_month>cm then raise exception 'INVALID_MONTH';end if;
 select * into pair from moneyspace_private.comparison_links where uid in (user_a,user_b);
 if not found then return jsonb_build_object('status','unavailable');end if;
 status:=jsonb_build_object('status',case when pair.share_a and pair.share_b then 'ready' else 'waiting' end,'mine_enabled',case when uid=pair.user_a then pair.share_a else pair.share_b end,'peer_enabled',case when uid=pair.user_a then pair.share_b else pair.share_a end,'version',pair.updated_at);
 if not (pair.share_a and pair.share_b) then return status;end if;
 through:=least(today,(p_month+interval '1 month'-interval '1 day')::date);
 with members as (select pair.user_a owner,'tape' key,'Tape' name union all select pair.user_b,'pat','Pat'),
 ledger as (
 select t.owner_id,t.occurred_on,
 sum(case when t.kind='expense' then t.amount else -t.amount end) net,
 sum(case when t.spending_group_snapshot='food' then case when t.kind='expense' then t.amount else -t.amount end else 0 end) food,
 sum(case when t.spending_group_snapshot='drink' then case when t.kind='expense' then t.amount else -t.amount end else 0 end) drink,
 count(*) filter(where t.kind='expense') expense_count,count(*) filter(where t.kind='refund') refund_count, count(*) filter(where t.kind='expense' and t.spending_group_snapshot='food') food_count,count(*) filter(where t.kind='expense' and t.spending_group_snapshot='drink') drink_count
 from public.transactions t where t.owner_id in (pair.user_a,pair.user_b) and t.household_id is null and t.deleted_at is null and t.kind in ('expense','refund') and t.occurred_on between p_month and through group by t.owner_id,t.occurred_on
 )
 select jsonb_agg(jsonb_build_object('key',m.key,'name',m.name,'daily',(
 select jsonb_agg(jsonb_build_object('date',d.day::date,'net',coalesce(l.net,0)::text,'food',coalesce(l.food,0)::text,'drink',coalesce(l.drink,0)::text,'count',coalesce(l.expense_count,0),'food_count',coalesce(l.food_count,0),'drink_count',coalesce(l.drink_count,0),'refund_count',coalesce(l.refund_count,0)) order by d.day)
 from generate_series(p_month,through,interval '1 day') d(day) left join ledger l on l.owner_id=m.owner and l.occurred_on=d.day::date)) order by m.key desc) into people from members m;
 return status||jsonb_build_object('month',p_month,'through',through,'people',people);
end $$;
revoke all on function moneyspace_private.read_comparison(date) from public,anon;grant execute on function moneyspace_private.read_comparison(date) to authenticated;
create function public.moneyspace_comparison(p_month date) returns jsonb language sql stable security invoker set search_path='' as $$select moneyspace_private.read_comparison(p_month)$$;
revoke all on function public.moneyspace_comparison(date) from public,anon;grant execute on function public.moneyspace_comparison(date) to authenticated;

create function public.moneyspace_reminder_context() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid();today date:=timezone('Asia/Bangkok',now())::date;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object('today',today,'has_expense',exists(select 1 from public.transactions t where t.owner_id=uid and t.household_id is null and t.deleted_at is null and t.kind='expense' and t.occurred_on=today));
end $$;
revoke all on function public.moneyspace_reminder_context() from public,anon;grant execute on function public.moneyspace_reminder_context() to authenticated;
commit;
