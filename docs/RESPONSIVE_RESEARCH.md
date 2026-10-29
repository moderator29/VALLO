# Responsive and desktop research: what the best marketplaces and apps do, and where Vallo stands

Written 29 October 2026. Method: web search plus a read of `docs/DESIGN_DIRECTION.md` section 5 and the code. The search tool returned thin results for some products, so each row says which part is sourced and which is the general practice the team already knows. Nothing here was measured on the live Airbnb, Booking.com, Linear, Stripe or Apple products from this sandbox.

Sources actually read in search results:
- web.dev, "The large, small, and dynamic viewport units" (https://web.dev/blog/viewport-units)
- web.dev Learn Design, "Interaction" (https://web.dev/learn/design/interaction)
- W3C, "What's New in WCAG 2.2" (https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- Apple developer tips (https://developer.apple.com/design/tips): controls at least 44 by 44 points
- Linear guide, "Navigating Linear" (https://linear.app/enablement/guide/navigating-linear)
- Airbnb engineering paper on ranking for maps (https://arxiv.org/abs/2407.00091)

Vallo's own reference, section 5 of `docs/DESIGN_DIRECTION.md`: phone under 640, tablet to 1023, laptop to 1439 with a sticky left rail, desktop from 1440 with a centred, capped column.

## 1. Navigation

- Practice: Linear reaches almost everything from one sidebar (personal on top, shared below, favourites pinned) and a Cmd+K menu that jumps to any page or action. Airbnb and Booking.com keep a thin top bar with search and account, and no sidebar. Apple's iPad guidance is a sidebar that collapses on narrow windows.
- Vallo has: the floating dock and drawer under 1024, the sticky rail and top account bar from 1024 (`app/side-nav.css`), a keyboard layer for fine pointers (`components/app/MemberKeys.tsx`: "/", "g" then h, s, m, p, "?").
- Missing: a Cmd+K palette (no `CommandPalette` exists); the rail is not user-pinnable.
- Recommend: one palette that searches listings, threads and settings, reusing the `MemberKeys` listener. Do not add a second navigation (section 5 rule).

## 2. Content width and grid

- Practice: marketplaces cap reading and card areas and centre them; results grids go 2, 3, 4 across by container width, not by device. Airbnb shows list and map as two views of one ranking.
- Vallo has: `--nf-content-max` (90rem, 1440px) on `.nf-shell`, three across cards on laptop, grids replacing swipe decks from 640.
- Missing: a documented cap for text-only pages (settings, legal, forms) narrower than the card cap. Wide forms at 1440 read as stretched.
- Recommend: a `--nf-form-max` around 40rem for single-column forms and settings, centred inside the content column.

## 3. Master and detail

- Practice: Apple's iPad pattern is two columns (sidebar plus detail) and three for deep trees; Stripe and Linear keep the list visible while a row opens beside it.
- Vallo has: messages master-detail (`nf-msg-split`). Host reservations, agent enquiries and admin desks open full pages.
- Missing: the same split for host and agent lists on laptop and up.
- Recommend: reuse the messages split as a layout primitive for reservations and enquiries from 1024; keep full pages on phone.

## 4. Dialogs versus sheets

- Practice: a bottom sheet for touch, a centred dialog for a mouse, same content and same focus rules.
- Vallo has: from 64rem with a mouse a sheet becomes a centred dialog (`components/ui/Sheet.tsx`), focus trap and return, Escape, scroll lock.
- Missing: nothing structural. Check that long sheets scroll inside the dialog at 900px height (they use dvh in 69 files).
- Recommend: keep. Add a sweep step that opens one long sheet at 1440 by 700.

## 5. Hover

- Practice: web.dev notes `hover` is binary and `pointer` is fine or coarse, a device can report both, hover must never be the only way to reveal something, and pair every `:hover` with a keyboard state.
- Vallo has: 42 files gate hover on `(hover: hover)`.
- Missing: a rule in the gallery that every hover style has a `:focus-visible` twin; nothing checks it.
- Recommend: a lint or test over `app/css` that flags a `:hover` selector in a control class with no `:focus-visible` sibling.

## 6. Focus-visible and keyboard

- Practice: `:focus-visible`, never `outline: none` without a replacement. WCAG 2.2 adds focus appearance (about 2px, 3:1 against neighbours) and 2.5.8 target size minimum 24 by 24 CSS px.
- Vallo has: `:focus-visible` in 86 files, member keyboard shortcuts, `forced-colors` in 2 files, `prefers-contrast` in 3.
- Missing: a measured check of the 3:1 focus ring in light, where the brand blue ring sits on pale surfaces.
- Recommend: add the ring colour to the light contrast pass in the sweep.

## 7. Pointer versus touch sizing

- Practice: Apple asks 44 by 44 points for fingers; WCAG 2.2 AA asks 24 by 24 CSS px; mouse UIs (Linear, Stripe) run denser rows (32 to 36px) where the pointer is fine.
- Vallo has: R-B in the design direction, a 44px floor everywhere (`min-height: 2.75rem` in 43 files) and `(pointer: coarse)` rules in `touch.css`.
- Missing: no denser desktop mode; a 44px floor on a mouse makes tables and rails look loose.
- Recommend: keep 44 on touch; allow 36px list rows only under `(pointer: fine)` and only inside admin and host desks.

## 8. Container queries

- Practice: size a component by the space it has, not the window, so one card works in a rail, a grid and a split.
- Vallo has: `@container` in 7 files.
- Missing: listing cards and state kits still depend on window breakpoints in places.
- Recommend: make `ListingCard` and the stat tiles container-aware first, because the master-detail split in section 3 will squeeze them.

## 9. Viewport units: dvh and svh

- Practice (web.dev): `dvh` follows the browser toolbars, `svh` is the safe small size, `lvh` the large; `100vh` hides content under mobile toolbars. Support: Chrome 108, Safari 15.4, Firefox 101.
- Vallo has: `dvh` in 69 files, `svh` in 10, `env(safe-area...)` in 51.
- Missing: nothing found. Risk is a full height element using `dvh` that jumps while the toolbar animates.
- Recommend: use `svh` for min heights of hero blocks and `dvh` only for sheets and the keyboard-aware composer.

## 10. iPad and split view

- Practice: an app must work at a third and two thirds of an iPad window, and rotate without losing state.
- Vallo has: the tablet band (640 to 1023) keeps the phone shell with grids, checked at 820 and 1180.
- Missing: a check at 320 to 438 wide on an iPad slide-over, and at 507 and 678 (split view widths) where the phone shell meets two-up grids.
- Recommend: add 507 and 678 to `responsive/sweep.mjs`.

## Priority

1. Light-theme focus ring contrast (section 6).
2. Hover and focus twin check (section 5).
3. Form width cap (section 2).
4. Split view for host and agent lists (section 3).
5. Command palette (section 1).
