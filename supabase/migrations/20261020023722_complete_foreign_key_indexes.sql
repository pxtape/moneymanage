create index allocations_period_owner_idx on public.budget_allocations(budget_period_id,owner_id);
create index contributions_goal_owner_idx on public.goal_contributions(goal_id,owner_id);
create index settlements_transaction_household_idx on public.settlements(transaction_id,household_id);
create index splits_transaction_household_idx on public.transaction_splits(transaction_id,household_id);
