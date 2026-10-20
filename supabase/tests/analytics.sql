begin;
create temporary table m4_ids(label text primary key,id uuid default gen_random_uuid());
insert into m4_ids(label) values('alice'),('bob'),('foreign_budget');
grant select on m4_ids to authenticated;
insert into auth.users(id) select id from m4_ids where label in ('alice','bob');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from m4_ids where label='alice'),true);
do $$
declare s jsonb;a jsonb;e uuid;c uuid;tx uuid;v text;old_v text;m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;
begin
 perform public.complete_onboarding('M4 Alice','เงินรวม',1000);
 s:=public.moneyspace_snapshot(m);c:=(s->'categories'->0->>'id')::uuid;
 e:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','Food','amount','100','category_ids',jsonb_build_array(c)),gen_random_uuid())->>'id')::uuid;
 tx:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id',c,'amount','80','date',m),gen_random_uuid())->>'id')::uuid;
 s:=public.moneyspace_snapshot(m);v:=s->'envelopes'->0->>'updated_at';old_v:=v;
 perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e,'name','Food and drink','amount','120','month',m,'version',v,'category_ids',jsonb_build_array(c)),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if s->'envelopes'->0->>'name'<>'Food and drink' or (s->>'cash')::numeric<>920 or (s->>'expenses')::numeric<>80 then raise exception 'FAIL: rename changed finances';end if;
 begin perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',e,'name','Stale','amount','1','month',m,'version',old_v),gen_random_uuid());raise exception 'FAIL: stale budget accepted';exception when raise_exception then if sqlerrm<>'STALE_VERSION' then raise;end if;end;
 v:=s->'envelopes'->0->>'updated_at';
 perform public.moneyspace_write('delete_envelope',jsonb_build_object('envelope_id',e,'version',v),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if jsonb_array_length(s->'envelopes')<>0 or (s->>'cash')::numeric<>920 or (s->>'expenses')::numeric<>80 then raise exception 'FAIL: budget deletion removed spending';end if;
 if exists(select 1 from public.categories where default_envelope_id=e) then raise exception 'FAIL: category link retained';end if;
 if not exists(select 1 from public.transactions where id=tx and envelope_id=e and deleted_at is null) then raise exception 'FAIL: history lost';end if;
 if not exists(select 1 from public.audit_events where entity_id=e and action='UPDATE') then raise exception 'FAIL: budget audit missing';end if;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','refund','refund_of_id',tx,'amount','20','date',m),gen_random_uuid());
end $$;
-- Seed beyond the UI preview limit without spending time making 124 separate RPCs.
reset role;
insert into public.envelopes(id,owner_id,name,monthly_target,updated_at) select (select id from m4_ids where label='foreign_budget'),id,'Private active budget',100,'2026-01-01T00:00:00Z' from m4_ids where label='alice';
insert into public.transactions(owner_id,account_id,category_id,kind,amount,tag,occurred_on)
 select u.id,a.id,(select id from public.categories where owner_id=u.id order by created_at limit 1),'expense',1,'need',date_trunc('month',timezone('Asia/Bangkok',now()))::date
 from m4_ids u join public.accounts a on a.owner_id=u.id cross join generate_series(1,124) n where u.label='alice';
set local role authenticated;
do $$declare a jsonb;s jsonb;m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;begin
 a:=public.moneyspace_analytics(m);s:=public.moneyspace_snapshot(m);
 if (select sum((x->>'count')::integer) from jsonb_array_elements(a->'facts') x where x->>'kind'='expense')<>125 then raise exception 'FAIL: truncated analytics';end if;
 if (select sum((x->>'amount')::numeric * case when x->>'kind'='refund' then -1 else 1 end) from jsonb_array_elements(a->'facts') x)<>184 then raise exception 'FAIL: refund accounting';end if;
 if jsonb_array_length(s->'transactions')<>100 or (s->>'expenses')::numeric<>184 then raise exception 'FAIL: preview mismatch';end if;
 if not exists(select 1 from jsonb_array_elements(a->'facts') x where x->>'kind'='refund' and x->>'tag'='need') then raise exception 'FAIL: refund tag lineage';end if;
 if jsonb_array_length(a->'savings')<>6 then raise exception 'FAIL: monthly savings range';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from m4_ids where label='bob'),true);
do $$declare a jsonb;e uuid;v text;m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;begin
 perform public.complete_onboarding('M4 Bob','เงินรวม',500);
 a:=public.moneyspace_analytics(m);
 if jsonb_array_length(a->'facts')<>0 then raise exception 'FAIL: analytics leaked another user';end if;
 select id,updated_at::text into e,v from public.envelopes where owner_id<>(select auth.uid()) limit 1;
 if e is not null then raise exception 'FAIL: envelope visibility';end if;
 begin perform public.moneyspace_write('delete_envelope',jsonb_build_object('envelope_id',(select id from m4_ids where label='foreign_budget'),'version','2026-01-01T00:00:00Z'),gen_random_uuid());raise exception 'FAIL: cross-owner budget delete accepted';exception when raise_exception then if sqlerrm<>'STALE_VERSION' then raise;end if;end;
end $$;
set local role anon;
do $$begin begin perform public.moneyspace_analytics(date_trunc('month',now())::date);raise exception 'FAIL: anonymous analytics';exception when insufficient_privilege then null;end;end $$;
reset role;
select 'PASS: budget rename/delete, version checks, audit preservation, full aggregation beyond100, refund tags, ownership and anonymous denial' as m4_result;
rollback;
