begin;
create temporary table activity_ids(label text primary key,id uuid default gen_random_uuid());
insert into activity_ids(label) values('alice'),('bob');grant select on activity_ids to authenticated;
insert into auth.users(id) select id from activity_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from activity_ids where label='alice'),true);
do $$declare cat uuid;tx uuid;s jsonb;begin
 perform public.complete_onboarding('Activity Alice','เงินรวม',1000);
 select id into cat from public.categories where owner_id=auth.uid() limit 1;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','income','amount','100','date',current_date),gen_random_uuid());
 tx:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','amount','30','date',current_date,'category_id',cat),gen_random_uuid())->>'id')::uuid;
 perform public.moneyspace_write('add_transaction',jsonb_build_object('kind','refund','amount','5','date',current_date,'refund_of_id',tx),gen_random_uuid());
 s:=public.moneyspace_daily_activity(current_date-2,current_date);
 if jsonb_array_length(s)<>3 or (s->2->>'count')::integer<>3 or (s->2->>'expenses')::numeric<>25 or (s->2->>'income')::numeric<>100 then raise exception 'FAIL activity totals %',s;end if;
 if (s->0->>'count')::integer<>0 then raise exception 'FAIL empty date';end if;
 begin perform public.moneyspace_daily_activity(current_date,current_date+1);raise exception 'FAIL future';exception when raise_exception then if sqlerrm<>'INVALID_DATE' then raise;end if;end;
 begin perform public.moneyspace_daily_activity(current_date-62,current_date);raise exception 'FAIL unbounded';exception when raise_exception then if sqlerrm<>'INVALID_DATE' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from activity_ids where label='bob'),true);
do $$declare s jsonb;begin
 perform public.complete_onboarding('Activity Bob','เงินรวม',0);
 s:=public.moneyspace_daily_activity(current_date,current_date);
 if (s->0->>'count')::integer<>0 or (s->0->>'income')::numeric<>0 then raise exception 'FAIL foreign activity';end if;
end $$;
reset role;
set local role anon;
do $$begin begin perform public.moneyspace_daily_activity(current_date,current_date);raise exception 'FAIL anon';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
