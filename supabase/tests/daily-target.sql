begin;
create temporary table target_ids(label text primary key,id uuid default gen_random_uuid());
insert into target_ids(label) values('alice'),('bob');
grant select on target_ids to authenticated;
insert into auth.users(id) select id from target_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from target_ids where label='alice'),true);
do $$
declare invalid numeric;before_cash text;
begin
 perform public.complete_onboarding('Target Alice','เงินรวม',1000);
 if public.moneyspace_daily_target()::numeric<>0 then raise exception 'FAIL default';end if;
 before_cash:=public.moneyspace_home(timezone('Asia/Bangkok',now())::date)#>>'{money,total}';
 if public.moneyspace_daily_target(150.25)::numeric<>150.25 or public.moneyspace_daily_target()::numeric<>150.25 then raise exception 'FAIL persistence';end if;
 if public.moneyspace_home(timezone('Asia/Bangkok',now())::date)#>>'{money,total}'<>before_cash then raise exception 'FAIL cash changed';end if;
 foreach invalid in array array[-1,1.001,1000000000,'NaN'::numeric,'Infinity'::numeric] loop
  begin perform public.moneyspace_daily_target(invalid);raise exception 'FAIL invalid accepted';exception when raise_exception then if sqlerrm<>'INVALID_AMOUNT' then raise;end if;end;
 end loop;
 if public.moneyspace_daily_target(0)::numeric<>0 then raise exception 'FAIL zero';end if;
 perform public.moneyspace_daily_target(150.25);
end $$;
select set_config('request.jwt.claim.sub',(select id::text from target_ids where label='bob'),true);
do $$begin
 perform public.complete_onboarding('Target Bob','เงินรวม',0);
 if public.moneyspace_daily_target()::numeric<>0 then raise exception 'FAIL foreign target';end if;
 perform public.moneyspace_daily_target(200);
end $$;
select set_config('request.jwt.claim.sub',(select id::text from target_ids where label='alice'),true);
do $$begin if public.moneyspace_daily_target()::numeric<>150.25 then raise exception 'FAIL foreign write';end if;end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.moneyspace_daily_target();raise exception 'FAIL anon read';exception when insufficient_privilege then null;end;
 begin perform public.moneyspace_daily_target(1);raise exception 'FAIL anon write';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
