-- VALLO ROOMMATES, PART 6: BOOKKEEPING.
--
-- Three migrations from 8 November were run by hand in the SQL Editor, so
-- their effects are live but the migration list does not name them. This
-- records them under the versions the repository files carry, and records
-- this Roommates drop itself, so the live list and the repository agree
-- (`scripts/check-migrations.mjs --online`). Nothing else changes.

insert into supabase_migrations.schema_migrations (version, name)
values
  ('20261108190000', 'circle_remove_member'),
  ('20261108200000', 'risk_alerts_last_seen'),
  ('20261108210000', 'd02_merge_host_policies'),
  ('20261109000000', 'roommates_all')
on conflict (version) do nothing;
