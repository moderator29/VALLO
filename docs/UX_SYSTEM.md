# THE VALLO GRADE 1 UX SYSTEM

Written 7 November 2026 for Platform Grade 1 Readiness. This is the design
and motion language every page is held to from now on. It does not replace
Vallo's palette or its standing rulings; it decides the STRUCTURE (surfaces,
rhythm, type, the four shared pieces, motion, states) so 559 pages read as
one product.

Sources, in order of authority: the founder's brief
(`docs/handoff/FOUNDER_BRIEF_VERBATIM.md`), the founder's standing design
rulings (`docs/design/CLEAN_UNIFIED_DIRECTION.md` sections 17 to 19,
`docs/RULINGS.md`), the reference patterns (`docs/handoff/REFERENCE_PATTERNS.md`).
Code: tokens in `packages/design-tokens/src/tokens.css`; Grade 1 surfaces in
`apps/web/src/app/css/grade1.css`.

---

## 0. The one sentence

Calm surfaces, generous space, thin lines, one accent with meaning, one
question per screen, honest feedback at the top, sheets that rise, steps that
slide, and nothing that waits for no reason.

## 1. What stays exactly as it is

- **The palette and both themes.** Vallo's navy night (default) and its paper
  day, blue-led with the orange spark only in the closed list of places
  (`CLEAN_UNIFIED_DIRECTION.md` section 18). We take Hauslet's STRUCTURE, never
  its colours.
- **The shape law.** Every button and control that carries text is a
  soft-cornered rectangle (10 / 12 / 14px on 44 / 48 / 56px), never a pill.
  Icon buttons, avatars, toggles and the FAB stay round. Heights 44 / 48 / 56
  only. One primary per screen.
- **The type families** (Poppins for display, Inter for text) and the
  type-weight test.

## 2. Surfaces

| Role | Token | Use |
|---|---|---|
| Page | `--nf-surface-canvas` | Every page ground. No gradients behind reading content. |
| Raised card | `--nf-surface-secondary` + 1px `--nf-border-default` | Cards, alerts, list groups. Almost no shadow. |
| Floating | `--nf-surface-elevated` + `--nf-elevation-floating` | The banner, the dock, popovers. |
| Sunken field | `--nf-surface-inset` | Search fields, segmented tracks, stat strips. |
| Scrim | `--nf-tier-sheet-scrim` + `--nf-tier-sheet-blur` | Behind every sheet: dim and blur, never a flat black. |

**Glass** only on floating things: the dock, sheets, the feedback banner, and
controls over photographs (back, share, heart on a listing hero). Never on a
reading surface. Always with the solid fallback, which Data Saver
(`data-save-data="on"`) and browsers without backdrop blur get automatically.

## 3. Radii (one scale, nothing else)

| Name | Value | Use |
|---|---|---|
| `--nf-radius-island` | 28px | Sheets' top corners, hero containers |
| `--nf-radius-xl` | 22px | Big cards, the feedback banner, alerts, option cards |
| `--nf-radius-lg` (`card`) | 18px | Ordinary cards, listing cards |
| `--nf-radius-md` (`control`) | 14px | Fields, chips, small tiles |
| `--nf-act-radius-sm/md/lg` | 10 / 12 / 14px | Text buttons by height |
| circle | 50% | Icon buttons, avatars, glyph tiles |

## 4. Spacing rhythm

Base unit 4px on the existing scale (`--nf-space-*`).

| Rhythm | Value |
|---|---|
| Page gutter | 16px (`--nf-space-md`) |
| Title to first control | 24px (`--nf-space-lg`) |
| Between sections | 32px (`--nf-space-xl`) |
| Card padding | 16px, 20px on hero cards |
| Row gap in a list | 12px |
| Bottom of a page | dock clearance + 32px |

Crowding is the fastest way to look cheap. When in doubt, add a step of space,
never a border.

## 5. Type scale

| Role | Token | Weight |
|---|---|---|
| Page title | `--nf-text-h1` | 700, tracking -0.02em |
| Step title | `--nf-text-h1` | 700 |
| Section title | `--nf-text-h3` | 600 |
| Body | `--nf-text-body` | 400 |
| Secondary line | `--nf-text-body-sm` in `--nf-content-secondary` | 400 |
| Eyebrow | `--nf-text-overline`, uppercase, 0.08em, brand ink | 600 |
| Caption | `--nf-text-caption` | 500 |

**The eyebrow** (small uppercase accent label above a step or hero title:
THE BASICS, LOCATION, PHOTOS, MOVE-IN CHARGES, FINISH) is the Grade 1
signpost. **The accent full stop** on a hero title ("Explore stays.") is used
on hero screens only, never on ordinary page titles.

## 6. Accent discipline

One accent carries meaning: the active tab, progress, the eyebrow, the
selected option (tinted fill, accent border, tick), the primary action, a
link. Everything else is ink and grey. Status colours (success, warning,
error, info) appear only on their state marks, never as page decoration.

## 7. Icons

- One family (`UiIcon`, Lucide geometry), one size scale (12 to 40).
- **Founder ruling, 7 November 2026: do NOT make the icons thin.** The
  stroke weights stay as they are: the navigation chrome keeps its bold
  stroke (29 September ruling, `css/symbols.css`) and content keeps the lean
  default. The icon pass is about ONE family, one size scale and removing
  inline `<svg>`, never about thinning the line.
- Active state is the filled twin or a tint, never a different glyph.
- Glyphs sit in soft tiles (round for content rows, square for settings rows)
  at 40px with a 20px glyph.
- No inline `<svg>` in product code when a `UiIcon` exists.

## 8. The four shared pieces (build every screen from these)

### 8.1 Feedback banner (`lib/ui/toast.ts` + `components/ui/ToastHost.tsx`)

One global system. `banner.success`, `banner.info`, `banner.warning`,
`banner.error` (`toast` is the same function for older callers).

- A wide rounded rectangle (22px) at the TOP, under the status bar and notch,
  max 34rem wide, glass with a solid fallback.
- A round tone mark (tick, info, warning), one specific sentence, an optional
  action (a retry is `{ retry }` and reads "Try again"), and an X.
- Dismiss by X, by swiping up or sideways, or by Escape. Holding it pauses
  the clock. Success and info dwell 3.2s; errors, warnings and anything with
  an action dwell 6s.
- **The queue replaces, it does not stack.** The same words twice restart the
  clock. An error holds the screen for at least 1.5s before a calmer message
  replaces it.
- **Words.** Specific and true: "Saved to your list", "Message sent",
  "Booking request sent", "Your profile has been updated". A queued action is
  "Saved on your device. It sends when you're back online", never "Sent".
  Failure says what happened and what to do: "Message couldn't be sent. Check
  your connection and try again."
- Account moments (signed in, account created, email confirmed, password
  changed, passcode set) arrive as banners through `SuccessFlagHost`. Record
  moments that are a real milestone (listing submitted, booking paid,
  verification approved) keep their success sheet with motion.
- A banner is never the only record of something important: the page or the
  notification centre also shows it.

### 8.2 Sheet (`components/ui/Sheet.tsx`)

The platform sheet, already with drag, detents, focus trap, Back and blur.
Grade 1 rules: a grabber, a title, a close X (`closeLabel`) on every sheet,
an optional one-sentence `description`, a sticky footer with one primary and
one pale secondary. Use it for: confirm your details, add a photo, policies
and explainers, switch account, "What do you manage?", filters, reports. Long
legal pages keep their own route and open a summary sheet.

### 8.3 Step frame (`components/ui/StepFrame.tsx`)

One question per screen. Back (round), the save state in the middle ("Saved"
with a tick only after the server answered; "Saved on this device" offline),
close (round), a 3px progress bar, eyebrow, title, one-line subtitle, the
question, an optional notice ("1 thing to fix"), and a sticky foot with
"Step N of M" and Continue above the home indicator and keyboard. Steps slide
from the side they came from. Used by the listing wizard, verification, the
registrations and every long form.

### 8.4 Page frame (`components/app/PageFrame.tsx`)

The top of an ordinary page: the large title that folds into the shell header
on scroll, subtitle, actions, an optional tab row, then the body on the
Grade 1 rhythm. Wraps `PageHeader variant="large"`; pages move onto it in the
page sweep.

## 9. Selection, options, inputs

- **Option cards** (one choice from a few): full-width cards, icon tile,
  bold title, one grey line; selected = tinted fill, accent border, a tick on
  the right. "What do you manage?", listing kind, document type.
- **Tile grid** for many choices (property type): two or three columns of
  square tiles with a glyph and a label.
- **Number chips** for counts (bedrooms, bathrooms), the `Quantity` control
  for guests.
- **Fields**: label above, 1px border, 14px radius, focus ring in the accent,
  error under the field in words, a counter that turns green when the minimum
  is met ("73 / 50 min").
- **Segmented control**: a sunken track with a raised active segment.

## 10. Motion

Durations and eases are the existing tokens; Grade 1 names their jobs.

| Job | Duration | Ease |
|---|---|---|
| Press | `--nf-duration-press` 120ms | `--nf-ease-press`, scale 0.97 |
| Banner in / out | `--nf-duration-base` 240ms / `fast` 160ms | `entrance` / `exit`, drop from -1rem |
| Sheet up | spring in `Sheet.tsx` | `--nf-ease-spring` |
| Step change | `--nf-duration-base` 240ms | `entrance`, slide 1.5rem from the side it came from |
| Card or alert arrival | `--nf-duration-base` | `entrance`, rise 6px |
| List first paint | 40ms stagger, at most 6 items | `entrance` |
| Success moment | `--nf-duration-entrance` 520ms | `spring` |

Transform and opacity only. Never blocking: no interaction waits for an
animation. Reduced motion and the in-app Motion setting (`motion-pref.css`,
imported last) collapse all of it. Haptics (`lib/ui/feedback.ts`) pair with
motion: `select` on a tab or option, `confirm` on a save, `success` on a
payoff, `error` on a failure.

## 11. States every screen defines

| State | Rule |
|---|---|
| Loading | A skeleton shaped like the real content. Never a spinner alone. Never artificial delay. |
| Empty | One thin glyph, one grey sentence, one action. Centred. |
| Error | A plain sentence of what happened, a retry, and a way back. |
| Offline | What is kept on the device, stamped "Saved on your device. Price and availability may have changed." Never present cached prices or availability as live. |
| Weak signal | The brief, in-place connection line only. Never a full-screen error. |

## 12. Definition of done for a screen

Tokens only. Works at 390 x 844 and 360 x 800, light and dark. Loading,
empty, error and offline states exist and look designed. Safe areas
respected. One primary action. Thin icons. Motion respects reduced motion.
The keyboard never covers the field being typed into. Nothing shifts after
load. Every success and failure goes through the banner. Screenshot it
locally before saying it is done.
