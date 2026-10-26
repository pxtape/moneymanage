#!/usr/bin/env bash
set -eu
column_count=$(psql -Atc "select count(*) from information_schema.columns where table_schema='auth' and table_name='users'")
[ "$column_count" = '1' ] || { echo 'Refusing outside minimal CI Auth stub' >&2; exit 1; }
IFS='|' read -r owner account category rule < <(psql -Atc 'select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()')
psql -v ON_ERROR_STOP=1 -c "insert into auth.users(id) values('$owner');insert into public.profiles(id,display_name,onboarding_completed_at) values('$owner','Bill race fixture',now());insert into public.accounts(id,owner_id,name,opening_balance) values('$account','$owner','Test',1000);insert into public.categories(id,owner_id,name) values('$category','$owner','Test');insert into public.recurring_rules(id,owner_id,account_id,category_id,amount,cadence,next_due,is_bill,bill_name,bill_first_month,bill_due_day) values('$rule','$owner','$account','$category',100,'monthly',current_date,true,'Race bill',date_trunc('month',timezone('Asia/Bangkok',now()))::date,1);" >/dev/null
version=$(psql -Atc "select updated_at from public.recurring_rules where id='$rule'")
sql="begin;set local role authenticated;select set_config('request.jwt.claim.sub','$owner',true);select public.moneyspace_write('pay_bill',jsonb_build_object('id','$rule','version','$version','month',date_trunc('month',timezone('Asia/Bangkok',now()))::date,'amount','100.00','date',timezone('Asia/Bangkok',now())::date),gen_random_uuid());commit;"
set +e
psql -v ON_ERROR_STOP=1 -c "$sql" >/tmp/moneyspace-bill-race-1.log 2>&1 & pid1=$!
psql -v ON_ERROR_STOP=1 -c "$sql" >/tmp/moneyspace-bill-race-2.log 2>&1 & pid2=$!
wait "$pid1"; one=$?
wait "$pid2"; two=$?
set -e
if ! { [ "$one" -eq 0 ] && [ "$two" -ne 0 ]; } && ! { [ "$two" -eq 0 ] && [ "$one" -ne 0 ]; }; then cat /tmp/moneyspace-bill-race-{1,2}.log;exit 1;fi
if ! grep -q 'BILL_ALREADY_PAID' /tmp/moneyspace-bill-race-{1,2}.log; then cat /tmp/moneyspace-bill-race-{1,2}.log;exit 1;fi
actual=$(psql -Atc "select moneyspace_private.balance('$owner','$account'),(select count(*) from public.transactions where owner_id='$owner'),(select count(*) from public.bill_payments where owner_id='$owner' and voided_at is null)")
[ "$actual" = '900.00|1|1' ] || { echo "Unexpected bill race: $actual";exit 1; }
echo 'PASS: two simultaneous bill confirmations create one expense and one payment'
