# DOCS HANDOFF (Agent DOCS, 11 November 2026)

Nothing committed, pushed or deployed. Everything below was run unless marked.

## What was built

**The kit** (`apps/web/src/components/docs/`, one stylesheet `docs-kit.css`, tokens only, both themes):
`DocShell` (brand glyph, section, search, breadcrumb), `DocCard`/`DocCards`, `DocTable` (real table markup, tinted sticky header, state pill with dot and word, yes/no marks, reflows to stacked cards under 34rem of its own width with table roles kept), `DocHeader`, `DocSummary`, `DocToc` (current section marked), `DocCallout` (note, warning, not-live), `DocCrossLink`, `StepGuide` (Before you start checklist, numbered steps, "Walk through it" player, theme-matched captures), `DocSearchSheet` (bottom sheet, popular topic chips that are plain links so it works offline, results grouped with matched words marked), `CopyControl`, `WasThisHelpful` (a "no" files a normal support ticket for a signed-in reader, via `fileSupportTicket`; signed out is sent to the contact form; a "yes" is not recorded and says only thanks), `DocButton`/`DocButtons` (signed-out goes to sign in carrying the destination; Start verification says so when the identity document is approved or with a reviewer; never a dead end), `FeeCalculator` + `FeeCalculatorSection` (reads `fee_rates` through the existing `readListerFees`; shows no figure and says so if unreadable).
Supporting `lib/docs/`: `destinations.ts` (every button target in one list), `contact.ts` (the one constant `hello@vallospaces.com`), `viewer-actions.ts`, `helpful-actions.ts`, `search-topics.ts`, `shots.ts/.json`, `capture-plan.json`, `coverage.ts` + `coverage.test.ts`.

**Upgraded in place** (no route, slug or still-true content removed): `/docs` (cards, DocShell, search sheet), `/docs/[slug]` (DocHeader, glance, DocToc, buttons, helpful, contact), `/guides` (DocCards) and each guide (buttons, helpful), `/help` (DocShell, buttons, contact). Deleted as unused: `OnThisPage.tsx`, `DocsSearch`, `.nf-doc-rail*`, `.nf-guides`, `.nf-guide-card*`.

**The sweep**: `docs/handoff/DOCS_COVERAGE.md` (every route, documented or exempt with a reason, what was corrected). 20 new member chapters (`chapters-platform.tsx`, `chapters-offers.tsx`), 9 staff manual pages behind the console (`app/admin/handbook/manual/**`, linked from the handbook).

**Offers pages** (all eight, plus the staff page): How offers work; How to make an offer (step guide with 5 captures, both themes); Receiving and answering; Counteroffers (worked example, 85,000,000 asking, 78,000,000 offer, 82,000,000 counter, 80,500,000 agreed, figures from `lib/offers/format.ts` itself: 7,000,000 below asking 8.2 percent; 3,000,000 / 3.5; 4,500,000 / 5.3; the buyer rose by 2,500,000, 3.2 percent of their first offer); The Deal Room; Inspections and due diligence; Documents; Fees. Every state, stage, refusal and document sentence is imported from `lib/offers/words.ts`, so it cannot drift. Buttons use `lib/offers/routes.ts`.

**Captures**: `apps/web/scripts/capture-docs.mjs` (Playwright, 390x844, deviceScaleFactor 2, dark and light, webp quality 78 via sharp, `--check`, `--only`, hides the Next dev badge). 10 files, 468 KB total, written to `public/docs/making-an-offer/`. They come from `/preview/offers/*` fixtures, never a live account; every caption says "Example screen, not a live account".

## Money wording corrected (code is right)
`facts.ts` said rent and shortlets default to Escrow and that a sale is always escrow. The code's live rail is `direct`, protected payment is not available, and a purchase takes no money through Vallo. Reworded everywhere the constants flow (docs, help answers, FAQ, guides). `SALE_IS_ESCROW` renamed `SALE_TAKES_NO_MONEY`. The paying chapter's escrow section is now "Protected payment (not available yet)". Detail in DOCS_COVERAGE.md.

## Gates (real results)
- `tsc --noEmit` whole project: clean (after fixing icon names).
- eslint on all my paths: clean.
- `check-no-em-dash.mjs`, `check-css-tokens.mjs` (incl. comment paths), `check-valuation-words.mjs`: all clean.
- vitest: `src/lib/docs` (11 tests incl. coverage, capture plan, button routes, manual desk links), `app/(site)/docs` (slugs, docs-links), `lib/support`, `lib/guides`, `lib/copy`, `lib/money`, `components/site`: all pass except `lib/money/fund-fallback-actions.test.ts > switchEscrowToCard` (fails with "That could not be done just now"). I did not touch `lib/money`; I did not investigate it. Please check whether another agent's change broke it.
- **The coverage check, shown to pass and to fail**: passes with the real tree; with a temporary `app/zz-fake-feature/page.tsx` it failed ("pages with no documentation entry ... /zz-fake-feature"); the file was removed. The test also carries a permanent fixture proving a fake route and a missing route are detected, and a nonexistent button target does not resolve.
- Looked at with Playwright on the shared dev server (3111): 13 documentation pages at 390, 360 and 1280, dark and light: 78 combinations, none scroll sideways. Viewed the docs home, the counteroffers table reflow at 360, the search sheet (light) and a capture. The 360 table first showed its caption squeezed; fixed (`caption { display: block }`) and not re-viewed.

## What I could not verify
- No signed-in session, no Supabase, no staff account: the DocButton signed-in and verified states, the helpful-to-ticket write, and the staff manual pages were type-checked and linted but never rendered or exercised. Signed-out behaviour was seen only as the fallback link.
- Dev server, not a production build (so the PAGE_LEDGER ticks say "dev server").
- Real signed-in screenshots are impossible here; all captures are preview fixtures.
- The 22 older chapters, 5 guides and help answers were searched for stale terms but not each re-read against screens (no "Last updated" date on them on purpose).
- New chapters are from each screen's own source and header comments, not from running the screens. Roommates and Offers describe features whose SQL is still in `supabase/migrations/pending/`.
- The typed 10 percent hotel commission in `facts.ts` is the one hand-typed figure left; the admin fees desk says every rate is zero. I could not read the live rows.

## Recommend next
1. Import `CONTACT_EMAIL` in `/contact` (not my path; it prints the mailbox only if an env var is set).
2. Decide the staff handbook line "never describe a wallet, a balance or escrow" against the existing Wallet screen (needs a version bump and re-acknowledgement).
3. Re-run `node apps/web/scripts/capture-docs.mjs` after any change to the offer screens; add Deal Room captures to `capture-plan.json` and a `shot:` on the Deal Room chapter.
4. Close the two known gaps (crypto payment page, review calls) and lower `MAX_KNOWN_GAPS`.
5. Drop `/around/manage`, `/profile/setup/firm`, `/sign-up/phone` from the page ledger.
6. A short section for in-product context links (fee beside the fee, policy on the booking screen) is not done: those are edits in other agents' files.
7. Re-read the older chapters line by line against their screens, then give each a date.
