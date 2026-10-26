begin;
create or replace function moneyspace_private.bill_action(p_action text,p_data jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
<<b>>
declare uid uuid:=auth.uid();r public.recurring_rules%rowtype;t public.expense_templates%rowtype;tx public.transactions%rowtype;eid uuid;cid uuid;aid uuid;env uuid;val numeric;label text;m date;day integer;today date:=timezone('Asia/Bangkok',now())::date;cm date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;due date;outid uuid;
begin
 if p_action in ('update_bill','stop_bill','pay_bill') then
 select * into r from public.recurring_rules where id=(p_data->>'id')::uuid and owner_id=uid and is_bill and deleted_at is null for update;
 if not found then raise exception 'INVALID_BILL' using errcode='42501';end if;
 if p_action='pay_bill' and exists(select 1 from public.bill_payments p where p.owner_id=uid and p.recurring_rule_id=r.id and p.period_start=(p_data->>'month')::date and p.voided_at is null) then raise exception 'BILL_ALREADY_PAID';end if;
 if p_data->>'version' is null or r.updated_at<>(p_data->>'version')::timestamptz then raise exception 'STALE_VERSION';end if;
 eid:=r.id;
 end if;
 if p_action in ('update_template','delete_template') then
 select * into t from public.expense_templates where id=(p_data->>'id')::uuid and owner_id=uid and deleted_at is null for update;
 if not found then raise exception 'INVALID_TEMPLATE' using errcode='42501';end if;
 if p_data->>'version' is null or t.updated_at<>(p_data->>'version')::timestamptz then raise exception 'STALE_VERSION';end if;eid:=t.id;
 end if;
 if p_action in ('create_bill','update_bill','create_template','update_template') then
 label:=btrim(p_data->>'name');val:=(p_data->>'amount')::numeric;cid:=(p_data->>'category_id')::uuid;
 if label is null or char_length(label) not between 1 and 60 or val is null or val::text in ('NaN','Infinity','-Infinity') or val<=0 or val>999999999999.99 or val<>round(val,2) then raise exception 'INVALID_BILL_TEMPLATE';end if;
 if not exists(select 1 from public.categories c where c.id=cid and c.owner_id=uid and c.deleted_at is null) then raise exception 'INVALID_CATEGORY' using errcode='42501';end if;
 end if;
 if p_action in ('create_bill','update_bill') then
 m:=(p_data->>'first_month')::date;day:=(p_data->>'due_day')::integer;env:=(p_data->>'envelope_id')::uuid;
 if m is null or m<>date_trunc('month',m)::date or (m<(cm-interval '11 months')::date and (p_action='create_bill' or m is distinct from r.bill_first_month)) or m>(cm+interval '24 months')::date or day is null or day not between 1 and 31 then raise exception 'INVALID_BILL_DATE';end if;
 if env is not null and not exists(select 1 from public.envelopes e where e.id=env and e.owner_id=uid and e.household_id is null and e.deleted_at is null) then raise exception 'INVALID_ENVELOPE' using errcode='42501';end if;
 select a.id into aid from public.accounts a where a.owner_id=uid and a.household_id is null and a.deleted_at is null order by a.created_at,a.id limit 1;
 if aid is null then raise exception 'INVALID_ACCOUNT';end if;
 if exists(select 1 from public.recurring_rules x where x.owner_id=uid and x.is_bill and x.deleted_at is null and lower(btrim(x.bill_name))=lower(label) and x.id is distinct from eid) then raise exception 'BILL_NAME_EXISTS';end if;
 if p_action='create_bill' then
 if (select count(*) from public.recurring_rules where owner_id=uid and is_bill and deleted_at is null)>=50 then raise exception 'BILL_LIMIT';end if;
 insert into public.recurring_rules(owner_id,account_id,category_id,amount,cadence,next_due,is_bill,bill_name,bill_first_month,bill_due_day,bill_envelope_id) values(uid,aid,cid,val,'monthly',moneyspace_private.bill_due(m,day),true,label,m,day,env) returning id into eid;
 else update public.recurring_rules set bill_name=label,amount=val,category_id=cid,bill_envelope_id=env,bill_first_month=m,bill_due_day=day,next_due=moneyspace_private.bill_due(m,day) where id=eid and owner_id=uid;end if;
 elsif p_action='stop_bill' then update public.recurring_rules set deleted_at=clock_timestamp(),active=false where id=eid and owner_id=uid;
 elsif p_action in ('create_template','update_template') then
 if exists(select 1 from public.expense_templates x where x.owner_id=uid and x.deleted_at is null and lower(btrim(x.name))=lower(label) and x.id is distinct from eid) then raise exception 'TEMPLATE_NAME_EXISTS';end if;
 if p_action='create_template' then
 if (select count(*) from public.expense_templates where owner_id=uid and deleted_at is null)>=24 then raise exception 'TEMPLATE_LIMIT';end if;
 insert into public.expense_templates(owner_id,name,amount,category_id) values(uid,label,val,cid) returning id into eid;
 else update public.expense_templates set name=label,amount=val,category_id=cid where id=eid and owner_id=uid;end if;
 elsif p_action='delete_template' then update public.expense_templates set deleted_at=clock_timestamp() where id=eid and owner_id=uid;
 elsif p_action='pay_bill' then
 m:=(p_data->>'month')::date;
 if m is null or m<>date_trunc('month',m)::date or m<r.bill_first_month or m>cm then raise exception 'INVALID_MONTH';end if;
 due:=moneyspace_private.bill_due(m,r.bill_due_day);
 if nullif(p_data->>'transaction_id','') is not null then
 select * into tx from public.transactions x where x.id=(p_data->>'transaction_id')::uuid and x.owner_id=uid and x.household_id is null and x.deleted_at is null and x.kind='expense' and x.account_id=r.account_id and x.category_id=r.category_id and x.occurred_on between m and today for update;
 if not found then raise exception 'INVALID_BILL_TRANSACTION' using errcode='42501';end if;
 if p_data->>'transaction_version' is null or tx.updated_at<>(p_data->>'transaction_version')::timestamptz then raise exception 'STALE_VERSION';end if;
 if exists(select 1 from public.bill_payments p where p.transaction_id=tx.id and p.voided_at is null) then raise exception 'BILL_TRANSACTION_USED';end if;
 outid:=tx.id;
 else
 if (p_data->>'date')::date is null or (p_data->>'date')::date<m then raise exception 'INVALID_BILL_DATE';end if;
 outid:=(moneyspace_private.write_finances('add_transaction',jsonb_build_object('kind','expense','amount',p_data->>'amount','date',p_data->>'date','account_id',r.account_id,'category_id',r.category_id,'envelope_id',r.bill_envelope_id,'merchant',r.bill_name,'notes','บิลรอบ '||m::text),gen_random_uuid())->>'id')::uuid;
 end if;
 insert into public.bill_payments(owner_id,recurring_rule_id,period_start,due_on,expected_amount,name_snapshot,transaction_id) values(uid,r.id,m,due,r.amount,r.bill_name,outid);
 update public.transactions set recurring_rule_id=r.id where id=outid and owner_id=uid;
 update public.recurring_rules set updated_at=clock_timestamp() where id=r.id and owner_id=uid;
 eid:=outid;
 else raise exception 'UNKNOWN_ACTION';end if;
 return eid;
end $$;
commit;
