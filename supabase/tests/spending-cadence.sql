begin;
create temporary table cadence_ids(label text primary key,id uuid default gen_random_uuid());insert into cadence_ids(label) values('alice'),('bob');grant select on cadence_ids to authenticated;
insert into auth.users(id) select id from cadence_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from cadence_ids where label='alice'),true);
do $$
declare m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;e uuid;c uuid;v text;s jsonb;a jsonb;
begin
 perform public.complete_onboarding('Cadence Alice','เงินรวม',10000);
 select id into c from public.categories where owner_id=auth.uid() order by created_at,id limit 1;
 e:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','Monthly bill','amount','2000','cadence','bill'),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id',c,'envelope_id',e,'amount','100','date',timezone('Asia/Bangkok',now())::date),gen_random_uuid());
 select updated_at::text into v from public.envelopes where id=e;
 perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e,'version',v,'month',m,'amount','2000','cadence','daily'),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if s->'envelopes'->0->>'cadence'<>'daily' or (s->>'cash')::numeric<>9900 or (s->>'expenses')::numeric<>100 or (s->'envelopes'->0->>'allocated')::numeric<>2000 then raise exception 'FAIL: cadence altered money';end if;
 a:=public.moneyspace_analytics(m);
 if not exists(select 1 from jsonb_array_elements(a->'facts') f where f->>'envelope_id'=e::text and f->>'kind'='expense') then raise exception 'FAIL: recorded pocket not in analytics facts';end if;
 select updated_at::text into v from public.envelopes where id=e;
 begin perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e,'version',v,'month',m,'amount','2000','cadence','invalid'),gen_random_uuid());raise exception 'FAIL: invalid cadence';exception when raise_exception then if sqlerrm<>'INVALID_CADENCE' then raise;end if;end;
 -- Older clients omit cadence: metadata must stay intact.
 perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e,'version',v,'month',m,'amount','2000'),gen_random_uuid());
 if (select spending_cadence from public.envelopes where id=e)<>'daily' then raise exception 'FAIL: omitted cadence reset';end if;
end $$;
reset role;
create temporary table foreign_pocket as select id,updated_at from public.envelopes where owner_id=(select id from cadence_ids where label='alice') limit 1;grant select on foreign_pocket to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from cadence_ids where label='bob'),true);
do $$declare e record;begin
 perform public.complete_onboarding('Cadence Bob','เงินรวม',0);select * into e from foreign_pocket;
 begin perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e.id,'version',e.updated_at,'month',date_trunc('month',now())::date,'amount','2000','cadence','bill'),gen_random_uuid());raise exception 'FAIL: foreign cadence edit';exception when insufficient_privilege then null;end;
 if exists(select 1 from jsonb_array_elements(public.moneyspace_analytics(date_trunc('month',now())::date)->'facts')) then raise exception 'FAIL: foreign analytics exposed';end if;
end $$;
reset role;
rollback;
