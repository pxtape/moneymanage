begin;
-- Even if a future grant is added accidentally, raw pair rows stay inaccessible.
create policy deny_raw_comparison_access on moneyspace_private.comparison_links for all to authenticated using(false) with check(false);
commit;
