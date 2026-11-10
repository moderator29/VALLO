# Vallo

Vallo is a Nigerian marketplace for property and stays. People rent, buy and sell homes, and book hotels, shortlets and restaurants, all through one account and one inbox. Every listing is put up by a verified person on the platform, not imported from a feed.

Vallo is built and operated by VALLO SPACES LTD (RC 9870413). Production runs at <https://www.vallospaces.com>. The iOS and Android apps are Capacitor shells that load that origin.

## Contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [Database and migrations](#database-and-migrations)
- [Tests and quality gates](#tests-and-quality-gates)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Stack

| Layer | Choice |
|---|---|
| Web app | Next.js 16 (App Router), React 19, TypeScript 5 (`strict`, `noUncheckedIndexedAccess`) |
| Styling | Tailwind CSS v4 and design tokens in `packages/design-tokens/src/tokens.css` |
| Data, auth, storage | Supabase: Postgres 17 with row level security on every table, Supabase Auth, Supabase Storage |
| Scheduled work | `pg_cron` in the database, plus Vercel Cron for the HTTP jobs in `apps/web/vercel.json` |
| Payments | Paystack split payments: each charge is divided between the lister, the Vallo Guarantee reserve and Vallo in the same transaction. Crypto through Yellow Card, off until configured |
| Email | Resend, with a Supabase Send Email hook so auth mail uses the same sender |
| Push | Web Push (VAPID), Firebase Cloud Messaging and APNs, through one drain in `lib/push/` |
| Maps | OpenFreeMap vector tiles (free for commercial use, no key), drawn by MapLibre with a light Leaflet fallback |
| Native | Capacitor 8. The shell loads the live origin and bundles an offline fallback page |
| Hosting | Vercel, with functions in `dub1` (Dublin) beside the database in eu-west-1 |
| Languages | English, Yoruba, Hausa and Igbo (`packages/i18n`) |

Principles that shape the code:

- **Server-first.** Most mutations are server actions. The root layout reads cookies, so every route renders dynamically. This is also why the native apps load the live site rather than a static export.
- **The database enforces the rules.** Payment gates, booking state machines, availability and grants live in Postgres as RLS policies, `security definer` functions in a `private` schema, constraints and triggers. Application code calls them and does not re-implement them.
- **Missing credentials degrade, they don't crash.** No integration throws at startup. Remove a key and its feature shows a designed empty or unconfigured state, so the app boots with an empty environment.
- **One content security policy, with a fresh nonce per request.** `apps/web/src/proxy.ts` sets it through `lib/security/csp.ts` and refreshes the Supabase session. (Next.js 16 renamed `middleware.ts` to `proxy.ts`.)
- **No third-party analytics or crash SDK in the browser.** Browser errors post to `/api/client-error` on our own origin. The server scrubs them and forwards them to Sentry when `SENTRY_DSN` is set.

---

## Architecture

### Two sides, one backend

`apps/web/src/lib/side.constants.ts` defines the two faces of the product:

- **Property:** rentals, sales, agents and inspections. Rooted at `/home` and `/search`.
- **Stays:** hotels, serviced apartments, guest houses, resorts, shortlets and restaurants. Rooted at `/stays`.

Both sides share the account, messages, notifications, profile and social feed. The active side is stored in the `nf_side` cookie, and a side-owned URL always wins over the cookie. **The side controls presentation only and is never used for authorisation.** RLS and role reads decide what a person may do.

### Mode, workspace and supply roles

`lib/mode.constants.ts` and `lib/supply/roles.ts` define three independent axes:

| Axis | Values | Stored in |
|---|---|---|
| Side | `property`, `stays` | `nf_side` cookie |
| Mode | `personal` (using the platform), `working` (running a business on it) | `nf_mode` cookie |
| Workspace | `owner`, `agent`, `firm` (property); `host` (stays); `console` (staff) | `nf_workspace` cookie, re-resolved against the caller's RLS-bound reads on every request |

Property supply comes through three doors: an **owner** listing their own property, an **agent** listing under a mandate, and a **firm** (a `businesses` row with its own registration ladder). A listing records which of the three is offering it. Stays supply is a `host` workspace (`/host`). Staff work in the admin console at `/admin` ([`docs/ADMIN_CONSOLE.md`](docs/ADMIN_CONSOLE.md)).

Verification follows a ladder defined as data in `lib/trust/verification.ts`. The verified badge appears only on entities that passed it.

### Money

**Vallo never holds customer money.** There is no wallet, balance, escrow or withdrawal. The full design is in [`docs/MONEY_ARCHITECTURE.md`](docs/MONEY_ARCHITECTURE.md) and [ADR 0002](docs/adr/0002-vallo-never-holds-customer-money.md). In short:

- All amounts are **integer kobo** in `bigint` columns ending in `_minor`. No float ever touches money.
- Payment opens only after both parties confirm an agreement and staff approve it. Database triggers enforce this gate.
- Paystack splits each charge in the same transaction between the lister's subaccount, the Vallo Guarantee reserve and Vallo's commission. A table check guarantees the three parts add up to the charge.
- Settlement writes to append-only ledgers (`ledger_entries`, `guarantee_reserve_entries`). Refunds go back to the paying card through Paystack.
- Every sentence a user reads about money comes from `apps/web/src/lib/money/copy.ts`.

### Where things live

| Concern | Location |
|---|---|
| Signed-in product routes | `apps/web/src/app/(app)/` |
| Sign-in, sign-up, password reset | `apps/web/src/app/(auth)/` |
| Public site pages (about, terms, privacy, help, careers) | `apps/web/src/app/(site)/` |
| Agent workspace | `apps/web/src/app/agent/` |
| Stays host workspace | `apps/web/src/app/host/` |
| Admin console | `apps/web/src/app/admin/` |
| HTTP endpoints (webhooks, cron, assistant, push) | `apps/web/src/app/api/` |
| Component previews (404 unless the local preview harness is enabled) | `apps/web/src/app/(dev)/` |
| Domain logic, server actions, queries | `apps/web/src/lib/<domain>/` |
| UI components | `apps/web/src/components/`, `apps/web/src/design-system/` |
| Database schema | `supabase/migrations/` |

### The in-app assistant

Vallo includes an AI assistant as a product feature, served from the Anthropic Messages API server side (`ANTHROPIC_API_KEY`). Without a key, each surface answers with a "not configured" message.

- **Concierge** (`apps/web/src/app/api/assistant/route.ts`, UI at `/assistant`). Streams replies and uses tools that read the same repository as the search page, so it can only cite listings that exist.
- **Support** (`apps/web/src/app/api/support/route.ts`). Answers help questions and escalates to a ticket with a summary. Falls back to a keyword FAQ.
- **`@vallo` in the social feed** (`apps/web/src/lib/social/bot-actions.ts`). Replies once to a mention, searching only public data, within a budget enforced in the database (`private.bot_may_run`).

---

## Getting started

### Prerequisites

- Node.js 20.9 or newer (CI uses Node 22).
- npm. This is an npm workspaces monorepo, so don't use yarn or pnpm.
- A Supabase project for real data. Without one the app still runs, and every data surface shows its empty state.
- For the native apps: Xcode and/or Android Studio. See [`docs/MOBILE.md`](docs/MOBILE.md).

### Install and run

```bash
npm install                                   # installs every workspace from the root
cp apps/web/.env.example apps/web/.env.local  # the env file lives in apps/web, not the root
npm run dev                                   # http://localhost:3000
```

Next.js reads `.env.local` from `apps/web/`. A root `.env.local` is ignored silently.

### Environment variables

The template is [`apps/web/.env.example`](apps/web/.env.example). [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) is the reference for every variable: what it does, what breaks without it, and where to get it. A unit test fails if the app reads a variable that document does not list.

The minimum for real data is `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL`.

**Never give a server-only value the `NEXT_PUBLIC_` prefix.** That prefix compiles the value into the browser bundle.

**Paystack test and live mode** (`apps/web/src/lib/payments/paystack-mode.ts`). All server only; the browser holds no Paystack key in either mode.

| Variable | Read when | Notes |
|---|---|---|
| `PAYSTACK_MODE` | Always, if set | `live` or `test`. Overrides everything below. `test` with no test key is "not configured", never live. |
| `PAYSTACK_ALLOW_TEST_MODE_IN_PRODUCTION` | Production with `PAYSTACK_MODE=test` | Must be `yes` or test mode is refused on Production. Leave unset. |
| `PAYSTACK_SECRET_KEY` | Production (default), or `PAYSTACK_MODE=live` | Must be an `sk_live_` key in live mode. Outside Production it is used without `PAYSTACK_MODE=live` only if it is an `sk_test_` key. Also signs live webhooks. |
| `PAYSTACK_TEST_SECRET_KEY` | Preview and Development when present, or `PAYSTACK_MODE=test` | Must be an `sk_test_` key. Also signs sandbox webhooks. |
| `PAYSTACK_GUARANTEE_SUBACCOUNT` | Live mode | The reserve subaccount (`ACCT_...`) on the live account. |
| `PAYSTACK_TEST_GUARANTEE_SUBACCOUNT` | Test mode | The reserve subaccount on the sandbox account. No fallback to the live code. |

A key whose `sk_live_`/`sk_test_` prefix contradicts the mode is refused. The admin payments page shows the mode in use. Details in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server for `@vallo/web` |
| `npm run build` | Production build. `prebuild` regenerates the scene manifest and runs the claims check |
| `npm run start` | Serves the production build on port 3000 |
| `npm run lint` | ESLint, then the repository checks (`check-css-tokens`, `check-valuation-words`, claims) |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run test` | Vitest unit and component tests |
| `npm run sync:versions` | Writes one app version into the iOS and Android projects |
| `npm run seed:reviewer` | Creates the App Store / Play Store reviewer account (supports `--dry-run`) |

---

## Repository layout

```
.
├── apps/
│   └── web/                     the Next.js app (@vallo/web): web, PWA and native shells
│       ├── src/
│       │   ├── app/             routes: (app) (auth) (site) (dev) agent host admin api
│       │   ├── lib/             domain logic, one folder per domain
│       │   ├── components/      feature components
│       │   ├── design-system/   shared primitives and icon components
│       │   └── proxy.ts         session refresh, route guard, per-request CSP
│       ├── tests/               Playwright specs (*.spec.mjs), run against a live server
│       ├── scripts/             lint checks, deep-link check, probes
│       ├── eslint-rules/        local ESLint rules
│       ├── public/              static assets, service worker, PWA icons, .well-known
│       ├── native-shell/        the offline page bundled into the native binaries
│       ├── ios/ android/        Capacitor native projects
│       ├── capacitor.config.ts  native shell configuration
│       ├── next.config.ts       security headers, workspace package transpilation
│       └── vercel.json          function region and cron schedule
├── packages/
│   ├── design-tokens/           colour, type, space, radius, elevation, motion
│   └── i18n/                    en, yo, ha, ig dictionaries; plural rules; money formatting
├── supabase/
│   ├── migrations/              the schema, one file per applied migration
│   │   └── pending/             drafts not yet applied
│   ├── tests/probes/            database regression tests
│   ├── templates/               generated auth email templates
│   └── config.toml              Supabase CLI config
├── scripts/                     repository tooling (Node .mjs): generators, seeding,
│                                audits, the probe runner, the migrations check
├── assets/                      brand sheets and icon sources
├── docs/                        documentation (index: docs/README.md)
└── .github/                     CI workflow, PR and issue templates, Dependabot
```

---

## Database and migrations

There is one hosted Supabase project (eu-west-1, Postgres 17). The files in `supabase/migrations/` are the schema and the record of what the hosted database has applied.

Rules (enforced in CI by `scripts/check-migrations.mjs` where possible):

1. **Name files `<version>_<what_it_does>.sql`**, where `version` is a 14-digit UTC timestamp and the description is snake_case.
2. **The version must match the applied version** in `supabase_migrations.schema_migrations`. Apply first, then name the file to the version the database recorded.
3. **Every applied migration has a file, and every file is applied.** Unapplied drafts go in `supabase/migrations/pending/`.
4. **Never edit an applied migration.** Write a new one.
5. **Open each file with a comment** saying what changes and why. Money and grant changes assert the state they expect first and check the result afterwards.
6. **New tables and columns ship with their RLS, grants and foreign-key indexes** in the same migration. Some tables are granted to `anon` column by column, so a new column needs its grant.
7. **Behaviour changes ship with a probe.** Any change to RLS, a grant, a trigger or a `security definer` function gets a probe in `supabase/tests/probes/` that fails before the change and passes after.
8. **No secrets in migrations.**

### Database probes

`supabase/tests/probes/*.sql` are the database regression tests. Each is one `do $$ … $$;` block that switches into `anon` or `authenticated`, runs a control that must succeed, then each expected refusal, and ends in `raise exception 'PROBE_OK <id>'` so it always rolls back. The contract is in [`supabase/tests/README.md`](supabase/tests/README.md).

```bash
DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres' \
  node scripts/db-probes/run.mjs              # every probe, each in its own rolled-back transaction
node scripts/db-probes/run.mjs --only sec-09  # one probe
node scripts/db-probes/run.mjs --check        # validate the probe contract only, no database
```

The runner needs `psql` and the session pooler (port 5432).

To change the auth email templates, edit `scripts/build-auth-emails.mjs` and regenerate them ([`supabase/README.md`](supabase/README.md)).

---

## Tests and quality gates

| Gate | Command | Notes |
|---|---|---|
| Typecheck | `npm run typecheck` | |
| Lint | `npm run lint` | ESLint with local rules, plus repository checks for CSS tokens, regulated valuation wording and product claims. Warnings are capped, so a new warning fails the run |
| Unit and component tests | `npm run test` | Vitest: `unit` (`*.test.ts`, Node) and `dom` (`*.dom.test.tsx`, real Chromium with axe-core) |
| Build | `npm run build` | The only gate that catches a non-function export from a `"use server"` module |
| Database probes | `node scripts/db-probes/run.mjs` | Needs a connection string |
| Migrations check | `node scripts/check-migrations.mjs --base <ref>` | Naming, one file per version, applied files unchanged |
| Browser specs | `BASE_URL=http://localhost:3210 node apps/web/tests/<name>.spec.mjs` | Playwright scripts against a running server. Not part of CI |

**CI** (`.github/workflows/ci.yml`) runs on pushes and pull requests to `main`, on Node 22:

- `checks`: typecheck, lint, tests, the deep-link check, the probe contract check and the migrations check.
- `audit`: `npm audit` of production dependencies at high severity.
- `build`: `next build` with the public production values from repository variables.
- `db-probes`: every database probe against the database in the `PROBES_DATABASE_URL` secret. It fails, rather than passing silently, when the secret is missing.

Native Android and iOS builds run in separate workflows (`native-android.yml`, `native-ios.yml`), described in [`docs/NATIVE_CI.md`](docs/NATIVE_CI.md).

> GitHub Actions has been paused on the account for billing in the past. If the Actions tab shows no runs for a push, CI did not run: run all four `npm` gates locally before pushing.

---

## Deployment

**Web.** Vercel builds `apps/web` (Root Directory `apps/web`, Next.js preset). Environment variables are set in Vercel per environment. Security headers come from `next.config.ts` and the CSP from `proxy.ts`, so neither should be added in Vercel. The full runbook, including Supabase dashboard steps, the Paystack webhook and the launch checklist, is [`docs/DEPLOY.md`](docs/DEPLOY.md).

**Native.** iOS and Android are Capacitor projects in `apps/web/ios` and `apps/web/android`. They load the live origin:

```bash
npm run build
cd apps/web
CAPACITOR_SERVER_URL="https://www.vallospaces.com" npx cap sync
```

Then build and sign in Xcode or Android Studio. [`docs/MOBILE.md`](docs/MOBILE.md) covers signing, versions, icons and deep links. [`docs/STORE_SUBMISSION_NOTES.md`](docs/STORE_SUBMISSION_NOTES.md) records store submission decisions.

---

## Documentation

[`docs/README.md`](docs/README.md) indexes all live documentation by purpose. Good first reads:

| Document | Read it for |
|---|---|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | What Vallo is, who it serves, and the vocabulary. Start here |
| [`docs/MONEY_ARCHITECTURE.md`](docs/MONEY_ARCHITECTURE.md) | How money moves |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Every environment variable and third-party account |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Deploying and operating production |
| [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md), [`docs/adr/`](docs/adr/) | Architecture decision records |
| [`docs/RULINGS.md`](docs/RULINGS.md) | The founder rulings still in force (D51 to D85); code comments cite them by number |
| [`docs/DECISIONS_2026-10-13.md`](docs/DECISIONS_2026-10-13.md) | The founder decisions of 13 October 2026 and their status in the code |
| [`docs/design/PREMIUM-STANDARD.md`](docs/design/PREMIUM-STANDARD.md) | The visual bar every screen is built to, and the reference renders in `docs/design/references/` |

Retired documents, dated build records, old session handoffs and finding registers (the `W-`, `V-` and `UX-` IDs some code comments still cite) were deleted from `docs/` on 17 October 2026. They live in git history only and govern nothing: a comment that cites one of those IDs is explained by its own words.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branches, commits, migrations, money rules and the pre-push checklist.

No licence has been published. All rights are reserved by VALLO SPACES LTD.
