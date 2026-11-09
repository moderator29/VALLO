# What is waiting in pending/ (Survey B, D-09)

Nothing here runs by itself and `check-migrations` ignores this folder. Each
file is pasted by the founder in the Supabase SQL Editor, then the lead checks
it live, moves it to `supabase/migrations/` under its stamped version and
records it in `APPLIED.txt`.

| File | Owner | Decided | Status |
|---|---|---|---|
| Applied 7 Nov 2026 by the founder, verified live by the lead, moved to `supabase/migrations/20261107180100` to `20261107180400` | Lead | | Done |
| `newsletter_default_on_2026-11-launch.sql` | Founder | Founder, 4 Nov 2026 | NOT APPLIED, checked live 9 Nov 2026: 18 profiles still carry `marketing = false`. Its last statement ENQUEUES THE SEND, so split it: the backfill is a harmless preference fix, the enqueue is outward facing and goes out only on the founder's word. |
| `example_collection_retirement_extended_to_2027-05-07.sql` | Lead | Founder, 9 Nov 2026 | NOT APPLIED, checked live 9 Nov 2026: `demo_retire_after` is still 2026-11-07 on 64 rows while the code already says 2027-05-07. The code and the database disagree until this is run. |
| `resolve_stale_payluk_signature_alert_2026-11-09.sql` | Lead | Lead, 9 Nov 2026 | NOT APPLIED. Resolves the one open "Webhook: payluk, signature invalid" alert of 13 Oct 2026 (an unsigned post the route refused with 401; Payluk was never on). Probe db-p2-02 stays red until it runs. Data only, one row. |
| `revoke_write_grants_with_no_policy_2026-11-09.sql` | Lead | Lead, 9 Nov 2026 | NOT APPLIED. Takes away 12 tables' write grants that no policy backs (the successor to part 4 below, which only covered the Circle tables). Probe db-06 stays red until it runs. Verified against live: its closing assertion will pass. |
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
