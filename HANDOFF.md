# Vallo: the handoff

Written 13 October 2026, brought up to date on 17 October 2026 after the deep audit (section 6). This is the only handoff in the repository. Read it first, then work.

**Latest brief (27 October 2026): `docs/NEXT_SESSION_PROMPT.md`.** It holds the current job (the platform-wide desktop, iPad and light-mode upgrade, phone verification and wallet, referral, calls) and the rules for that session: ONE agent in total, fully autonomous, apply all database work yourself, audit everything twice before committing, push to the working branch and never to `main`. Where it disagrees with section 5's advice to run agents in parallel, it wins.

## Paste this to start a session

> You are the lead engineer for Vallo (VALLO SPACES LTD), a Nigerian property and stays marketplace. Read `HANDOFF.md` in the repo root, then `apps/web/AGENTS.md`. Work on the branch the session names (the 17 October audit is on `claude/new-session-8to5i0`, not yet merged). Seyi is the founder: short answers, plain words, no em dashes, decide the obvious things yourself and keep going. You may run all database changes and all repo work on the working branch without asking. Use up to 4 parallel agents, one branch and one worktree each, and audit every result before merging it. Never push to `main` unless Seyi says so in that message. Say plainly what you could not verify. Start with section 6 of the handoff.

## 1. The founder and how Seyi works

- **Seyi** (Omojuni Oluwaseyifunmi Ebenezer): founder, CEO and CTO. Works from a phone, pays for this personally, and hits usage limits, so waste nothing. Writes fast with typos: read the intent.
- **Answer first.** One or two lines of result, then detail only if it matters. Lists beat paragraphs. No theory, no long preambles.
- **No em dashes** anywhere: code, docs, copy, messages. A repo gate enforces it.
- **Decisions are Seyi's, defaults are yours.** Recommend one clear option. When a question has an obvious answer, act and say what you chose. Ask only when the whole task depends on something only Seyi has. Seyi often says "tell me the best approach and do it": do it.
- **Never ask Seyi to run what you can run.** Database changes, repo work and merges to the working branch are pre-authorised. If a tool blocks you, say so once and give the exact SQL or command.
- **Verify before asserting.** Seyi has been burned by confident wrong answers and a misread timestamp. Check one thing at a time, correct yourself in one sentence, then move on. Say "committed", "pushed", "tested" and "compliant" only when true, and list what you could not test.
- **Test twice.** Run the gates twice and keep the output honest.
- **Fast and parallel.** Run agents in parallel, tell them to finish, merge as each reports. Report status in a few lines.
- **Industry standard, clean, premium.** Copy what big platforms do (Airbnb, Booking.com, OpenTable) and adapt it for Nigeria. One design language, one way of doing each thing. Enhance what exists; never build a second version of a screen.
- **Security.** Never print, log or commit a credential. Never ask anyone to paste a key or password into chat. Keys that were pasted in chat before must be rotated (see section 6).
- **Merging to main** happens only when Seyi says "push to main" in that message. Then verify the Vercel production deploy. No pull request unless asked.

## 2. Product rules that never change

- **Free to use.** Listing is free. Vallo charges only on a completed deal. Pro is optional, never required. Renters and guests pay exactly the listed price with nothing added.
- **Every cost is shown before booking**, including charges at the door. Hosts must not charge anything not listed on Vallo or add a charge with no stated reason. Hosts accept the Terms, Privacy Policy and Host Agreement before publishing.
- **Vallo never holds customer money.** Licensed partners hold payments and escrow. The UI stays Vallo-native; provider names appear only where the law requires. Never fabricate a balance, reference or transaction.
- **Viewings never take money.** Money moves only after the inspection and the renter's decision.
- **Restaurants:** booking a table is free, the restaurant confirms, the diner pays the bill at the restaurant or through Vallo. Vallo bills the restaurant 1,000 naira per seated table. Bill payment through Vallo (Paystack split, 2 percent commission) stays off until Paystack keys and each restaurant's subaccount exist.
- **An owner account and an agent account are separate.** One account holds one side.
- **Words and claims.** Copy lives in `packages/i18n`. Never claim "safe", "checked" or "verified" unless a mechanism backs it (a test polices this). Use `countOf` for plurals. Never use font-weight 500 in app CSS. The dock's resting icons stay brand blue. The logo has the same colours in light and dark.
- **Names.** The company is VALLO SPACES LTD (contracts, legal pages). The product is Vallo. RentMe and NaijaFinds are dead and never appear in anything new.

## 3. Company facts

- VALLO SPACES LTD, RC 9870413, TIN 2623712661609, incorporated 18 September 2026. Office: Plot 5, Zone 6, Dutse Alhaji, Bwari Area Council, FCT, Abuja. Share capital 1,000,000 naira.
- Co-founders agreement dated 13 October 2026, with the lawyer for review, not yet signed: Seyi 45 percent (CEO and CTO), Samuel Soledayo Babatola 35 percent (Chief Growth Officer, UK; invests US$20,000, of which US$6,000 is received; leads investor funding), Kareem Adetiba Tunde 20 percent (Chief Operating Officer, Akure). Four-year vesting with a one-year cliff from 18 September 2026. Major decisions need all three. All three approve every bank payment before money leaves. CAC still shows 523,000 / 297,000 / 180,000 shares until the transfers are filed after signing.
- Order for the bank: CAC certificate, then SCUML, then the corporate account.

## 4. Where things live

- **Repo:** `moderator29/read-it-well`. Next.js 16 in `apps/web` (this version differs from older docs: read `apps/web/AGENTS.md` and `node_modules/next/dist/docs/` before writing Next code). Shared packages in `packages/*`. Capacitor shells in `apps/web/android` and `apps/web/ios`; they load the live site, so web changes need no app build.
- **Production:** `main` deploys to https://www.vallospaces.com. Vercel project `read-it-well-web` (team vallospacelstd): pass the project name, never a team id.
- **Database:** Supabase project `uccixoonmbhrnyczyigt`. Check access first (`list_projects` must show it): on 17 October the session's connector was signed in to another account, so every database fix was written as a draft in `supabase/migrations/pending/` for Seyi to paste. Reconnect at claude.ai/customize/connectors with the owning account, then start a new session.
- **Apps:** package `com.vallospaces.app`. iOS 1.0.0 (built 9 October, includes App-Bound Domains so the service worker runs) is in Apple review. Android is in Play production review. Versions come from `npm run sync:versions`. Firebase project `vallo-6f946` (Android push), APNs team `X74KD52994` (iPhone push).
- **Founder admin account:** Phantomfcalls@gmail.com (`super_admin`). QA accounts use `+qaadmi` and `+qamember` plus-addresses; their passwords were pasted in chat and must be rotated.
- **Design tokens:** `packages/design-tokens/src/tokens.css`. Back-button rules: `docs/BACK_NAVIGATION.md`. Money design: `docs/MONEY_ARCHITECTURE.md`. Decisions record: `docs/DECISIONS_2026-10-13.md`. Founder rulings D51 to D85: `docs/RULINGS.md`. Database statements the connector cannot run: `docs/DB_NOTES.md`.

## 5. How work is done

- **Gates** (all must pass before a commit batch and again at the end), from the repo root: `node apps/web/scripts/check-no-em-dash.mjs`, `check-valuation-words.mjs`, `check-css-tokens.mjs`, and `node scripts/check-migrations.mjs`. In `apps/web`: `npx tsc --noEmit -p .` and `npx eslint .` (both at zero errors since 17 October; keep them there, CI's lint step fails on any error). `npm ci` installs `livekit-client` in the sandbox now, so tsc is fully clean and the calls tests run.
- **Tests:** run only the tests for the areas you touched; the full suite takes about 20 minutes and is fully green on the 17 October branch. Many repo tests police copy, claims, routes, plurals, returned errors and docs: fix the code or the register, never weaken a test.
- **New routes** go in `src/lib/nav/route-parents.ts`, `route-labels.ts` and `src/lib/routing/known-routes.ts`. A public route also goes in `PUBLIC_SEGMENTS` in `src/proxy.ts`, in `src/proxy.test.ts` and in `src/lib/i18n/public-locale.ts`.
- **Database changes:** apply with the Supabase MCP `apply_migration`, in small chunks (use `$fn$` quoting and start each with `set lock_timeout = '5s';`). Save the same SQL as `supabase/migrations/<version>_<name>.sql` using the version the database recorded, then `node scripts/check-migrations.mjs --record <file>`. Drafts go in `supabase/migrations/pending/`. Read each agent's migration against the live function definitions and grants before applying. The connector freezes for 60 seconds on any statement containing `DELETE` or `DROP FUNCTION`: do not disguise them; give Seyi the SQL.
- **New pg_cron jobs** also go in `PG_CRON_JOBS` (`apps/web/src/lib/admin/reads/jobs.ts`) and the table and count in `docs/ADMIN_CONSOLE.md`.
- **Agents:** brief each one fully (goal, files, rules, "never push, never touch main, no live database writes, no DROP"), one branch `track/<name>` and one worktree each, at most 4 at once because memory is short. Audit the diff, run the gates, then merge into the working branch. Agents write the code; you own the database and the merge.
- **Rules added on 17 October:** no `:root:has()`, `html:has()` or `body:has()` in a screen stylesheet (each one restyled the whole page on every DOM insertion; `src/app/root-has.test.ts`); the component that owns a state raises a root flag instead (`lib/ui/root-flag.ts`, `components/ui/RootFlag.tsx`), and a flag's name must not match an attribute an element already carries. Every storage path recorded on a row goes through `lib/security/own-folder.ts` (listing media through `lib/agent/media-path.ts`). Dead code is reported by knip in CI (`knip.jsonc`, report only).
- **CI** runs only on a push to `main` and on pull requests; a session cannot dispatch it (403), so the database probes against the live database run when the branch is merged.
- **Sandbox limits:** no device, and MapTiler, Payluk, LiveKit and Termii are unreachable. A production build works (`npm run build` in `apps/web` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SITE_URL` set, about 3 minutes); `next dev` with Turbopack fails in a worktree whose node_modules are symlinks, so agents use `--webpack` or a build. Check providers from production at `/admin/operations/providers`. `gh` is the built-in API client only.

## 6. Open items (17 October 2026)

The deep audit of 17 October (one lead, ten agents on `track/audit-a` to `track/audit-j`, all merged into `claude/new-session-8to5i0`) fixed what it found in the money, identity, upload, admin and messaging paths, cleared CI's lint and test failures, removed dead code and brought the public docs and help in line with the code. What it could not do is below. The first two items are the most urgent.

### Founder (not engineering)

1. **Done on 21 October 2026:** `private.booking_is_paid` now answers true or false (migration `20261021105606_booking_is_paid_never_null.sql`). Nothing to do.
2. **Reconnect the Supabase connector** to the account that owns `uccixoonmbhrnyczyigt` (claude.ai/customize/connectors), so the next session can apply the other drafts in `pending/` (each header says what to check against the live definition first): the self-review guards (`20261017120000`, `20261017141000`, `20261017143000`), the message scanner that flags every phone number as an account number (`20261017120100`), the restaurant bill switch (`20261017140000`, seeds `restaurant_bill_pay` off), the restaurant fees window (`20261017142000`), the Abuja stadium pin (`20261017144000`), the custody switch guard missing on live (`20261017150000`; card saving now has its own switch `saved_cards`, so restore the guard, set `saved_cards` on if cards should be saved, then turn `wallet` off), account deletion waiting for partner-held money and withdrawable rewards (`20261017151000`), the viewing reminder's day word read from the Lagos dates (`20261017152000`), plus `rt01`/`rt02`. `docs/DB_NOTES.md` also holds two data fixes to check first: the example collection's agents row now belongs to the QA member on live, and one open alert keeps probe db-p2-02 red. Run `docs/sql-editor/02-health-check-read-only.sql` and hand the answers to the next session.
3. **Merge decides the database probes.** CI's "Database probes" job has failed since 13 October (38 of 123 on main): two are the bug in item 1, most are probe fixtures that went stale when later rules landed (workspace acceptance, one side per account, the rail changes); `track/audit-g` repaired what it could without a database. `track-a-custody-retired` says the live database lets the retired `wallet` switch be turned on although every migration refuses it: live drift to decide.
4. **Check the Vercel preview of the branch reads READY** (the connector could not read it). A local production build of the branch passed with no warnings.
5. **Devices:** install from TestFlight and the Play internal track; allow notifications on the iPhone and read the failure reference Settings now shows if enrolment fails (for example `token/os-...`); confirm a row reaches `push_tokens`; make a call; time a repeat open; upload a real video; book a viewing; reserve a table.
6. **Rotate every credential pasted in chat** (QA passwords, the APNs key, the Firebase service-account keys, the old vallo-44059 key). Watch the Apple and Play reviews. Connect Paystack for restaurants (each restaurant's payout subaccount, then a Paystack test-mode run, then switch `restaurant_bill_pay` on).
7. **Host Agreement version moved to 2026-10-17** (the restaurant fee is per seated table, not per guest): hosts tick it again on their next application.

### Lawyer

`docs/LEGAL_AND_NDPC_READINESS.md` section 7 holds the full list (27 points): the retired Guarantee and "no wallet, no balance" wording across Terms sections 4, 5, 13, 14 and 15, the Disclaimer and the Privacy policy; the single cancellation schedule the Terms describe (hosts now pick Flexible, Moderate, Firm or Strict); staff approval before payment (off under D83); the fee section missing the hotel commission, the per-table restaurant fee and the paid plans; processors the Privacy policy does not name (Payluk, Termii, LiveKit, Google and Apple sign-in, WhatsApp). Change the Terms and Privacy in one release so members accept once. The co-founders agreement is out for review (after signing, file the share transfers at CAC).

### Work for the next session, in priority order

1. **Walk the signed-in flows** with a QA account on a real build: post a house with photos and a video, a viewing to a no-show and its dispute, host setup for each kind, a reservation to seated and a review, the owner and agent applications, messaging (reply, forward, swipe, photo groups).
2. **Apply the database drafts** (item 2 above) once the connector reaches the project, each read against `pg_get_functiondef` first, and move each pending probe into `supabase/tests/probes/` when its migration is applied.
3. **Shared focus-ring cascade:** the global focus rule in `app/css/base.css` sits outside every CSS layer, so it beats component focus rules inside a layer (`.nf-pcard__photobtn`'s ring never shows; `.nf-sc__link` may show two). Needs a deliberate pass.
4. **knip** still reports about 30 unused files and 500 unused exports; several are built-and-waiting money modules (commission sweep, processor fee, fee and rate acceptance) and `lib/bookings/lifecycle-actions.ts` (a stay no-show action with no screen). Decide which are product and which are dead.
5. **Translations:** a native speaker should review the Hausa, Igbo and Yoruba strings agents wrote (the drafts folders and `review-status.ts` list them; about 600 strings moved into the dictionaries on 17 October). Still English in every language: the `checkout` namespace (about 115 strings on money screens, the biggest gap), the listing wizard (about 70), `pro/pro-copy.ts`, `SupportChat`, the rest of `AgreementControls` (the claim form), `MapCanvas`, `TableSeatingPanel`, `PaystackCheckout`, `profile/AccountBody`, about 90 `loading.tsx` labels, and server action refusals as a layer. The Hausa core slice is at 11,816 of its 12,000-byte budget (`core-entry.test`). `codeLengthWord` answers in English.
6. **The retired Guarantee still shows in the app:** the Guarantee claim form and its email still appear on paid agreements (D51 retired it), and the Hausa chargeback copy names Payluk and the Guarantee. Decide with the lawyer's Terms change.
7. **Speed, next steps** (measured on 17 October, local build): every public page's largest paint is about 86 percent render delay, so the lever is less script before first paint: split `UiIcon` (10 KB on every route, about a day), load the call layer lazily (about 14 KB on 116 routes, half a day), move `system.css` to the error boundaries (an hour), split RiskSettingsForm's zod (30 minutes, then drop it from `client-import-graph.test.ts`). Record `/` and the other weight budgets from CI's own reading (local reads `/` at 498 against 595).
8. **Night theme:** the legal and policy pages are a white document sheet in night theme by design (D28.1, enforced by `Panel.tiers.test`); it is the biggest pale box left. Founder's call.
9. **Native speed (only if needed):** a first launch after install still waits for the network; an Android native shell plus new builds would fix it. Repeat launches are served from saved screens (service worker v6).
10. **Repo:** the git history is 2.7 GB because of old uploads; rewriting it is Seyi's call.
- **Known conflicts:** restaurant deposits (D75, flag off) contradict "free table booking" if ever turned on.

### Rollback

Production is whatever `main` holds. To return to the commit before this audit's merge: `git revert -m 1 <merge commit>` and push to `main` (Vercel redeploys), or promote the previous production deployment in the Vercel dashboard (Deployments, the one before the merge, Promote to Production). The commit `main` held before the audit was `2e0a01e8`.
