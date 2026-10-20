#!/usr/bin/env bash
# CI-only: refuse real Supabase auth.users schemas before creating any fixtures.
set -eu
column_count=$(psql -Atc "select count(*) from information_schema.columns where table_schema='auth' and table_name='users'")
if [ "$column_count" != '1' ]; then
  echo 'Refusing concurrency harness outside the minimal CI Auth stub.' >&2
  exit 1
fi
IFS='|' read -r test_owner test_account test_category < <(psql -Atc 'select gen_random_uuid(),gen_random_uuid(),gen_random_uuid()')
psql -v ON_ERROR_STOP=1 -c "insert into auth.users(id) values('$test_owner'); insert into public.profiles(id,display_name,onboarding_completed_at) values('$test_owner','Concurrency fixture',now()); insert into public.accounts(id,owner_id,name,opening_balance) values('$test_account','$test_owner','Test',100); insert into public.categories(id,owner_id,name) values('$test_category','$test_owner','Test');" >/dev/null
race_sql="begin; set local role authenticated; select set_config('request.jwt.claim.sub','$test_owner',true); select public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','account_id','$test_account','category_id','$test_category','amount','80.00','date',timezone('Asia/Bangkok',now())::date),gen_random_uuid()); commit;"
set +e
psql -v ON_ERROR_STOP=1 -c "$race_sql" >/tmp/moneyspace-race-1.log 2>&1 & race_pid_one=$!
psql -v ON_ERROR_STOP=1 -c "$race_sql" >/tmp/moneyspace-race-2.log 2>&1 & race_pid_two=$!
wait "$race_pid_one"; exit_one=$?
wait "$race_pid_two"; exit_two=$?
set -e
if [ "$exit_one" -ne 0 ] || [ "$exit_two" -ne 0 ]; then
  cat /tmp/moneyspace-race-1.log /tmp/moneyspace-race-2.log
  exit 1
fi
actual_result=$(psql -Atc "select moneyspace_private.balance('$test_owner','$test_account')::text,(select count(*) from public.transactions where owner_id='$test_owner')")
if [ "$actual_result" != '-60.00|2' ]; then
  echo "Unexpected concurrent balance/result: $actual_result" >&2
  exit 1
fi
echo 'PASS: concurrent independent expenses both commit exactly; balance -60.00'

# Simultaneous retry of one identical request must create a single additional row.
race_key=$(psql -Atc 'select gen_random_uuid()')
race_sql="begin; set local role authenticated; select set_config('request.jwt.claim.sub','$test_owner',true); select public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id','$test_category','amount','10.00','date',timezone('Asia/Bangkok',now())::date),'$race_key'); commit;"
psql -v ON_ERROR_STOP=1 -c "$race_sql" >/tmp/moneyspace-retry-1.log 2>&1 & race_pid_one=$!
psql -v ON_ERROR_STOP=1 -c "$race_sql" >/tmp/moneyspace-retry-2.log 2>&1 & race_pid_two=$!
wait "$race_pid_one"
wait "$race_pid_two"
actual_result=$(psql -Atc "select moneyspace_private.balance('$test_owner','$test_account')::text,(select count(*) from public.transactions where owner_id='$test_owner')")
if [ "$actual_result" != '-70.00|3' ]; then
  echo "Unexpected concurrent retry result: $actual_result" >&2
  exit 1
fi
echo 'PASS: concurrent identical requests commit once'
