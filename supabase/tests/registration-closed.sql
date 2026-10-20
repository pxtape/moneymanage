-- CI-only: Supabase managed postgres cannot SET ROLE supabase_auth_admin.
-- The live Auth signup endpoint is tested separately.
begin;
set local role supabase_auth_admin;
do $$begin begin insert into auth.users(id) values(gen_random_uuid()); raise exception 'FAIL: Auth server accepted new registration'; exception when insufficient_privilege then if sqlerrm<>'New account registration is disabled' then raise; end if; end; end $$;
reset role;
select 'PASS: Auth-server registration rejected' as result;
rollback;
