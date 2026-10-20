begin;
create temporary table plan_test_user(id uuid default gen_random_uuid());insert into plan_test_user default values;grant select on plan_test_user to authenticated;
insert into auth.users(id) select id from plan_test_user;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from plan_test_user),true);
do $$
declare s jsonb;a jsonb;r jsonb;payload jsonb;k uuid:=gen_random_uuid();c uuid;t uuid;v text;m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;
begin
 perform public.complete_onboarding('Simple planner','เงินรวม',100);
 payload:=jsonb_build_object('items',jsonb_build_array(jsonb_build_object('name','อาหาร','icon','🍜','group','food','amount','6000'),jsonb_build_object('name','เครื่องดื่ม','icon','☕','group','drink','amount','1500'),jsonb_build_object('name','ค่าโทรศัพท์','icon','📱','group','other','amount','300')),'goal_amount','10000');
 r:=public.moneyspace_write('setup_plan',payload,k);perform public.moneyspace_write('setup_plan',payload,k);
 s:=public.moneyspace_snapshot(m);
 if jsonb_array_length(s->'envelopes')<>3 or jsonb_array_length(s->'goals')<>1 or (s->>'cash')::numeric<>100 or (s->>'expenses')::numeric<>0 or (s->>'savings')::numeric<>0 then raise exception 'FAIL: plan counted as spending or savings, or duplicate retry';end if;
 if not exists(select 1 from jsonb_array_elements(s->'envelopes') e where e->>'name'='อาหาร' and (e->>'allocated')::numeric=6000) then raise exception 'FAIL: recurring food target missing';end if;
 -- A collision must roll back the whole attempted plan, including any earlier new rows.
 begin perform public.moneyspace_write('setup_plan',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('name','New unique','amount','1'),jsonb_build_object('name','อาหาร','amount','2'))),gen_random_uuid());raise exception 'FAIL: overwrote existing plan';exception when raise_exception then if sqlerrm<>'PLAN_ALREADY_EXISTS' then raise;end if;end;
 if exists(select 1 from public.envelopes where name='New unique') or exists(select 1 from public.categories where name='New unique') then raise exception 'FAIL: partial setup committed';end if;
 select id into c from public.categories where name='เครื่องดื่ม';
 t:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id',c,'amount','60','date',m),gen_random_uuid())->>'id')::uuid;
 select updated_at::text into v from public.categories where id=c;
 perform public.moneyspace_write('update_category',jsonb_build_object('category_id',c,'version',v,'name','ช่วงพัก','icon','🧋','spending_group','drink'),gen_random_uuid());
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id',c,'amount','20','date',m),gen_random_uuid());
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','refund','refund_of_id',t,'amount','10','date',m),gen_random_uuid());
 a:=public.moneyspace_analytics(m);
 if (select sum((f->>'amount')::numeric*case when f->>'kind'='refund' then -1 else 1 end) from jsonb_array_elements(a->'facts') f where f->>'spending_group'='drink')<>70 then raise exception 'FAIL: drink group changed by rename or refund';end if;
 if not exists(select 1 from jsonb_array_elements(a->'facts') f where f->>'category_name'='เครื่องดื่ม' and f->>'spending_group'='drink') or not exists(select 1 from jsonb_array_elements(a->'facts') f where f->>'category_name'='ช่วงพัก' and f->>'spending_group'='drink') then raise exception 'FAIL: historical group identity missing';end if;
 if (public.moneyspace_snapshot(m)->>'cash')::numeric<>30 then raise exception 'FAIL: plan or refund changed exact cash';end if;
end $$;
reset role;select 'PASS: atomic starter plan, no funding requirement, no overwrite, idempotency, goal neutrality and stable drink analysis' as result;rollback;
