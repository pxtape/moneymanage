begin;
create temporary table home_ids(label text primary key,id uuid default gen_random_uuid());
insert into home_ids(label) values('alice'),('bob');
grant select on home_ids to authenticated;
insert into auth.users(id) select id from home_ids;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from home_ids where label='alice'),true);
do $$
declare today date:=timezone('Asia/Bangkok',now())::date;cycle_from date;budget_month date;cat uuid;env uuid;goal uuid;expense_id uuid;s jsonb;
begin
 perform public.complete_onboarding('Home Alice','เงินรวม',10000);
 if public.moneyspace_set_cycle_day(20)<>20 then raise exception 'FAIL: cycle day not confirmed';end if;
 cycle_from:=make_date(extract(year from today)::integer,extract(month from today)::integer,20);
 if today<cycle_from then cycle_from:=(cycle_from-interval '1 month')::date;end if;
 budget_month:=date_trunc('month',cycle_from)::date;
 select id into cat from public.categories where owner_id=auth.uid() order by created_at,id limit 1;
 env:=(public.moneyspace_write('create_envelope',jsonb_build_object('name','กินและดื่ม','amount','6000','category_ids',jsonb_build_array(cat)),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('allocate',jsonb_build_object('envelope_id',env,'month',budget_month,'amount','6000'),gen_random_uuid());
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','income','amount','1000','date',today,'merchant','รายได้เสริม'),gen_random_uuid());
 expense_id:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','amount','300','date',today,'category_id',cat,'envelope_id',env),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','refund','amount','50','date',today,'refund_of_id',expense_id),gen_random_uuid());
 goal:=(public.moneyspace_write('create_goal',jsonb_build_object('name','ฉุกเฉิน','amount','1000'),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('earmark_goal',jsonb_build_object('goal_id',goal,'amount','100'),gen_random_uuid());
 s:=public.moneyspace_home(today);
 if s->>'cycle_day'<>'20' or s->>'cycle_from'<>cycle_from::text then raise exception 'FAIL: custom cycle missing: %',s;end if;
 if (s#>>'{money,total}')::numeric<>10750 or (s#>>'{money,savings}')::numeric<>100 or (s#>>'{money,spendable}')::numeric<>10650 then raise exception 'FAIL: cash or earmark double counted: %',s->'money';end if;
 if (s#>>'{cycle,income}')::numeric<>1000 or (s#>>'{cycle,expenses}')::numeric<>250 or (s#>>'{cycle,budget_total}')::numeric<>6000 then raise exception 'FAIL: cycle totals: %',s->'cycle';end if;
 if (s#>>'{daily,expenses}')::numeric<>250 or jsonb_array_length(s#>'{daily,transactions}')<>3 or jsonb_array_length(s#>'{daily,categories}')<>1 then raise exception 'FAIL: daily details: %',s->'daily';end if;
 if jsonb_array_length(s#>'{weekly,days}')<>7 or jsonb_array_length(s->'yearly')<1 then raise exception 'FAIL: chart windows incomplete';end if;
 begin perform public.moneyspace_set_cycle_day(29);raise exception 'FAIL: invalid cycle accepted';exception when raise_exception then if sqlerrm<>'INVALID_CYCLE_DAY' then raise;end if;end;
 begin perform public.moneyspace_home(today+1);raise exception 'FAIL: future date accepted';exception when raise_exception then if sqlerrm<>'INVALID_DATE' then raise;end if;end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from home_ids where label='bob'),true);
do $$declare s jsonb;begin
 perform public.complete_onboarding('Home Bob','เงินรวม',0);
 s:=public.moneyspace_home(timezone('Asia/Bangkok',now())::date);
 if (s#>>'{money,total}')::numeric<>0 or (s#>>'{cycle,income}')::numeric<>0 then raise exception 'FAIL: foreign finances exposed';end if;
end $$;
reset role;

set local role anon;
do $$begin
 begin perform public.moneyspace_home(current_date);raise exception 'FAIL: anonymous home read';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_set_cycle_day(1);raise exception 'FAIL: anonymous cycle write';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
