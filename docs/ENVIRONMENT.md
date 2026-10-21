# Environment and third-party accounts

Every credential the platform reads, what breaks without it, and where to go
and get it. Compiled by grepping `process.env.*` across `apps/`, `packages/`
and `supabase/` and then reading each call site, so this is what the code
actually does rather than what a template once hoped it would do.

Three things to know before the tables:

- **`NEXT_PUBLIC_` is not a decoration.** Anything with that prefix is compiled
  into the browser bundle and is readable by anyone who opens devtools. A key
  that must stay secret must never carry it.
- **Nothing here throws on startup.** Every integration is checked lazily, at
  the moment it is used, and degrades to an honest state. That is deliberate:
  the platform must boot and be walkable with an empty environment. The "what
  happens without it" column is the real, tested behaviour.
- **Vercel is the deploy target.** Every value below has to be entered at
  *Project Settings → Environment Variables*, for the Production environment
  and, if you want previews to work, for Preview too. A key set only in
  `.env.local` exists on your laptop and nowhere else.

---

## 1. Required, the platform is not itself without these

| Variable | Where to get it | Without it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase → Settings → API](https://supabase.com/dashboard/project/uccixoonmbhrnyczyigt/settings/api). Already known: `https://uccixoonmbhrnyczyigt.supabase.co` | No accounts, no listings, no state/LGA/occupation lists. Every picker shows "we could not load the list". |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page, the **anon / publishable** key. Safe in the browser, because it only ever acts through Row Level Security. | Same as above. **This is the first thing to check if the sign-up dropdowns are empty in production.** |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, the **service role** key. **SERVER ONLY.** It bypasses RLS entirely. `serviceRoleKey()` throws if it is ever evaluated in a browser bundle, so it cannot leak by accident, but never give it the `NEXT_PUBLIC_` prefix. | Admin jobs and any server task that must read across users fail. |
| `NEXT_PUBLIC_SITE_URL` | Your own production URL, e.g. `https://vallospaces.com`. No account needed. | Auth redirects and every link inside an email point at the wrong host. On Vercel previews the platform's own `VERCEL_URL` covers for it; production needs it set explicitly. |

---

## 2. Accounts to go and open

Each row is a service to sign up for. The "free tier reaches" column is there
so you know which ones cost money before launch and which do not.

| Service | Sign-up | What it powers here | Free tier reaches |
|---|---|---|---|
| **Supabase** | [supabase.com](https://supabase.com/dashboard), already open, project `uccixoonmbhrnyczyigt` | Database, auth, storage, RLS | Yes, to a real amount of traffic |
| **Anthropic** | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | The AI assistant and the support-escalation summariser | No, pay as you go |
| **Paystack** | [dashboard.paystack.com → Settings → API Keys & Webhooks](https://dashboard.paystack.com/#/settings/developers) | Card, transfer and USSD payments in naira | No fee to hold an account; per-transaction fee |
| **Resend** | [resend.com/api-keys](https://resend.com/api-keys) | Booking confirmations, receipts, every transactional email | Yes, 3k emails/month |
| **MapTiler** | [cloud.maptiler.com/account/keys](https://cloud.maptiler.com/account/keys) | Map tiles. **A licence, not a feature**: unset, the map draws on CARTO's public basemaps, which are non-commercial use only, and a marketplace taking bookings is a commercial use | Free tier, and this is the only item here that can cost you a letter rather than a bug report |
| **Apple Developer** | [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers) | The App Store, code signing, the Team ID the deep links need | $99/year, which you need anyway to ship on iOS |

### Three services this file used to list and no longer needs

Corrected 2026-08-09.

- **Google Cloud (Places API New)** and **LiteAPI (Nuitée Connect)** powered
  third-party hotel and restaurant inventory. **The owner removed third-party
  inventory from the product** and `apps/web/src/lib/inventory/` no longer
  exists, so neither key does anything. Delete `GOOGLE_PLACES_API_KEY`,
  `GOOGLE_ROUTES_API_KEY`, `LITEAPI_KEY` and `LITEAPI_WHITELABEL_DOMAIN` from
  every environment. ADR-013. Residue still in the database is
  `RECOMMENDATIONS.md` S-2.
- **Google Cloud (OAuth)** powered "Continue with Google". **No Google or Apple
  sign in.** The buttons and the server actions are still in the tree and are
  being removed (`RECOMMENDATIONS.md` N-4). Do not enable a provider in the
  Supabase dashboard and do not set `NEXT_PUBLIC_AUTH_PROVIDERS`. Removing
  Google also removes the Apple obligation: guideline 4.8 requires Sign in with
  Apple only when another third-party sign-in is offered.

The Apple Developer account is still needed, for the store and for signing.

---

## 3. Optional, each one switches a feature on

| Variable | Scope | Without it |
|---|---|---|
| `NEXT_PUBLIC_AUTH_PROVIDERS` | public | **Leave unset, permanently.** The product is email and password only. Setting this to `google` or `apple` enables buttons whose OAuth return journey is not closed on native (`docs/MOBILE.md` section 6), and the whole path is being deleted (`RECOMMENDATIONS.md` N-4). Unset, the two rows render disabled with a plain explanation, which is itself a defect while they exist. |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | **server** | Voice and video calls (VC1, `lib/calls/provider/`). The LiveKit project's websocket URL (`wss://<project>.livekit.cloud`), API key and API secret. The secret signs ten-minute join tokens and verifies LiveKit's webhooks at `/api/calls/webhook`; it never reaches a browser. The URL also widens CSP `connect-src` to that host. Unset: every call action answers "calls are not available right now" and nothing rings. Calls also need the `video_calls` flag on (seeded off); review calls also `admin_review_calls`. Setup: `docs/video-calling/VIDEO-CALLING-PRODUCTION-CHECKLIST.md`. |
| `ANTHROPIC_API_KEY` | **server** | The assistant answers 200 with an honest "not configured" message rather than pretending; support falls back to its keyword FAQ store, so support never goes dark. |
| `ASSISTANT_MODEL` | server | Unset, the route's own default model (`app/api/assistant/route.ts`). Only set to pin a different model. |
| `SUPPORT_MODEL` | server | Same, for the support route. |
| `PAYSTACK_SECRET_KEY` | **server** | The LIVE key (`sk_live_...`). Read on Vercel Production, under `PAYSTACK_MODE=live`, and on any other deployment with no `PAYSTACK_TEST_SECRET_KEY`. Without a usable key for the mode in use, checkout cannot take money; the flow explains itself rather than failing at the card form. It also verifies live webhooks: Paystack signs them with the secret key, so there is no separate webhook secret. |
| `PAYSTACK_TEST_SECRET_KEY` | **server** | The SANDBOX key (`sk_test_...`, Paystack dashboard with Test mode on). When set, Preview and Development deployments use it instead of the live key, and sandbox webhooks are verified with it. A live key pasted here is refused. See "Paystack test and live mode" below. |
| `PAYSTACK_FLOAT_SECRET_KEY` | **server** | The secret key of Vallo's MARKETING FLOAT: a separate Paystack account/balance that holds only Vallo's own money and no customer settlement money. Rewards Balance payouts (D51, `lib/payouts/referral-payout.ts`) send transfers from it and from nothing else; it must never be the main `PAYSTACK_SECRET_KEY`. Unset, a Rewards withdrawal answers "not available yet" and nothing is sent. Payouts additionally stay off until a dated `referral_policy` row sets `payouts_enabled = true` (default false). Paystack signs that account's webhooks with this key. |
| `PAYMENTS_KILL_PAYSTACK`, `PAYMENTS_KILL_PAYLUK` | **server** | Emergency stop for one payment provider, needing no database: exactly `1` stops new payments starting on that provider (`lib/payments/providers/kill-switch.ts`). Verification, webhooks and reconciliation are never stopped, so money already taken is still recorded. Unset in normal running. The database flags `payments_paystack_off` (Paystack runs unless it is on) and `payments_payluk_on` (Payluk runs only while it is on: the founder's escrow switch) are the everyday controls. |
| `PAYLUK_SECRET_KEY`, `PAYLUK_TEST_SECRET_KEY` | **server** | Payluk keys: live (`sk_live_...`, `api.payluk.ng`) and staging (`sk_test_...`, `staging.api.payluk.ng`); the prefix picks the host and a key in the wrong slot is ignored. Read today only by the commission sweep (`lib/payouts/commission-sweep.ts`), which reads Vallo's merchant balance. Unset: every Payluk path no-ops, calling nothing and writing nothing. 10 requests per minute per key, shared by everything that uses it. |
| `PAYSTACK_MODE` | **server** | Optional, `live` or `test`, and it overrides the default below. Unset: Production is live; every other deployment is test, from `PAYSTACK_TEST_SECRET_KEY`, or from `PAYSTACK_SECRET_KEY` only when that holds an `sk_test_` key. Outside Production a live key is used only with `PAYSTACK_MODE=live`. `test` with no test key is "not configured" and never falls back to the live key. Any other value is refused. |
| `PAYSTACK_ALLOW_TEST_MODE_IN_PRODUCTION` | **server** | Leave unset. `PAYSTACK_MODE=test` on Vercel Production is refused unless this is exactly `yes`, because Production on the sandbox would take bookings nobody pays for. |
| `PAYSTACK_TEST_GUARANTEE_SUBACCOUNT` | **server** | The Guarantee reserve subaccount created on the SANDBOX account. Subaccounts belong to one mode, so test mode reads only this; unset in test mode, no payment opens. |
| `PAYSTACK_GUARANTEE_SUBACCOUNT` | **server** | The Paystack subaccount code of the Vallo Guarantee reserve (Track A). Unset, **no payment opens**: every charge is split at the moment of payment and a charge without the reserve leg is refused (`lib/payments/split-attempt.ts`). Created in the Paystack dashboard against the reserve's own bank account. See `docs/MONEY_ARCHITECTURE.md`. |
| `RESEND_API_KEY` | **server** | `sendEmail` returns `{sent: false, reason: "unconfigured"}` and nothing leaves the process. No booking confirmations, no receipts. |
| `EMAIL_FROM` | server | Defaults to `Vallo <hello@vallospaces.com>`, the company address, for every platform email including the auth emails the Send Email Hook composes. `vallospaces.com` must be a **verified domain in Resend** or delivery is rejected outright. |
| `CRON_SECRET` | **server, and read by VERCEL rather than by us** | Vercel's scheduler sends `Authorization: Bearer $CRON_SECRET` on every cron invocation. The name is fixed by Vercel. A grep of this repository finds it only in comments, because no line of ours reads it, which is what makes it easy to misname. **On 22 September this project held `CRONS_SECRET`, with an S. Vercel injected nothing, all seven jobs were refused 401 by our own door for four days, and 262 alerts said "unauthorised" while meaning "your scheduler cannot get in".** Must equal `RECONCILE_CRON_SECRET`. See `docs/DEPLOY.md` section 2.5. |
| `RECONCILE_CRON_SECRET` | **server** | The value `lib/cron/auth.ts` compares that bearer against. Unset, every scheduled job refuses everything, which is deliberate: an open endpoint that cancels bookings is worse than a job that does not run. Whitespace is trimmed on both sides, because a pasted secret carries a newline and an untrimmed comparison turns that into an unexplainable 401. |
| `EMAIL_REPLY_TO` | server | **Defaults to `Vallo <hello@vallospaces.com>`, the company address (founder, 29 September 2026)**, so every platform email carries that `reply_to` even when this is unset, and a value that is not an address falls back to it. Set it only to send replies somewhere else; a message that names its own reply address still wins. `hello@vallospaces.com` must actually receive mail (MX), or replies bounce. Takes `hello@vallospaces.com` or `Vallo <hello@vallospaces.com>`. It rides in the headers of every message the platform sends, so it is as public as the From line and must never be the private founder mailbox. |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_ROUTES_API_KEY`, `LITEAPI_KEY`, `LITEAPI_WHITELABEL_DOMAIN` | none | **Gone, 2026-08-09.** All four powered third-party inventory. `apps/web/src/lib/inventory/` no longer exists, so nothing reads any of them and setting them does nothing at all. Delete them from every environment. ADR-013. |
| `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` / `AMADEUS_ENV` | none | **Gone.** The provider was removed on 2026-08-07 along with these variables. Amadeus decommissioned its Self-Service portal on 17 July 2026 and disabled the keys, so nothing could ever configure it again. Setting these now does nothing at all; delete them from any environment that still carries them. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | public | Six surfaces show a support address. Until this names a real mailbox they show the in-app route instead of an address that bounces. |
| `NEXT_PUBLIC_MAPTILER_KEY` | public | **A licence, not a feature.** Unset, the map draws on CARTO's public basemaps, which are **non-commercial use only**, and a marketplace taking a booking fee is a commercial use. Set it and the map switches provider, zoom ceiling and attribution together. [cloud.maptiler.com/account/keys](https://cloud.maptiler.com/account/keys) |
| `NEXT_PUBLIC_NGN_USD_RATE` | public | The wallet's naira→dollar toggle simply does not appear. It is gated rather than defaulted because a made-up FX rate on a wallet balance is a lie about money. |
| `CSP_ENFORCE` | **server** | **Leave it unset. The Content Security Policy enforces by default now.** It used to read `=== "true"`, which meant an unset variable, a typo or a new environment all landed on report-only, and a report-only policy blocks nothing. Set to the literal `false`, and only that, to step back to reporting while chasing a directive: violations post to `/api/csp-report` and appear as `[csp]` lines in the deployment log. Every other value, including no value, enforces. |
| `CRYPTO_PROVIDER` | **server** | Which licensed on/off-ramp pays for crypto (`lib/crypto/providers/index.ts`). Unset means `yellowcard`, the only one implemented; an unknown name keeps crypto closed. |
| `CRYPTO_ENABLED_ASSETS` | **server** | Comma-separated `ASSET:NETWORK` pairs offered, from the catalogue in `lib/crypto/assets.ts` (e.g. `USDT:TRON,USDC:ETHEREUM,BTC:BITCOIN`). Unknown pairs are ignored; empty offers nothing, and "Pay with crypto" does not appear. |
| `YELLOWCARD_API_BASE`, `YELLOWCARD_API_KEY`, `YELLOWCARD_API_SECRET` | **server** | Pay with crypto (`lib/crypto/providers/yellowcard.ts`) is hidden without all three plus the webhook secret. The base must be `https://`. Written from Yellow Card's published API and never run against a real merchant account: every line marked `CONFIRM ON ONBOARDING` must be checked against the live docs first. Supplied by Yellow Card on merchant onboarding. |
| `YELLOWCARD_WEBHOOK_SECRET` | **server** | Signs every webhook body (`x-yc-signature`, HMAC-SHA256, base64) to `/api/yellowcard/webhook`. Unset, the webhook answers 500 so deliveries stay in Yellow Card's retry queue, and crypto is hidden. |
| `YELLOWCARD_VALLO_SETTLEMENT_ACCOUNT_ID` | **server** | Yellow Card's id for Vallo's own settlement account (the commission leg). Required, or crypto stays closed. |
| `YELLOWCARD_PROVIDER_ACCOUNTS_ARE_BANK_PAYOUTS` | **server** | Crypto stays closed unless this is the literal `confirmed`. Set it only once Yellow Card has confirmed in writing that Vallo's settlement account pays out to Vallo's own bank account rather than accruing a balance held at the provider. |
| `YELLOWCARD_RESERVE_BANK_CODE`, `YELLOWCARD_RESERVE_ACCOUNT_NUMBER`, `YELLOWCARD_RESERVE_ACCOUNT_NAME` | **server** | The Guarantee reserve's own bank account (CBN bank code, 10-digit NUBAN, account name). The reserve leg of every crypto payment is a bank payout here, never a provider balance. All three required and well-formed, or crypto stays closed. The lister's leg settles to their verified payout account, read from the database per payment. |
| `YELLOWCARD_DIRECT_SETTLEMENT` | **server** | Crypto stays closed unless this is the literal `confirmed`. Set it only once Yellow Card has confirmed in writing that it settles naira straight to each leg (lister, Guarantee reserve, Vallo). Vallo never holds a crypto address, crypto or anybody's naira (Track A). Crypto also needs `feature_flags.crypto_payments` on and a KYC-verified payer. |
| `VALLO_INSPECTION_REPORTS` | server | Unset, the eight-room inspection report is ON. `0` turns it off without a code change (`lib/inspections/report-flag.ts`). |
| `LANDLORD_LINE_TRANSPORT` | **server** | Unset or `stub`: messages to a landlord are recorded and never sent (`lib/landlord/channel.ts`). `sms`: sent through Termii's DND route (`lib/landlord/sms-channel.ts`) with `TERMII_API_KEY` and `TERMII_SENDER_ID`; without both, every send fails as `not_configured` and the job raises it. Any other name falls back to the stub. |
| `LANDLORD_INBOUND_SECRET` | **server** | The bearer token an SMS aggregator presents to `/api/landlord/inbound`. Unset, the route answers 503 and no landlord reply is accepted. |
| `VALLO_NIMC_MERCHANT_CODE`, `VALLO_NIN_HMAC_KEY` | **server** | The vNIN identity route (V-49), behind its feature flag. Unset, the route is not drawn and the photo route is the only one. The HMAC key must be at least 32 characters; a NIN is hashed with it before anything stores it, and a new key orphans every stored hash. |
| `STORE_REVIEWER_EMAIL`, `STORE_REVIEWER_PASSWORD` | **server** | The reviewer login the admin store desk signs in with (`lib/store/run.ts`, V-52). Unset, it falls back to `SEED_REVIEWER_EMAIL` and `SEED_REVIEWER_PASSWORD`; with neither, the check reports not configured. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | **server** | The WhatsApp doorbell (V-96) is off: nothing is sent. The Cloud API token and the number's id, from Meta Business Manager. The doorbell also needs its feature flag. |
| `WHATSAPP_APP_SECRET` | **server** | Signs every inbound webhook body (`X-Hub-Signature-256`). Unset, the webhook refuses every delivery. |
| `WHATSAPP_VERIFY_TOKEN` | **server** | Any string; Meta sends it back once when the webhook is registered. Unset, registration cannot complete. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | public | The one number printed on `/safety`, in E.164 (`+234...`). Unset, `/safety` prints no number. |
| `SUPABASE_AUTH_HOOK_SECRET` | **server** | The Send Email Hook secret from Supabase (Authentication, Hooks, Send Email; paste the whole `v1,whsec_...` value). Unset, `/api/auth/email-hook` refuses every request, so no confirmation or reset email is sent: that endpoint mails any address in its body, so an unverified version would be an open relay. |
| `PHONE_SIGNIN_ENABLED` | **server** | **Off unless exactly `true`.** A2, phone sign-in: opens `/sign-in/phone`, the phone code actions (`lib/auth/phone-sign-in.ts`) and the Send SMS hook (`/api/auth/sms-hook`). Supabase generates and checks the code; the hook only delivers it. Set it only after everything in `docs/PHONE_SIGNIN.md` is done. Email is unaffected either way. |
| `SEND_SMS_HOOK_SECRET` | **server** | The Send SMS hook secret from Supabase (Authentication, Hooks, Send SMS; the whole `v1,whsec_...` value, `|`-separated during a rotation). Unset, `/api/auth/sms-hook` refuses every request. |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | **server** | Termii, the code transport for Nigerian numbers (`lib/phone-otp/termii.ts`, behind the `OtpTransport` interface). Both are needed; without either `otpTransport()` is the unconfigured transport and no code is sent. Tries the DND route (reaches MTN and Airtel Do-Not-Disturb numbers) and then the generic route. |
| `TERMII_WHATSAPP_ENABLED` | **server** | `true` puts WhatsApp first, falling back to the DND SMS route. Needs a WhatsApp sender and an approved authentication template on the Termii account. |
| `NEXT_PUBLIC_PASSKEY_SIGNIN_ENABLED` | public | `true` shows "Sign in with a passkey" on `/sign-in` (web only). Passkeys are experimental in supabase-js 2.110 and must also be enabled in the project (Authentication, Passkeys, relying party `vallospaces.com`). Off by default. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | public / **server** | Web Push is off. Generate the pair once with `npx web-push generate-vapid-keys`; a new pair silently kills every enrolled device. See `docs/push/FIRST_NOTIFICATION.md`. |
| `VAPID_SUBJECT` | server | Unset, `mailto:` plus `NEXT_PUBLIC_SUPPORT_EMAIL` when that is set, otherwise `mailto:hello@vallospaces.com` (`lib/push/credentials.ts`). Some push services refuse a request without one (RFC 8292). |
| `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` | **server** | Android push is off. Firebase project settings, Service accounts; the JSON goes in whole, on one line. Set on Production only today, so Preview reports Android push unconfigured. Also needs `android/app/google-services.json` with its real API key. |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` | **server** | iOS push is off. An APNs `.p8` key from the Apple Developer account (99 USD a year). `APNS_BUNDLE_ID` defaults to `com.vallospaces.app`; `APNS_PRODUCTION=true` only for App Store and TestFlight builds. |
| `COINGECKO_API_KEY`, `COINGECKO_PLAN` | none | **Gone.** The deferred crypto market left the shipped tree (V-83), and nothing reads these any more. |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` | public | The store listings for the landing's app band (read at build time, so redeploy after setting them). Both official badges always show on the web; each links to its store only once its URL is set and is that store's own address (`https://apps.apple.com/...`, `https://play.google.com/store/apps/details?id=...`). Until then the badge shows "Coming soon" beneath it and is not a link. Neither shows inside the native apps. |
| `NEXT_PUBLIC_VALLO_X_URL`, `NEXT_PUBLIC_VALLO_TELEGRAM_URL` | public | The footer draws a social mark only when its URL is set. |
| `VALLO_PREVIEW_HARNESS` | server, local only | `1` opens the `(dev)/preview` and `/gallery` fixture harnesses off Vercel. They answer not-found on Vercel whatever it says. |
| `BOT_INPUT_KOBO_PER_MTOK`, `BOT_OUTPUT_KOBO_PER_MTOK` | server | The kobo cost per million tokens the Around assistant's spend ceilings count with (`lib/social/bot-schema.ts`). Unset, the configured model's published price at 1,600 naira to the dollar. Set them when the rate or the price moves; nobody is shown this number. |
| `NEXT_DIST_DIR` | local builds only | A separate `.next` output directory so two local builds cannot corrupt each other (`next.config.ts`). The deploy sets nothing. |
| `CAPACITOR_SERVER_URL` | native build shells and CI | The live origin the iOS and Android shells load (`capacitor.config.ts`). Unset at `npx cap sync`, the binary opens on its offline card. `docs/MOBILE_READINESS.md`. |
| `VALLO_SOCIAL_SIGN_IN` | server | Unset by default: email sign-in only, with Sign in with Apple on when Supabase reports its Apple provider enabled. `google` re-enables Google sign-in on the website only (never inside a native shell); `none` switches Apple off everywhere. Comma-separated, read per request by `lib/auth/providers.ts`. The Supabase dashboard's provider switch remains the control of record for Google. |
| `VALLO_PUBLIC_CATALOGUE` | server | Off by default. `1`, `true` or `on` opens a read-only catalogue (`/search`, `/stays`, `/restaurants` and the listing, stay and restaurant pages) to signed-out visitors, rate-limited per IP; everything else stays behind sign-in. Read by `proxy.ts` per request, so no rebuild is needed. See `docs/PRODUCT.md` section 4. |
| `NF_DATA_SOURCE` | server | `repository` (default) or `api`. Selects the listing/agent data source. Leave unset. |
| `SENTRY_DSN` | **server** | **Crash and error reporting is off and the product is silent about it.** A crash in production leaves only Vercel's own logs, and a crash on an App Store or Play Store build leaves nothing at all, because neither store hands that data back. Set it and `lib/observability/report.ts` posts scrubbed events to Sentry's envelope endpoint over plain HTTPS: server errors through `instrumentation.ts`'s `onRequestError`, browser errors through the error boundaries and `/api/client-error`. Unset, every call returns `{sent:false}` and prints nothing at all, so a development console stays quiet. The value is read on the server only, it is never sent to the browser and it is never logged, so there is no `NEXT_PUBLIC_` twin and none should be added. **Nothing personal is ever sent:** every event passes an explicit allowlist and then the credential-key vocabulary in `lib/alerts/record.ts`, and `lib/observability/scrub.test.ts` proves an email, a bank account, a NIN, an authorization header and a card number do not survive it. Stack traces arrive minified: no source maps are uploaded, by choice, because that needs an auth token this build has not got. Free tier at [sentry.io](https://sentry.io). |
| `OPS_ALERT_EMAIL`, `OPS_ALERT_WEBHOOK_URL` | **server** | **Nobody is told about a critical alert.** Set either or both and `lib/ops/page.ts` sends every CRITICAL alert (a refused catalogue read, the five-minute catalogue canary, a cron that stopped, a money job failure) to a person, at most once an hour per alert: the email through Resend directly (needs `RESEND_API_KEY`), the webhook as a JSON POST `{"text","title"}` to an https URL such as `https://ntfy.sh/<long random topic>`. Unset, alerts stay rows on `/admin/alerts`. This covers failures the app can see; an app that is down is covered by the external uptime monitor on `/api/health/catalogue` (`docs/DEPLOY.md`, "Paging a human"). |
| `CALENDAR_SYNC_ENABLED` | server | **Off unless `1` or `true`.** Host calendar sync (C2): the `calendar-sync` job (`lib/cron/jobs/calendar-sync.ts`) pulls the Airbnb, Booking.com and other calendars hosts link on `/host/calendar` and closes the nights booked there. Needs the migration `20260930084937_host_c2_calendar_sync_feeds_out_and_imports_in.sql` (applied 30 September 2026). Off, the job runs and does nothing; the export feed (`/api/calendar/feed`) works either way. Links are fetched only from the list of sites in `lib/host/ical.ts`. |
| `CALENDAR_SYNC_INTERVAL_MINUTES` | server | How stale a linked calendar may get before it is pulled again. 30 unless set; never under 15 or over 1440. The job itself runs every 15 minutes (`vercel.json`). |
| `SANCTIONS_UN_URL`, `SANCTIONS_NG_URL` | **server** | SCUML items 8 and 9. The https addresses the daily `sanctions-lists` job (`lib/compliance/sanctions/sources.ts`) fetches the UN Consolidated List (XML) and the Nigeria Sanctions List (CSV) from. A fetched file with fewer than 90% of the entries in force waits for a staff member on /admin/compliance instead of activating. Unset, nothing is fetched and staff upload each list on the desk, where a second staff member activates it. Anything but an `https://` URL is ignored. |

### Paystack test and live mode

One rule, in `apps/web/src/lib/payments/paystack-mode.ts`, decides which Paystack account a deployment talks to, and the admin payments page (`/admin/payments`) prints the result as a read-only line.

| Deployment | `PAYSTACK_MODE` unset | `PAYSTACK_MODE=test` | `PAYSTACK_MODE=live` |
|---|---|---|---|
| Production (`VERCEL_ENV=production`) | live: `PAYSTACK_SECRET_KEY` | refused, unless `PAYSTACK_ALLOW_TEST_MODE_IN_PRODUCTION=yes`: then test, `PAYSTACK_TEST_SECRET_KEY` | live: `PAYSTACK_SECRET_KEY` |
| Preview, Development, local | test: `PAYSTACK_TEST_SECRET_KEY` if set, else `PAYSTACK_SECRET_KEY` only if it is an `sk_test_` key (a live key there is refused) | test: `PAYSTACK_TEST_SECRET_KEY` | live: `PAYSTACK_SECRET_KEY` |

- **The key must agree with the mode.** An `sk_live_` key where test mode is expected, or an `sk_test_` key in live mode, is refused and payment reports "not configured". A key with neither prefix takes the mode of the variable it came from.
- **No public key in either mode.** The page resumes the server's transaction by access code, so `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` stays unread.
- **Webhooks.** Paystack signs each webhook with the secret key of the account that sent it, and the route verifies with the key for the mode in use. Point the sandbox account's webhook URL (Paystack dashboard, Test mode, Settings, API Keys and Webhooks) at the Preview deployment's `/api/paystack/webhook`, and the live one at Production's.
- **The reserve.** Test mode reads `PAYSTACK_TEST_GUARANTEE_SUBACCOUNT` and live mode `PAYSTACK_GUARANTEE_SUBACCOUNT`.
- **Lister subaccounts are per mode too.** A lister's settlement subaccount is stored in the database when they add a payout account, on whichever key was in use then. A sandbox charge against a lister whose subaccount was made on the live account is refused by Paystack. Make the sandbox listers' payout accounts on a test-mode deployment.
- **Every attempt records its mode** (`transactions.paystack_mode`; older rows were backfilled as `live`). The attempt sweep, a retry and the payer's close only judge or settle attempts made on the deployment's own mode.
- **Unless Preview has its own Supabase project, it writes to the Production database.** A sandbox charge settled on Preview writes real rows (a paid agreement, a confirmed booking) into the live database. Use test accounts and test listings for sandbox runs.

---

## 4. Documented but NOT wired to anything yet

These appear in older templates. Nothing in the codebase reads them today.
Setting them changes nothing; they are listed so nobody wastes an afternoon
wondering why.

| Variable | Status |
|---|---|
| `NODE_ENV`, `NEXT_RUNTIME`, `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_PROJECT_PRODUCTION_URL` | Read by the code, set by Next.js or Vercel. Never set them by hand. |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Not needed, in live or test mode. The server initialises the transaction and the page resumes it by access code in Paystack's inline iframe, which takes no public key, so the browser never holds a Paystack key. There is no `NEXT_PUBLIC_PAYSTACK_TEST_PUBLIC_KEY` for the same reason. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | No analytics client is installed. |
| `TURBOPACK_ROOT` | Build only, never on Vercel: widens Turbopack's root so a git worktree whose `node_modules` are symlinks into another checkout can run `next build` (`next.config.ts`). Unset, nothing changes. |

---

## 5. Test-harness and build tooling only

Read by specs under `apps/web/tests/`, never by the application: `BASE_URL`,
`QA_MEMBER_EMAIL`, `QA_MEMBER_PASSWORD`, `SOCIAL_AREA`, `SOCIAL_HANDLE`,
`SOCIAL_STANDIN_PORT`, `SOCIAL_STANDIN_DELAY_MS`, `CHROMIUM_PATH`, and the
`PROOF_*` / `PROBE_*` names used by individual scripts under `scripts/`.

Read by build tooling, never by the running app:

| Name | Read by |
|---|---|
| `CAPACITOR_SERVER_URL` | `capacitor.config.ts` during `npx cap sync`: the origin the native shell loads. Unset, the build succeeds but the app opens on its offline page |
| `VALLO_BUILD` | `scripts/sync-native-versions.mjs`: the native build number |
| `NEXT_DIST_DIR` | `next.config.ts`: an alternative `.next` output directory for parallel builds |
| `W6_APP_CSS` | `src/components/app/account/w6-test-css.ts`, the account surfaces' browser tests: a compiled `globals.css` to draw screenshots from the real cascade. Unset, the bundled sheets are used |
| `FIT_DUMP` | `src/components/locale-fit/fit-cases.ts`, the locale-fit browser tests: a file to append every surface's findings to, as JSON lines. Unset, nothing is written |
| `CONTROL_CONTRAST_REPORT` | `src/components/ui/control-contrast.dom.test.tsx`: a file to write every measured control contrast ratio to. Unset, nothing is written |
| `VALLO_AUTH_EMAIL_OUT_DIR` | `scripts/build-auth-emails.mjs`: where the auth email templates are written |
| `SEED_REVIEWER_EMAIL`, `SEED_REVIEWER_PASSWORD` | `npm run seed:reviewer` only |
| `DATABASE_URL` | `scripts/db-probes/run.mjs`, the database probe runner. CI reads it from the `PROBES_DATABASE_URL` repository secret |

Vercel and Node set `NODE_ENV`, `NEXT_RUNTIME`, `VERCEL_ENV`, `VERCEL_URL`,
`VERCEL_GIT_COMMIT_SHA` and `VERCEL_PROJECT_PRODUCTION_URL` themselves. Do not
set them.

---

## 6. Order of work

Reordered 2026-08-09. Steps 5 and 6 used to send the reader to spend an afternoon
on Google OAuth and two inventory providers that the product no longer has.

1. **`SUPABASE_SERVICE_ROLE_KEY`, first, before anything.** It was step 1 already
   and it is now called out on its own line, because a missing service role key
   does not degrade honestly: the Paystack webhook answers HTTP 200 with no log,
   Paystack never retries, and a paid funding is lost permanently. That is the
   most probable cause of the reported wallet failure.
   `RECOMMENDATIONS.md` W-1.
2. **`NEXT_PUBLIC_SUPABASE_URL`, the anon key and `NEXT_PUBLIC_SITE_URL`.**
   Everything else is decoration until these are right in Vercel.
3. **Anthropic.** The assistant is a headline feature and the key takes a
   minute.
4. **Resend + a verified sending domain.** A booking with no confirmation email
   is a support ticket, and `EMAIL_FROM` must be a verified sender or delivery
   is rejected outright.
5. **Paystack.** Required before anyone can pay.
6. **Leaked password protection is NOT on this list any more, because it is
   not free.** It stood here as "one toggle" and that was wrong: Supabase
   gates it behind the **Pro plan**. It is a paid decision rather than a
   dashboard visit, and calling it a toggle meant it sat on a launch checklist
   for weeks looking like thirty seconds of somebody's time. Moved to the paid
   items in `docs/archive/FOUNDER_OPEN_ITEMS.md`. `docs/archive/DATABASE_AUDIT.md` section 1.1
   still describes what it does.
7. **`NEXT_PUBLIC_MAPTILER_KEY`. DONE, 22 September.** Key created, origin
   locked, and set in Vercel for production and preview. The origin list
   deliberately includes a bare `?`, because the native shell sends no
   ordinary web origin and the map would be blank inside the app without it.
