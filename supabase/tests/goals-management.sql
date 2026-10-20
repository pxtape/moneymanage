begin;
create temporary table goals_test_ids(label text primary key,id uuid default gen_random_uuid());insert into goals_test_ids(label) values('alice'),('bob'),('foreign_goal');grant select on goals_test_ids to authenticated;
insert into auth.users(id) select id from goals_test_ids where label in ('alice','bob');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from goals_test_ids where label='alice'),true);
do $$
declare m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;g uuid;c uuid;v text;before_v text;s jsonb;k uuid:=gen_random_uuid();payload jsonb;
begin
 perform public.complete_onboarding('Goal Alice','เงินรวม',10000);
 g:=(public.moneyspace_write('create_goal',jsonb_build_object('name','Trip','amount','10000'),gen_random_uuid())->>'id')::uuid;
 select updated_at::text into before_v from public.goals where id=g;
 c:=(public.moneyspace_write('earmark_goal',jsonb_build_object('goal_id',g,'amount','1000'),gen_random_uuid())->>'id')::uuid;
 select updated_at::text into v from public.goals where id=g;
 if v=before_v then raise exception 'FAIL: contributions did not invalidate goal version';end if;
 begin perform public.moneyspace_write('delete_goal',jsonb_build_object('goal_id',g,'version',before_v),gen_random_uuid());raise exception 'FAIL: stale deletion accepted';exception when raise_exception then if sqlerrm<>'STALE_VERSION' then raise;end if;end;
 perform public.moneyspace_write('update_goal',jsonb_build_object('goal_id',g,'version',v,'name','Holiday','amount','500','date','2027-12-01'),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if s->'goals'->0->>'name'<>'Holiday' or (s->'goals'->0->>'target')::numeric<>500 or (s->'goals'->0->>'saved')::numeric<>1000 or (s->>'cash')::numeric<>10000 or (s->>'expenses')::numeric<>0 then raise exception 'FAIL: goal edit mutated money';end if;
 if s->'contributions'->0->>'goal_name_snapshot'<>'Trip' then raise exception 'FAIL: rename rewrote savings label';end if;
 select updated_at::text into before_v from public.goals where id=g;
 perform public.moneyspace_write('release_goal',jsonb_build_object('id',c),gen_random_uuid());
 select updated_at::text into v from public.goals where id=g;
 if v=before_v then raise exception 'FAIL: release did not invalidate version';end if;
 perform public.moneyspace_write('earmark_goal',jsonb_build_object('goal_id',g,'amount','1200'),gen_random_uuid());
 select updated_at::text into v from public.goals where id=g;
 payload:=jsonb_build_object('goal_id',g,'version',v);
 perform public.moneyspace_write('delete_goal',payload,k);perform public.moneyspace_write('delete_goal',payload,k);
 s:=public.moneyspace_snapshot(m);
 if jsonb_array_length(s->'goals')<>0 or jsonb_array_length(s->'contributions')<>0 or (s->>'savings')::numeric<>0 or (s->>'savings_change')::numeric<>0 or (s->>'cash')::numeric<>10000 or (s->>'expenses')::numeric<>0 then raise exception 'FAIL: deletion lost cash or failed to release earmarks';end if;
 begin update public.goals set name='Bypass';raise exception 'FAIL: direct goal update';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin
 if (select count(*) from public.goal_contributions where owner_id=(select id from goals_test_ids where label='alice') and deleted_at is not null)<>2 then raise exception 'FAIL: savings records removed';end if;
 if not exists(select 1 from public.goals where owner_id=(select id from goals_test_ids where label='alice') and name='Holiday' and deleted_at is not null) then raise exception 'FAIL: goal hard deleted';end if;
end $$;
insert into public.profiles(id,display_name,onboarding_completed_at) select id,'Bob',now() from goals_test_ids where label='bob';
insert into public.goals(id,owner_id,name,target_amount,updated_at) values((select id from goals_test_ids where label='foreign_goal'),(select id from goals_test_ids where label='bob'),'Private goal',1000,'2026-01-01T00:00:00Z');
set local role authenticated;
do $$begin
 begin perform public.moneyspace_write('delete_goal',jsonb_build_object('goal_id',(select id from goals_test_ids where label='foreign_goal'),'version','2026-01-01T00:00:00Z'),gen_random_uuid());raise exception 'FAIL: cross-user delete';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_write('update_goal',jsonb_build_object('goal_id',(select id from goals_test_ids where label='foreign_goal'),'version','2026-01-01T00:00:00Z','name','Stolen','amount','1'),gen_random_uuid());raise exception 'FAIL: cross-user edit';exception when insufficient_privilege then null;end;
end $$;
reset role;select 'PASS: goal rename/retarget/delete, stale conflicts, exact release, idempotent retry, historical labels and authorization' as result;rollback;
