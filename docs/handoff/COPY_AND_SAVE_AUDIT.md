# Copy and save audit (10 November 2026)

Founder: "easy copy click-board things, banner stuff like the archived banner, clean, wide platform, in the admin panel and inside the platform, all pages; even if I bookmark something it should show the banner of the action."

## The shared pieces

- `components/ui/CopyButton.tsx`: `CopyButton` (a small icon button with an accessible name), `CopyValue` (a value with its button) and `CopyLink` (a page of ours by path, built from the browser origin at the tap). It copies through `lib/ui/clipboard.ts` (async clipboard, textarea fallback), says what it copied in the top banner ("Link copied", "Code copied", "Copied" or a custom line), and swaps its glyph for a check for a beat. A glyph swap, not a motion, so reduced motion needs no branch. It works with or without the client copy provider (the admin console has none). Tests: `CopyButton.dom.test.tsx`.
- `lib/ui/save-banner.ts`: `saveDoneBanner`, built on `bannerWithUndo`. "Saved. It is in Saved." with Undo (the real inverse); a removal says "Removed from Saved." and Undo puts it back. The banner helper offers one action, so the destination is in the words. Tests: `save-banner.test.ts`.
- The banner host is mounted once in the root layout, so a deep-linked page (a bookmark, a shared link, a push) shows the banner of its action with no extra work.

## Copy: where it is now

| Place | State |
| --- | --- |
| Listing page | ADDED `CopyLink` beside Share to feed |
| Feed post menu: Share (no native sheet) and Copy link | CHANGED to the shared `useCopy` (was a bare clipboard call with its own banner) |
| Post thread, profile menu, story viewer share, saved collection share | Already copy and say "Link copied" (kept) |
| Referral link and code, invite links and tickets | Already had a copy control with a banner (kept) |
| Receipt codes, protected-rail references, listing code, table seating, crypto payment status, calendar sync | Already had one (kept) |
| Support ticket number: filed screen and ticket page | ADDED |
| Admin: every `DetailRow` whose label is a reference, id, email, case, ticket, code or number | ADDED once, in the shared row (`app/admin/_components/ui.tsx`) |
| Admin: listing review reference | ADDED |
| Booking and agreement references, payment references | Not changed in this pass: they render through pages other agents own or through the same DetailRow where the label matches. Listed as a follow-up. |

## Save, bookmark, collection: where the banner stands

| Action | Before | Now |
| --- | --- | --- |
| Listing heart on a card (`SaveControl`) | banner, no Undo, words "Saved to your list" | `saveDoneBanner`, Undo on listing, stay, restaurant and device saves |
| Listing page heart (`ListingActions`) | banner, no Undo | `saveDoneBanner` with Undo, all three shelves |
| Map card heart (`MapCanvas`) | banner, no Undo | `saveDoneBanner` with Undo |
| Post save (feed, thread) | banner with Undo | unchanged |
| Story save (`StoryViewer`) | banner, no Undo | `saveDoneBanner` with Undo, destination in the words |
| Saved collections: add or take off | banner, no Undo | `saveDoneBanner` with Undo, "It is in Saved" |
| Saved search (price check) | banner with destination ("It is in your saved searches") | unchanged |
| Offline outbox saves | "kept for later" info banner | unchanged (the replay says its outcome) |
| Roommate save | owned by the Roommates agent | not touched |

Not covered: Saved board remove (it already has its own Undo strip), the compare tray (not a save).
