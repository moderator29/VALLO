# Auth latency, measured: sign-in, sign-up, passcode, Face ID, /settings

13 November 2026, agent SPEED. The founder: "database have not been responding
... clicking passcode and it stuck there, same as password login ... make it
fast, less than 0.2 to 0.5 seconds".

Nothing here signed in to production or typed a passcode. Authenticated paths
are counted from the code; their round trips are timed with anon-callable
stand-ins of the same shape against the real Supabase public URL.

## 1. Where things run

| piece | region | evidence |
|---|---|---|
| Vercel functions | `dub1` (Dublin) | `apps/web/vercel.json` `"regions": ["dub1"]`, held by `src/lib/ops/function-region.test.ts` |
| Supabase project `uccixoonmbhrnyczyigt` | `eu-west-1` (Ireland) | `docs/DEPLOY.md` |
| this sandbox (where the timings were taken) | US East | Supabase answers carry `cf-ray: ...-IAD` |

**The regions match.** A function in `dub1` reaches the database in about 1 to
3 ms. Nothing for the founder to change in Vercel, provided the production
project really serves from `dub1`: the one check is the `x-vercel-id`
response header on any production page, which must read `...::dub1::...`
(DEPLOY.md). If it reads `iad1`, the dashboard's Settings, Functions,
Function Region must be set to Dublin (dub1); that adds a transatlantic round
trip (about 80 ms) to every query otherwise.

From this sandbox every round trip crosses the Atlantic (wall time about 150
to 400 ms through the sandbox proxy), so the wall numbers below are inflated
by the sandbox, not by Vercel. The number that describes production is the
Supabase-side time (`x-envoy-upstream-service-time`).

## 2. One round trip, measured (curl, 11 calls each, first call dropped, 16:50 Lagos)

| call | Supabase-side median / p90 | wall from sandbox median / p90 |
|---|---|---|
| GoTrue `/auth/v1/health` | 0 / 1 ms | 331 / 352 ms |
| GoTrue JWKS (what `getClaims` fetches, cached 10 min) | 26 / 26 ms (edge cache) | 53 / 66 ms |
| `rpc/passcode_status` (executes, refuses anon) | 6 / 11 ms | 357 / 397 ms |
| `rpc/consume_rate_limit` (refused to anon) | 6 / 11 ms | 368 / 405 ms |
| `rpc/shell_context` (refuses anon) | 3 / 4 ms | 348 / 396 ms |
| `money_credentials` select (refused to anon) | 6 / 20 ms | 373 / 400 ms |
| `states` select (a real 200 read) | 4 / 12 ms | 340 / 365 ms |

**The database was healthy at 16:50.** Every auth-path statement is a single
row by primary key or unique index and answers in single-digit milliseconds.
So the "stuck" the founder saw is not a slow auth query: it is (a) the whole
database stalling (15:00 to 15:40, 57014 timeouts; the 74.6 s insert and 25 s
sweep maximums before the reset), and (b) code paths with no deadline, which
turned a stall into a spinner with no end. Both are addressed below.

## 3. Every round trip on each server path, before and after

`RT` = one network round trip from the function. `||` = asked together.
"Healthy server time" = round trips x about 5 to 10 ms in `dub1`, plus the
named fixed costs; it is an estimate from the measurements above, not a
production measurement.

| path | before (in order) | after (in order) | serial RTs before -> after |
|---|---|---|---|
| password sign-in | count by connection, count by address (MUST stay serial), GoTrue password check (no deadline) | unchanged order; GoTrue check now bounded at 8 s and a lost answer says "cannot reach accounts" | 3 -> 3 |
| email code sign-in | count, GoTrue verifyOtp, cookie, **server redirect: Next builds /home inside the action** | count, verifyOtp, then answers `{ next }`; the page loads it | 2 + a whole /home render -> 2 |
| sign-up (form) | count, GoTrue signUp (sends the email), marketing read, marketing write, age receipt, terms upsert, redirect | count, signUp, redirect; the 4 bookkeeping writes run in `after()` | 6 -> 2 |
| sign-up (code) | count email, count connection, verifyOtp, welcome: getUserById, profiles, outbox | (count email || count connection), verifyOtp; welcome in `after()` | 6 -> 2 |
| passcode unlock (code) | getClaims (local), count user, count address, `passcode_verify` (bcrypt cost 10), cookie | getClaims (local), (count user || count address), `passcode_verify` bounded at 6 s | 3 -> 2 |
| Face ID begin | GoTrue getUser, key list, challenge insert | (key list || challenge insert); caller from the verified token | 3 -> 1 |
| Face ID finish | GoTrue getUser, count, passcode_status, key read, challenge take, counter update | (count || passcode_status || key read || challenge take), signature checked in memory, counter update in `after()` | 6 -> 1 |
| (app) layout, every signed-in page | in parallel: `shell_context` (1), `passcode_status` (1), Face ID offer: GoTrue getUser then key list (2) | in parallel: `shell_context` (1), `passcode_status` (1), Face ID offer: key list only, bounded 3 s (1) | critical path 2 -> 1 |

The two password sign-in counts stay one after the other: in parallel, a
connection refused by its own count would still spend the owner's address
count, which is the lockout this order prevents (held by
`sign-in-fast.test.ts`, unchanged and passing).

### The same shapes replayed against the real Supabase URL (Node, 15 runs, warm connections, run 2)

These are the sandbox's transatlantic wall times, so read the ratio, not the
absolute: one round trip from here was 345 ms median.

| path | before median / p90 | after median / p90 |
|---|---|---|
| passcode unlock | 732 / 1072 ms | 526 / 631 ms |
| Face ID begin | 486 / 678 ms | 201 / 388 ms |
| Face ID finish | 938 / 1314 ms | 374 / 436 ms |
| layout Face ID offer | 375 / 504 ms | 150 / 170 ms |
| sign-up code | 913 / 1080 ms | 468 / 520 ms |
| sign-up form | 918 / 976 ms | 291 / 312 ms |
| password sign-in (unchanged) | 451 / 513 ms | same |

Projected server time in `dub1` with a healthy database (estimate): passcode
unlock about 20 ms of round trips plus bcrypt (tens of ms), so well under
200 ms; Face ID finish about 10 ms plus signature check; password sign-in two
counts (about 20 ms) plus GoTrue's own password check and session insert. The
remaining wait the founder sees is the phone's link to Dublin (about 100 to
150 ms per request from Lagos) and the next page's render, which is separate
from the auth action now.

## 4. /settings, which did not load in 90 s twice today

Server path, in order:

1. (app) layout, in parallel: `shell_context` (1 RT), `passcode_status` (1 RT), Face ID offer (now 1 RT).
2. `resolveSession()`: GoTrue `getUser` (1 RT, memoised for the request).
3. In parallel:
   - `loadProfileState`: `profiles` row, then (states || lga || occupation names), then (bookings exact count || saved exact count || reviews exact count): **3 serial RTs**;
   - `loadSessions`: `my_sessions()` over `auth.sessions` (1 RT);
   - `getAgentContext`: `agents` (1 RT);
   - `readMyRewards`: no call today.
4. Then, inside the JSX, **one after the other**: `phoneConfirmationOn()` (`feature_flags`, 1 RT, not cached) and `isQaTester()` (`qa_accounts` through the **service role**, 1 RT).

Healthy, that is about 6 serial round trips (well under 100 ms in `dub1`).
Nothing on it should take 90 s, and the member-role reads cannot: they carry a
15 s client deadline and the 8 s `authenticated` statement timeout. **Two
calls on this path have neither**, because they run as the service role
(which has no statement timeout) through a client with no deadline:

- `isQaTester()` (`lib/phone-otp/qa.ts`), when the phone flag is on;
- `reportReadError()` -> `recordCrash()` (`lib/observability/crash-log.ts`,
  `admin.rpc("record_crash")`), which `loadProfileState` AWAITS when its
  profile read fails. In a stall the profile read fails at 8 s, and the
  report of that failure then waits for the same stalled database for as
  long as the stall lasts.

That is the most likely way /settings, and only pages that report a failed
read on the way, hangs past 90 s while other pages load. Not proven (no
production logs here). The fix is not in this agent's files; see section 7.

## 5. What changed, by file

- `apps/web/src/lib/security/agent-client.ts`: the sign-in client had no deadline at all; it now carries `deadlineFetch` (15 s default, a caller may ask for less).
- `apps/web/src/lib/supabase/admin.ts`: `createAdminClient({ deadlineMs })`, optional; unchanged for every existing caller.
- `apps/web/src/lib/auth/actions.ts`: password check bounded at 8 s (`SIGN_IN_AUTH_WAIT_MS`); a lost answer says "We cannot reach accounts right now. Nothing you typed was lost." instead of a credentials refusal; sign-up's marketing and terms writes and the code step's welcome moved to `after()`; the sign-up code's two counts asked together; a timed-out code check is no longer called a wrong code.
- `apps/web/src/lib/auth/after-response.ts` (new): `afterResponse()`, Next's `after()` with a never-awaited fallback outside a request.
- `apps/web/src/lib/auth/unreachable.ts` (new): which auth errors are "no answer" (status 0, any 5xx) rather than about what was typed.
- `apps/web/src/lib/auth/email-code.ts`, `phone-sign-in.ts`, `code-sign-in-state.ts`, `apps/web/src/components/auth/CodeSignInForm.tsx`: a script submit is answered with `{ next }` and the form loads it, as the password sign-in already did; a timed-out check says "failed", not "wrong code".
- `apps/web/src/components/auth/EmailAuthForm.tsx`: after 5 s pending, a status line under the pill says it is still working and nothing typed is lost.
- `apps/web/src/lib/passcode/actions.ts`: the two pacing counts asked together; `passcode_verify` bounded at 6 s and answered as a retryable `error`.
- `apps/web/src/lib/passcode/passkey-unlock.ts`: unlock identifies the caller from the verified token (no GoTrue trip; turning the lock off keeps `getUser`); begin and finish are one round trip each; key counter written in `after()`; every call bounded at 3 s; the layout's Face ID offer no longer calls GoTrue.
- `apps/web/src/lib/passcode/state.ts`: `readPasscodeStatus(supabase, { waitMs })`, used by Face ID only; the layout keeps the client's own deadline (an early error there would lock a member who never set a passcode).
- `apps/web/src/lib/passcode/within.ts` (new), `patient-verify.ts`, `apps/web/src/components/passcode/PasskeyUnlockKey.tsx`: every wait on the lock is bounded (passcode ask 10 s then asked again under the same attempt id; Face ID begin 6 s, finish 10 s, then "that did not work" with the keypad).

The keypad already had its pressed state (`.nf-passcode__key:active`) and the
lock already says "Checking" in the render after the last digit; neither was
changed.

## 6. The SQL draft

`supabase/drafts/auth_speed_2026-11-13.sql`, not applied, not verified
against live: read-only checks first, then `rate_limits` fillfactor 70 for
in-place counter updates, a seven-day purge of `cron.job_run_details` (now
and daily), the hold sweep moved from every minute to every five
(`cron.alter_job`, the founder's compliance call), and a commented-out
service-role statement timeout for the founder to decide. No new index: the
auth statements are already on primary keys and unique indexes.

## 7. For others and for the founder

- **RECOVER / observability owner:** `recordCrash` (`lib/observability/crash-log.ts`) should use `createAdminClient({ deadlineMs: 3_000 })`, and `reportReadError` callers on a render path should not await it (or wrap it in `after()`). Same for `isQaTester` (`lib/phone-otp/qa.ts`), and `/settings/page.tsx` should ask `phoneConfirmationOn()` and `isQaTester()` in its `Promise.all` instead of one after the other.
- **Founder:** check `x-vercel-id` reads `dub1` on production; in Supabase, Reports, Database, look at CPU and Disk IO for 15:00 to 15:40 Lagos today (a small compute that ran out of its disk burst budget stalls every query at once, which matches the timings); read and decide `supabase/drafts/auth_speed_2026-11-13.sql` and `supabase/drafts/sign_in_bookkeeping_off_the_sign_in_2026-11-13.sql`.

## 8. Not proven

- No authenticated production timing: the projected server times are estimates from round-trip counts and the anon-side measurements.
- The 90 s /settings cause is a reading of the code, not a log.
- Whether the 15:00 stall was compute exhaustion: needs the Supabase dashboard.
- The SQL draft has not run anywhere.
