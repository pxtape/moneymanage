begin;
create temporary table category_tag_ids(label text primary key,id uuid default gen_random_uuid());insert into category_tag_ids(label) values('alice'),('bob');grant select on category_tag_ids to authenticated;
insert into auth.users(id) select id from category_tag_ids;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from category_tag_ids where label='alice'),true);
do $$
declare c public.categories%rowtype;t uuid;t2 uuid;v text;d date:=timezone('Asia/Bangkok',now())::date;payload jsonb;s jsonb;
begin
 perform public.complete_onboarding('Tag Alice','เงินรวม',1000);
 select * into c from public.categories where owner_id=auth.uid() order by created_at,id limit 1;
 t:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id',c.id,'amount','20','date',d,'tag','need'),gen_random_uuid())->>'id')::uuid;
 payload:=jsonb_build_object('category_id',c.id,'version',c.updated_at,'name',c.name,'icon',c.icon,'tag','want');
 perform public.moneyspace_write('update_category',payload,gen_random_uuid());
 if (select default_tag from public.categories where id=c.id)<>'want' or (select tag from public.transactions where id=t)<>'need' then raise exception 'FAIL: category tag edit rewrote history';end if;
 t2:=(public.moneyspace_write('add_transaction',jsonb_build_object('kind','expense','category_id',c.id,'amount','30','date',d),gen_random_uuid())->>'id')::uuid;
 if (select tag from public.transactions where id=t2)<>'want' then raise exception 'FAIL: new expense did not inherit default';end if;
 select updated_at::text into v from public.transactions where id=t;
 perform public.moneyspace_write('edit_transaction',jsonb_build_object('id',t,'version',v,'kind','expense','category_id',c.id,'amount','25','date',d),gen_random_uuid());
 if (select tag from public.transactions where id=t)<>'need' then raise exception 'FAIL: amount-only edit lost recorded tag';end if;
 select updated_at::text into v from public.categories where id=c.id;
 begin perform public.moneyspace_write('update_category',payload||jsonb_build_object('version',v,'tag','invalid'),gen_random_uuid());raise exception 'FAIL: invalid category tag';exception when raise_exception then if sqlerrm<>'INVALID_CATEGORY' then raise;end if;end;
 -- Backward-compatible callers that omit tag preserve the configured default.
 perform public.moneyspace_write('update_category',jsonb_build_object('category_id',c.id,'version',v,'name',c.name,'icon',c.icon),gen_random_uuid());
 if (select default_tag from public.categories where id=c.id)<>'want' then raise exception 'FAIL: omitted tag reset default';end if;
 s:=public.moneyspace_snapshot(date_trunc('month',d)::date);
 if (s->>'expenses')::numeric<>55 or (s->>'cash')::numeric<>945 then raise exception 'FAIL: tag change altered amounts';end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from category_tag_ids where label='bob'),true);
do $$begin
 perform public.complete_onboarding('Tag Bob','เงินรวม',0);
end $$;
reset role;
create temporary table foreign_category as select id,updated_at,name,icon from public.categories where owner_id=(select id from category_tag_ids where label='alice') limit 1;grant select on foreign_category to authenticated;
set local role authenticated;
do $$declare c record;begin
 select * into c from foreign_category;
 begin perform public.moneyspace_write('update_category',jsonb_build_object('category_id',c.id,'version',c.updated_at,'name',c.name,'icon',c.icon,'tag','need'),gen_random_uuid());raise exception 'FAIL: foreign tag edit';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
