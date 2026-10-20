begin;
create temporary table monthly_plan_ids(label text primary key,id uuid default gen_random_uuid());insert into monthly_plan_ids(label) values('alice'),('bob');grant select on monthly_plan_ids to authenticated;
insert into auth.users(id) select id from monthly_plan_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from monthly_plan_ids where label='alice'),true);
do $$
declare m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;p jsonb;s jsonb;k uuid:=gen_random_uuid();r jsonb;v text;before_s jsonb;next_s jsonb;envelope uuid;
begin
 perform public.complete_onboarding('Plan Alice','เงินรวม',10000);
 envelope:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','อาหาร','amount','6000'),gen_random_uuid())->>'id')::uuid;
 before_s:=public.moneyspace_snapshot(m);
 p:=jsonb_build_object('month',m,'version',null,'amount','5000','incomes',jsonb_build_array(jsonb_build_object('name','เงินเดือน','amount','30000.00'),jsonb_build_object('name','งานเสริม','amount','5000.25')));
 r:=public.moneyspace_write('save_month_plan',p,k);
 if public.moneyspace_write('save_month_plan',p,k)<>r then raise exception 'FAIL: retry changed result';end if;
 s:=public.moneyspace_snapshot(m);v:=s->'monthly_plan'->>'updated_at';
 if jsonb_array_length(s->'monthly_plan'->'incomes')<>2 or (s->'monthly_plan'->>'savings_target')::numeric<>5000 then raise exception 'FAIL: saved plan mismatch';end if;
 if (s->'monthly_plan'->'incomes'->1->>'amount')::numeric<>5000.25 then raise exception 'FAIL: imprecise income';end if;
 if s->>'cash'<>before_s->>'cash' or s->>'income'<>before_s->>'income' or s->>'expenses'<>before_s->>'expenses' or s->>'savings'<>before_s->>'savings' or s->'envelopes'<>before_s->'envelopes' or s->>'transaction_count'<>before_s->>'transaction_count' then raise exception 'FAIL: planning mutated actual finances or budget';end if;
 begin perform public.moneyspace_write('save_month_plan',p,gen_random_uuid());raise exception 'FAIL: duplicate stale creation';exception when raise_exception then if sqlerrm<>'STALE_VERSION' then raise;end if;end;
 begin update public.monthly_cashflow_plans set savings_target=1;raise exception 'FAIL: direct update';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_write('save_month_plan',p||jsonb_build_object('version',v,'incomes',jsonb_build_array(jsonb_build_object('name','','amount','2'))),gen_random_uuid());raise exception 'FAIL: blank income name';exception when raise_exception then if sqlerrm<>'INVALID_MONTH_PLAN' then raise;end if;end;
 begin perform public.moneyspace_write('save_month_plan',p||jsonb_build_object('version',v,'incomes',jsonb_build_array(jsonb_build_object('name','bad','amount','1.001'))),gen_random_uuid());raise exception 'FAIL: excessive decimals';exception when raise_exception then if sqlerrm<>'INVALID_MONTH_PLAN' then raise;end if;end;
 begin perform public.moneyspace_write('save_month_plan',p||jsonb_build_object('version',v,'amount','NaN'),gen_random_uuid());raise exception 'FAIL: NaN saving';exception when raise_exception then if sqlerrm<>'INVALID_AMOUNT' then raise;end if;end;
 -- A plan may deliberately exceed expected income. It is a warning, not a funding constraint.
 perform public.moneyspace_write('save_month_plan',p||jsonb_build_object('version',v,'amount','40000','incomes','[]'::jsonb),gen_random_uuid());
 s:=public.moneyspace_snapshot(m);
 if (s->'monthly_plan'->>'savings_target')::numeric<>40000 or jsonb_array_length(s->'monthly_plan'->'incomes')<>0 then raise exception 'FAIL: deficit/empty plan not supported';end if;
 -- Save the previous month separately; current month must stay unchanged.
 perform public.moneyspace_write('save_month_plan',p||jsonb_build_object('month',(m-interval '1 month')::date,'version',null,'amount','2000'),gen_random_uuid());
 next_s:=public.moneyspace_snapshot(m);
 if next_s->'monthly_plan'<>s->'monthly_plan' or next_s->'previous_month_plan'->>'month'<>((m-interval '1 month')::date)::text then raise exception 'FAIL: month separation';end if;
 begin perform public.moneyspace_write('set_salary','{}'::jsonb,gen_random_uuid());raise exception 'FAIL: retired salary still enabled';exception when raise_exception then if sqlerrm<>'FEATURE_REMOVED' then raise;end if;end;
 begin perform public.moneyspace_write('receive_salary','{}'::jsonb,gen_random_uuid());raise exception 'FAIL: retired salary income still enabled';exception when raise_exception then if sqlerrm<>'FEATURE_REMOVED' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from monthly_plan_ids where label='bob'),true);
do $$declare s jsonb;m date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;begin
 perform public.complete_onboarding('Plan Bob','เงินรวม',0);
 if exists(select 1 from public.monthly_cashflow_plans) then raise exception 'FAIL: foreign plan visible';end if;
 s:=public.moneyspace_snapshot(m);
 if s->'monthly_plan'<>'null'::jsonb or s->'previous_month_plan'<>'null'::jsonb then raise exception 'FAIL: foreign snapshot visible';end if;
 perform public.moneyspace_write('save_month_plan',jsonb_build_object('month',m,'amount','1','incomes','[]'::jsonb,'version',null,'owner_id',(select id from monthly_plan_ids where label='alice')),gen_random_uuid());
 if (select count(*) from public.monthly_cashflow_plans)<>1 then raise exception 'FAIL: ownership not derived from auth.uid';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform * from public.monthly_cashflow_plans;raise exception 'FAIL: anonymous plans visible';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
