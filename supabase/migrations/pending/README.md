# What is waiting in pending/ (Survey B, D-09)

Nothing here runs by itself and `check-migrations` ignores this folder. Each
file is pasted by the founder in the Supabase SQL Editor, then the lead checks
it live, moves it to `supabase/migrations/` under its stamped version and
records it in `APPLIED.txt`.

| File | Owner | Decided | Status |
|---|---|---|---|
| Applied 7 Nov 2026 by the founder, verified live by the lead, moved to `supabase/migrations/20261107180100` to `20261107180400` | Lead | | Done |
| `newsletter_default_on_2026-11-launch.sql` | Founder | Founder, 4 Nov 2026 | Re-checked live 9 Nov 2026: the backfill (step 1) now matches 0 rows, so it would change nothing; step 2 counts 23 who would get the newsletter. Step 3 SENDS it: run only on the founder's word, on its own. |
| `example_collection_retirement_extended_to_2027-05-07.sql` | Lead | Founder, 9 Nov 2026 | APPLIED by the lead on 9 Nov 2026 through the Supabase tools (data only, 64 example listings now carry `demo_retire_after = 2027-05-07`, matching the code). Kept here as the record; do not run again (it would change nothing). |
| `payluk_switch_off_2026-11-09.sql` | Lead | Founder rule (rail OFF until signed), 9 Nov 2026 | APPLIED by the founder on 9 Nov 2026 in one block, verified live by the lead (switch false, no open alert, the grants gone, roommate_groups UPDATE kept). Kept as the record; do not run again. |
| `resolve_stale_payluk_signature_alert_2026-11-09.sql` | Lead | Lead, 9 Nov 2026 | APPLIED by the founder on 9 Nov 2026 in one block, verified live by the lead (switch false, no open alert, the grants gone, roommate_groups UPDATE kept). Kept as the record; do not run again. |
| `revoke_write_grants_with_no_policy_2026-11-09.sql` | Lead | Lead, 9 Nov 2026 | APPLIED by the founder on 9 Nov 2026 in one block, verified live by the lead (switch false, no open alert, the grants gone, roommate_groups UPDATE kept). Kept as the record; do not run again. |
| `rt01_remove_retired_objects.sql` | Lead | Draft, 13 Oct 2026 | DROPS objects. Never run without the founder's explicit yes. |
| `rt02_remove_v100_renter_passport.sql` | Lead | Applied by hand 29 Oct 2026 | Kept as the record only. Do not run again. |
| `LANDMARKS.md` and `rollback/` | Lead | | Reference only. |

## Vallo Roommates (8 November 2026): ONE file to paste

`ROOMMATES_ALL.sql` is the whole Roommates database in one file, built by
`build_roommates_all.sh` from the parts `roommates_1_core.sql`,
`roommates_2_engine.sql`, `roommates_3_integrations.sql` and
`roommates_5_institutions.sql`. The founder pastes it once into the Supabase
SQL Editor. It is safe to run twice and deletes nothing. Every part is
tested on a local copy of the schema (`supabase/tests/roommates`: the stub,
then `e2e.sql` and `e2e_feed.sql`, which exercise matching, privacy, chat,
groups, viewings, alerts, blocks and the feed share).

**State: APPLIED. Checked live on 9 November 2026**, correcting the "NOT
APPLIED" this file used to claim. `supabase_migrations.schema_migrations`
carries `20261109000000 roommates_all`, every roommate table exists, and
parts 4, 6 and 7 are live too (part 4's revokes have taken effect on the
Circle tables, part 6's bookkeeping rows are present, part 7's moderation
tables exist). Part 4 only tidied the tables added on 7 and 8 November, so
the tables Roommates itself added still carry write grants no policy backs:
`revoke_write_grants_with_no_policy_2026-11-09.sql` finishes that job and is
still waiting.
