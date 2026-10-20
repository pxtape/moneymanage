begin;
create temporary table salary_ids(label text primary key,id uuid default gen_random_uuid());insert into salary_ids(label) values('alice'),('bob');grant select on salary_ids to authenticated;
insert into auth.users(id) select id from salary_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from salary_ids where label='alice'),true);
do $$
declare s jsonb;v text;k uuid:=gen_random_uuid();pay jsonb;result jsonb;today date:=timezone('Asia/Bangkok',now())::date;due date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;tx uuid;old_v text;
begin
 perform public.complete_onboarding('Salary Alice','เงินรวม',10000);
 perform public.moneyspace_write('set_salary',jsonb_build_object('enabled',true,'amount','30000','payday',31,'version',null),gen_random_uuid());
 s:=public.moneyspace_snapshot(due);v:=s->'salary'->>'updated_at';
 if (s->>'cash')::numeric<>10000 or (s->>'income')::numeric<>0 or (s->'salary'->>'amount')::numeric<>30000 then raise exception 'FAIL: expected income changed cash';end if;
 begin update public.salary_plans set amount=1;raise exception 'FAIL: direct update';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_write('set_salary',jsonb_build_object('enabled',true,'amount','NaN','payday',1,'version',v),gen_random_uuid());raise exception 'FAIL: NaN accepted';exception when raise_exception then if sqlerrm<>'INVALID_AMOUNT' then raise;end if;end;
 begin perform public.moneyspace_write('receive_salary',jsonb_build_object('amount','30000','due',(due+interval '1 month - 1 day')::date,'date',today+1,'version',v),gen_random_uuid());raise exception 'FAIL: future actual receipt';exception when raise_exception then if sqlerrm<>'INVALID_SALARY_DATE' then raise;end if;end;
 pay:=jsonb_build_object('amount','29999.99','due',(due+interval '1 month - 1 day')::date,'date',today,'version',v);
 result:=public.moneyspace_write('receive_salary',pay,k);tx:=(result->>'id')::uuid;
 if public.moneyspace_write('receive_salary',pay,k)<>result then raise exception 'FAIL: retry changed result';end if;
 s:=public.moneyspace_snapshot(due);
 if (s->>'cash')::numeric<>39999.99 or (s->>'income')::numeric<>29999.99 or (s->>'expenses')::numeric<>0 or jsonb_array_length(s->'salary'->'payments')<>1 then raise exception 'FAIL: receipt double counted';end if;
 begin perform public.moneyspace_write('receive_salary',pay,gen_random_uuid());raise exception 'FAIL: second key duplicated salary';exception when raise_exception then if sqlerrm<>'SALARY_ALREADY_RECEIVED' then raise;end if;end;
 old_v:=v;
 perform public.moneyspace_write('set_salary',jsonb_build_object('enabled',false,'amount','30000','payday',1,'version',v),gen_random_uuid());
 s:=public.moneyspace_snapshot(due);v:=s->'salary'->>'updated_at';
 begin perform public.moneyspace_write('set_salary',jsonb_build_object('enabled',true,'amount','30000','payday',1,'version',old_v),gen_random_uuid());raise exception 'FAIL: stale plan';exception when raise_exception then if sqlerrm<>'STALE_VERSION' then raise;end if;end;
 perform public.moneyspace_write('set_salary',jsonb_build_object('enabled',true,'amount','32000','payday',1,'version',v),gen_random_uuid());
 s:=public.moneyspace_snapshot(due);pay:=pay||jsonb_build_object('due',due,'version',s->'salary'->>'updated_at');
 begin perform public.moneyspace_write('receive_salary',pay,gen_random_uuid());raise exception 'FAIL: disable/re-enable duplicated salary';exception when raise_exception then if sqlerrm<>'SALARY_ALREADY_RECEIVED' then raise;end if;end;
 select updated_at::text into v from public.transactions where id=tx;
 perform public.moneyspace_write('delete_transaction',jsonb_build_object('id',tx,'version',v),gen_random_uuid());
 s:=public.moneyspace_snapshot(due);
 if (s->>'cash')::numeric<>10000 or (s->>'income')::numeric<>0 or (s->'salary'->'payments'->0->>'deleted')::boolean<>true then raise exception 'FAIL: salary delete accounting';end if;
 begin perform public.moneyspace_write('receive_salary',pay,gen_random_uuid());raise exception 'FAIL: deleted receipt duplicated';exception when raise_exception then if sqlerrm<>'SALARY_ALREADY_RECEIVED' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from salary_ids where label='bob'),true);
do $$begin
 perform public.complete_onboarding('Salary Bob','เงินรวม',0);
 if exists(select 1 from public.salary_plans) or exists(select 1 from public.salary_payments) then raise exception 'FAIL: foreign salary visible';end if;
 if public.moneyspace_snapshot(date_trunc('month',now())::date)->'salary'<>'null'::jsonb then raise exception 'FAIL: foreign snapshot';end if;
 begin perform public.moneyspace_write('receive_salary',jsonb_build_object('amount','1','due',current_date,'date',current_date,'version',now()),gen_random_uuid());raise exception 'FAIL: missing plan accepted';exception when raise_exception then if sqlerrm<>'INVALID_SALARY' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform * from public.salary_plans;raise exception 'FAIL: anonymous table';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_snapshot(current_date);raise exception 'FAIL: anonymous snapshot';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
