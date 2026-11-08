# What is waiting in pending/ (Survey B, D-09)

Nothing here runs by itself and `check-migrations` ignores this folder. Each
file is pasted by the founder in the Supabase SQL Editor, then the lead checks
it live, moves it to `supabase/migrations/` under its stamped version and
records it in `APPLIED.txt`.

| File | Owner | Decided | Status |
|---|---|---|---|
| Applied 7 Nov 2026 by the founder, verified live by the lead, moved to `supabase/migrations/20261107180100` to `20261107180400` | Lead | | Done |
| `newsletter_default_on_2026-11-launch.sql` | Founder | Founder, 4 Nov 2026 | Data, run once by hand. Do not run without the founder's word. |
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
groups, viewings, alerts, blocks and the feed share). State: NOT APPLIED.
After it is pasted, record it with `node scripts/check-migrations.mjs`.
