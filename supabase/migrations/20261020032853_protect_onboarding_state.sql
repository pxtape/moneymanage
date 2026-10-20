revoke update(onboarding_completed_at) on public.profiles from authenticated;
create policy requests_explicit_deny on moneyspace_private.financial_requests for all to authenticated using(false) with check(false);
