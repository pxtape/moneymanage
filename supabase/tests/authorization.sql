-- Run as project postgres via SQL editor/MCP. Everything, including synthetic auth users, rolls back.
begin;
create temporary table ms_test_ids(key text primary key,id uuid not null default gen_random_uuid());
insert into ms_test_ids(key) values('alice'),('bob'),('carol'),('dave'),('house'),('private_account'),('shared_account'),('bob_account'),('expense_private'),('expense_shared');
grant select on ms_test_ids to authenticated,anon;
insert into auth.users(id) select id from ms_test_ids where key in ('alice','bob','carol','dave');
insert into public.profiles(id,display_name) select id,key from ms_test_ids where key in ('alice','bob','carol');
insert into public.households(id,owner_id,name) values((select id from ms_test_ids where key='house'),(select id from ms_test_ids where key='alice'),'Test household');
insert into public.household_members(household_id,user_id,role) select h.id,u.id,case when u.key='alice' then 'owner' else 'viewer' end from ms_test_ids h cross join ms_test_ids u where h.key='house' and u.key in ('alice','bob');
insert into public.accounts(id,owner_id,household_id,name,opening_balance) values
 ((select id from ms_test_ids where key='private_account'),(select id from ms_test_ids where key='alice'),null,'Alice private',1000),
 ((select id from ms_test_ids where key='shared_account'),(select id from ms_test_ids where key='alice'),(select id from ms_test_ids where key='house'),'Shared',2000),
 ((select id from ms_test_ids where key='bob_account'),(select id from ms_test_ids where key='bob'),null,'Bob private',500);
insert into public.transactions(id,owner_id,household_id,account_id,kind,amount,occurred_on) values
 ((select id from ms_test_ids where key='expense_private'),(select id from ms_test_ids where key='alice'),null,(select id from ms_test_ids where key='private_account'),'expense',10.25,current_date),
 ((select id from ms_test_ids where key='expense_shared'),(select id from ms_test_ids where key='alice'),(select id from ms_test_ids where key='house'),(select id from ms_test_ids where key='shared_account'),'expense',20.15,current_date);

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from ms_test_ids where key='bob'),true);
do $$begin
 if (select count(*) from public.profiles)<>1 then raise exception 'FAIL: profiles leak'; end if;
 if (select count(*) from public.accounts)<>2 then raise exception 'FAIL: member account visibility'; end if;
 if exists(select 1 from public.accounts where name='Alice private') then raise exception 'FAIL: private account shared'; end if;
 if (select count(*) from public.transactions)<>1 then raise exception 'FAIL: private transaction shared'; end if;
 if exists(select 1 from public.invitations) then raise exception 'FAIL: viewer invitation access'; end if;
 begin
 insert into public.categories(owner_id,name) values((select id from ms_test_ids where key='alice'),'Spoofed');
 raise exception 'FAIL: category ownership spoof accepted';
 exception when insufficient_privilege then null; end;
 begin
 update public.profiles set id=(select id from ms_test_ids where key='alice');
 raise exception 'FAIL: profile owner reassignment allowed';
 exception when insufficient_privilege then null; end;
 begin
 update public.household_members set role='owner' where user_id=(select id from ms_test_ids where key='bob');
 raise exception 'FAIL: role escalation accepted';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.transactions(owner_id,account_id,kind,amount,occurred_on) values((select id from ms_test_ids where key='bob'),(select id from ms_test_ids where key='private_account'),'expense',1,current_date);
 raise exception 'FAIL: direct financial write accepted';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.audit_events(entity_table,entity_id,action) values('profiles',gen_random_uuid(),'UPDATE');
 raise exception 'FAIL: audit spoof accepted';
 exception when insufficient_privilege then null; end;
end $$;

reset role;
update public.household_members set removed_at=now() where user_id=(select id from ms_test_ids where key='bob');
set local role authenticated;
do $$begin
 if (select count(*) from public.accounts)<>1 or exists(select 1 from public.transactions) or exists(select 1 from public.households) then raise exception 'FAIL: removed member retained shared access'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from ms_test_ids where key='carol'),true);
do $$begin
 if exists(select 1 from public.accounts) or exists(select 1 from public.transactions) or exists(select 1 from public.household_members) then raise exception 'FAIL: outsider access'; end if;
 insert into public.categories(owner_id,name) values(auth.uid(),'สัตว์เลี้ยง');
 if (select count(*) from public.categories)<>1 then raise exception 'FAIL: own category persistence'; end if;
 begin
 insert into public.categories(owner_id,name) values(auth.uid(),'สัตว์เลี้ยง');
 raise exception 'FAIL: duplicate category accepted';
 exception when unique_violation then null; end;
 begin
 insert into public.categories(owner_id,name) values(auth.uid(),' ');
 raise exception 'FAIL: blank category accepted';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from ms_test_ids where key='dave'),true);
do $$begin
 begin
 perform public.complete_onboarding('Dave','',100.25);
 raise exception 'FAIL: invalid onboarding accepted';
 exception when check_violation then null; end;
 if exists(select 1 from public.profiles) or exists(select 1 from public.accounts) then raise exception 'FAIL: onboarding not atomic'; end if;
 begin
 perform public.complete_onboarding('Dave','บัญชี',100.251);
 raise exception 'FAIL: fractional satang accepted';
 exception when raise_exception then if sqlerrm<>'Invalid balance' then raise; end if; end;
 perform public.complete_onboarding('Dave','บัญชีใช้จ่าย',100.25);
 perform public.complete_onboarding('Dave','Duplicate',999);
 if (select count(*) from public.accounts)<>1 or (select count(*) from public.categories)<>6 then raise exception 'FAIL: onboarding not idempotent'; end if;
 if (select opening_balance from public.accounts)<>100.25 then raise exception 'FAIL: decimal balance'; end if;
 if not exists(select 1 from public.profiles where onboarding_completed_at is not null) then raise exception 'FAIL: onboarding completion'; end if;
 if not exists(select 1 from public.audit_events where actor_id=auth.uid()) then raise exception 'FAIL: audit event missing'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin perform 1 from public.accounts; raise exception 'FAIL: anonymous read'; exception when insufficient_privilege then null; end;
 begin perform public.complete_onboarding('Anonymous','Account',0); raise exception 'FAIL: anonymous RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$begin
 if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'FAIL: public table without RLS'; end if;
end $$;
select 'PASS: ownership, private/shared isolation, removed member, outsider, category persistence/constraints, escalation denial, direct financial/audit write denial, atomic/idempotent onboarding, decimal precision, anonymous denial, all-table RLS' as authorization_result;
rollback;
