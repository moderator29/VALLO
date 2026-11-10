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
