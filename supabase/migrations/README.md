# MONEYSPACE migrations

Apply the `.sql` migration files in lexical order to a dedicated empty Supabase project. RLS and explicit grants are included. The files match migration versions recorded in the deployed MONEYSPACE project.

Run `../tests/authorization.sql` as project postgres to verify access policies; all fixtures roll back. Do not apply `../tests/bootstrap.sql` to Supabase; it exists only for CI PostgreSQL's Auth role stub.

See `docs/M2-REVIEW.md` for scope, security boundaries and setup. Shared financial mutations remain disabled until transactional APIs ship in M3/M5.
