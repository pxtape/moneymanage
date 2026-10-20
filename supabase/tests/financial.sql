begin;
create temporary table m3_users(label text primary key,id uuid default gen_random_uuid());
insert into m3_users(label) values('alice'),('bob');
grant select on m3_users to authenticated;
insert into auth.users(id) select id from m3_users;
insert into public.profiles(id,display_name,onboarding_completed_at) select id,'Bob',now() from m3_users where label='bob';
insert into public.accounts(owner_id,name,opening_balance) select id,'Bob account',500 from m3_users where label='bob';
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from m3_users where label='alice'),true);
do $$
declare s jsonb; r jsonb; acct uuid; acct2 uuid; cat uuid; env uuid; goal uuid; contribution uuid; expense_id uuid; refund_id uuid; tx uuid; v timestamptz; old_v timestamptz; key uuid; payload jsonb;
 m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date; prev date:=(date_trunc('month',timezone('Asia/Bangkok',now()))-interval '1 month')::date;
begin
 perform public.complete_onboarding('Alice','Bank',10000.25);
 s:=public.moneyspace_snapshot(m);acct:=(s->'accounts'->0->>'id')::uuid;cat:=(s->'categories'->0->>'id')::uuid;
 env:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','Food','rollover','positive'),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('link_category',jsonb_build_object('category_id',cat,'envelope_id',env),gen_random_uuid());
 perform public.moneyspace_write('allocate',jsonb_build_object('month',prev,'envelope_id',env,'amount','5000.00'),gen_random_uuid());
 perform public.moneyspace_write('allocate',jsonb_build_object('month',m,'envelope_id',env,'amount','2000.00'),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if (s->>'cash')::numeric<>10000.25 or (s->>'expenses')::numeric<>0 or (s->'envelopes'->0->>'carried')::numeric<>5000 then raise exception 'FAIL: allocation treated as expense or rollover lost'; end if;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','account_id',acct,'category_id',cat,'amount','1200.10','date',prev),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if (s->'envelopes'->0->>'carried')::numeric<>3799.90 then raise exception 'FAIL: historical expense not rolled forward'; end if;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','income','account_id',acct,'amount','1000.00','date',m),gen_random_uuid());
 expense_id:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','account_id',acct,'category_id',cat,'amount','800.05','date',m),gen_random_uuid())->>'id')::uuid;
 acct2:=(public.moneyspace_write('create_account',jsonb_build_object('name','Cash','kind','cash','amount','0.00'),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','transfer','account_id',acct,'destination_id',acct2,'amount','2000.00','date',m),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if (s->>'cash')::numeric<>9000.10 or (s->>'expenses')::numeric<>800.05 then raise exception 'FAIL: transfer double counted'; end if;
 refund_id:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','refund','account_id',acct,'refund_of_id',expense_id,'amount','100.00','date',m),gen_random_uuid())->>'id')::uuid;
 s:=public.moneyspace_snapshot(m);
 if (s->>'cash')::numeric<>9100.10 or (s->>'expenses')::numeric<>700.05 then raise exception 'FAIL: refund not offset'; end if;
 begin
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','refund','account_id',acct,'refund_of_id',expense_id,'amount','701.00','date',m),gen_random_uuid());
 raise exception 'FAIL: excessive refund accepted'; exception when raise_exception then if sqlerrm<>'REFUND_EXCEEDS_EXPENSE' then raise; end if;end;
 goal:=(public.moneyspace_write('create_goal',jsonb_build_object('name','Emergency','amount','5000.00'),gen_random_uuid())->>'id')::uuid;
 contribution:=(public.moneyspace_write('earmark_goal',jsonb_build_object('goal_id',goal,'account_id',acct,'amount','1000.00'),gen_random_uuid())->>'id')::uuid;
 s:=public.moneyspace_snapshot(m);
 if (s->>'cash')::numeric<>9100.10 or (s->>'expenses')::numeric<>700.05 or (s->>'savings')::numeric<>1000 then raise exception 'FAIL: earmark counted as consumption'; end if;
 begin
 perform public.moneyspace_write('allocate',jsonb_build_object('month',m,'envelope_id',env,'amount','20000.00'),gen_random_uuid());
 raise exception 'FAIL: over-allocation accepted';exception when raise_exception then if sqlerrm<>'INSUFFICIENT_UNALLOCATED' then raise;end if;end;
 begin
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','transfer','account_id',acct,'destination_id',acct2,'amount','7000.00','date',m),gen_random_uuid());
 raise exception 'FAIL: reserved savings spent';exception when raise_exception then if sqlerrm<>'ACCOUNT_FUNDS_RESERVED_OR_INSUFFICIENT' then raise;end if;end;
 key:=gen_random_uuid();payload:=jsonb_build_object('kind','expense','account_id',acct,'category_id',cat,'amount','55.55','date',m);
 tx:=(public.moneyspace_write('add_transaction',payload,key)->>'id')::uuid;
 if (public.moneyspace_write('add_transaction',payload,key)->>'id')::uuid<>tx then raise exception 'FAIL: retry result changed';end if;
 if (select count(*) from public.transactions where id=tx)<>1 then raise exception 'FAIL: duplicate retry';end if;
 begin perform public.moneyspace_write('add_transaction',payload||'{"amount":"56.00"}'::jsonb,key);raise exception 'FAIL: mismatched retry accepted';exception when raise_exception then if sqlerrm<>'REQUEST_KEY_REUSED' then raise;end if;end;
 select updated_at into old_v from public.transactions where id=tx;
 perform public.moneyspace_write('edit_transaction',jsonb_build_object('id',tx,'version',old_v,'kind','expense','account_id',acct,'category_id',cat,'amount','66.66','date',m),gen_random_uuid());
 begin perform public.moneyspace_write('delete_transaction',jsonb_build_object('id',tx,'version',old_v),gen_random_uuid());raise exception 'FAIL: stale edit accepted';exception when raise_exception then if sqlerrm<>'STALE_VERSION' then raise;end if;end;
 select updated_at into v from public.transactions where id=tx;
 perform public.moneyspace_write('delete_transaction',jsonb_build_object('id',tx,'version',v),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if (s->>'cash')::numeric<>9100.10 or (s->>'expenses')::numeric<>700.05 then raise exception 'FAIL: edit/delete balance drift';end if;
 if (select count(*) from public.transaction_versions where transaction_id=tx)<>3 then raise exception 'FAIL: history missing';end if;
 perform public.moneyspace_write('release_goal',jsonb_build_object('id',contribution),gen_random_uuid());
 if (public.moneyspace_snapshot(m)->>'savings')::numeric<>0 then raise exception 'FAIL: release changed cash or failed';end if;
 -- Direct opening-balance inserts are no longer an escape from transactional validation.
 begin insert into public.accounts(owner_id,name,opening_balance) values(auth.uid(),'Bypass',-100000);raise exception 'FAIL: direct account write accepted';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','account_id',acct,'category_id',cat,'amount','1.001','date',m),gen_random_uuid());raise exception 'FAIL: fractional satang';exception when raise_exception then if sqlerrm<>'INVALID_AMOUNT' then raise;end if;end;
 -- Full rollover carries negative balances; none discards the previous remainder.
 env:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','Full','rollover','full'),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('allocate',jsonb_build_object('month',prev,'envelope_id',env,'amount','100.00'),gen_random_uuid());
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','account_id',acct,'category_id',cat,'envelope_id',env,'amount','150.00','date',prev),gen_random_uuid());
 if not exists(select 1 from jsonb_array_elements(public.moneyspace_snapshot(m)->'envelopes') e where e->>'id'=env::text and (e->>'carried')::numeric=-50) then raise exception 'FAIL: negative rollover lost';end if;
 env:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','None','rollover','none'),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('allocate',jsonb_build_object('month',prev,'envelope_id',env,'amount','100.00'),gen_random_uuid());
 if not exists(select 1 from jsonb_array_elements(public.moneyspace_snapshot(m)->'envelopes') e where e->>'id'=env::text and (e->>'carried')::numeric=0) then raise exception 'FAIL: none rollover carried';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from m3_users where label='bob'),true);
do $$declare a uuid;begin
 if exists(select 1 from public.transaction_versions) then raise exception 'FAIL: history leaked';end if;
 if (public.moneyspace_snapshot(date_trunc('month',timezone('Asia/Bangkok',now()))::date)->>'cash')::numeric<>500 then raise exception 'FAIL: snapshot leaked';end if;
 -- An owner UUID in payload is ignored; actual ownership always comes from auth.uid().
 begin perform public.moneyspace_write('delete_transaction',jsonb_build_object('id',gen_random_uuid(),'version',now()),gen_random_uuid());raise exception 'FAIL: cross-tenant write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: exact balances, allocations, three rollover modes, historical recomputation, transfer neutrality, capped refunds, savings earmarks, retry idempotency, atomic rollback, edit/delete, stale versions, audit privacy and ownership' as financial_result;
rollback;
