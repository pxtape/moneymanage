-- CI-only minimal Auth identity boundary for PostgreSQL role/RLS tests.
-- Never apply this file to Supabase: Supabase already manages auth.users and auth.uid().
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema public,auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;

-- Model the Auth server role for the closed-registration trigger assertion.
create role supabase_auth_admin nologin;
grant usage on schema auth to supabase_auth_admin;
grant insert on auth.users to supabase_auth_admin;
