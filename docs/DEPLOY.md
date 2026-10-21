# Vallo deploy runbook

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

Written for the owner, to be worked top to bottom. Every step is either a
value to paste, a dashboard screen to visit, or a command to run. Where
something cannot be automated from this repository it says so, and where a
capability is not built yet it says that too, in section 9.

Target platform: Vercel (Next.js 16 App Router, Turbopack). Database, auth
and storage: Supabase project `uccixoonmbhrnyczyigt` (eu-west-1, Postgres 17).
Payments: Paystack. Transactional email: Resend. Deploy branch policy:
`main` is never pushed to from a working session, so the production branch on
Vercel should be whichever branch the owner promotes deliberately.

Functions run in Dublin (`"regions": ["dub1"]` in `apps/web/vercel.json`,
OPS-09), next to the database in eu-west-1. If the Vercel dashboard's
Settings → Functions → Function Region shows something else, `vercel.json`
wins on the next deploy. Confirm it once after deploying: the `x-vercel-id`
response header should read `…::dub1::…`, not `iad1`.

Order of operations, because some steps depend on earlier ones:

1. Create the Vercel project and set the environment variables (section 2).
2. Deploy once, so a real HTTPS URL exists (section 3).
3. Feed that URL back into `NEXT_PUBLIC_SITE_URL`, Supabase auth and Paystack
   (sections 3, 4, 5), then redeploy.
4. Work the pre-launch checklist (section 7) and the post-deploy smoke test
   (section 8).

---

## 0. Who owns the accounts (OPS-P2-02, FOUNDER)

**Today the company does not own its own production.** The live database is Supabase project `uccixoonmbhrnyczyigt`. It sits in a project named after a personal Gmail address, inside an organisation called `Naijafinds`. Hosting is Vercel team `boosthubservice-2204's projects`, next to unrelated projects. A lost personal login or a lapsed personal card would take VALLO SPACES LTD's customer data, payment ledgers and KYC store with it.

Only the founder can move them. Both moves keep the same URLs, keys and data.

1. **A company identity.**
   - Create `ops@vallospaces.com`, or any company-domain mailbox that is not one person's.
   - Turn on 2FA and store the recovery codes somewhere a second director can reach.
2. **Supabase.**
   - Signed in as `ops@`, create the organisation **VALLO SPACES LTD**.
   - Invite a second person as **Owner**.
   - Put the company card on it and choose **Pro**, which gives daily backups (OPS-07). Point-in-time recovery is a separate add-on on top of Pro; turn it on too, because the payment and Guarantee ledgers are in this database.
   - From an account that owns both organisations, open project `uccixoonmbhrnyczyigt`, then **Project Settings → General → Transfer project**, and choose VALLO SPACES LTD.
   - The project URL and API keys do not change, so no Vercel variable changes.
3. **Vercel.**
   - Signed in as `ops@`, create the team **Vallo**.
   - Invite a second **Owner**, put the company card on it, and move it to **Pro** BEFORE the transfer. The catalogue canary cron runs every 5 minutes, which Hobby does not allow, so a project transferred into a Hobby team loses its crons.
   - In `boosthubservice-2204's projects`, open the Vallo project, then **Settings → General → Transfer Project**, and choose Vallo.
   - Environment variables, deployments and cron jobs move with the project. Afterwards, check four things:
     - `vallospaces.com` still shows *Valid Configuration* under Domains;
     - the GitHub app is installed for the new team, so pushes still deploy;
     - the next cron run appears in the logs;
     - any Vercel ↔ Supabase integration is re-authorised for the new team and organisation. It is tied to the account that installed it, so it may need installing again.
4. **Write it down here.** Fill in the table below. Remove the old personal accounts' access only after one deploy and one cron run have succeeded under the new owners.

| Account | Organisation / team | Owners (two, by role) | Recovery codes kept at |
|---|---|---|---|
| Supabase | *to fill: VALLO SPACES LTD* | *to fill* | *to fill* |
| Vercel | *to fill: Vallo* | *to fill* | *to fill* |
| GitHub | *to fill* | *to fill* | *to fill* |

## 1. What is in the box

Counted on 23 September 2026. Counts go stale within days on this repository;
re-count rather than quoting them.

- **About 145 page routes and 26 API routes** under `apps/web/src/app`
  (excluding the `(dev)` fixture harnesses).
- **About 300 migrations** in `supabase/migrations/`, RLS on every table,
  `private.*` security-definer helpers. Nothing in this runbook needs a
  migration run by hand unless section 4.6 says so.
- **`pg_cron` with 14 jobs**, which run whether or not the web application is
  up (ADR-014), and **eight Vercel Cron jobs** declared in `apps/web/vercel.json`.
- An installable PWA: `apps/web/src/app/manifest.ts` serves
  `/manifest.webmanifest`, `apps/web/public/sw.js` is the hand written service
  worker, `/offline` is the offline shell, and the icon set lives in
  `apps/web/public/pwa/`.
- Auth email through the Send Email Hook (section 4.4), with generated
  fallback templates in `supabase/templates/`.
- **CI** in `.github/workflows/ci.yml`: typecheck, lint, tests and a build on
  every push. The Build job reads two public values from repository
  **Variables** (GitHub, Settings, Secrets and variables, Actions, Variables):
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key) and
  `NEXT_PUBLIC_MAPTILER_KEY` (the same value as Vercel Production). Without
  them the run warns that it is not building production's config.

---

## 2. Environment variables

Set every one of these in Vercel under **Project Settings, Environment
Variables**, for the Production and Preview environments. Anything marked
SERVER ONLY must never be given the `NEXT_PUBLIC_` prefix, because that prefix
inlines the value into the browser bundle.

The template in `apps/web/.env.example` is the starting point for local
development (`cp apps/web/.env.example apps/web/.env.local`), and it is now
the **only** template: the second one at the repository root is a signpost
pointing here, because Next.js loads `.env.local` from the application
directory and a value set at the workspace root is read by nothing.

Every variable in that template is read by code, and every variable the code
reads is in it. Section 2.6 lists what was removed to make that true, so that
nobody re-adds a key on the strength of having seen it here once.

### 2.1 Required for the platform to do anything real

| Variable | If it is missing | Where to obtain it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The whole Supabase layer switches off. Every client is env-guarded, so nothing crashes: discovery returns **nothing** and every screen draws its designed empty state, sign-in and sign-up render as honest disabled states. The seed catalogue this row used to promise as a fallback was deleted, deliberately, and an honest absence replaced it (ADR-005). Nothing writes to a database. | Supabase dashboard, Project Settings, API. Already known for this project: `https://uccixoonmbhrnyczyigt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as above. The URL alone is not enough; `isSupabaseConfigured()` requires both, and the auth proxy (`src/proxy.ts`) becomes a pass-through. | Supabase dashboard, Project Settings, API, "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` (SERVER ONLY) | **Set this first, and verify it.** Every path that must bypass RLS legitimately stops working, and the worst one does so silently: the Paystack webhook cannot settle a payment. It now answers 503 so Paystack keeps retrying (`app/api/paystack/webhook/route.ts`; it used to answer 200 with `{received:false}`, which lost the event: `RECOMMENDATIONS.md` W-1), but nothing settles until the key is set. Also affected: booking `confirm`, and anonymous support escalation (there is deliberately no anon insert policy on `support_tickets`). Signed-in user paths under their own RLS keep working. | Supabase dashboard, Project Settings, API, "service_role" key. Treat as a root password |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs fall back to `http://localhost:3000`. Consequences: Open Graph and canonical URLs in page metadata point at localhost, Paystack callback URLs built by the payment actions point at localhost, and rendered email links point at localhost. This is the single most commonly forgotten variable and the damage is invisible until someone shares a link. | Your own production URL, for example `https://vallospaces.com`. No trailing slash |

### 2.2 Required per feature

| Variable | If it is missing | Where to obtain it |
|---|---|---|
| `PAYSTACK_SECRET_KEY` (SERVER ONLY) | Payment answers honestly that the capability switches on the moment the key lands, rather than pretending. The webhook route cannot verify a signature and answers 503, so no ledger entry is ever settled. Money never moves. This is the **only** Paystack variable: payment redirects to Paystack's hosted checkout so no public key is read in the browser, and Paystack issues no separate webhook secret, signing each callback with an HMAC SHA-512 of the raw body keyed by this same key. | Paystack dashboard, Settings, API Keys and Webhooks. Use the **live** secret key in Production and a test key in Preview. Set the webhook URL on that same screen to `https://<your-domain>/api/paystack/webhook` |
| `ANTHROPIC_API_KEY` (SERVER ONLY) | `/api/assistant` answers 200 with an honest message instead of streaming. The assistant UI still renders and the thread store still works; the model simply never speaks. | https://console.anthropic.com/settings/keys |
| `ASSISTANT_MODEL` | Optional. Falls back to the default model pinned in `app/api/assistant/route.ts`. Only set this to move the assistant to a different model deliberately. | Not a secret. A model identifier |
| `SUPPORT_MODEL` | Optional. The same, for the support escalation summariser in `app/api/support/route.ts`. Falls back to its own pinned default. | Not a secret. A model identifier |
| `RESEND_API_KEY` (SERVER ONLY) | `isEmailConfigured()` returns false, `sendEmail` returns `{sent: false, reason: "unconfigured"}` and nothing leaves the process. Every event that would have emailed still fires its in-app notification, so users are not left uninformed, only un-emailed. Email and password sign-in is unaffected: Supabase issues that session itself. | https://resend.com/api-keys. The sending domain must be verified in Resend first, or Resend rejects the send |
| `EMAIL_FROM` | Optional. Defaults to `Vallo <hello@vallospaces.com>`. If that domain is not the one verified in Resend, every send is rejected, so set this to match the verified domain. | Your verified sending address |
| `NF_DATA_SOURCE` | Optional. Selects the repository implementation for listings, agents and messages. Leave unset for the default. Setting it to `api` throws on the agent repository, which is not implemented. | Not a secret |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | **Leave unset, permanently.** Email and password only, by owner decision. Section 4.2 says why, and `RECOMMENDATIONS.md` N-4 removes the code. | Do not set |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | All six "contact support" surfaces point at `/contact` instead of a `mailto:`. That is a working channel, not a fallback: the form writes a real `support_tickets` row under RLS and the reply notifies the sender. Set this only once the mailbox genuinely receives mail, because an address that bounces fails silently while the person who wrote believes they have asked. | Your own mailbox, once it exists |
| `NEXT_PUBLIC_NGN_USD_RATE` | Nothing. It fed the wallet's currency toggle, and the wallet was retired on 25 September 2026; no code in `apps/web/src` reads it now. Leave it unset. | Do not set |

### 2.3 Optional, safe to leave empty at launch

| Variable | If it is missing | Where to obtain it |
|---|---|---|
| `BASE_URL` | Nothing in the product. Read only by the Playwright specs in `apps/web/tests`, each of which defaults to its own localhost port. Set it only to point the suite at a deployed build. | Not a secret |

### 2.4 Social sign-in: do not configure it

**Corrected 2026-08-09. This section used to tell you how to set Google and
Apple up. Do not.** The product is email and password only, by owner decision.
Leave `NEXT_PUBLIC_AUTH_PROVIDERS` unset and enable nothing in the Supabase
Authentication, Providers screen.

The code has not caught up yet: `startGoogleOAuth` and `startAppleOAuth` still
exist in `apps/web/src/lib/auth/actions.ts` and the buttons still render,
disabled, because no provider is listed. Removing them is
`RECOMMENDATIONS.md` N-4. Until then, setting that variable would enable a path
whose native return journey is not closed (`docs/MOBILE.md` section 6), leaving
the mobile application signed out after a successful sign-in.

For the record of how it worked, because the migration
`20260807125555_a_google_account_arrives_with_its_name_and_its_face` is still
applied and reads Google identity metadata on signup: provider secrets went into
the Supabase dashboard and never into this application, which only ever read
which buttons to draw.

### 2.5 THE TWO CRON SECRETS, AND THE SPELLING THAT COST FOUR DAYS

`lib/cron/auth.ts` has pointed readers at "docs/DEPLOY.md, section 2" for
these since it was written, **and this section never mentioned them**. A
person following that pointer arrived at a list of variables the code does NOT
read and concluded nothing. That is why this subsection exists.

Two variables, and they are not the same variable:

| Name | Who reads it | What it does |
| --- | --- | --- |
| **`CRON_SECRET`** | **Vercel itself**, never our code | Vercel's scheduler sends `Authorization: Bearer $CRON_SECRET` on every cron invocation. The name is fixed by Vercel and cannot be chosen |
| **`RECONCILE_CRON_SECRET`** | our code, in `lib/cron/auth.ts` | the value the door compares that bearer against |

**They must hold the SAME VALUE.** A grep for `CRON_SECRET` in this repository
finds only the second one, because the first is never read by us, which is
exactly what makes it easy to get wrong.

**THE SPELLING IS EXACT AND THERE IS NO WARNING WHEN IT IS NOT.** On 22
September this project held a variable named **`CRONS_SECRET`**, with an S.
Vercel does not read that name, so it injected no header at all, so every one
of the seven scheduled jobs was refused by our own door with a 401. It ran for
four days and raised 262 alerts. Nothing anywhere said "that variable is not
the one I read", because nothing is watching for a variable that does not
exist.

If the jobs are refused, **check the NAME before the value**. The refusal
alert now tells you which fault it is in `detail.reason`: `no-bearer` means
Vercel is injecting nothing and the name is wrong or the variable is absent;
`secret-mismatch` means both exist and disagree; `no-secret-configured` means
`RECONCILE_CRON_SECRET` is empty here.

**Whitespace is trimmed on both sides now, deliberately.** A secret reaches a
dashboard by being pasted, and a paste brings a trailing newline more often
than not. Before 22 September neither side was trimmed, so a newline on either
value produced this same silent 401. The same fault in SQL, where `btrim` with
one argument strips spaces only, broke the database half of this on the same
day.

`apps/web/vercel.json` declares the scheduled paths (eight today). If a job is missing from
there, no secret will help it.

---

### 2.6 Removed from the template, and why

This document previously told you to set the groups below. **The code
reads none of them.** Verified by scanning every `process.env` reference in
`apps/web`, `packages` and `scripts`; each has zero hits. They are listed here
rather than deleted silently, so that finding one in an old deploy or an old
commit does not read as an accidental omission.

| Variable | Why it is gone |
|---|---|
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Checkout runs inline: the server initialises the transaction and the page resumes it by its access code in Paystack's iframe (`components/app/payments/PaystackCheckout.tsx`), a path that takes no public key. Only the secret key is read |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack issues no such thing. Webhooks are signed with an HMAC SHA-512 of the raw body keyed by the secret key. The phantom variable sent somebody hunting a dashboard field that does not exist |
| `AUTH_DATABASE_URL` | A leftover of the pre-Supabase auth layer. `lib/auth/providers.ts` reads exactly one variable now, and this is not it |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Same leftover. These belong in the Supabase dashboard, per 2.4 |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Same |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | Sign in with X was never built, and its API tier is paid |
| `GOOGLE_MAPS_SERVER_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Google Maps is not the map provider |
| `GOOGLE_PLACES_API_KEY` | Places was part of the removed third-party inventory; nothing reads it |
| `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENV` | The hotel provider was removed on 7 August 2026 with these variables (ADR-013) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Media goes to Supabase Storage |
| `TERMII_API_KEY` | No SMS or OTP path calls it |
| `TRAVELGATE_API_KEY` | Requires a signed commercial agreement that does not exist, and no code path awaits it |
| `NEXT_PUBLIC_SENTRY_DSN` | Nothing reads it and nothing should. `SENTRY_DSN` IS wired as of 19 September 2026 and is server side only: the browser posts crashes to `/api/client-error` on our own origin and the server forwards them, so no DSN reaches a bundle. See `docs/ENVIRONMENT.md` section 3 |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics is not wired |

If you have any of these set in Vercel today, they are inert; clearing them
changes nothing. Adding one back is only correct alongside the code that reads
it, in the same change.

---

## 3. Vercel project setup

1. **Import the repository.** Vercel detects the monorepo. Set **Root
   Directory** to `apps/web`. Framework preset: Next.js.
2. **Build command**: leave the default (`next build`). Install command:
   leave the default; npm workspaces resolve `@vallo/design-tokens` and
   `@vallo/i18n` from the repository root, and both are listed in
   `transpilePackages` so they compile in place.
3. **Node version**: 20.9 or newer, per the `engines` field in the root
   `package.json`.
4. **Production branch**: set it deliberately. Do not leave it pointing at a
   working branch.
5. Paste the environment variables from section 2. Deploy.
6. Take the resulting URL, set `NEXT_PUBLIC_SITE_URL` to it, and redeploy.
   Nothing in section 4 or 5 can be finished before this URL exists.
7. **Custom domain**: add it under Project Settings, Domains, then update
   `NEXT_PUBLIC_SITE_URL` again and redeploy. Every URL in sections 4 and 5
   must use the final domain, not the `*.vercel.app` preview host.

Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, HSTS with preload) are already applied
to every route by `apps/web/next.config.ts`. Do not duplicate them in Vercel's
headers configuration.

**The Content Security Policy is the one exception, and it is set elsewhere.**
It lives in `apps/web/src/lib/security/csp.ts` and is applied per request by
`apps/web/src/proxy.ts` (Next 16's name for middleware), because it carries a fresh nonce every time and a
static header cannot. Do not move it into `next.config.ts` and do not add a
second policy in Vercel: two `Content-Security-Policy` headers are intersected
by the browser, so the stricter one wins and the nonce in ours stops matching,
which takes the whole application down rather than degrading it.

Two things in that policy follow the environment rather than being fixed, so
check them after any change of Supabase project or payment provider:

- The Supabase origin in `connect-src`, `img-src` and `form-action` is derived
  from `NEXT_PUBLIC_SUPABASE_URL`. A deployment without that variable simply
  contributes no origin, which matches how the rest of the platform degrades.
- `form-action` also names Paystack's checkout host, because a server action
  that finishes with a `redirect()` off-origin is a form navigation on the
  no-JavaScript path. The reasoning is written out in full in `csp.ts`.

`apps/web/tests/csp.spec.mjs` proves the policy against a running browser,
including that nothing on the page is actually blocked. Run it after any change
to the header.

Note on HSTS: `Strict-Transport-Security` is sent with `max-age=63072000`,
`includeSubDomains` and `preload`. That is a two year commitment for the domain
and all of its subdomains. Be certain every subdomain you will ever use can
serve HTTPS before pointing a real domain at this deployment.

---

## 4. Supabase dashboard, by hand

These steps cannot be done from this repository. Every one of them is in the
dashboard for project `uccixoonmbhrnyczyigt`.

### 4.1 Site URL and the redirect allow list

**Authentication, URL Configuration.**

- **Site URL**: your production URL, for example `https://vallospaces.com`. This is
  what `{{ .SiteURL }}` expands to inside the email templates, so the logo in
  every auth email resolves from here. Get it wrong and every auth email shows
  a broken image.
- **Redirect URLs**: add every origin that will ever complete an auth flow.
  Supabase rejects a redirect that is not on this list, and the failure looks
  like a silent bounce back to sign-in:
  - `https://vallospaces.com/**`
  - `https://<your-project>.vercel.app/**` for preview deploys
  - `http://localhost:3000/**` and `http://localhost:3210/**` for local work
    (3210 is the port the Playwright specs and the screenshot harness expect)

### 4.2 and 4.3 Google and Apple sign-in: SKIP BOTH

**Corrected 2026-08-09. These two sections used to walk you through configuring
Google and Apple. Do neither.** The product is email and password only, by owner
decision, and the code that would use them is being removed
(`RECOMMENDATIONS.md` N-4).

Leave Authentication, Providers alone. Leave `NEXT_PUBLIC_AUTH_PROVIDERS` unset.
Enabling a provider today would light up a path whose native return journey is
not closed, so a mobile sign-in would complete in the system browser and leave
the application signed out (`docs/MOBILE.md` section 6).

One consequence worth knowing: App Store guideline 4.8 requires Sign in with
Apple only when another third-party sign-in is offered. Offering neither removes
the obligation and removes the paid-key work that came with it.

### 4.4 Auth email delivery: the Send Email Hook

Supabase's built-in email service is rate limited and unsuitable for
production. Vallo sends its own auth email through the **Send Email Hook**,
which has been live since 22 September 2026 (`docs/email/AUTH_EMAILS.md`
section 1).

1. **Authentication, Hooks, Send Email.** Enable it, type HTTPS, URL
   `https://<your production domain>/api/auth/email-hook`.
2. Copy the secret Supabase shows (`v1,whsec_...`, the whole thing) into
   Vercel as `SUPABASE_AUTH_HOOK_SECRET` and redeploy. Without it the route
   refuses every request, so no confirmation code is sent.
3. Sign up with a test address and check `auth_logs` for a `run_hook` row
   saying "Hook ran successfully".

With the hook on, GoTrue sends nothing itself and the dashboard's Email
Templates are not used. Custom SMTP is not needed. The generated templates in
`supabase/templates/` (built by `node scripts/build-auth-emails.mjs`) are the
fallback to paste into Authentication, Email Templates if the hook is ever
switched off.

### 4.5 Storage buckets

All three buckets already exist, created by the `storage_buckets` migration and
tightened by `storage_policy_hardening`. Confirm them under **Storage**, do not
recreate them:

| Bucket | Public | Path convention | Policy |
|---|---|---|---|
| `listing-photos` | yes | `<user_id>/...` | Owner-scoped read, insert, update and delete. Objects in a public bucket also serve through their public URL regardless of RLS, which is why the broad read policy was deliberately removed |
| `avatars` | yes | `<user_id>/...` | Same shape as above |
| `message-attachments` | no | `<conversation_id>/...` | Access decided by `private.attachment_path_access`, which resolves the leading path segment through `private.in_conversation` |

If you add a bucket later, add its RLS policies in the same commit. The
project has an event trigger that enables RLS automatically on new tables; it
does not do that for storage policies.

### 4.6 Three database items to settle before launch

Rewritten 2026-08-09. Both original items were resolved and one of them said the
opposite of the truth.

- **Turn on leaked password protection.** Authentication, Policies. It is off,
  and it is the only genuine item on the security advisor list. Credential
  stuffing against a marketplace that takes naira payments is exactly what
  it prevents. `docs/archive/DATABASE_AUDIT.md` section 1.1.
- **Drop `private.probe_as` before real people's data arrives.** It sets
  `request.jwt.claims` so a probe can run as a signed-in person under RLS, which
  is the only way to test a policy. It is revoked from every role but
  `service_role` and no application code calls it. It is still the wrong thing
  to leave on a production database. `RECOMMENDATIONS.md` V-4.
- **The migration mirror disagrees on eight filenames.** Not a missing
  migration: 120 applied, 120 committed, eight of them under a hand-rounded
  timestamp rather than the real one. `RECOMMENDATIONS.md` T-4 has the table and
  the two whose names also differ. The previously reported genuinely-missing file
  (`20260729174306_rls_initplan_and_fk_index`) is committed.

Rate limiting and idempotency are applied and live
(`20260730013645_rate_limits_and_idempotency.sql` plus the ambiguity fix in
`20260730013758`). They stay inert until `SUPABASE_SERVICE_ROLE_KEY` is set,
because the limiter fails open by design.

### 4.7 Run the advisors

**Advisors, Security Advisor** and **Performance Advisor**. Security returns
eleven items and **ten of them are correct by design**: read
`docs/archive/DATABASE_AUDIT.md` section 4, the do-not-fix list, before changing
anything. "Fixing" any of those five breaks the landing page, the agent trust
panel or the machinery that stops a payment being taken twice. Performance shows
multiple-permissive-policy notes and unused indexes on empty tables; that is
expected pre-launch noise, not a regression. Re-run both after the first real
month, which is the first point at which the performance list means anything.

### 4.8 Removing a person: never "Delete user"

**Authentication, Users, Delete user** (and a hard delete through the Admin
API) fails with `Database error deleting user` for almost anybody who has used
the product, and that is deliberate. A person's bookings,
rent records, conversations, messages, reports and agent profile (and, in the
`retired_custody` schema, any wallet and escrow rows from before 25 September
2026) all refuse the delete (`ON DELETE RESTRICT`), because deleting one person must
never take the other party's thread, money trail or moderation evidence with
them.

Remove a person with the account deletion flow instead: they ask from
Settings, or staff open it for them, and the purge anonymises the account in
place and keeps what the law and the other party need
(`docs/RETENTION_SCHEDULE.md`). The same applies to a booking or a table
reservation: one with a conversation cannot be deleted, and a draft listing
whose reservations have threads stays as a draft (hidden from everybody but
its lister) rather than being deleted.

### 4.9 The migration history and the files

Every row in the live `supabase_migrations.schema_migrations` has a file in
`supabase/migrations` with the same version and name
(`supabase/tests/probes/db-11.sql` checks it). Apply every new migration
through the history (the CLI or the MCP), never by pasting SQL into the
dashboard, so the history and the directory keep matching.

What a reset or a branch rebuilds from the directory is not yet exactly live.
33 files were edited after they were applied, most by a few characters and
about a dozen materially. The SQL live actually ran is kept in the history's
`statements` column for each version. `supabase migration fetch` (with the
database password) writes those statements back out as files; run it and
review the diff before building a branch or a disaster recovery from the
repository. Until then, treat live as the source of truth. The versions
concerned:

20260812090000, 20260812090100, 20260915090000, 20260918120200,
20260918120400, 20260918120500, 20260918140000, 20260918140100,
20260918151000, 20260918151100, 20260919103000, 20260919160000,
20260919160100, 20260919190000, 20260922120000, 20260922130000,
20260922140000, 20260922150000, 20260922160000, 20260922170000,
20260922190000, 20260922190200, 20260922193000, 20260922200100,
20260922220000, 20260922230000, 20260922230300, 20260922230400,
20260922230500, 20260923011000, 20260923011500, 20260923012500,
20260923081500.

---

## 5. Paystack

1. **Register the webhook.** Paystack dashboard, **Settings, API Keys and
   Webhooks**, Webhook URL:

   ```
   https://vallospaces.com/api/paystack/webhook
   ```

   Substitute your real production domain. This **must** be the live HTTPS URL
   on your own domain. Paystack will not reach `localhost`, and pointing it at
   a preview deployment means production charges settle nowhere. There is one
   webhook URL per Paystack account per mode, so use the test mode webhook for
   Preview and the live mode webhook for Production.

2. **Verify signature handling is intact.** The route reads the raw request
   body, computes HMAC SHA-512 with the secret key, and compares against the
   `x-paystack-signature` header before parsing anything. Never introduce a
   body parser ahead of it.

3. **Events consumed.** `charge.success` and `charge.failed` on a booking
   reference (`rm-book-<uuid>`) settle or fail that booking's split payment
   through `lib/bookings/settlement.ts`; a charge that cannot be applied is
   refunded to the card in full. A `charge.success` on an old wallet top-up
   reference (`rm-fund-<uuid>`) is refunded to the card and never credited.
   `transfer.*` events are acknowledged and ignored, because Vallo sends no
   transfers. The route routes purely on these reference prefixes, so never
   invent a new reference shape without updating it.

4. **Enable the payment channels the audience actually uses**: card, bank
   transfer and USSD. A card-only checkout loses a large share of Nigerian
   customers at the last step.

5. **Settlement account.** Paystack will not pay out until a settlement bank
   account is added and the business is verified. Do this early, because
   verification is not instant.

6. Note that the platform charges its users nothing for using it. Paystack's
   own charges to the merchant are a separate commercial matter between the
   owner and Paystack, and no such amount is ever surfaced to a user.

---

## 6. The PWA

Nothing to configure. It is worth understanding what ships, because a service
worker is the one artefact that can outlive a bad deploy on a user's phone.

- **Manifest**: `apps/web/src/app/manifest.ts`, served at
  `/manifest.webmanifest`. `start_url` is `/home`, `scope` is `/`, display
  `standalone`, orientation portrait, both colours the brand navy `#010118`.
  Shortcuts (long-press the home-screen icon) go to `/search`, `/bookings` and
  `/agreements` (the Agreements shortcut still uses the old
  `shortcut-wallet.png` art).
- **Icons**: `apps/web/public/pwa/`, generated from the canonical brand cutout
  `/brand/vallo-mark.png`, cropped to the house-and-R mark and centred on the
  brand navy. 192, 512, a maskable 512 held inside the 80 per cent safe zone,
  a 180 Apple touch icon, and three 96px shortcut icons. All small, because
  data is expensive.
- **Service worker**: `apps/web/public/sw.js`. Registered by
  `components/app/ServiceWorkerRegistrar.tsx` after the window `load` event, in
  production only, silently. It precaches the offline shell (`/offline`, the
  192px icon, the manifest, and the offline page's stylesheet discovered from
  the precached HTML), serves navigations network-first with `/offline` as the
  fallback, and applies stale-while-revalidate to `/_next/static/`, `/brand/`,
  `/icons/` and `/pwa/` only.
- **What it will never cache**: any HTML document other than the static
  `/offline` page, and anything whose first path segment is `api`, `admin`,
  `agent`, `wallet` (kept in the list although `/wallet` now only redirects to
`/agreements`), `messages`, `notifications` or `auth`. Any response
  carrying `Authorization`, `Set-Cookie`, `Vary: Cookie` or a `no-store` or
  `private` cache directive is passed straight through. A money or messaging
  surface can never serve a stale answer.
- **Save-Data**: when the hint is present the asset cache is read but never
  written, because filling a cache is itself paid-for traffic.
- **Versioning**: `CACHE_VERSION` at the top of `sw.js`. **Bump it in the same
  commit as any change to that file.** The `activate` step deletes every
  `vallo-` cache not in the current set, so a deploy cannot leave a user on
  last week's shell.

If you ever need to retire the worker entirely, replace `sw.js` with a script
that calls `self.registration.unregister()` and deletes all caches. Deleting
the file is not enough on its own, because an installed worker keeps running
from the client's own storage.

---

## 7. Pre-launch checklist

Run from the repository root unless stated.

```bash
# 1. Types. Must exit 0.
cd apps/web && npx tsc --noEmit

# 2. Clean build. Concurrent builds corrupt .next, so clear it first.
rm -rf apps/web/.next && npm run build

# 3. Start the built app on the port the specs expect.
cd apps/web && npx next start -p 3210
```

`npm run lint` (eslint, the CSS token check and the valuation-words check) and
`npm test` (the vitest suite, a few thousand tests) both run, and CI runs them
on every push (`.github/workflows/ci.yml`). The browser specs below are plain
node scripts that nothing runs automatically (THE_AUDIT DOC-09).

With that server up, in a second shell:

```bash
# 4. Playwright golden paths. Each is a plain node script, no runner.
for spec in pwa admin agent-listings assistant bookings messages profile saved; do
  BASE_URL=http://localhost:3210 node apps/web/tests/$spec.spec.mjs || echo "FAILED: $spec"
done

# 5. The 390px screenshot pass. Writes PNGs to scripts/.shots/.
node scripts/verify-shots.mjs / /home /search /offline /agreements /bookings /messages
```

`apps/web/tests/wallet.spec.mjs` still exists but drives the retired `/wallet`
surface, which now redirects to `/agreements`. Do not run it.

Then, by eye:

- **390px** is the reference width. Every touched surface is checked there,
  in dark and in light (Settings, Appearance: Light, Dark or System; the
  default is Dark). `apps/web/scripts/design/light/sweep.mjs` shoots both.
- Listing photos and map tiles render as grey placeholders in this sandbox
  because it has no outbound access to Unsplash or the tile servers. They load
  on a real deploy. This is not a bug to fix.
- `grep -rn "Vallo" apps/web/src packages/i18n/src` should find nothing in
  user-facing copy.
- Em dash scan: `grep -rn "$(printf '\xe2\x80\x94')" apps packages docs` should
  find nothing.
- No "sample", "preview", "demo" or "not live" wording in any UI string, and no
  mention of any charge for using the platform.
- Supabase Security Advisor: zero lints (section 4.7).

---

## 8. Post-deploy smoke test

Against the real production URL, on a real Android phone if possible.

1. `https://vallospaces.com/manifest.webmanifest` returns JSON with `"name":
   "Vallo"` and `"start_url": "/home"`.
2. Chrome on Android offers "Install app" or "Add to Home screen". Install it.
   The home-screen icon shows the house-and-R mark on navy, not a screenshot of
   the page and not a blank tile.
3. Open the installed app. It launches without browser chrome, opens on
   `/home`, and the status bar is navy rather than a pale strip.
4. Long-press the home-screen icon. Search, Bookings and Agreements appear as
   shortcuts, and each opens the right surface.
5. In DevTools, Application, Service Workers: `sw.js` is activated and running.
   Application, Cache Storage shows `vallo-shell-v1` and `vallo-assets-v1`.
6. Turn on airplane mode and navigate anywhere. The designed `/offline` screen
   appears with its heading, its three-point list and a working Try again
   button. Turn airplane mode off, tap Try again, and the app carries on.
7. In Cache Storage, confirm no entry exists for `/agreements`, `/messages`,
   `/api/...` or any admin or agent path. This is the check that matters most.
8. Sign in with Google. Sign in with Apple. Request a password reset and
   confirm the email that arrives is the branded Vallo template, with the logo
   loading.
9. Pay for the smallest real booking or agreement Paystack will accept, on a
   real card. Confirm the transaction appears with its split (lister,
   Guarantee reserve, Vallo), and the notification fires. Then check the
   Paystack dashboard shows the webhook delivered a 200 and the split landed
   in each subaccount.
10. Refund that payment from the admin console and confirm it goes back to the
    paying card (`docs/MONEY_ARCHITECTURE.md`).

### 8.1 Paging a human (OPS-03, V-01)

Three layers, each switched on by the founder once. None of them needs code.

1. **Inside the app: critical alerts reach a phone.** Set `OPS_ALERT_WEBHOOK_URL`
   (simplest: install the ntfy app, subscribe to a long random topic, and set
   `https://ntfy.sh/<that topic>`) and/or `OPS_ALERT_EMAIL` in Vercel
   Production. Every critical alert then pages, at most once an hour per alert.
   The catalogue canary (`/api/cron/canary`, every 5 minutes) raises one when
   the published catalogue cannot be read as the public role, reads fewer
   listings than exist, or is empty.
   Alerts the DATABASE writes itself (the money reconciliation and push drain watchers, the content scanners) page through
   the database instead, so they still leave when Vercel is down: in the
   Supabase SQL editor run, once, with the same URL,
   `select vault.create_secret('https://ntfy.sh/<that topic>', 'vallo_ops_alert_webhook_url');`
   (trigger `risk_alerts_page_on_high`; checked by `supabase/tests/probes/ops-03.sql`).
2. **Outside the app: an uptime monitor.** If Vercel itself is down, nothing
   inside it can page. Create a free monitor at UptimeRobot or Better Stack:
   type HTTP(s), URL **`https://www.vallospaces.com/api/health/catalogue`**,
   every 5 minutes, alert when the status is not 200 (it answers 503 with a
   reason token when the catalogue read fails), alert contact your phone or
   email. Add a second monitor on `https://www.vallospaces.com/` for the site
   itself.
3. **Crashes: Sentry.** At sentry.io create a project (platform **Next.js**,
   or "Other JavaScript"; the app posts envelopes itself and needs no SDK),
   copy its **DSN**, and paste it as `SENTRY_DSN` in Vercel for
   **Production** and **Preview** (server only; never a `NEXT_PUBLIC_` name).
   Then in Sentry, Alerts, create a rule "a new issue is created" that emails
   you. Critical alerts are also sent to Sentry, so the same rule covers them.

---

## 9. Not yet wired, honestly

Do not promise any of this at launch. **Rewritten 23 September 2026.** The
checked, finding-by-finding state of the platform is `docs/THE_AUDIT.md`;
section 3 there is the store-readiness list and section 11 is what only the
owner can do. What follows is only what an operator needs before pressing
deploy.

- **There is almost no real supply.** The catalogue is example listings
  (`is_demo`), clearly marked, and no real transaction has been made. Real
  listings from real listers are a launch dependency (THE_AUDIT STORE-11).
- **No real money has moved.** The Paystack paths, the webhook and the hourly
  reconciliation are built and tested, but no live charge or payout has run.
  No payment opens until the Guarantee reserve's subaccount
  (`PAYSTACK_GUARANTEE_SUBACCOUNT`) is set and the lister has a Paystack
  subaccount of their own.
- **Vallo never holds customer money** (decided 25 September 2026,
  [ADR 0002](adr/0002-vallo-never-holds-customer-money.md)). There is no
  wallet, escrow, pot, withdrawal or held payment, and no launch copy may say
  there is. Protection is the Vallo Guarantee (`docs/MONEY_ARCHITECTURE.md`).
- **Crash reporting is wired and switched off.** `SENTRY_DSN` is not set in
  Vercel, so every crash report is a silent no-op. Set it before the first
  store submission (THE_AUDIT OPS-03).
- **Replies to platform email reach no one.** `EMAIL_REPLY_TO` and
  `NEXT_PUBLIC_SUPPORT_EMAIL` are not set, and `vallospaces.com` has no MX and
  no DMARC record (THE_AUDIT OPS-06). Sending works: a real sign-up email has
  been delivered through the outbox.
- **Push is built and unproven.** Web Push (VAPID) is configured; FCM is set
  on Production only (Preview reports Android push unconfigured, by design);
  APNs is not configured, and `android/app/google-services.json` still holds a
  placeholder API key that fails every release build. No real device has
  enrolled yet: at 23:47 UTC on 23 September `push_tokens` held one web token, a
  test enrolment that was revoked 28 seconds later.
- **CI exists but does not gate.** `.github/workflows/ci.yml` runs typecheck,
  lint, tests and a build, and `main` has no branch protection
  (THE_AUDIT DOC-01).
- **Map tiles are on the non-commercial CARTO endpoint** wherever
  `NEXT_PUBLIC_MAPTILER_KEY` is unset. It is set in Vercel for Production and
  Preview; a local build without it falls back.
- **Universal Links and Android App Links**: both association files exist and
  carry placeholders that fail verification rather than looking plausible.
  `docs/MOBILE.md` section 5.
- **Locale coverage is incomplete.** Yoruba, Hausa and Igbo are functional and
  were not written by native speakers.
