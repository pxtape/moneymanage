begin;
create temporary table appearance_ids(label text primary key,id uuid default gen_random_uuid());insert into appearance_ids(label) values('alice'),('bob');grant select on appearance_ids to authenticated;
insert into auth.users(id) select id from appearance_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from appearance_ids where label='alice'),true);
do $$
declare c public.categories%rowtype;e uuid;v text;s jsonb;before_s jsonb;w jsonb;today date:=timezone('Asia/Bangkok',now())::date;m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;k uuid:=gen_random_uuid();p jsonb;tx uuid;g uuid;
begin
 perform public.complete_onboarding('Style Alice','เงินรวม',10000);
 select * into c from public.categories where owner_id=auth.uid() order by created_at,id limit 1;
 before_s:=public.moneyspace_snapshot(m);
 p:=jsonb_build_object('category_id',c.id,'version',c.updated_at,'favorite',true);
 perform public.moneyspace_write('pin_category',p,k);perform public.moneyspace_write('pin_category',p,k);
 if not (select is_favorite from public.categories where id=c.id) then raise exception 'FAIL: favorite not persisted';end if;
 s:=public.moneyspace_snapshot(m);
 if s->>'cash'<>before_s->>'cash' or s->>'expenses'<>before_s->>'expenses' or s->>'savings'<>before_s->>'savings' or s->>'transaction_count'<>before_s->>'transaction_count' then raise exception 'FAIL: pin changed finances';end if;
 begin perform public.moneyspace_write('pin_category',p,gen_random_uuid());raise exception 'FAIL: stale pin accepted';exception when raise_exception then if sqlerrm<>'STALE_VERSION' then raise;end if;end;
 e:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','Food','amount','6000','cadence','daily','color','#8aaeff','pocket_icon','🍜','cover','dots'),gen_random_uuid())->>'id')::uuid;
 s:=public.moneyspace_snapshot(m);
 if s->'envelopes'->0->>'color'<>'#8aaeff' or s->'envelopes'->0->>'icon'<>'🍜' or s->'envelopes'->0->>'cover'<>'dots' then raise exception 'FAIL: pocket appearance not in snapshot';end if;
 select updated_at::text into v from public.envelopes where id=e;
 begin perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e,'version',v,'month',m,'amount','6000','color','url(evil)'),gen_random_uuid());raise exception 'FAIL: invalid style';exception when raise_exception then if sqlerrm<>'INVALID_POCKET_STYLE' then raise;end if;end;
 -- Ordinary existing callers keep appearance when styling fields are omitted.
 perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e,'version',v,'month',m,'amount','6000'),gen_random_uuid());
 if (select color from public.envelopes where id=e)<>'#8aaeff' then raise exception 'FAIL: style reset by older caller';end if;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','income','amount','1000.25','date',today),gen_random_uuid());
 -- More than the ledger preview limit: the digest must aggregate every row.
 for i in 1..105 loop
 tx:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id',c.id,'envelope_id',e,'amount','1.10','date',today),gen_random_uuid())->>'id')::uuid;
 end loop;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','refund','refund_of_id',tx,'amount','.50','date',today),gen_random_uuid());
 g:=(public.moneyspace_write('create_goal',jsonb_build_object('name','Trip','amount','1000'),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('earmark_goal',jsonb_build_object('goal_id',g,'amount','100'),gen_random_uuid());
 w:=public.moneyspace_weekly_summary(today);
 if (w->>'income')::numeric<>1000.25 or (w->>'expenses')::numeric<>115.00 or (w->>'expense_count')::integer<>105 or (w->>'recorded_days')::integer<>1 or (w->>'savings_change')::numeric<>100 then raise exception 'FAIL: weekly totals or savings double counted: %',w;end if;
 if w->>'start'<>date_trunc('week',today)::date::text then raise exception 'FAIL: wrong calendar week';end if;
 w:=public.moneyspace_weekly_summary(date_trunc('week',today)::date-1);
 if (w->>'expense_count')::integer<>0 or (w->>'income')::numeric<>0 then raise exception 'FAIL: current transactions leaked into prior week';end if;
 begin perform public.moneyspace_weekly_summary(today+1);raise exception 'FAIL: future summary';exception when raise_exception then if sqlerrm<>'INVALID_DATE' then raise;end if;end;
end $$;
reset role;
create temporary table foreign_category as select id,updated_at from public.categories where owner_id=(select id from appearance_ids where label='alice') limit 1;grant select on foreign_category to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from appearance_ids where label='bob'),true);
do $$declare c record;s jsonb;begin
 perform public.complete_onboarding('Style Bob','เงินรวม',0);select * into c from foreign_category;
 begin perform public.moneyspace_write('pin_category',jsonb_build_object('category_id',c.id,'version',c.updated_at,'favorite',true),gen_random_uuid());raise exception 'FAIL: foreign favorite';exception when insufficient_privilege then null;end;
 s:=public.moneyspace_weekly_summary(timezone('Asia/Bangkok',now())::date);
 if (s->>'expense_count')::integer<>0 or (s->>'income')::numeric<>0 or (s->>'savings_change')::numeric<>0 then raise exception 'FAIL: foreign weekly money exposed';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.moneyspace_weekly_summary(current_date);raise exception 'FAIL: anonymous weekly read';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
