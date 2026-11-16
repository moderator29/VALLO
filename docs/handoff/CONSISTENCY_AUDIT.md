# THE CONSISTENCY AUDIT, WITH NUMBERS (14 November 2026)

Phase 3 of the next-generation upgrade (handoff section 7, queue item M5).
Measurement first, fixes second. Nothing here is an impression: every value in
the tables below was read off a rendered page in a real Chromium against a
production build, and every verdict compares that value to a rule that was
already written down before this audit ran.

## 1. How it was measured

`apps/web/scripts/consistency-sweep.mjs` walks each route at each width in
each theme and reads, from the rendered DOM:

| Column | What it is | Read from |
|---|---|---|
| Header | whether a page header is drawn, and which parts it has | `.nf-ph-large` for the shared frame, else the first visible `h1` and the block holding it, so a hand-rolled top is measured rather than reported absent |
| Back | the count of `[data-nav-back]`, and the first one's x, y, width and height | `getBoundingClientRect` |
| Primary y | where the first `.nf-btn--primary` sits down the page | `getBoundingClientRect` |
| Gap | CSS px between the bottom of the header and the top of the first thing drawn below it | `getBoundingClientRect` |
| Card r | the first card surface's top-left radius, with every distinct corner on the page recorded beside it so a page is not judged by whichever card comes first in its markup | `getComputedStyle` |
| L/E | whether the route declares a `loading.tsx` and an `error.tsx` | the file tree, not a render: a state a page reaches only with particular data cannot be proved by one load |
| Overflow | `document.documentElement.scrollWidth - clientWidth` | the rule is 0 |
| Under 44 | interactive elements whose TARGET is under 44 by 44. The target is the painted box, or a hit area that overflows it: a child, a pseudo-element (`.nf-tap::after`, `.nf-btn--sm::before`), or the label that names the control. A link inside a line of type is counted separately, the exemption WCAG 2.5.8 writes down. Section 4.2 says why each of those had to be added | `getBoundingClientRect` and `getComputedStyle(el, "::before")` |

The theme is set with the `nf_theme` cookie, which the server reads, so the
two passes really render in two themes. The cookie bar is answered once per
context, as a person would, so the page under it is what gets measured.

**The narrow pass runs on a touch screen and the wide pass with a mouse.**
The 44px rule is a touch rule and this product keeps it with media queries
that ask about the pointer rather than the width, so a 390px viewport with a
mouse takes the wrong branch of it. Section 4.2 has the arithmetic this cost.

**The page is read once its entrance has finished**, bounded, because a
control inside a block that is still being scaled measures smaller than it
is.

**A route that redirects to a sign-in door is not measured.** The run
records the final address and marks the row `needs-session` rather than
measuring the door and calling it the page. A route that redirects
ELSEWHERE is measured at the address it actually rendered, and the table
names that address beside it.

`apps/web/scripts/consistency-report.mjs` turns that JSON into the tables
below and applies the rules.

## 2. The rules each column is judged against

| Rule | Value | Where it is written |
|---|---|---|
| A back control is 44 by 44 CSS px, its real painted size | 44 x 44 | `docs/BACK_NAVIGATION.md`, "The control" |
| It sits at the top left of the page header, bar or cover | inside the header's box | same |
| There is one per screen | count 1, or 0 on a root | same |
| A card's corner is the card tier, or the nested tier for a card inside a card at night | 18px (`--nf-radius-card`), 14px (`--nf-radius-card-sm`) nested in dark | `packages/design-tokens/src/tokens.css`, `app/css/brand-glass.css`; see section 7 item 3 |
| No page scrolls sideways | `scrollWidth` equals `clientWidth` | `docs/RESPONSIVE_RESEARCH.md` section 2 |
| A control is at least 44 by 44 on touch, as a TARGET rather than as paint | 44 x 44 | `docs/RESPONSIVE_RESEARCH.md` section 7, Apple's 44pt; the inline exemption is WCAG 2.5.8 |
| The gap under a large title is the system's | the value the majority of framed pages draw, computed per width from this run rather than asserted | `.nf-g1page` in `app/css/grade1.css` |

Two deliberate exceptions, which the audit must NOT report as outliers:

1. **No back control on a phone inside the member shell.** Since 14 November
   the phone header's back is decided by the server-rendered shell rather
   than by a script after hydration (`app/css/chrome.css`, the lead's
   change). A member route at 390 showing no `[data-nav-back]` is correct.
2. **A root shows no back control at all**, at any width: `/home`, `/stays`,
   `/`, `/welcome` and the other roots listed in `docs/BACK_NAVIGATION.md`.

## 3. The back and close controls (the founder, 14 November 2026)

He asked for this twice, with App Store screenshots: "you see our go back icon
in our platform rn it's like arrow instead of this greater sign <, bro this
should be wide platform ... clean on dark mode and light mode and you see the
positioning of it. Same as the x one too ... every single page every single
tab or area", and "this go back button are too close to the end of the page
like no space maybe it's arrow icon so you know look into that too".

### 3.1 The glyph

`BackControl` drew `arrow-left`. It draws `chevron-left` now: a new glyph in
`design-system/icons/UiIcon.tsx`, the exact mirror of the `chevron-right` the
product already uses (`m15 18-6-6 6-6` against `m9 18 6-6-6-6`), same family,
same stroke, so the pair is one shape pointing two ways.

`arrow-left` is NOT retired, and that is deliberate: an arrow is right where
something moves THROUGH content. Four more controls were genuinely navigation
and became chevrons; the rest were checked one by one and left alone.

| File | What it is | Changed |
|---|---|---|
| `components/ui/BackControl.tsx` | every back on the platform | yes |
| `components/ui/StepFrame.tsx` | a wizard's step back, in its own bar | yes |
| `components/docs/DocShell.tsx` | the document shell's way up | yes |
| `components/app/assistant/PersonHandoff.tsx` | back to the assistant | yes |
| `components/auth/ForgotPasswordForm.tsx` | back to sign in | yes |
| `ListingGallery`, `PhotoViewer`, `MediaViewer`, `SwipeStack`, `FeaturedStack`, `SpaceCard`, `SlidePagination`, `ListingCard` | the previous photo or card | no, it moves content |
| `VisitCalendar`, `RateCalendar`, `VisitPlanner`, `StatementView` | the previous month | no, it moves content |
| `PhotosStep`, `PostFlow`, `ProfileFlow` | move a photo earlier in a grid | no, it moves content |
| `ListingsWorkspace` | undo a deletion | no, it is an undo |
| `docs/[slug]` | the previous document in a series | no, it moves content |
| `CodeSignInForm`, `ResetCodeForm` | back to sign in | not changed: the keyboard pass holds the auth code fields this round |

### 3.2 The position, measured

His two rulings are both true and they are about different boxes. On 13
November the control was "too big and too far from the edge" and was pulled
outward by half its slack (`margin-inline-start: -0.75rem`). That put the
44px BOX 4px from the screen at a 16px gutter, which is what now reads as no
space. Meanwhile the GLYPH sat further in than the title under it, so nothing
lined up either.

So the resting place is decided by the glyph's INK against the page's text,
and the box follows. A chevron is drawn from x=9 to x=15 in a 24 unit square,
so at a 20px glyph its ink begins 7.5px inside its own box. Pulling the
control out by exactly that much puts the ink on the gutter.

Measured in Chromium on `/help`, `/guides`, `/about`, `/contact`, `/terms`
and `/docs`, both themes:

| | Box from the screen edge | Glyph ink | The page's text | Aligned |
|---|---|---|---|---|
| Before, 390 | 16.0px | 35.5px | 16.0px | no, ink 19.5px inside the text |
| After, 390 | 8.5px | **16.0px** | 16.0px | yes, exactly |
| Before, 1440 | 128.0px | 147.5px | gutter 32px | no |
| After, 1440 | 120.5px | **128.0px** | gutter 32px | yes, exactly |

The 44px target is untouched and now keeps 8.5px of air at the screen edge
instead of 4. Nothing in the rule is a magic number: change the glyph size or
the gutter and both follow.

Two mechanisms had to change for this to be true everywhere, and measuring
found both:

1. The edge rule lived on `.nf-back-plain`, which only the member shell's
   `round` surface wears. `/help`, `/guides` and `/docs` draw the `bare`
   surface, so their chevron sat at 35.5px while their text sat at 16. The
   arithmetic is now its own class, `.nf-nav-edge`, worn by every surface
   that sits on the page's own gutter. A bar that replaces a bare control's
   PAINT keeps its geometry, or the auth slate drifts away from the rest.
2. `place-items-center` is a Tailwind utility and beat the component layer,
   so the rule moved the box and left the glyph centred inside it (measured:
   ink at 28px when it should have been 16). The glyph is packed to the start
   on every edge surface; a plated surface still centres its glyph, because
   over a photograph the PLATE is the visible edge and it is the plate that
   lines up with the gutter.

### 3.3 The close control

One rule, written down: **a standalone dismiss is the `close` glyph at 20px
in a 44px box**. A smaller X is allowed only where it removes an ITEM rather
than closing a surface, because a 44px circle on a 72px thumbnail swallows
it.

| Control | File | Box | Glyph | Before |
|---|---|---|---|---|
| The sheet's close | `components/ui/Sheet.tsx` | 44 round | 20 | already correct, it is the reference |
| A wizard's close | `components/ui/StepFrame.tsx` | 44 round | 20 | already correct |
| The photo viewer | `components/app/listing/PhotoViewer.tsx` | 44 on media | 20 | already correct |
| The media viewer | `components/app/messages/MediaViewer.tsx` | 44 | 20 | already correct |
| The story composer | `components/social/story/StoryComposer.tsx` | 44 | 20 | glyph was 22 |
| The dismissible promo | `components/social/feed/DismissiblePromo.tsx` | 44 round | 20 | glyph was 18 |
| The inner nav's toggle | `components/ui/InnerNav.tsx` | 44 | 20 | glyph was 24 |
| The site's mobile menu | `components/site/MobileMenu.tsx` | 44 | 20 | **box was 36 and glyph 16** |

Nineteen other X's were checked and left small on purpose: they clear a
field, drop a chip, take a photo out of a grid or mark a status. Each one is
listed with its reason in `components/ui/nav-controls.test.ts`, so the list
can be argued with rather than guessed at.

### 3.4 The re-audit, as he asked

A table is read once. `components/ui/nav-controls.test.ts` is read on every
run and fails on a new control that does not match:

- `BackControl` draws the chevron and no arrow.
- No `arrow-left` anywhere inside a control whose accessible name says it
  goes back (the window around each arrow is read, so a carousel's "previous
  photo" passes and a mislabelled back does not).
- Every standalone `close` glyph is 20, with the nineteen item-removals
  listed by name and reason.
- The list of nineteen must stay honest: a file that stops drawing an X has
  to leave it.

Proven to bite: putting the story composer's X back to 18 fails the suite
with `components/social/story/StoryComposer.tsx: close at 18`.

## 4. The general consistency audit

The sweep ran in full on 16 November 2026: 161 routes, two widths (390 and
1440), two themes, **644 page loads measured, 0 failed**, against a
production build (`NEXT_DIST_DIR=.next-cons npx next build`, served on port
3301, two browsers at a time). The narrow pass runs with a touch screen and
the wide pass with a mouse, for the reason in 4.2.

### 4.1 What this sweep CANNOT see, said plainly

**There are no database credentials in the sandbox this ran in.** Every route
that needs a signed-in viewer rendered its signed-out or its not-found face.
Four loads (`/sign-up/finish`, both widths, both themes) were sent to
`/sign-in` and are recorded as `needs-session` rather than measured.
Nineteen more routes sent the browser somewhere else and were measured at
the address they actually rendered, which the table names beside the route:
`/pro` and `/offline` land on `/home`, `/circle/ask` and
`/settings/ai-assistant` on `/welcome`, `/messages/new` on `/messages`, and
so on. `/leaderboard` drew its "opens soon" state because the board it reads
is behind a pending migration.

For what this audit is about that is still a real measurement: the header,
the back control, the gap under the title, the card corner, sideways scroll
and the painted size of every control are chrome, and the chrome is what the
sweep reads. **It is not the signed-in page.** No row below is a statement
about what a route shows a member, and nothing in this document describes a
route's content, because the content was not seen. A member's card grid, a
wallet's rows, a desk's table and every list with real data in it are
unmeasured, and a fault that only appears once there is data would not be in
this table.

Two more limits worth stating rather than leaving to be discovered:

- **The gap rule is judged on 170 of 640 rows.** Those are the rows drawing
  the shared frame header (`.nf-ph-large`). On the other 442 the sweep found
  a visible `h1` and took the block holding it, which is whatever element
  the page happens to wrap its title in, so that number is recorded but is
  not comparable between pages and is not judged. 26 rows draw no header at
  all. The 24px system gap is the mode of the 170, not of the platform.
- **Loading and error states are read from the file tree, not from a
  render**, because a state a page reaches only with particular data cannot
  be proved by one load. On that reading 496 of 640 rows belong to a route
  that declares a `loading.tsx` and **only 4 declare an `error.tsx`**. That
  is a gap in the product, not in the measurement, and it is not a
  consistency outlier, so nothing was changed for it here.

### 4.2 Six things the sweep itself had wrong, and what each one cost

This section exists because the first complete run reported 509 of 640 rows
as failing the touch rule, and every one of those 509 was the measurement
being wrong rather than the page. A consistency audit that reports the whole
platform as broken is worth nothing, so each fault was found, named and
corrected before any page was touched. The corrections are in
`apps/web/scripts/consistency-sweep.mjs` with the reasoning beside them.

| What the sweep could not see | How it showed up | What it cost |
|---|---|---|
| **A hit area drawn as a pseudo-element.** `.nf-tap::after` is `max(100%, 44px)` in both axes (`app/css/base.css`) and `.nf-btn--sm::before` is at least 44px tall (`app/css/buttons.css`), which is how the button ladder can paint the compact rung at 40px (the founder, 7 November 2026: "fix our button size, they are too wide, they are too big") and still hand a thumb 44. A pseudo-element is not a child node, so reading the element and its children misses it. | 509 of 640 rows reported at least one control under 44. The compact primary button was named among the worst three on 356 rows, the glass button on 309, a `.nf-tap` settings row on 167. | Reading `getComputedStyle(el, "::before")`, which Chromium resolves to used pixels. 509 rows to 146. |
| **The pointer.** The 44px rule is a TOUCH rule (`docs/RESPONSIVE_RESEARCH.md` section 7), and this product keeps it with media queries that ask about the pointer, not the width: `.nf-site-footer-link` is `min-height: 2.75rem` and drops to 2.25rem only inside `@media (hover: hover) and (pointer: fine)` ("a mouse does not need the finger's 44px row", `app/css/site.css`). A headless Chromium at a 390px viewport still reports a fine pointer, so the sweep took the mouse branch of a touch rule. | The footer's links were named on 297 rows at 36px tall. Measured with `hasTouch`, they are 44 x 44. | A touch screen on the narrow pass. The footer finding vanished. |
| **The entrance animation.** The document pages run a reveal on arrival and the sweep read the page 400ms in, mid-flight. | Controls on `/privacy`, `/legal/privacy`, `/delete-account` and `/cancellations` measured 42.2px where they are 44, and two header gaps (`/saved` at 54.9, `/leaderboard` at 36) were the same thing. | Waiting, bounded, for every finite animation to finish. All of those readings were the animation, not the page. |
| **Only the first card on a page.** The card column read one surface, and which surface comes first depends on the width. | `/stays/search` failed at 390 and passed at 1440 for no reason that had anything to do with the page. | Every distinct card corner is collected with the class that draws it. |
| **A checkbox's label.** A tap on a label activates the control it names, and this product says so above the markup: "`nf-tap` makes each row a 44px target without moving it: the 20px box alone was too small to hit reliably, and the label is the control" (`components/auth/AcceptTerms.tsx`). | The three boxes on `/sign-up/email` were reported on every touch load, each already inside a 44px row. | The associated label's target, its own pseudo area included, counts as the control's. |
| **WCAG 2.5.8's inline exemption**, which exempts a target "in a sentence or whose size is otherwise constrained by the line-height of non-target text". | Hundreds of prose links, 15 to 25px tall because that is what a line of type is, were counted as undersized controls. Growing one puts an invisible 44px target over the words above and below it and steals their taps. | Both clauses are tested, measurably: words on the same line that are not the target, or a box laid out in the line with no padding and no floor whose every line box is no taller than its parent's line-height. **549 links on the touch pass are exempt on that test**, counted separately (`inlineSmallCount`) rather than thrown away, so the number stays arguable. |

The lesson is the one the stylesheets keep stating about themselves: this
platform grows a target without moving a pixel, deliberately, in at least
three separate mechanisms, and any check that reads only the painted box
will call every one of them a fault.

### 4.3 The headline numbers

| | |
|---|---|
| Page loads measured | **644 of 644**, 0 failed |
| Rows judged (not `needs-session`) | **640** (320 on a touch screen, 320 with a mouse) |
| Rows matching every rule | **637 of 640**. The three that do not are the one gap artefact in section 7 item 8 and `/styleguide` at both widths in dark, whose nested card is the documented night tier in section 7 item 3. Both are left flagged in the table rather than exempted, because the first is a limit of the sweep and the second is a question for the founder |
| Pages that scroll sideways | **0**, at either width, in either theme |
| Back controls off their 44 x 44, or more than one on a screen | **0** of the 521 rows that draw one |
| Controls whose target is under 44 x 44 on the touch pass | **0**, after the one fix in section 6 |
| The system's gap under a large title | **24px** at both widths, the mode of 170 framed rows (`--nf-space-lg`); 142 rows draw exactly 24 and 27 draw 20, which is inside the 8px tolerance |
| Framed pages differing from that gap by more than 8px | **1**, and it is an artefact: see section 7 item 8 |
| Card corners measured | 18px on 282, 0 on 8 (a square full-bleed surface), 14px on 6 |
| Card corners off the card tier with no written reason | **0**. All six 14px corners are the two documented tiers in section 7 items 3 and 4 |

## 5. The table

The back and close numbers are in section 3. Everything below is one row
per route per width, generated by
`node scripts/consistency-report.mjs <json> --md`. The two themes are
folded together: a value that differs between them is called out in the
last column rather than doubling every row.

Reading the columns: **Header** is `frame` for the shared page frame or
`own` for a page that draws its own top, with `+sub` and `+act` for a
subtitle and actions. **Back** is the first `[data-nav-back]`'s x, y,
width and height. **Primary y** is how far down the first
`.nf-btn--primary` sits. **Gap** is the distance from the header's bottom
to the first thing drawn under it. **Card r** is the first card surface's
corner. **L/E** is whether the route declares a `loading.tsx` and an
`error.tsx`, read from the file tree rather than from a render. **Under
44** counts controls whose target is under 44 by 44, judged only on the
390 pass, which has a touch screen (section 4.2). A route that sent the
browser elsewhere names where it actually rendered.

**No row here is a signed-in page.** See section 4.1.

| Route | W | Header | Back (x,y,w,h) | Primary y | Gap | Card r | L/E | Overflow | Under 44 | Matches the rule |
|---|---|---|---|---|---|---|---|---|---|---|
| `/about` | 390 | own | 16,84,44,44 | 3998.6 | 32 | 18 | -- | 0 | 0 | yes |
| `/about` | 1440 | own | 128,84,44,44 | 21 | 160 | 18 | -- | 0 | 27 | yes |
| `/agent/analytics` | 390 | own | 16,8,44,44 | none | 367 | - | L- | 0 | 0 | yes |
| `/agent/analytics` | 1440 | own | 280,8,44,44 | none | - | 18 | L- | 0 | 0 | yes |
| `/agent/assistant` | 390 | own | 16,8,44,44 | 751.8 | 13.9 | - | L- | 0 | 0 | yes |
| `/agent/assistant` | 1440 | own | 280,8,44,44 | 770.4 | 23.9 | 18 | L- | 0 | 0 | yes |
| `/agent/bookings` | 390 | own | 16,8,44,44 | none | 367 | - | L- | 0 | 0 | yes |
| `/agent/bookings` | 1440 | own | 280,8,44,44 | none | - | 18 | L- | 0 | 0 | yes |
| `/agent/dashboard` | 390 | own | 16,8,44,44 | 441.3 | - | 18 | L- | 0 | 0 | yes |
| `/agent/dashboard` | 1440 | own | 280,8,44,44 | 435.3 | - | 18 | L- | 0 | 0 | yes |
| `/agent/earnings` | 390 | own | 16,8,44,44 | none | 355 | - | L- | 0 | 0 | yes |
| `/agent/earnings` | 1440 | own | 280,8,44,44 | none | - | 18 | L- | 0 | 0 | yes |
| `/agent/firm` | 390 | frame | 16,136,44,44 | none | 24 | - | L- | 0 | 0 | yes |
| `/agent/firm` | 1440 | frame | 296,96,44,44 | none | 24 | 18 | L- | 0 | 0 | yes |
| `/agent/inspections` | 390 | none | 16,8,44,44 | 521.7 | - | - | L- | 0 | 0 | yes |
| `/agent/inspections` | 1440 | none | 280,8,44,44 | 450.7 | - | 18 | L- | 0 | 0 | yes |
| `/agent/list` | 390 | own | 16,8,44,44 | 844 | 68.5 | - | L- | 0 | 0 | yes |
| `/agent/list` | 1440 | own | 280,8,44,44 | 844 | 147.5 | 18 | L- | 0 | 0 | yes |
| `/agent/listings` | 390 | own | 16,8,44,44 | 336.5 | 393.5 | - | L- | 0 | 0 | yes |
| `/agent/listings` | 1440 | own | 280,8,44,44 | 274.5 | - | 18 | L- | 0 | 0 | yes |
| `/agent/messages` | 390 | frame | 16,136,44,44 | 538.5 | 24 | - | L- | 0 | 0 | yes |
| `/agent/messages` | 1440 | frame | 296,96,44,44 | 501.1 | 24 | 18 | L- | 0 | 0 | yes |
| `/agent/notifications`<br>to `/notifications` | 390 | none | none | 10 | - | 18 | L- | 0 | 0 | yes |
| `/agent/notifications`<br>to `/notifications` | 1440 | frame | 516,128,44,44 | 16 | 20 | 18 | L- | 0 | 0 | yes |
| `/agent/portfolio` | 390 | own | 16,8,44,44 | 825.8 | - | 18 | L- | 0 | 0 | yes |
| `/agent/portfolio` | 1440 | own | 280,8,44,44 | 686.4 | - | 18 | L- | 0 | 0 | yes |
| `/agent/promotion` | 390 | none | 16,8,44,44 | none | - | - | -- | 0 | 0 | yes |
| `/agent/promotion` | 1440 | none | 280,8,44,44 | none | - | 18 | -- | 0 | 0 | yes |
| `/agent/reviews` | 390 | frame | 16,136,44,44 | 538.5 | 24 | - | L- | 0 | 0 | yes |
| `/agent/reviews` | 1440 | frame | 296,96,44,44 | 501.1 | 24 | 18 | L- | 0 | 0 | yes |
| `/agent/settings` | 390 | own | 16,8,44,44 | none | 385 | - | L- | 0 | 0 | yes |
| `/agent/settings` | 1440 | own | 280,8,44,44 | none | - | 18 | L- | 0 | 0 | yes |
| `/agent/verification` | 390 | own | 16,8,44,44 | none | 435 | - | L- | 0 | 0 | yes |
| `/agent/verification` | 1440 | own | 280,8,44,44 | none | - | 18 | L- | 0 | 0 | yes |
| `/agreements` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/agreements` | 1440 | frame | 468,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/ai/permissions` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/ai/permissions` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/ai/privacy` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/ai/privacy` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/ai/security` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/ai/security` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/ai/terms` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/ai/terms` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/around` | 390 | own | none | 10 | 2 | - | L- | 0 | 0 | yes |
| `/around` | 1440 | own | none | 16 | 2 | 18 | L- | 0 | 0 | yes |
| `/around/manage`<br>to `/around/settings` | 390 | own | 16,8,44,44 | 10 | 44 | 18 | -- | 0 | 0 | yes |
| `/around/manage`<br>to `/around/settings` | 1440 | own | 468,136,44,44 | 16 | 28 | 18 | -- | 0 | 0 | yes |
| `/around/new` | 390 | own | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/around/new` | 1440 | own | 516,136,44,44 | 16 | 28 | 18 | L- | 0 | 0 | yes |
| `/around/people` | 390 | own | 16,8,44,44 | 10 | 48 | - | L- | 0 | 0 | yes |
| `/around/people` | 1440 | own | 404,136,44,44 | 16 | 52 | 18 | L- | 0 | 0 | yes |
| `/around/settings` | 390 | own | 16,8,44,44 | 10 | 44 | 18 | L- | 0 | 0 | yes |
| `/around/settings` | 1440 | own | 468,136,44,44 | 16 | 28 | 18 | L- | 0 | 0 | yes |
| `/assistant` | 390 | own | 16,13,44,44 | 751.8 | 0 | - | L- | 0 | 0 | yes |
| `/assistant` | 1440 | own | 296,13,44,44 | 770.4 | 0 | 18 | L- | 0 | 0 | yes |
| `/assistant/person` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/assistant/person` | 1440 | own | 516,120,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/auth/callback` | 390 | own | none | 537 | 242 | - | -- | 0 | 0 | yes |
| `/auth/callback` | 1440 | own | none | 560.4 | 210.6 | - | -- | 0 | 0 | yes |
| `/bookings` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/bookings` | 1440 | frame+sub | 516,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/calls/reviews` | 390 | own | 16,8,44,44 | 10 | 40 | - | L- | 0 | 0 | yes |
| `/calls/reviews` | 1440 | own | 548,120,44,44 | 16 | 44 | 18 | L- | 0 | 0 | yes |
| `/cancellations` | 390 | own | 16,84,44,44 | 5836 | 32 | 0 | -- | 0 | 0 | yes |
| `/cancellations` | 1440 | own | 128,84,44,44 | 21 | 96 | 0 | -- | 0 | 27 | yes |
| `/careers` | 390 | own | 16,84,44,44 | 2402.7 | 32 | 18 | -- | 0 | 0 | yes |
| `/careers` | 1440 | own | 128,84,44,44 | 21 | 160 | 18 | -- | 0 | 27 | yes |
| `/check` | 390 | own | 16,84,44,44 | 453.9 | 16 | - | -- | 0 | 0 | yes |
| `/check` | 1440 | own | 128,84,44,44 | 21 | 16 | - | -- | 0 | 27 | yes |
| `/checkout`<br>to `/stays` | 390 | own | none | 10 | 16 | 18 | L- | 0 | 0 | yes |
| `/checkout`<br>to `/stays` | 1440 | none | none | 16 | - | 18 | L- | 0 | 27 | yes |
| `/circle` | 390 | frame+sub+act | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/circle` | 1440 | frame+sub+act | 296,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/circle/ask`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/circle/ask`<br>to `/welcome` | 1440 | own | none | 535.1 | 24 | - | L- | 0 | 0 | yes |
| `/circle/new`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/circle/new`<br>to `/welcome` | 1440 | own | none | 535.1 | 24 | - | L- | 0 | 0 | yes |
| `/compare` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/compare` | 1440 | frame | 468,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/contact` | 390 | own | 16,84,44,44 | 2038.5 | 32 | 18 | -- | 0 | 0 | yes |
| `/contact` | 1440 | own | 128,84,44,44 | 21 | 160 | 18 | -- | 0 | 27 | yes |
| `/delete-account` | 390 | own | 16,84,44,44 | 1207.7 | 32 | - | -- | 0 | 0 | yes |
| `/delete-account` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/directory` | 390 | frame+sub | 16,8,44,44 | 10 | 20 | - | L- | 0 | 0 | yes |
| `/directory` | 1440 | frame+sub | 484,128,44,44 | 16 | 20 | 18 | L- | 0 | 0 | yes |
| `/disclaimer` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/disclaimer` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/docs` | 390 | own | 16,84,44,44 | 409.6 | 32 | - | -- | 0 | 0 | yes |
| `/docs` | 1440 | own | 128,84,44,44 | 21 | 32 | - | -- | 0 | 27 | yes |
| `/email/preferences` | 390 | own | none | 301.7 | 453.5 | - | L- | 0 | 0 | yes |
| `/email/preferences` | 1440 | own | none | 322.8 | 424.4 | - | L- | 0 | 0 | yes |
| `/eula` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/eula` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/for-agents` | 390 | own | 16,84,44,44 | 494 | 32 | 18 | -- | 0 | 0 | yes |
| `/for-agents` | 1440 | own | 128,84,44,44 | 21 | 64 | 18 | -- | 0 | 27 | yes |
| `/for-hosts` | 390 | own | 16,84,44,44 | 430.9 | 32 | 18 | -- | 0 | 0 | yes |
| `/for-hosts` | 1440 | own | 128,84,44,44 | 21 | 64 | 18 | -- | 0 | 27 | yes |
| `/for-landlords` | 390 | own | 16,84,44,44 | 467.6 | 32 | 18 | -- | 0 | 0 | yes |
| `/for-landlords` | 1440 | own | 128,84,44,44 | 21 | 64 | 18 | -- | 0 | 27 | yes |
| `/forgot-password` | 390 | own | 16,8,44,44 | 528.6 | 211.4 | - | L- | 0 | 0 | yes |
| `/forgot-password` | 1440 | own | 512,8,44,44 | 584.6 | 155.4 | - | L- | 0 | 0 | yes |
| `/forgot-password/code` | 390 | own | 16,8,44,44 | 670.3 | 69.7 | - | L- | 0 | 0 | yes |
| `/forgot-password/code` | 1440 | own | 512,8,44,44 | 704.5 | 35.5 | - | L- | 0 | 0 | yes |
| `/guides` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/guides` | 1440 | own | 128,84,44,44 | 21 | 32 | - | -- | 0 | 27 | yes |
| `/help` | 390 | own | 16,84,44,44 | none | 32 | 18 | -- | 0 | 0 | yes |
| `/help` | 1440 | own | 128,84,44,44 | 21 | 32 | 18 | -- | 0 | 27 | yes |
| `/home` | 390 | own | none | 10 | 16 | - | L- | 0 | 0 | yes |
| `/home` | 1440 | own | none | 16 | 16 | 18 | L- | 0 | 0 | yes |
| `/host` | 390 | own | 16,8,44,44 | 463.3 | 252 | - | LE | 0 | 0 | yes |
| `/host` | 1440 | own | 280,8,44,44 | 438.7 | - | - | LE | 0 | 0 | yes |
| `/host-agreement` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/host-agreement` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/host/apply` | 390 | own | 16,8,44,44 | 437.7 | 277.5 | - | L- | 0 | 0 | yes |
| `/host/apply` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/arrival` | 390 | own | 16,8,44,44 | 514.4 | 200.8 | - | L- | 0 | 0 | yes |
| `/host/arrival` | 1440 | own | 280,8,44,44 | 464.3 | - | - | L- | 0 | 0 | yes |
| `/host/assistant` | 390 | own | 16,8,44,44 | 751.8 | 13.9 | - | L- | 0 | 0 | yes |
| `/host/assistant` | 1440 | own | 280,8,44,44 | 770.4 | 23.9 | 18 | L- | 0 | 0 | yes |
| `/host/bookings` | 390 | own | 16,8,44,44 | 437.7 | 277.5 | - | L- | 0 | 0 | yes |
| `/host/bookings` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/calendar` | 390 | own | 16,8,44,44 | 412.1 | 303.1 | - | L- | 0 | 0 | yes |
| `/host/calendar` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/decide` | 390 | own | 16,8,44,44 | 437.7 | 277.5 | - | L- | 0 | 0 | yes |
| `/host/decide` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/earnings` | 390 | frame | 16,180,44,44 | 775.2 | 24 | - | L- | 0 | 0 | yes |
| `/host/earnings` | 1440 | frame | 564,84,44,44 | 681 | 24 | - | L- | 0 | 0 | yes |
| `/host/earnings/statement` | 390 | frame+sub | 16,8,44,44 | none | 20 | - | L- | 0 | 0 | yes |
| `/host/earnings/statement` | 1440 | frame+sub | 280,8,44,44 | none | 20 | - | L- | 0 | 0 | yes |
| `/host/notifications` | 390 | frame | 16,136,44,44 | 534.5 | 20 | - | L- | 0 | 0 | yes |
| `/host/notifications` | 1440 | frame | 564,84,44,44 | 485.1 | 20 | - | L- | 0 | 0 | yes |
| `/host/photos` | 390 | own | 16,8,44,44 | 412.1 | 303.1 | - | L- | 0 | 0 | yes |
| `/host/photos` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/reservations` | 390 | own | 16,8,44,44 | 437.7 | 277.5 | - | L- | 0 | 0 | yes |
| `/host/reservations` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/reviews` | 390 | own | 16,8,44,44 | 412.1 | 303.1 | - | L- | 0 | 0 | yes |
| `/host/reviews` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/rooms` | 390 | own | 16,8,44,44 | 437.7 | 277.5 | - | L- | 0 | 0 | yes |
| `/host/rooms` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/settings` | 390 | own | 16,8,44,44 | 412.1 | 303.1 | - | L- | 0 | 0 | yes |
| `/host/settings` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/host/start`<br>to `/profile/setup` | 390 | own | 16,92,44,44 | 10 | - | - | -- | 0 | 0 | yes |
| `/host/start`<br>to `/profile/setup` | 1440 | none | none | none | - | - | -- | 0 | 0 | yes |
| `/host/transfer` | 390 | own | 16,8,44,44 | 437.7 | 277.5 | - | L- | 0 | 0 | yes |
| `/host/transfer` | 1440 | own | 280,8,44,44 | 413.1 | - | - | L- | 0 | 0 | yes |
| `/leaderboard` | 390 | frame+sub+act | 16,8,44,44 | 10 | 20 | - | L- | 0 | 0 | yes |
| `/leaderboard` | 1440 | frame+sub+act | 548,128,44,44 | 16 | 20 | 18 | L- | 0 | 0 | yes |
| `/legal/disclaimer` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/legal/disclaimer` | 1440 | frame+sub | 468,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/legal/privacy` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/legal/privacy` | 1440 | frame+sub | 468,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/legal/terms` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/legal/terms` | 1440 | frame+sub | 468,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/messages` | 390 | own | 16,8,44,44 | 10 | - | - | L- | 0 | 0 | yes |
| `/messages` | 1440 | frame | 516,128,44,44 | 16 | 20 | 18 | L- | 0 | 0 | yes |
| `/messages/new`<br>to `/messages` | 390 | own | 16,8,44,44 | 10 | - | - | L- | 0 | 0 | yes |
| `/messages/new`<br>to `/messages` | 1440 | frame | 516,138,44,44 | 16 | 143.1 | 18 | L- | 0 | 0 | header gap 143.1 (system 24) |
| `/move-in-cost` | 390 | own | 16,84,44,44 | 1913 | 32 | - | -- | 0 | 0 | yes |
| `/move-in-cost` | 1440 | own | 128,84,44,44 | 21 | 64 | - | -- | 0 | 27 | yes |
| `/notifications` | 390 | own | 16,8,44,44 | 10 | - | - | L- | 0 | 0 | yes |
| `/notifications` | 1440 | frame | 516,128,44,44 | 16 | 20 | 18 | L- | 0 | 0 | yes |
| `/offers`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/offers`<br>to `/welcome` | 1440 | none | none | 535.1 | - | - | L- | 0 | 0 | yes |
| `/offline`<br>to `/home` | 390 | own | none | 10 | 16 | - | -- | 0 | 0 | yes |
| `/offline`<br>to `/home` | 1440 | own | none | 16 | 16 | 18 | -- | 0 | 0 | yes |
| `/payments` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/payments` | 1440 | frame | 616,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/payouts` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/payouts` | 1440 | frame | 616,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/price` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/price` | 1440 | frame+sub | 468,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/privacy` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/privacy` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/pro`<br>to `/home` | 390 | own | none | 10 | 16 | - | L- | 0 | 0 | yes |
| `/pro`<br>to `/home` | 1440 | own | none | 16 | 16 | 18 | L- | 0 | 0 | yes |
| `/pro/confirm`<br>to `/home` | 390 | none | none | none | - | - | L- | 0 | 0 | yes |
| `/pro/confirm`<br>to `/home` | 1440 | none | none | none | - | - | L- | 0 | 0 | yes |
| `/profile` | 390 | own | 8,62,44,44 | 10 | 56.2 | 18 | L- | 0 | 0 | yes |
| `/profile` | 1440 | own | 532,82,44,44 | 16 | 54.4 | 18 | L- | 0 | 0 | yes |
| `/profile/application` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/profile/application` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/profile/setup` | 390 | own | 16,92,44,44 | 10 | - | - | L- | 0 | 0 | yes |
| `/profile/setup` | 1440 | own | 296,120,44,44 | 16 | - | 18 | L- | 0 | 0 | yes |
| `/profile/setup/agent` | 390 | own | none | 10 | 156.9 | 18 | L- | 0 | 0 | yes |
| `/profile/setup/agent` | 1440 | own | none | 16 | 162.6 | 18 | L- | 0 | 0 | yes |
| `/profile/setup/firm`<br>to `/profile/setup/agent` | 390 | own | none | 10 | 156.9 | 18 | -- | 0 | 0 | yes |
| `/profile/setup/firm`<br>to `/profile/setup/agent` | 1440 | own | none | 16 | 162.6 | 18 | -- | 0 | 0 | yes |
| `/profile/setup/owner` | 390 | own | none | 10 | 130.1 | 18 | L- | 0 | 0 | yes |
| `/profile/setup/owner` | 1440 | own | none | 16 | 135.8 | 18 | L- | 0 | 0 | yes |
| `/r` | 390 | own | 16,84,44,44 | 363.9 | 16 | 18 | -- | 0 | 0 | yes |
| `/r` | 1440 | own | 128,84,44,44 | 21 | 16 | 18 | -- | 0 | 27 | yes |
| `/receipts` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/receipts` | 1440 | frame | 616,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/refunds` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/refunds` | 1440 | frame | 616,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/reset-password` | 390 | own | 16,8,44,44 | 422.9 | 301.1 | - | L- | 0 | 0 | yes |
| `/reset-password` | 1440 | own | 512,8,44,44 | 478.9 | 245.1 | - | L- | 0 | 0 | yes |
| `/restaurants` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/restaurants` | 1440 | own | 340,120,44,44 | 16 | 24 | 18 | L- | 0 | 27 | yes |
| `/rewards` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/rewards` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/rewards/history` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/rewards/history` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/rewards/referrals` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/rewards/referrals` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/rewards/withdraw` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/rewards/withdraw` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/safety` | 390 | own | 16,84,44,44 | 1240.8 | 32 | 18 | -- | 0 | 0 | yes |
| `/safety` | 1440 | own | 128,84,44,44 | 21 | 160 | 18 | -- | 0 | 27 | yes |
| `/saved` | 390 | frame+act | 16,8,44,44 | 10 | 20 | - | L- | 0 | 0 | yes |
| `/saved` | 1440 | frame+act | 468,128,44,44 | 16 | 20 | 18 | L- | 0 | 0 | yes |
| `/saved/searches` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/saved/searches` | 1440 | own | 516,120,44,44 | 16 | 28 | 18 | L- | 0 | 0 | yes |
| `/search` | 390 | own | 16,74,44,44 | 10 | 64 | - | L- | 0 | 0 | yes |
| `/search` | 1440 | own | 468,86,44,44 | 16 | 80 | 18 | L- | 0 | 27 | yes |
| `/settings` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/accessibility` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/accessibility` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/account` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/account` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/ai-assistant`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/settings/ai-assistant`<br>to `/welcome` | 1440 | none | none | none | - | - | L- | 0 | 0 | yes |
| `/settings/ai-assistant/consent`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/settings/ai-assistant/consent`<br>to `/welcome` | 1440 | own | none | 535.1 | 24 | - | L- | 0 | 0 | yes |
| `/settings/appearance` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/appearance` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/devices` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/devices` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/devices/alert` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/devices/alert` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/help` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/help` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/interests` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/interests` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/invite` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/invite` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/invite/how-it-works` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/invite/how-it-works` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/invite/referrals`<br>to `/rewards/referrals` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | -- | 0 | 0 | yes |
| `/settings/invite/referrals`<br>to `/rewards/referrals` | 1440 | none | none | none | - | - | -- | 0 | 0 | yes |
| `/settings/notifications` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/notifications` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/notifications/reminders`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/settings/notifications/reminders`<br>to `/welcome` | 1440 | none | none | none | - | - | L- | 0 | 0 | yes |
| `/settings/passcode` | 390 | own | 16,8,44,44 | 10 | - | - | L- | 0 | 0 | yes |
| `/settings/passcode` | 1440 | frame | 564,128,44,44 | 16 | - | 18 | L- | 0 | 0 | yes |
| `/settings/passport` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/passport` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/payments` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/payments` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/phone` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/phone` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/place` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/place` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy/ai` | 390 | own | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy/ai` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy/blocked` | 390 | own | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy/blocked` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy/data` | 390 | own | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy/data` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/privacy/money-lock` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/settings/privacy/money-lock` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/region` | 390 | frame+sub | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/settings/region` | 1440 | frame+sub | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/sign-in`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/sign-in`<br>to `/welcome` | 1440 | own | none | 535.1 | 24 | - | L- | 0 | 0 | yes |
| `/sign-in/code` | 390 | own | 16,8,44,44 | 528.6 | 211.4 | - | L- | 0 | 0 | yes |
| `/sign-in/code` | 1440 | own | 512,8,44,44 | 584.6 | 155.4 | - | L- | 0 | 0 | yes |
| `/sign-in/email`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | -- | 0 | 0 | yes |
| `/sign-in/email`<br>to `/welcome` | 1440 | own | none | 535.1 | 24 | - | -- | 0 | 0 | yes |
| `/sign-in/phone` | 390 | own | 16,8,44,44 | 912.8 | 12 | - | L- | 0 | 0 | yes |
| `/sign-in/phone` | 1440 | own | 512,8,44,44 | 1015.8 | 12 | - | L- | 0 | 0 | yes |
| `/sign-up`<br>to `/welcome` | 390 | own | none | 760 | 12 | - | L- | 0 | 0 | yes |
| `/sign-up`<br>to `/welcome` | 1440 | own | none | 535.1 | 24 | - | L- | 0 | 0 | yes |
| `/sign-up/email` | 390 | own | 16,8,44,44 | 832 | 24 | - | L- | 0 | 0 | yes |
| `/sign-up/email` | 1440 | own | 512,8,44,44 | 832 | 24 | - | L- | 0 | 0 | yes |
| `/sign-up/phone` | 390 | own | none | 593.7 | 12 | - | -- | 0 | 0 | yes |
| `/sign-up/phone` | 1440 | own | none | 653.2 | 12 | - | -- | 0 | 0 | yes |
| `/sign-up/verify` | 390 | own | 16,8,44,44 | 684 | 24 | - | L- | 0 | 0 | yes |
| `/sign-up/verify` | 1440 | own | 512,8,44,44 | 718.3 | 24 | - | L- | 0 | 0 | yes |
| `/standards` | 390 | own | 16,84,44,44 | 7033.8 | 32 | 0 | -- | 0 | 0 | yes |
| `/standards` | 1440 | own | 128,84,44,44 | 21 | 96 | 0 | -- | 0 | 27 | yes |
| `/stays` | 390 | own | none | 10 | 16 | 18 | L- | 0 | 0 | yes |
| `/stays` | 1440 | own | none | 16 | 16 | 18 | L- | 0 | 27 | yes |
| `/stays/search` | 390 | own | 16,8,44,44 | 10 | 24 | 14 | L- | 0 | 0 | yes |
| `/stays/search` | 1440 | own | 340,120,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/stories/new` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/stories/new` | 1440 | own | 516,136,44,44 | 16 | 28 | 18 | L- | 0 | 0 | yes |
| `/styleguide` | 390 | own | 16,84,44,44 | 5064.8 | 32 | 18 | -- | 0 | 0 | card radius 14 on `block` |
| `/styleguide` | 1440 | own | 128,84,44,44 | 21 | 64 | 18 | -- | 0 | 27 | card radius 14 on `block` |
| `/support` | 390 | own | 16,8,44,44 | 10 | 24 | 18 | L- | 0 | 0 | yes |
| `/support` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/support/messages` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/support/messages` | 1440 | own | 516,120,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/support/new` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/support/new` | 1440 | frame | 564,128,44,44 | 16 | 24 | 18 | L- | 0 | 0 | yes |
| `/terms` | 390 | own | 16,84,44,44 | none | 32 | - | -- | 0 | 0 | yes |
| `/terms` | 1440 | own | 128,84,44,44 | 21 | 96 | - | -- | 0 | 27 | yes |
| `/u` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/u` | 1440 | own | 516,136,44,44 | 16 | 28 | 18 | L- | 0 | 0 | yes |
| `/verification` | 390 | own | 16,8,44,44 | 10 | 24 | - | L- | 0 | 0 | yes |
| `/verification` | 1440 | own | 516,120,44,44 | 16 | 28 | 18 | L- | 0 | 0 | yes |
| `/wallet` | 390 | own | none | 463.6 | 12 | - | L- | 0 | 0 | yes |
| `/wallet` | 1440 | own | none | 544.9 | 12 | 18 | L- | 0 | 0 | yes |
| `/wallet/add` | 390 | own | none | 463.6 | 12 | - | L- | 0 | 0 | yes |
| `/wallet/add` | 1440 | own | none | 544.9 | 12 | 18 | L- | 0 | 0 | yes |
| `/wallet/send` | 390 | own | none | 463.6 | 12 | - | L- | 0 | 0 | yes |
| `/wallet/send` | 1440 | own | none | 544.9 | 12 | 18 | L- | 0 | 0 | yes |
| `/wallet/settings` | 390 | own | none | 463.6 | 12 | - | L- | 0 | 0 | yes |
| `/wallet/settings` | 1440 | own | none | 544.9 | 12 | 18 | L- | 0 | 0 | yes |
| `/wallet/transactions` | 390 | own | none | 463.6 | 12 | - | L- | 0 | 0 | yes |
| `/wallet/transactions` | 1440 | own | none | 544.9 | 12 | 18 | L- | 0 | 0 | yes |
| `/wallet/withdraw` | 390 | own | none | 463.6 | 12 | - | L- | 0 | 0 | yes |
| `/wallet/withdraw` | 1440 | own | none | 544.9 | 12 | 18 | L- | 0 | 0 | yes |
| `/welcome` | 390 | own | none | 760 | 12 | - | -- | 0 | 0 | yes |
| `/welcome` | 1440 | own | none | 535.1 | 24 | - | -- | 0 | 0 | yes |

## 6. Fixed

| What | Where | Commit |
|---|---|---|
| Back draws a chevron, not an arrow | `BackControl.tsx`, `UiIcon.tsx`, 4 other back controls | uncommitted |
| The edge rule: the glyph's ink on the gutter, shared by every surface | `chrome.css`, `BackControl.tsx` | uncommitted |
| The mobile menu's close: 36px box and 16px glyph to 44 and 20 | `MobileMenu.tsx` | uncommitted |
| Three off-size dismiss glyphs | `StoryComposer`, `DismissiblePromo`, `InnerNav` | uncommitted |
| A guard test that fails on the next one | `nav-controls.test.ts` | uncommitted |
| The assistant composer's field raised to the 44pt floor its own send disc already kept: 40.8px to 44px, measured on `/assistant`, `/agent/assistant` and `/host/assistant` at 390 with a touch screen and at 1440, both themes | `app/css/input-bar.css` | uncommitted |
| Six measurement faults in the sweep itself, each one listed in 4.2 with what it cost | `scripts/consistency-sweep.mjs`, `scripts/consistency-report.mjs` | uncommitted |

## 7. Where the rule looks wrong, not the page

For the founder, not for this session to change.

1. **The 13 November ruling and the 14 November ruling pull opposite ways.**
   "Too far from the edge" produced a control 4px from the screen; "too close
   to the end of the page" says that is wrong. The arithmetic above satisfies
   both readings by aligning the glyph with the text, which is a third
   answer rather than either of his two. If he wants it visibly further in
   again, the one number to change is in `.nf-nav-edge`, and the whole
   platform follows it.
2. **The auth code screens keep an arrow** (`CodeSignInForm`, `ResetCodeForm`)
   because another agent holds those files this round. They are two text
   links reading "Back to sign in". They should become chevrons in the next
   round for the rule to be true without an exception.
3. **The card tier has a second rung at night, and the rule in section 2 does
   not know about it.** Section 2 says a card's corner is 18px. In dark
   theme a card INSIDE another card is 14px, by name: `brand-glass.css`'s
   glass-quiet rule gives a nested panel `--nf-night-glass-quiet-radius`,
   which is `--nf-radius-card-sm`, which is `--nf-radius-md`, which is 14px
   and is on the scale. Measured on `/styleguide`, where the skeleton card
   sits inside the Loading section's own card: 14px in dark, 18px in light,
   both widths. Nothing is wrong with either page; the rule is written as
   one tier when the product has two, and **the light theme has no nested
   rung at all**, so the same nested card is 14 at night and 18 by day. That
   asymmetry is a material decision for the founder, not a consistency fix,
   and adding a light-theme nesting rule would be inventing a look. The rule
   in section 2 should read "the card tier, or the nested tier for a card
   inside a card at night".

4. **A surface wearing the card's material is not always a card.**
   `.nf-stays-tile` is a place type, a cancellation policy or a price band:
   a control you pick, carrying text, so it draws on `--nf-radius-control`
   (14px). `catalogue.css` states that shape law above the rule that draws
   it ("SHAPE LAW: it carries text, so `--nf-radius-control`"). It carries
   `.nf-panel--card` for the shared fill and edge, not for the corner. The
   report exempts it by name with that reason (`CARD_EXEMPT` in
   `consistency-report.mjs`) rather than filtering it quietly, so the
   exemption can be argued with. No change made.

5. **Two prose links are standalone enough to argue about, and were left.**
   `.nf-doc-flow__link` (18.9px, on `/privacy`, `/legal/privacy` and
   `/cancellations`) and `.nf-doc-xlink` (24px, nineteen of them on `/help`)
   are text links inside document prose. They pass the WCAG 2.5.8 test
   described in 4.2 and are counted as inline rather than as faults. The
   reason not to grow them is mechanical, not a preference: the platform's
   own device for a small target is `.nf-tap`, whose area is 44px centred on
   the control with `pointer-events: auto`, and on a 19px line in a
   paragraph that area covers about 12px of the line above and the line
   below. In a list of destinations that costs nothing; in prose it means a
   tap meant for the next sentence opens a link. **If the founder wants
   prose links to answer a thumb, the answer is a taller line-height in
   document body copy, not a hit area over the neighbours.** That is a type
   decision, so it is his.

6. **The 44px rule needs the word "touch" in it.** Section 2 reads "a
   control is at least 44 by 44 on touch", and the product honours exactly
   that: the site footer's links are 44 on a coarse pointer and 36 on a
   fine one, on purpose, with the reason in the stylesheet. The sweep now
   judges the rule only on the pass that has a touch screen. Any later check
   that measures a 390px viewport with a mouse will report the same 297
   false rows again; **the pointer, not the width, is what the rule is
   about.**

7. **One route could not be measured at all.** `/sign-up/finish` was sent to
   `/sign-in` on all four of its loads, so those four are marked
   `needs-session` and are NOT in the table below: the sweep records the
   door it met rather than measuring the door and calling it the page. That
   is not a finding either way. Everything else that needs a session was
   measured on its signed-out face, as section 4.1 says, and the nineteen
   routes that redirected somewhere other than a sign-in door ARE in the
   table, each naming the address it actually rendered.

8. **One header gap in the table is the sweep, not the page.**
   `/messages/new` at 1440 in dark reads a 143.1px gap against a system of
   24. That route sends the browser to `/messages`, and the sweep read it
   while it was still arriving. Measured again directly, with two seconds to
   settle: the header sits at y=128 and the next thing drawn at y=192 in
   **both** themes, which is a 20px gap, the same as the light row beside it
   and inside the tolerance. The row is left in the table as it was measured
   rather than edited, because a table that gets corrected by hand is not a
   measurement any more. The sweep's settle is bounded at 1.2 seconds across
   644 loads, and a route that is still navigating can be caught mid-flight;
   that is the cost of the bound, and it is cheaper than the alternative.

9. **Only four routes declare an `error.tsx`** against 496 rows whose route
   declares a `loading.tsx` (section 4.1). That is a real gap, it is not a
   consistency outlier, and nothing was changed for it in this pass. It
   belongs on the queue as its own item.
