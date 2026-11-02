begin;
create temporary table income_ids(label text primary key,id uuid default gen_random_uuid());
insert into income_ids(label) values('alice'),('bob');grant select,update on income_ids to authenticated;
insert into auth.users(id) select id from income_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from income_ids where label='alice'),true);
do $$
declare tx uuid;v timestamptz;payload jsonb;key uuid:=gen_random_uuid();s jsonb;cash text;count_before bigint;
begin
 perform public.complete_onboarding('Income Alice','เงินรวม',1000);
 tx:=(public.moneyspace_write_income('add_transaction',jsonb_build_object('kind','income','amount','500','date',current_date-1),gen_random_uuid())->>'id')::uuid;
 update income_ids set id=tx where label='alice';
 if (select income_category_code is not null from public.transactions where id=tx) then raise exception 'FAIL legacy guessed';end if;
 cash:=public.moneyspace_home_v2(current_date-1)#>>'{money,total}';
 select updated_at into v from public.transactions where id=tx;
 payload:=jsonb_build_object('id',tx,'version',v,'kind','income','amount','500','date',current_date-1,'income_category_code','salary');
 perform public.moneyspace_write_income('edit_transaction',payload,key);
 perform public.moneyspace_write_income('edit_transaction',payload,key);
 if (select income_category_name_snapshot from public.transactions where id=tx)<>'เงินเดือน' then raise exception 'FAIL missing label';end if;
 if public.moneyspace_home_v2(current_date-1)#>>'{money,total}'<>cash then raise exception 'FAIL categorizing changed cash';end if;
 s:=public.moneyspace_home_v2(current_date-1);
 if not exists(select 1 from jsonb_array_elements(s#>'{daily,types}') t where t->>'name'='เงินเดือน' and (t->>'amount')::numeric=500) then raise exception 'FAIL income chart';end if;
 if not exists(select 1 from public.transaction_versions where transaction_id=tx and action='edited' and after_value->>'income_category_code'='salary') then raise exception 'FAIL missing audit';end if;
 s:=public.moneyspace_snapshot_v2(date_trunc('month',current_date-1)::date);
 if not exists(select 1 from jsonb_array_elements(s->'transactions') t where t->>'income_category_code'='salary') then raise exception 'FAIL snapshot missing code';end if;
 select count(*) into count_before from public.transactions where owner_id=auth.uid();
 begin perform public.moneyspace_write_income('add_transaction',jsonb_build_object('kind','income','amount','10','date',current_date,'income_category_code','fake'),gen_random_uuid());raise exception 'FAIL invalid code';exception when raise_exception then if sqlerrm<>'INVALID_INCOME_CATEGORY' then raise;end if;end;
 if (select count(*) from public.transactions where owner_id=auth.uid())<>count_before then raise exception 'FAIL failed write persisted';end if;
 select updated_at into v from public.transactions where id=tx;
 perform public.moneyspace_write_income('edit_transaction',jsonb_build_object('id',tx,'version',v,'kind','income','amount','500','date',current_date-1),gen_random_uuid());
 if (select income_category_code from public.transactions where id=tx)<>'salary' then raise exception 'FAIL old client cleared category';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from income_ids where label='bob'),true);
do $$begin
 perform public.complete_onboarding('Income Bob','เงินรวม',0);
 if exists(select 1 from public.transactions where id=(select id from income_ids where label='alice')) then raise exception 'FAIL foreign read';end if;
 begin perform public.moneyspace_write_income('edit_transaction',jsonb_build_object('id',(select id from income_ids where label='alice'),'version',now(),'kind','income','amount','500','date',current_date-1,'income_category_code','freelance'),gen_random_uuid());raise exception 'FAIL foreign edit';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.moneyspace_write_income('add_transaction','{}',gen_random_uuid());raise exception 'FAIL anon write';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_home_v2(current_date);raise exception 'FAIL anon report';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
