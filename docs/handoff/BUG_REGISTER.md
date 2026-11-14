# BUG REGISTER (one current list, started 14 November 2026)

Phase 1 of the next-generation upgrade. Every open finding from
`SURVEY_A_MEMBER_PUBLIC.md` (153 findings, 7 Nov), `SURVEY_B_WORKSPACES_BACKEND.md`
(84 findings, 7 Nov) and `AUDIT_2026-11.md` was re-checked against the tree at
`4baa05fb` (14 Nov) by grep and file reads, and against the live database by
read-only queries on 14 November. Items the Grade 1 rounds fixed are dropped
(evidence at the end). Feature-level survey items (new desks, calendars,
Activity inbox, wizard re-flow) are not bugs; they live in the phase queue in
`WORK_QUEUE.md`.

Severity: P0 broken for members now, P1 wrong or costly and must be fixed in
phase 2, P2 polish or hygiene. Status: Open (verified today), Verify (needs a
browser walk, a measurement or deeper reading), Founder (his action or
decision).

## Open

| Id | P | Area | Where | What | How to see it | Status |
|---|---|---|---|---|---|---|
| BR-01 | - | Console | `lib/admin/queue-desk-actions.ts` | DROPPED on a closer read: the void returns are redirect-back form actions that carry the outcome in the URL (`?claim=taken/held/failed`, `?bulk=done-skipped-failed`) and `QueueTable.tsx:524` draws the words. The survey's AD-02 is answered | Take a row another reviewer holds; the page says so | Fixed |
| BR-02 | P2 | Ops, cost | `apps/web/vercel.json:29` plus pg_cron `vallo_reconcile_payments` | DOWNGRADED on a closer read: the audit flood is fixed (clean runs inside a heartbeat skip the audit row, `app/api/paystack/reconcile/route.ts:195`, measured 13 Nov), and the route's own comment keeps both schedulers deliberately so the freshness watch survives one being down. Residual: two Paystack API sweeps an hour; fold into the M3 cost review rather than fix now | `audit_log` reconciliation rows per day | Verify in M3 |
| BR-03 | P1 | Ops | `risk_alerts` live | "Store: readiness, red": 29 open alerts, one a day, never resolved, not idempotent; trains staff to ignore the Alerts desk (survey R-04) | Live read 14 Nov: 29 open, newest 13 Nov | Open |
| BR-04 | P1 | Ops | `app/api/health/catalogue`, `risk_alerts` | "Catalogue: read failed": 12 open, newest 13 Nov 14:13. It guards the public catalogue home and search read; recurring and uninvestigated (survey R-05) | Live read 14 Nov | Open |
| BR-05 | P1 | Ops | `risk_alerts`, the schedule watch | "Cron: schedule, silent" 14 Nov 06:20 names `display-rates` as never having reported "in the 1259 hours this watch has been running". The job is one day old and ran ok at 12:50 UTC today (`job_runs`: wrote 10 rates). Two watch defects: it measures a new job against the watch's own uptime, and a green run does not resolve the open alert. Cause read 14 Nov: every pg_cron failure on 13 Nov is "job startup timeout" between 14:00 and 22:22 UTC, the disk IO crisis window; none since. The remaining work is the watch's new-job wording and auto-resolve on green, folded into M3; the pile itself is cleared by `alerts_cleanup_2026-11-14.sql` | Live reads 14 Nov | Explained; M3 for the watch |
| BR-06 | - | Client | `crash_reports` | SUPERSEDED: the crash log (live since the Grade 1 rounds) records chunk path, line and column, which is how BR-20 was traced to the incoming-calls channel and fixed. The alerts desk's thin `stack_top` no longer matters; the crash desk is the place to read | See BR-20 | Fixed by BR-20 |
| BR-07 | P2 | Member shell | `components/app/AppShell.tsx` (drawer), `components/app/assistant/AssistantChat.tsx` (history) | The last two hand-rolled `role="dialog"` surfaces outside `Sheet` (survey SW14 remnant); the guard test does not catch them | Grep `role="dialog"` | Open |
| BR-08 | P2 | Routes | `app/(app)/u/page.tsx` and `app/(app)/around/people/page.tsx` | Two people finders for one job (survey SW13) | Open both | Open |
| BR-09 | P2 | Routes | `app/(auth)/sign-in/email/page.tsx` | Redirect-only page still ships as a route (survey SW13) | Open `/sign-in/email` | Open |
| BR-10 | P1 | Backend | bookings, inspection_requests, briefs | HALF FIXED before this session: `lib/security/member-write-limit.ts` caps holds, inspection requests, viewings and briefs app-side. The database backstop was still missing (live `pg_trigger` read, 14 Nov), and bookings insert under the member's own RLS client, so the data API walked past the app limit. Backstop written as `insert_limits_bookings_inspections_briefs_2026-11-14.sql`, waiting on the founder | Live trigger list shows 9 `limit_member_inserts` rows after he runs it | Open, SQL ready |
| BR-11 | P1 | Backend | Wizard checklist, admin `heldReasons`, database gates | Publish blockers computed in three places that can disagree (survey B-13); whether the Grade 1 rounds consolidated them is unverified | Read `lib/admin/actions.ts` and the wizard gate | Verify |
| BR-12 | P2 | Performance | `app/(app)/search/page.tsx`, `listing/[id]/page.tsx` | Serial read waves (survey B-05). The catalogue cache (a642 commit) changed this; remeasure in M2 before touching | M2 baseline | Verify |
| BR-13 | P1 | Forms | Platform-wide | `enterKeyHint`/`inputMode`/`autoComplete` present in 72 of about 266 component files that draw an input; the keyboard pass (queue S5) owns the fix and the guard test | S5 | Open, owned by S5 |
| BR-14 | P2 | Console | Various `app/admin` files | 18 files reported inline `setMessage` feedback in survey AD-02; 102 workspace files now call `banner.*`, so most are fixed; the remainder needs a sweep count | Grep after S-series lands | Verify |
| BR-15 | P2 | Database | Live vs repo | Migration drift is down from 3 to 1 (774 live, 773 files). Identify the one live-only version and file it (survey D-08) | M3 | Verify |
| BR-16 | P1 | Database | Hot tables | 393 multiple-permissive-policy warnings on 7 Nov; `20261108210000_d02_merge_host_policies` fixed hosts; listings, accommodations, businesses still to confirm (survey D-02) | M3 advisors read | Verify |
| BR-17 | P2 | Ops | `risk_alerts` | Stale open alerts from September and October (Sanctions lists 10, email outbox, push drain answered, reconcile needs attention): jobs are green now, alerts never closed (survey R-07) | Resolve-with-note SQL for the founder | Open |
| BR-19 | P0 | Console, database | `public.mandate_consents`, `public.property_candidates` | Scoped staff (the founder's new desk model) are refused by `private.is_staff()` database guards: the BD Director's Listings desk consent read crashes with 42501 "only staff read consent" (5 live rows since 13:54 on 14 Nov, right after her admin role was removed). Fix written as `supabase/migrations/pending/scoped_staff_listing_doors_2026-11-14.sql`, waiting on the founder | Live `crash_reports`, newest 13:54 14 Nov | Open, SQL ready |
| BR-20 | P0 | Client, realtime | `lib/calls/useCallRealtime.ts` (incoming-calls channel, mounted in the signed-in shell) | `RangeError: Maximum call stack size exceeded`, 69 occurrences on live (51 iOS `/home/*`, 11 `/around/*`, 7 web `/admin/*`), last 15:13 on 14 Nov. Cause: the channel's status callback handled CLOSED by calling removeChannel, and removeChannel fires that same callback with CLOSED synchronously, recursing. FIXED in `1094b98f` with a once-per-channel guard (`invitesStatusPlan`) and a test that simulates the echo. Reaches members when main next deploys | Live `crash_reports` stops growing after the deploy | Fixed on branch |
| BR-21 | P2 | Ops | `app/api/health/catalogue` vs `crash_reports` | A `ChunkLoadError` and iOS `TypeError: Load failed` rows (5 on `/home/*` today) look like network flake plus a deploy-window chunk miss; watch, do not chase yet | Live `crash_reports` | Verify |
| BR-18 | - | Staff | `risk_alerts` | "Abuse in a message", 1 open since 10 Nov, severity high: a moderation case waiting on a person, not a code bug. The founder or the moderation desk should look | Admin alerts desk | Founder |

## Still to do for phase 1

- A fresh walk of the app as a member, an agent, a host and a guest at 390 px
  (and the console at 1440) to add what the surveys could not see. Planned
  together with the M2 Core Web Vitals baseline run, same Playwright session.
- M3 resolves every Verify row above against live.

## Dropped as fixed (spot-checked 14 November against `4baa05fb`)

- SW2 (`useToast` retired: no caller left), SW7 (`State.tsx` art only where a
  caller names it), B-04 (`getAgentContext` wrapped in `cache()`), B-07 (dead
  sign-up phone gate deleted), R-01 (`ownChannelName` on the call channels),
  X-02 in the main (102 workspace files call `banner.*`), SW4/X-01 in the main
  (PageFrame on 131 app files), LW-01 in part (`ListingWizard.tsx` down from
  4,733 to 1,993 lines), SW13 in part (`around/manage`, `profile/setup/firm`
  redirect pages deleted), SW16 in part (`/around` back control gone;
  `/search` keeps a `BackButton` with a written reason at
  `app/(app)/search/page.tsx:568`, treated as a ruled exception).
- The two surveys' remaining P0s (D-08 three-migration drift, X-02, SW1 wave
  1, SW2, `/stories/[id]` useToast) are all fixed or reduced as above.
