# OFFERS AND DEAL ROOM: UI HAND-OFF (Agent UI, 10 November 2026)

## Files
- Routes module (stable, for DOCS): `apps/web/src/lib/offers/routes.ts` (offersHref, offersTabHref, dealRoomHref, dealRoomTabHref, makeOfferHref, adminOffersHref, adminDealHref).
- Words and money: `lib/offers/words.ts`, `format.ts`, `fixtures.ts` (+ `words.test.ts`, `format.test.ts`).
- Screens: `app/(app)/offers/{page,loading}`, `offers/[id]/{page,loading,not-found}` (Deal Room; `?sent=1` is the confirmation), `app/(app)/listing/[id]/offer/{page,loading}`.
- Components: `components/app/offers/*` (OfferFlow, OfferParts, OffersWorkspace, OfferConfirmation, CannotOffer, Skeletons, offer-action, offers.css), `components/app/deal-room/*` (DealRoomView, Panels, DocumentsPanel, DealSheets, act, model).
- Admin: `app/admin/offers/*` (page, [id]/page, OverviewStrip, OffersTable, DealView, Intervention, model, reads, fixtures, loading). Nav: child "Offers and deals" under Agreements in `admin/_components/nav.ts`; `STAFF_EXTRA_DESKS.agreements` in `StaffFrame.tsx`.
- Listing edits (smallest): `listing/[id]/page.tsx` (offer gate read, sale primary = Make an offer / View your offer / View offers, price block + "does not verify title" in the cost section, mandate prop), `ListingStickyBar.tsx` (optional `inspect` ghost button), `ListingAgentCard.tsx` (optional `mandate` line).
- Previews: `app/(dev)/preview/offers/{page,flow,list,room,parts,admin}` (VALLO_PREVIEW_HARNESS=1).
- Ledger rows added (fixture-seen only) in `PAGE_LEDGER.md`.

## Gates actually run
- vitest: 60 tests pass across lib/offers, offers dom tests, deal-room model, offer-action.
- eslint on all my files: clean. no-em-dash: clean. valuation-words: clean (when last run). css-tokens: no fault in my files (one unresolved comment path in `admin/handbook/manual/manual-content.tsx`, not mine).
- tsc: no errors in my files. Remaining errors are others': `(site)/docs/chapters-platform.tsx`, `admin/handbook/manual/manual-content.tsx`, `lib/offers/actions.ts(155)`.
- Seen through Playwright against fixtures: flow (390/360, light/dark), blocked flow, confirmation, My offers, Deal Room (390, 360, 1280, both themes), admin desk 1280. No horizontal overflow measured.
- A wider vitest run (admin/_components) had 7 timeouts under machine load; not re-run in isolation. Re-run `nav-coverage.test.ts`.

## Not verified
- No live data: every screen is seen with fixtures only. Sheets (accept, counter, document review), upload to signed URL, admin intervention, and the listing page edits were type-checked but not opened in a browser. Existing listing DOM tests were not re-run.
- Light mode checked for flow, confirmation and Deal Room; not for list, admin or sheets. Desktop checked for Deal Room and admin only.

## Gaps and requests (contract)
1. Messages tab links to `/messages/[id]` rather than embedding: `ThreadView` needs a large server payload and sits in a file I may not touch. Recommend a thread panel export.
2. `/verification` does not honour a return path. The draft is kept in sessionStorage by listing id, so Back returns to a filled form; a `next` param would be better.
3. `DealDocument` lacks the uploader's side, so Review shows on every uploaded doc and the server must refuse self-review. Add `uploadedBy: Side`.
4. No `disputed` flag or info-request marker in `DealRoom`; I infer an open question from the last event being `info_requested`. Add `disputed` and `openQuestion`.
5. The eight-item inspection report has no read in the contract; the Inspection tab links to the existing visit flow and shows the report only as an `inspection_report` document.
6. `app/admin/offers/reads.ts` returns null until you fill `readOffersDesk` and `readAdminDeal` (shapes in `model.ts`).
7. Offer flow uses `canOpenForm` (form visible) and `canOffer` (Send enabled).
8. Stage buttons assume `markStage` order due_diligence, documentation, closing, completed.

## Still to do
Full re-audit pass (light mode on every screen, sheets, 360 on admin), real keyboard test on the desk, ledger ticks once seen live.

---

## DESIGN UPGRADE (founder: "not to my taste, make it advanced")

### What changed
- **One card language**: kit `Panel` cards with `SectionHead` (icon plate and title), `Receipt` (dashed dividers, tabular figures; used on the offer summary, confirmation, Deal Room terms and the admin deal; no total line unless real).
- **Money hero**: `HeroMoney` counts in once with the kit `CountUp` (off under reduced motion, Calm, Off). `OfferFigures` adds the difference pill (arrow, amount, percent, word) and a `GapBar` (offer marker, asking marker, fill for the gap). Used on offer cards, Deal Room, versions, summary, confirmation, accept sheet, admin deal.
- **Tables**: `.nf-dt` language on My offers (desktop) and the admin desk: sticky tinted header, sticky filter bar with counts, search (`/`), thumbnail plus title plus reference cell, difference pill, sortable headers with a turning arrow, up/down arrow keys and Enter, row "Open" cue on hover and focus. Phone keeps rich cards (thumbnail, figure, gap bar, whose turn).
- **Deal Room**: `StageRail` (fill glides, current node pops, done nodes draw their tick, once; vertical on phone inside a disclosure with a "Step n of 7" line, horizontal on desktop); `FourStrip` (the four answers, 2x2 on phone, four columns on desktop, "your move" tinted); negotiation as a timeline (node per version, diff chips with arrows, a joining version animates); tabs with one sliding ink bar; the primary action has one sheen; messages restyled (tails, day separators, growing composer); inspection report as eight check cards with the photo count.
- **Flow**: StepFrame direction set so steps slide the right way; payment fields reveal with a height and opacity transition (`inert` while closed); eligibility checks draw themselves in; summary is a receipt.
- **Listing**: Make an offer gets one sheen; Contact agent and Schedule inspection now share the quiet slot (they overlapped before: found by looking); mandate shows as a quiet green plate only when held.
- **Skeletons** in the real shapes (flow, cards and table, Deal Room); empty states with Icon3D art and an invitation.
- Fixtures: eight-item report and a four-message thread added; new preview `/preview/offers/listing`.

### Seen (Playwright, deviceScaleFactor 1, dev server on 3120, fixtures only)
Flow steps 1 to 3 (blocked and open), instalment reveal, confirmation, My offers (cards 390/360, table 1280, empty), Deal Room (overview, negotiation, documents, messages, inspection at 390/360/1280), admin desk and admin deal at 1280, listing sticky bar and price block at 390/360; sheets opened at 390 dark: respond, accept, decline, counter, info, withdraw, concern, request document, review document. No horizontal overflow measured on any screen. Found and fixed by looking: overlapping sticky-bar icons, offer/asking labels overlapping on the gap bar, a clashing global `.nf-msg` class, the tab row overflowing, the four-answer strip pushing the terms below the fold, and an unstyled admin deal page.

### Gates
eslint clean on my files; em dash, valuation words, css tokens clean; tsc no errors; vitest (css, type-weights, i18n, ui, design, nav, trust, offers, offers components, deal-room, admin/_components): 990 pass, 1 fails (`lib/nav/route-files.test.ts` names `/api/build`, not mine).

### Not verified
- Sheets and the admin desk in light mode, and sheets at 360 and 1280, were not opened. Light mode checked for flow, list, Deal Room, admin desk, listing.
- Real motion was not watched (screenshots are still frames); animation correctness is by CSS review and by the gates keeping it to transform and opacity, once, behind the motion gate. Reduced-motion and Calm paths not exercised in a browser.
- Document upload to a signed URL, live listing page, keyboard row navigation and the `/` shortcut were not driven in a browser.
- Dev server stopped; nothing committed.
