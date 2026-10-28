begin;
alter table moneyspace_private.comparison_links add column details_a boolean not null default false,add column details_b boolean not null default false;
create function moneyspace_private.set_comparison_details(p_enabled boolean,p_version timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();pair moneyspace_private.comparison_links%rowtype;mine boolean;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_enabled is null then raise exception 'INVALID_CONSENT';end if;
 select * into pair from moneyspace_private.comparison_links where uid in (user_a,user_b) for update;
 if not found then raise exception 'COMPARISON_NOT_AVAILABLE' using errcode='42501';end if;
 mine:=case when uid=pair.user_a then pair.details_a else pair.details_b end;
 if mine=p_enabled then return jsonb_build_object('confirmed',true);end if;
 if p_version is null or p_version<>pair.updated_at then raise exception 'STALE_VERSION';end if;
 update moneyspace_private.comparison_links set details_a=case when uid=pair.user_a then p_enabled else details_a end,details_b=case when uid=pair.user_b then p_enabled else details_b end,updated_at=clock_timestamp() where id=pair.id;
 return jsonb_build_object('confirmed',true);
end $$;
revoke all on function moneyspace_private.set_comparison_details(boolean,timestamptz) from public,anon;grant execute on function moneyspace_private.set_comparison_details(boolean,timestamptz) to authenticated;
create function public.moneyspace_comparison_details(p_enabled boolean,p_version timestamptz) returns jsonb language sql security invoker set search_path='' as $$select moneyspace_private.set_comparison_details(p_enabled,p_version)$$;
revoke all on function public.moneyspace_comparison_details(boolean,timestamptz) from public,anon;grant execute on function public.moneyspace_comparison_details(boolean,timestamptz) to authenticated;
create or replace function moneyspace_private.read_comparison(p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();pair moneyspace_private.comparison_links%rowtype;through date;today date:=timezone('Asia/Bangkok',now())::date;cm date:=date_trunc('month',timezone('Asia/Bangkok',now()))::date;status jsonb;people jsonb;detail_ok boolean;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_month<'2000-01-01' or p_month>cm then raise exception 'INVALID_MONTH';end if;
 select * into pair from moneyspace_private.comparison_links where uid in (user_a,user_b);
 if not found then return jsonb_build_object('status','unavailable');end if;
 detail_ok:=pair.details_a and pair.details_b;
 status:=jsonb_build_object('status',case when pair.share_a and pair.share_b then 'ready' else 'waiting' end,'mine_enabled',case when uid=pair.user_a then pair.share_a else pair.share_b end,'peer_enabled',case when uid=pair.user_a then pair.share_b else pair.share_a end,'details_mine_enabled',case when uid=pair.user_a then pair.details_a else pair.details_b end,'details_peer_enabled',case when uid=pair.user_a then pair.details_b else pair.details_a end,'details_ready',detail_ok,'version',pair.updated_at);
 if not (pair.share_a and pair.share_b) then return status;end if;
 through:=least(today,(p_month+interval '1 month'-interval '1 day')::date);
 with members as (select pair.user_a owner,'tape' key,'Tape' name union all select pair.user_b,'pat','Pat'),
 ledger as (
 select t.owner_id,t.occurred_on,
 sum(case when t.kind='expense' then t.amount else -t.amount end) net,
 sum(case when t.spending_group_snapshot='food' then case when t.kind='expense' then t.amount else -t.amount end else 0 end) food,
 sum(case when t.spending_group_snapshot='drink' then case when t.kind='expense' then t.amount else -t.amount end else 0 end) drink,
 count(*) filter(where t.kind='expense') expense_count,count(*) filter(where t.kind='refund') refund_count,
 count(*) filter(where t.kind='expense' and t.spending_group_snapshot='food') food_count,count(*) filter(where t.kind='expense' and t.spending_group_snapshot='drink') drink_count
 from public.transactions t where t.owner_id in (pair.user_a,pair.user_b) and t.household_id is null and t.deleted_at is null and t.kind in ('expense','refund') and ((t.occurred_on between p_month and through) or (t.occurred_on between today-6 and today)) group by t.owner_id,t.occurred_on
 )
 select jsonb_agg(jsonb_build_object('key',m.key,'name',m.name,'daily',(
 select jsonb_agg(jsonb_build_object('date',d.day::date,'net',coalesce(l.net,0)::text,'food',coalesce(l.food,0)::text,'drink',coalesce(l.drink,0)::text,'count',coalesce(l.expense_count,0),'food_count',coalesce(l.food_count,0),'drink_count',coalesce(l.drink_count,0),'refund_count',coalesce(l.refund_count,0)) order by d.day)
 from generate_series(p_month,through,interval '1 day') d(day) left join ledger l on l.owner_id=m.owner and l.occurred_on=d.day::date),
 'recent_daily',(select jsonb_agg(jsonb_build_object('date',d.day::date,'net',coalesce(l.net,0)::text,'count',coalesce(l.expense_count,0)) order by d.day) from generate_series(today-6,today,interval '1 day') d(day) left join ledger l on l.owner_id=m.owner and l.occurred_on=d.day::date))||
 case when detail_ok then jsonb_build_object(
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.net::numeric desc,c.name,c.icon) from (
 select coalesce(t.category_name_snapshot,'ไม่ระบุหมวด') name,coalesce(t.category_icon_snapshot,'✳️') icon,
 sum(case when t.kind='expense' then t.amount else -t.amount end)::text net,
 coalesce(sum(t.amount) filter(where t.kind='expense'),0)::text gross,coalesce(sum(t.amount) filter(where t.kind='refund'),0)::text refund,count(*) filter(where t.kind='expense') count
 from public.transactions t where t.owner_id=m.owner and t.household_id is null and t.deleted_at is null and t.kind in ('expense','refund') and t.occurred_on between p_month and through group by t.category_name_snapshot,t.category_icon_snapshot) c),'[]'::jsonb),
 -- Earmarked savings are already part of cash: never add goal contributions again.
 'total_money',coalesce((select sum(moneyspace_private.balance(m.owner,a.id)) from public.accounts a where a.owner_id=m.owner and a.household_id is null and a.deleted_at is null and a.kind<>'debt'),0)::text
 ) else '{}'::jsonb end order by m.key desc) into people from members m;
 return status||jsonb_build_object('month',p_month,'through',through,'recent_from',today-6,'recent_through',today,'money_as_of',today,'people',people);
end $$;
commit;
