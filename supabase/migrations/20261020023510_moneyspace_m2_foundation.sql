-- MONEYSPACE M2 foundation. Apply once to an empty dedicated project.
-- All future financial writes require reviewed transactional RPCs (M3/M5).
begin;
create schema if not exists moneyspace_private;
revoke all on schema moneyspace_private from public, anon;
grant usage on schema moneyspace_private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
 currency text not null default 'THB' check (currency = 'THB'),
 timezone text not null default 'Asia/Bangkok' check (timezone = 'Asia/Bangkok'),
 onboarding_completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.households (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 1 and 80),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.household_members (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete restrict,
 role text not null check (role in ('owner','admin','member','viewer')),
 contribution_ratio numeric(7,6) not null default 0 check (contribution_ratio between 0 and 1),
 joined_at timestamptz not null default now(), removed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(household_id,user_id), unique(id,household_id)
);
create table public.accounts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 household_id uuid references public.households(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 1 and 60),
 kind text not null default 'bank' check (kind in ('bank','cash','ewallet','debt')),
 currency text not null default 'THB' check (currency='THB'),
 opening_balance numeric(16,2) not null default 0 check (opening_balance between -999999999999.99 and 999999999999.99),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,owner_id), unique(id,household_id)
);
create table public.envelopes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 household_id uuid references public.households(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 1 and 60),
 rollover_mode text not null default 'none' check (rollover_mode in ('none','positive','full')),
 alert_ratio numeric(3,2) not null default .80 check (alert_ratio between 0 and 1),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,owner_id), unique(id,household_id)
);
-- Reusable quick-entry labels are categories, not budget envelopes.
create table public.categories (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 1 and 40), icon text not null default '✳️' check (char_length(icon) between 1 and 12),
 default_envelope_id uuid, default_tag text not null default 'need' check (default_tag in ('need','want')),
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,owner_id), foreign key(default_envelope_id,owner_id) references public.envelopes(id,owner_id) on delete restrict
);
create unique index categories_owner_name_live on public.categories(owner_id,lower(btrim(name))) where deleted_at is null;
create table public.budget_periods (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 household_id uuid references public.households(id) on delete restrict,
 month_start date not null check (extract(day from month_start)=1),
 closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,owner_id), unique nulls not distinct(owner_id,household_id,month_start)
);
create table public.budget_allocations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 budget_period_id uuid not null, envelope_id uuid not null,
 amount numeric(16,2) not null check (amount >= 0), rollover_amount numeric(16,2) not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(budget_period_id,owner_id) references public.budget_periods(id,owner_id) on delete restrict,
 foreign key(envelope_id,owner_id) references public.envelopes(id,owner_id) on delete restrict,
 unique(budget_period_id,envelope_id)
);
create table public.recurring_rules (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 account_id uuid not null, category_id uuid, amount numeric(16,2) not null check(amount>0),
 cadence text not null check(cadence in ('weekly','monthly','yearly')), next_due date not null, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(account_id,owner_id) references public.accounts(id,owner_id) on delete restrict,
 foreign key(category_id,owner_id) references public.categories(id,owner_id) on delete restrict,
 unique(id,owner_id)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 household_id uuid references public.households(id) on delete restrict,
 account_id uuid not null, destination_account_id uuid,
 kind text not null check(kind in ('income','expense','transfer','refund','settlement')),
 amount numeric(16,2) not null check(amount>0 and amount<=999999999999.99),
 category_id uuid, envelope_id uuid, merchant text check(char_length(merchant)<=100), notes text check(char_length(notes)<=500),
 tag text check(tag in ('need','want')), occurred_on date not null,
 refund_of_id uuid, recurring_rule_id uuid, idempotency_key uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(account_id,owner_id) references public.accounts(id,owner_id) on delete restrict,
 foreign key(destination_account_id,owner_id) references public.accounts(id,owner_id) on delete restrict,
 foreign key(category_id,owner_id) references public.categories(id,owner_id) on delete restrict,
 foreign key(envelope_id,owner_id) references public.envelopes(id,owner_id) on delete restrict,
 foreign key(recurring_rule_id,owner_id) references public.recurring_rules(id,owner_id) on delete restrict,
 unique(id,owner_id), unique(id,household_id), unique(owner_id,idempotency_key),
 foreign key(refund_of_id,owner_id) references public.transactions(id,owner_id) on delete restrict,
 check(account_id is distinct from destination_account_id),
 check((kind in ('transfer','settlement')) = (destination_account_id is not null)),
 check(refund_of_id is null or kind='refund')
);
create table public.transaction_splits (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete restrict,
 transaction_id uuid not null, member_id uuid not null, amount numeric(16,2) not null check(amount>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(transaction_id,household_id) references public.transactions(id,household_id) on delete restrict,
 foreign key(member_id,household_id) references public.household_members(id,household_id) on delete restrict,
 unique(transaction_id,member_id)
);
create table public.settlements (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete restrict,
 from_member_id uuid not null, to_member_id uuid not null, transaction_id uuid not null unique,
 amount numeric(16,2) not null check(amount>0), settled_on date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(from_member_id,household_id) references public.household_members(id,household_id) on delete restrict,
 foreign key(to_member_id,household_id) references public.household_members(id,household_id) on delete restrict,
 foreign key(transaction_id,household_id) references public.transactions(id,household_id) on delete restrict,
 check(from_member_id<>to_member_id)
);
create table public.goals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 household_id uuid references public.households(id) on delete restrict,
 name text not null check(char_length(btrim(name)) between 1 and 80), target_amount numeric(16,2) not null check(target_amount>0), target_date date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,owner_id), unique(id,household_id)
);
create table public.goal_contributions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 goal_id uuid not null, account_id uuid not null, transaction_id uuid,
 amount numeric(16,2) not null check(amount>0), kind text not null check(kind in ('earmark','transfer')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(goal_id,owner_id) references public.goals(id,owner_id) on delete restrict,
 foreign key(account_id,owner_id) references public.accounts(id,owner_id) on delete restrict,
 foreign key(transaction_id,owner_id) references public.transactions(id,owner_id) on delete restrict,
 check((kind='transfer')=(transaction_id is not null)), unique(goal_id,transaction_id)
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete restrict,
 invited_by uuid not null references public.profiles(id) on delete restrict,
 email text not null check(char_length(email)<=254), token_hash text not null unique check(char_length(token_hash)=64),
 role text not null check(role in ('admin','member','viewer')), expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(expires_at>created_at)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete restrict,
 entity_table text not null, entity_id uuid not null, action text not null check(action in ('INSERT','UPDATE','DELETE')),
 created_at timestamptz not null default now()
);
-- Avoid copying financial content or session tokens into audit records.

-- Internal lookup functions never trust JWT user_metadata. Membership is read live.
create function moneyspace_private.is_member(p_household_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.household_members m join public.households h on h.id=m.household_id
 where m.household_id=p_household_id and m.user_id=(select auth.uid()) and m.removed_at is null and h.deleted_at is null)
$$;
create function moneyspace_private.is_household_admin(p_household_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.household_members m join public.households h on h.id=m.household_id
 where m.household_id=p_household_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin') and m.removed_at is null and h.deleted_at is null)
$$;
revoke all on function moneyspace_private.is_member(uuid),moneyspace_private.is_household_admin(uuid) from public,anon;
grant execute on function moneyspace_private.is_member(uuid),moneyspace_private.is_household_admin(uuid) to authenticated;

create function moneyspace_private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end $$;
create function moneyspace_private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_events(actor_id,entity_table,entity_id,action) values(auth.uid(),tg_table_name,coalesce(new.id,old.id),tg_op);
 return coalesce(new,old);
end $$;
revoke all on function moneyspace_private.touch_updated_at(),moneyspace_private.audit_change() from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['profiles','households','household_members','accounts','envelopes','categories','budget_periods','budget_allocations','transactions','transaction_splits','settlements','goals','goal_contributions','recurring_rules','invitations','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t<>'audit_events' then
 execute format('create trigger set_updated_at before update on public.%I for each row execute function moneyspace_private.touch_updated_at()',t);
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function moneyspace_private.audit_change()',t);
 end if;
 end loop;
end $$;

create policy own_profile_select on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_profile_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant insert(id,display_name),update(display_name,onboarding_completed_at) on public.profiles to authenticated;
create policy own_household_select on public.households for select to authenticated using(deleted_at is null and moneyspace_private.is_member(id));
create policy members_select on public.household_members for select to authenticated using(moneyspace_private.is_member(household_id));
-- Shared visibility is explicit on each resource. Household membership never grants access to personal rows.
create policy accounts_select on public.accounts for select to authenticated using(deleted_at is null and ((household_id is null and owner_id=(select auth.uid())) or (household_id is not null and moneyspace_private.is_member(household_id))));
create policy onboarding_account_insert on public.accounts for insert to authenticated with check(owner_id=(select auth.uid()) and household_id is null);
grant insert(owner_id,name,kind,opening_balance) on public.accounts to authenticated;
create policy envelopes_select on public.envelopes for select to authenticated using(deleted_at is null and ((household_id is null and owner_id=(select auth.uid())) or (household_id is not null and moneyspace_private.is_member(household_id))));
create policy categories_select on public.categories for select to authenticated using(owner_id=(select auth.uid()) and deleted_at is null);
create policy categories_insert on public.categories for insert to authenticated with check(owner_id=(select auth.uid()) and deleted_at is null and default_envelope_id is null);
grant insert(id,owner_id,name,icon,default_tag,sort_order) on public.categories to authenticated;
create policy periods_select on public.budget_periods for select to authenticated using((household_id is null and owner_id=(select auth.uid())) or (household_id is not null and moneyspace_private.is_member(household_id)));
create policy allocations_select on public.budget_allocations for select to authenticated using(exists(select 1 from public.budget_periods p where p.id=budget_period_id) and exists(select 1 from public.envelopes e where e.id=envelope_id));
create policy transactions_select on public.transactions for select to authenticated using(deleted_at is null and ((household_id is null and owner_id=(select auth.uid()) and exists(select 1 from public.accounts a where a.id=account_id and a.household_id is null)) or (household_id is not null and moneyspace_private.is_member(household_id) and exists(select 1 from public.accounts a where a.id=account_id and a.household_id=transactions.household_id))));
create policy splits_select on public.transaction_splits for select to authenticated using(moneyspace_private.is_member(household_id) and exists(select 1 from public.transactions t where t.id=transaction_id));
create policy settlements_select on public.settlements for select to authenticated using(deleted_at is null and moneyspace_private.is_member(household_id) and exists(select 1 from public.transactions t where t.id=transaction_id));
create policy goals_select on public.goals for select to authenticated using(deleted_at is null and ((household_id is null and owner_id=(select auth.uid())) or (household_id is not null and moneyspace_private.is_member(household_id))));
create policy contributions_select on public.goal_contributions for select to authenticated using(deleted_at is null and exists(select 1 from public.goals g where g.id=goal_id) and exists(select 1 from public.accounts a where a.id=account_id));
create policy recurring_select on public.recurring_rules for select to authenticated using(owner_id=(select auth.uid()) and deleted_at is null);
create policy invitations_admin_select on public.invitations for select to authenticated using(moneyspace_private.is_household_admin(household_id));
create policy audit_own_select on public.audit_events for select to authenticated using(actor_id=(select auth.uid()));

-- Atomic first-run creation. No SECURITY DEFINER: every statement passes the caller's RLS.
create function public.complete_onboarding(p_display_name text,p_account_name text,p_opening_balance numeric default 0) returns void
language plpgsql security invoker set search_path='' as $$
declare uid uuid := auth.uid(); item record;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_opening_balance<0 or p_opening_balance>999999999999.99 or p_opening_balance<>round(p_opening_balance,2) then raise exception 'Invalid balance'; end if;
 insert into public.profiles(id,display_name) values(uid,btrim(p_display_name)) on conflict(id) do nothing;
 perform 1 from public.profiles where id=uid for update;
 if exists(select 1 from public.profiles where id=uid and onboarding_completed_at is not null) then return; end if;
 insert into public.accounts(owner_id,name,opening_balance) values(uid,btrim(p_account_name),p_opening_balance);
 for item in select * from (values ('อาหาร','🍜','need'),('เครื่องดื่ม','☕','want'),('เดินทาง','🚆','need'),('ช้อปปิ้ง','🛍️','want'),('บิลและบ้าน','🏠','need'),('สุขภาพ','🌿','need')) as x(name,icon,tag) loop
 insert into public.categories(owner_id,name,icon,default_tag) values(uid,item.name,item.icon,item.tag) on conflict do nothing;
 end loop;
 update public.profiles set onboarding_completed_at=now() where id=uid;
end $$;
revoke all on function public.complete_onboarding(text,text,numeric) from public,anon;
grant execute on function public.complete_onboarding(text,text,numeric) to authenticated;

-- Index every foreign key and principal policy predicate.
create index households_owner_idx on public.households(owner_id);
create index household_members_user_live_idx on public.household_members(user_id,household_id) where removed_at is null;
create index accounts_owner_live_idx on public.accounts(owner_id) where deleted_at is null;
create index accounts_household_idx on public.accounts(household_id);
create index envelopes_owner_live_idx on public.envelopes(owner_id) where deleted_at is null;
create index envelopes_household_idx on public.envelopes(household_id);
create index categories_envelope_owner_idx on public.categories(default_envelope_id,owner_id);
create index periods_household_idx on public.budget_periods(household_id);
create index allocations_owner_idx on public.budget_allocations(owner_id);
create index allocations_envelope_idx on public.budget_allocations(envelope_id,owner_id);
create index recurring_account_idx on public.recurring_rules(account_id,owner_id);
create index recurring_category_idx on public.recurring_rules(category_id,owner_id);
create index recurring_owner_due_idx on public.recurring_rules(owner_id,next_due) where active and deleted_at is null;
create index transactions_owner_date_live_idx on public.transactions(owner_id,occurred_on desc) where deleted_at is null;
create index transactions_account_idx on public.transactions(account_id,owner_id);
create index transactions_destination_idx on public.transactions(destination_account_id,owner_id);
create index transactions_category_idx on public.transactions(category_id,owner_id);
create index transactions_envelope_idx on public.transactions(envelope_id,owner_id);
create index transactions_household_date_idx on public.transactions(household_id,occurred_on desc) where deleted_at is null;
create index transactions_refund_idx on public.transactions(refund_of_id,owner_id);
create index transactions_recurring_idx on public.transactions(recurring_rule_id,owner_id);
create index splits_member_household_idx on public.transaction_splits(member_id,household_id);
create index splits_household_idx on public.transaction_splits(household_id);
create index settlements_from_member_idx on public.settlements(from_member_id,household_id);
create index settlements_to_member_idx on public.settlements(to_member_id,household_id);
create index settlements_household_idx on public.settlements(household_id);
create index goals_owner_idx on public.goals(owner_id);
create index goals_household_idx on public.goals(household_id);
create index contributions_owner_idx on public.goal_contributions(owner_id);
create index contributions_account_idx on public.goal_contributions(account_id,owner_id);
create index contributions_transaction_idx on public.goal_contributions(transaction_id,owner_id);
create index invitations_household_idx on public.invitations(household_id);
create index invitations_inviter_idx on public.invitations(invited_by);
create index audit_actor_created_idx on public.audit_events(actor_id,created_at desc);
comment on table public.transactions is 'Physical money movement only. Budget allocations and goal earmarks are separate. M2 exposes SELECT only; atomic financial writes ship in M3/M5.';
commit;
