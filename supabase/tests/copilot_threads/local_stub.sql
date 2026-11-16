-- A local stand-in for the parts of the live schema that
-- copilot_threads_2026-11-16.sql touches: the two roles, auth.users,
-- auth.uid() read from the request's JWT claim, and the private schema.
do $$ begin create role anon nologin; create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema if not exists private;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
