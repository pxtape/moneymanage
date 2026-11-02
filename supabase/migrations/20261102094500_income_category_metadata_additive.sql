begin;
-- Additive income metadata. Existing money-writing and reporting functions remain intact.
alter table public.transactions
 add column income_category_code text check (income_category_code is null or (kind='income' and income_category_code in ('salary','freelance','sales','bonus','interest','rental','gift','other'))),
 add column income_category_name_snapshot text;
create function moneyspace_private.income_category_label(p_code text) returns text language sql immutable set search_path='' as $$
 select case p_code when 'salary' then 'เงินเดือน' when 'freelance' then 'รับจ้าง' when 'sales' then 'ขายของ' when 'bonus' then 'โบนัส' when 'interest' then 'ดอกเบี้ยและลงทุน' when 'rental' then 'ค่าเช่า' when 'gift' then 'เงินที่ได้รับ' when 'other' then 'รายได้อื่น ๆ' end
$$;
revoke all on function moneyspace_private.income_category_label(text) from public,anon,authenticated;
create function moneyspace_private.write_income(p_action text,p_data jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prior boolean; result jsonb; code text; label text; tx public.transactions%rowtype;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_action not in ('add_transaction','edit_transaction') or p_action is null or p_data->>'kind' is distinct from 'income' then raise exception 'INVALID_TRANSACTION';end if;
 -- Same per-owner lock and request cache used by the existing ledger.
 perform 1 from public.profiles where id=uid for update;
 select exists(select 1 from moneyspace_private.financial_requests where owner_id=uid and request_key=p_key) into prior;
 if prior then return moneyspace_private.write_finances(p_action,p_data,p_key);end if;
 if p_action='edit_transaction' then
  select * into tx from public.transactions where id=(p_data->>'id')::uuid and owner_id=uid and household_id is null and deleted_at is null;
  if not found then raise exception 'TRANSACTION_NOT_FOUND' using errcode='42501';end if;
 end if;
 code:=case when p_data ? 'income_category_code' then nullif(p_data->>'income_category_code','') else tx.income_category_code end;
 label:=moneyspace_private.income_category_label(code);
 if code is not null and label is null then raise exception 'INVALID_INCOME_CATEGORY';end if;
 -- The existing ledger performs amount/date/ownership/version validation and all money operations.
 result:=moneyspace_private.write_finances(p_action,p_data,p_key);
 update public.transactions set income_category_code=code,
  income_category_name_snapshot=case when code is not distinct from tx.income_category_code then tx.income_category_name_snapshot else label end
 where id=(result->>'id')::uuid and owner_id=uid and kind='income' and household_id is null;
 if not found then raise exception 'TRANSACTION_NOT_FOUND' using errcode='42501';end if;
 return result;
end $$;
revoke all on function moneyspace_private.write_income(text,jsonb,uuid) from public,anon;
grant execute on function moneyspace_private.write_income(text,jsonb,uuid) to authenticated;
create function public.moneyspace_write_income(p_action text,p_data jsonb,p_key uuid)
returns jsonb language sql security invoker set search_path='' as $$ select moneyspace_private.write_income(p_action,p_data,p_key) $$;
revoke all on function public.moneyspace_write_income(text,jsonb,uuid) from public,anon;
grant execute on function public.moneyspace_write_income(text,jsonb,uuid) to authenticated;

create function public.moneyspace_snapshot_v2(p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; rows jsonb; uid uuid:=auth.uid();
begin
 result:=public.moneyspace_snapshot(p_month);
 select coalesce(jsonb_agg(case when t.kind='income' then e.value||jsonb_build_object('income_category_code',t.income_category_code,'category_name_snapshot',t.income_category_name_snapshot) else e.value end order by e.ord),'[]'::jsonb) into rows
 from jsonb_array_elements(result->'transactions') with ordinality e(value,ord)
 left join public.transactions t on t.id=(e.value->>'id')::uuid and t.owner_id=uid and t.household_id is null;
 return jsonb_set(result,'{transactions}',rows);
end $$;
revoke all on function public.moneyspace_snapshot_v2(date) from public,anon;
grant execute on function public.moneyspace_snapshot_v2(date) to authenticated;

create function public.moneyspace_home_v2(p_date date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; rows jsonb; kinds jsonb; incomes jsonb; uid uuid:=auth.uid(); chosen date;
begin
 result:=public.moneyspace_home(p_date);chosen:=(result->>'selected_date')::date;
 select coalesce(jsonb_agg(case when t.kind='income' then e.value||jsonb_build_object('category',coalesce(t.income_category_name_snapshot,'รายได้ไม่ระบุหมวด')) else e.value end order by e.ord),'[]'::jsonb) into rows
 from jsonb_array_elements(result#>'{daily,transactions}') with ordinality e(value,ord)
 left join public.transactions t on t.id=(e.value->>'id')::uuid and t.owner_id=uid and t.household_id is null;
 select coalesce(jsonb_agg(e.value),'[]'::jsonb) into kinds from jsonb_array_elements(result#>'{daily,types}') e(value) where e.value->>'type'<>'income';
 select coalesce(jsonb_agg(jsonb_build_object('name',x.name,'type','income','amount',x.amount::text) order by x.name),'[]'::jsonb) into incomes
 from (select coalesce(income_category_name_snapshot,'รายได้ไม่ระบุหมวด') name,sum(amount) amount from public.transactions where owner_id=uid and household_id is null and deleted_at is null and kind='income' and occurred_on=chosen group by 1) x;
 result:=jsonb_set(result,'{daily,transactions}',rows);
 return jsonb_set(result,'{daily,types}',kinds||incomes);
end $$;
revoke all on function public.moneyspace_home_v2(date) from public,anon;
grant execute on function public.moneyspace_home_v2(date) to authenticated;
commit;
