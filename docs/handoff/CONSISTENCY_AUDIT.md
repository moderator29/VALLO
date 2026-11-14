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
| Card r | the first card surface's top-left radius | `getComputedStyle` |
| L/E | whether the route declares a `loading.tsx` and an `error.tsx` | the file tree, not a render: a state a page reaches only with particular data cannot be proved by one load |
| Overflow | `document.documentElement.scrollWidth - clientWidth` | the rule is 0 |
| Under 44 | interactive elements painted under 44 by 44, counting a hit area that overflows its own box | `getBoundingClientRect` on the element and its children |

The theme is set with the `nf_theme` cookie, which the server reads, so the
two passes really render in two themes. The cookie bar is answered once per
context, as a person would, so the page under it is what gets measured.

**A route that redirects is not measured.** A signed-out sweep meets the
sign-in door on every member route; the run records the final address and
marks the row `needs-session` rather than measuring the door and calling it
the page.

`apps/web/scripts/consistency-report.mjs` turns that JSON into the tables
below and applies the rules.

## 2. The rules each column is judged against

| Rule | Value | Where it is written |
|---|---|---|
| A back control is 44 by 44 CSS px, its real painted size | 44 x 44 | `docs/BACK_NAVIGATION.md`, "The control" |
| It sits at the top left of the page header, bar or cover | inside the header's box | same |
| There is one per screen | count 1, or 0 on a root | same |
| A card's corner is the card tier | 18px (`--nf-radius-card`) | `packages/design-tokens/src/tokens.css` |
| No page scrolls sideways | `scrollWidth` equals `clientWidth` | `docs/RESPONSIVE_RESEARCH.md` section 2 |
| A control is at least 44 by 44 on touch | 44 x 44 | `docs/RESPONSIVE_RESEARCH.md` section 7, Apple's 44pt |
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

The wider sweep (header parts, primary action, header gap, card radius,
loading and error states, sideways scroll, every control under 44) is built
and runs: `apps/web/scripts/consistency-sweep.mjs` with
`apps/web/scripts/consistency-report.mjs`. It was stopped part way through
its 644 page loads when the founder's back and close work arrived, which
outranks it. The script, its method and its rules are above and below; the
table is the one thing still to generate.

## 5. The table

_The back and close numbers are in section 3. The wider table is generated by
`node scripts/consistency-report.mjs <json> --md` once the sweep is run again._

## 6. Fixed

| What | Where | Commit |
|---|---|---|
| Back draws a chevron, not an arrow | `BackControl.tsx`, `UiIcon.tsx`, 4 other back controls | uncommitted |
| The edge rule: the glyph's ink on the gutter, shared by every surface | `chrome.css`, `BackControl.tsx` | uncommitted |
| The mobile menu's close: 36px box and 16px glyph to 44 and 20 | `MobileMenu.tsx` | uncommitted |
| Three off-size dismiss glyphs | `StoryComposer`, `DismissiblePromo`, `InnerNav` | uncommitted |
| A guard test that fails on the next one | `nav-controls.test.ts` | uncommitted |

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
