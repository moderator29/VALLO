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
| `payluk_dead_objects_2026-11-09.sql` | Lead | Founder, 9 Nov 2026 (Payluk clearing rules) | APPLIED via END_OF_BATCH_2026-11-10.sql, verified live 10 Nov 2026. Kept as the record; do not run again. Drops two dead database objects, each with what it was and why it is safe: the never-called ledger_record_payluk_commission, and the trigger provider_arrangements_00_payable (fully covered by _00_payable_gate). No row touched. For the founder's end-of-batch block. |
| `protected_payment_categories_all_disabled_2026-11-09.sql` | Lead | Founder, 9 Nov 2026 (build the EscrowPay rail, switched off) | APPLIED via END_OF_BATCH_2026-11-10.sql, verified live 10 Nov 2026 (8 categories disabled). Kept as the record; do not run again. Additive: the eight protected payment categories, all disabled, with an append-only history, and two flags (`payments_escrowpay_on` false, `protected_partner_mark_on` true). Dry-run against live inside a rolled-back transaction: 8 disabled, history written, unknown reads as disabled. The lead's apply asked the founder for approval and timed out; apply on his word. |
| `payluk_switch_off_2026-11-09.sql` | Lead | Founder rule (rail OFF until signed), 9 Nov 2026 | APPLIED by the founder on 9 Nov 2026 in one block, verified live by the lead (switch false, no open alert, the grants gone, roommate_groups UPDATE kept). Kept as the record; do not run again. |
| `resolve_stale_payluk_signature_alert_2026-11-09.sql` | Lead | Lead, 9 Nov 2026 | APPLIED by the founder on 9 Nov 2026 in one block, verified live by the lead (switch false, no open alert, the grants gone, roommate_groups UPDATE kept). Kept as the record; do not run again. |
| `revoke_write_grants_with_no_policy_2026-11-09.sql` | Lead | Lead, 9 Nov 2026 | APPLIED by the founder on 9 Nov 2026 in one block, verified live by the lead (switch false, no open alert, the grants gone, roommate_groups UPDATE kept). Kept as the record; do not run again. |
| `END_OF_BATCH_2_2026-11-10.sql` | Lead | Founder asked for the second block, 10 Nov 2026 | NOT APPLIED. The three files below as ONE transaction with a closing check: protected_rail_server, protected_category_read, docs_page_feedback. Reviewed line by line against the live schema; not yet dry-run as one block (three Supabase approval prompts timed out). This is the file the founder pastes.
| `protected_rail_server_2026-11-10.sql` | Lead | Founder, 10 Nov 2026 (the remaining server steps) | NOT APPLIED. Audit 10.6 items 9 to 11: the deal-to-category map, lifecycle stamps by trigger, the payer's transfer mark (moves no status), observe lets Vallo record refund asked, requires review and its own dispute (never funded, released or refunded), the provider-aware open (service role), the named payer with both consents, and the lapsed-funding list for read-back. Two dry-run attempts on live waited on the founder's approval in the Supabase connection and did not run. |
| `END_OF_BATCH_2026-11-10.sql` | Lead | Founder asked for the one block, 10 Nov 2026 | APPLIED by the founder on 10 Nov 2026, verified live by the lead (8 categories disabled, switch off, unused flag gone, protected rent off, escrowpay allowed, duplicate trigger gone, new columns present). Kept as the record; do not run again. The four files below in order (categories, rail prep, Payluk dead objects, unread flag) as ONE transaction, with a closing check. This is the file the founder pastes; the four files stay as the record. |
| `protected_rail_prep_2026-11-10.sql` | Lead | Founder, 9 Nov 2026 (build the EscrowPay rail, switched off) | APPLIED via END_OF_BATCH_2026-11-10.sql, verified live 10 Nov 2026. Kept as the record; do not run again. Audit 10.6 items 1 to 5 and 8: provider may be escrowpay; Payluk customer ids nullable but still required on Payluk rows; nullable lifecycle columns; two new states (refund_requested, requires_review) in the check and in provider_arrangement_step_ok (twin: lib/money/arrangement-states.ts, already updated); webhook provider widened; rentals_protected_pay_on reads payments_escrowpay_on. Dry-run against live in a rolled-back transaction on 10 Nov: self-checks pass, 0 arrangements, rollback verified. Run after the categories file. |
| `retire_unread_flag_rentals_protected_pay_2026-11-10.sql` | Lead | Removal audit, 10 Nov 2026 | APPLIED via END_OF_BATCH_2026-11-10.sql, verified live 10 Nov 2026 (row gone). Kept as the record; do not run again. Deletes the `rentals_protected_pay` flag row (false, read by no code and no database function). No behaviour changes. For the founder's end-of-batch block. |
| `docs_page_feedback_2026-11-10.sql` | Docs agent | Brief, 10 Nov 2026 ("was this helpful" to the support desk) | NOT APPLIED. Additive: the `doc_feedback` table (RLS on, no member grant), `submit_doc_feedback` for anon and members, `doc_feedback_ready()` (the help, guide and docs pages draw "Was this helpful?" only once it exists), and `staff_doc_feedback_summary` for staff. Not run against live or a local copy. |
| `protected_category_read_2026-11-10.sql` | Protected screens agent | Brief, 10 Nov 2026 (the screens' server read) | NOT APPLIED. Additive and read-only: `public.protected_category_status_for_agreement(uuid)` for members, which answers a party (renter, owner or named payer) with the deal's category and its status, and anyone else with disabled. The app treats the function being missing as disabled. Run AFTER `protected_rail_server_2026-11-10.sql` (it calls `private.protected_category_for_agreement` and reads `named_payer_id`). Not run against live or a local copy. |
| `social_posts_2026-11-10.sql` | Social media desk agent | Brief, 10 Nov 2026 (the Social Media Manager desk at `/admin/social-media`) | NOT APPLIED. Additive: the `public.social_posts` table (the content calendar, drafts, campaigns, approvals and the permanent record of what was posted by hand) and a new private storage bucket, `social-media-library`, for the media library. RLS is admin-role read/write only, the same shape as `support_ticket_escalations_admin_read`; a holder of the `social_media` scope reaches the table through the service client `requireAdmin("social_media")` already hands out. Depends on `staff_business_dev_social_media_2026-11-10.sql` (the `social_media` scope) already being applied. No platform API, no OAuth, no credential anywhere in it. Not run against live or a local copy. |
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
