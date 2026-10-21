# Vallo Icon System

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

## Current rule, 29 September 2026: one family, lean glyphs on flat plates

This section supersedes everything below it where the two disagree. The
spec is `docs/design/CLEAN_UNIFIED_DIRECTION.md` section 4, and the pass that
applied it is recorded in `docs/ICON_UPGRADE_2026-09-29.md`.

- **One set.** Every icon inside a page is a `UiIcon` (Lucide geometry,
  lean line). The navigation chrome keeps the bold line (`app/css/symbols.css`).
  `SettingsGlyph`, `LineGlyph` and `AdminGlyph` are name maps onto `UiIcon`.
  They are not separate drawings.
- **One plate.** On a row, card, KPI tile, sheet head or empty state, the
  glyph sits on `IconPlate` (`components/ui/IconPlate.tsx`, material in
  `app/css/symbols.css`, values in the `--nf-plate-*` tokens). The plate is a
  soft flat square: 36, 44 or 56px on a 10, 12 or 14px corner, holding a
  20, 20 or 24px glyph (`ICON_PLATE_GLYPH`). It has no rim and no glow in
  either theme.
- **Tones.** The tones are `neutral` (the default), `brand` (only for the
  one row that is the point of a screen), `success`, `warning`, `danger`,
  `info` and `solid`.
- **Inline glyphs** in chips and buttons are 16px with no plate.
- **The glass objects retire.** `BrandIcon` no longer stands on a row, card,
  button, empty state or sheet. A component that still takes a
  `BrandIconName` draws its line twin from
  `design-system/icons/glass-to-line.ts` (`lineGlyphFor`). The `State` kit
  does this for every empty state. The flip, the logo and the photographic
  hero scenes keep their artwork. The open list of the remaining glass call
  sites is in the upgrade doc.
- **Adding a glyph.** Copy Lucide's path data into `PATHS` in `UiIcon.tsx`,
  name the Lucide source in a bracket comment, add the name to `UiIconName`,
  then run `node scripts/build-icon-vectors.mjs`.
  `ui-icon.dom.test.tsx` fails until the vector exists.

**Two tiers, each with one job, plus one landing-only mark set that is not a
tier. Never mix them.**

Corrected 2026-08-09. This file said three tiers, which disagreed with ADR-011,
and it carried a section describing `Icon3D` as retired-but-kept-in-the-repository
when those files do not exist at all. It also said 33 checked-in UI vectors when
there are 40, and told the reader to wrap objects in a `.nf-icon-chip` class that
is defined nowhere in the codebase.

## Tier 1: BrandIcon, the commissioned 3D pack (content)

`apps/web/src/design-system/icons/BrandIcon.tsx`, artwork in
`apps/web/public/brand/icons/*.png`.

**THE SWAP LANDED, 16 September 2026.** `BrandIcon` draws from
`apps/web/public/brand/glass/`: 103 glass objects in the logo's own language,
23 of them with a light twin (drawn at the time, no longer rendered), and 12 hero
scenes under `glass/hero/` that are scenes, never icons, and are painted with
`next/image` at their own call sites rather than through this component.

**What the swap deleted, and each deletion is a rule now:**

- `mix-blend-mode: multiply` is gone. The clay artwork was opaque RGB on white
  and multiply removed the white at paint time; the glass artwork carries a
  real alpha channel. Never reintroduce a blend mode to rescue artwork: fix
  the artwork.
- The near-white ground plate on dark is gone, and **its absence is the
  standing acceptance test**: if an object ever needs a plate behind it to be
  visible on the night canvas, the cutout is wrong.
- In daylight (the light theme, restored 25 September 2026) every object
  stands on its own with no ground behind it: a soft blue drop shadow and a
  fade over the outer tenth of the image keep it defined on white
  (`apps/web/src/app/css/light.css`, "THE ICON TILES"). The navy chip
  `--nf-icon-ground` and the light twins are no longer drawn; the twin files
  stay on disk under `public/brand/glass/light/` and nothing references them.
- Seven clay names live on as `LEGACY_ALIASES` in `BrandIcon.tsx`, resolving
  to their glass substitutes so 36 call sites keep working. The renames belong
  to the files' owners. Two objects still need commissioning: `homes-sparkle`
  and `house-sparkle` are standing in as `cluster-home` and `modern-house`.

The clay set remains on disk at `brand/icons/` as an archive and nothing draws
it. The inventory below is the OLD inventory, kept for the historical name
mapping at the bottom of this file; `BRAND_ICONS` in `BrandIcon.tsx` is
generated from the glass directory and is the authority now.

White ceramic objects with brand blue accents, each on a soft plinth, lit
from the upper left, sliced from the four supplied pack sheets. This is the
platform's signature iconography: features, categories, facts, empty states,
settings rows, wallet kinds, showcase panels. 57 objects:

bell-alert, bell-badge, booking-instant, bot, bot-chat, bot-home,
calendar-check, calendar-clock, calendar-home, calendar-time, camera,
card-lock, chart-growth, chat, chat-duo, cleaning, clock-check, doc-lock,
doc-shield, gift, gift-star, globe-pin, heart-home, home-cam, home-check,
home-refresh, home-search, home-swap, homes-sparkle, hotel-star,
house-sparkle, key-cycle, keys-home, keys-tag, listing-review,
listing-search, luggage-check, luggage-plane, map-route, map-spot,
naira-hand, phone-home, pin-map, report-stats, reviews, search-home,
shield-check, shield-home, shield-lock, support-chat, support-shield,
tag-hash, tag-percent, tour-360, user-check, user-verified, wallet-secure.

Usage: `<BrandIcon name="shield-check" size={44} />` or `fill` inside a sized
wrapper. Props are `name`, `size`, `fill`, `label`, `priority` and `className`.
**There is no `ramp` prop.** The artwork is rendered on white: in daylight it
composites with multiply so the ground disappears on paper, at night it is
masked and lifted so the object reads on the dark canvas.

**That mechanism is why `--nf-icon-ground` exists, and it is the single thing the
glass set changes most.** Multiply against the night canvas returns the night
canvas, so an untiled object with nothing light behind it is not understated, it
is invisible, and the flat plate is what rescues it. The glass artwork carries
its own alpha, so on the day of the swap the blend mode and the dark plate both
become unnecessary. **Deleting `--nf-icon-ground` on dark is the acceptance test
for the replacement**: if an object still needs a plate, the cutout is wrong.

**Do not reach for `.nf-icon-chip`.** This file used to tell you to wrap an
object in that class when it needed its own tile. The class is defined in no
stylesheet in the repository and never was. A tinted tile behind a glyph came
from the retired reference brief, not from this system: see
`RECOMMENDATIONS.md` D-2 and D-5.

**The percentage padding trap.** Percentage padding resolves against the
containing block, not the element. A 22px icon tile inside a 330px button got
about 30px of padding per side and rendered a 0x0 image, so every non-`fill`
`BrandIcon` was an empty white chip and nothing caught it but a screenshot.

Sizing convention: 20 to 24px inline in dense rows, 40 to 48px in feature
cards and list rows, 64 to 96px in showcase and empty states, and larger only
in hero or story panels.

<!-- render-crops:start -->
## Tier 1, continued: the 41 objects cropped from the reference renders

**Added 18 September 2026 by G2, on the ruling in `docs/DESIGN_DIRECTION.md`
section 3.5:** where a governing render uses a glass object the ten sheets do
not carry, crop it from the render, key it through the existing pipeline, file
it through the manifest under a lowercase-hyphen name, and use it, provided it
carries no baked text. `BrandIcon` now lists 144 objects: the 103 sheet objects
and these 41.

**Where they live in the pipeline.** `RENDER_CROPS` in `scripts/icon-manifest.mjs`
is the filing: each entry names the render under `docs/design/references/`,
the box in that render's own pixels, the object's longer edge at source and what
it is. `slice-icon-sheets.mjs` cuts the declared boxes into the pseudo-sheet
`renders`, `cut-icon-ground.mjs` keys them, and `name-icon-objects.mjs`
emits them at the pack's 256 edge like every other object. The three commands in
`assets/README.md` rebuild them with the rest; nothing was dropped into
`public/brand/glass` by hand.

**How the key differs, and why.** A render's ground is not black. Under the
wallet it is around rgb(0, 44, 128), under a settings tile rgb(0, 13, 52), and
it is a gradient, so the sheet key would return the panel as a square wash with
the object inside it. The cutter therefore fits a plane per channel to a thin
ring at the edge of each box (twice: the second fit drops ring pixels the first
fit shows to be object), subtracts it, and uses the result for ONE thing: how
much of each pixel's brightest channel is object rather than ground. The render
pixel is scaled by that fraction, all three channels by the same number, and
keyed exactly as a sheet object is. The hue is the render's hue by
construction. The first cut subtracted channel by channel instead and came back
green and yellow, because the render's blue channel is already clipped at 255
wherever an object is lit; that account is in the cutter's header, next to the
one about luminance.

**They are not all one size, and the size is recorded.** The wallet and the
hotel are around 190 and 250 pixels at source and lose nothing at 256. The
profile tiles are 84, the settings tiles 56, the landing rings and chips 36 to
48, and those are upsampled to 256 and read soft at 96 on a 3x display. The
`native` column below is the honest number: a `-ring` or a `-chip` belongs in
a 24 to 48 slot, the tiles in 32 to 64, the wallet and the hotel anywhere up to
an empty state.

**Light theme.** None of the 41 has a light twin, because no render draws them
on white and, as section 3 of `docs/BRAND_MARKS.md` established, no filter
makes one. In the light theme they take the same recipe as every other object:
no chip behind them, a soft blue drop shadow, and the outer tenth of the image
faded so a tile-form object (one that arrives on its own glass tile, like the
transaction marks) ends in falloff rather than a hard edge
(`apps/web/src/app/css/light.css`). The preview at `/preview/g2` shows every
one at 32, 48 and 96 on canvas, card, elevated and the glass card, in both
themes; the proof shots `docs/design/proofs/g2/objects-390-dark.png` and
`objects-390-light.png` (taken before the light recipe changed) were removed from the tree with the other build proofs
and remain in git history (last present at `85c5471`; the rest of the proofs
tree was removed at `77cf90ad`).

**What was looked at and left out, and why.** The HOTEL-lettered building on
`2A49E2F7` (baked text, never cropped). The onboarding coin on the same render
(its motion rings run under both flanking cards, so no clean box exists; the
drawer's coin is the `flip-coin`). The Verve card on `7F96BE6C` (a real brand
mark with lettering). The settings shield (a smaller drawing of
`shield-check-tile`). The landing grid's Buy ring (the same house as the
Properties stat, which is larger and is `home-ring`). The wallet render's
fourth quick action, a person (the same glyph as `person-card`). The two
fullpage chips that carry the Vallo bars mark (that is the logo, which has its
own assets, not an object). The Verify, Experience and Manage rings of the
How-it-works row (35 pixels at source on a 780-wide render; Verify duplicates
`shield-ring`, the other two are a blur at that size). Nothing warm-tinted was
found among the candidates; the gold stars on the stays render are in the
listing cards, not in any object.

| Name | Render | Box (left, top, size) | Native px | What it is |
| --- | --- | --- | ---: | --- |
| `wallet-naira` | `6AF37222` | 614, 226, 182x180 | 186 | The 3D glass wallet with the naira sign, from the balance card |
| `send-plane-tile` | `6AF37222` | 209, 606, 64x64 | 52 | Paper plane on a rounded glass tile, the Send Money quick action |
| `phone-tile` | `6AF37222` | 371, 606, 64x64 | 52 | Handset on a rounded glass tile, the airtime quick action |
| `bill-tile` | `6AF37222` | 527, 606, 64x64 | 52 | Lined document on a rounded glass tile, the bills quick action |
| `stays-hotel-palms` | `FD3DFE84` | 568, 198, 252x180 | 252 | The hotel block between two palms on a glass slab, the Stays side's mark |
| `hotel-bed` | `FD3DFE84` | 241, 481, 54x54 | 42 | Double bed glyph, from the lit Hotels category tile (glyph only, above its caption) |
| `apartment-block` | `FD3DFE84` | 366, 479, 56x56 | 40 | Apartment block glyph, from the Apartments category tile |
| `palm-tree` | `FD3DFE84` | 489, 479, 56x56 | 38 | Palm glyph, from the Resorts category tile |
| `guest-house` | `FD3DFE84` | 612, 479, 56x56 | 38 | House with door glyph, from the Guest Houses category tile |
| `serviced-block` | `FD3DFE84` | 736, 479, 56x56 | 40 | Tower with wings glyph, from the Serviced Apartments category tile |
| `flip-coin` | `BCD39CA8` | 222, 1132, 98x98 | 86 | The two-faced glass coin with the bars mark, from the drawer's Flip Coin card |
| `calendar-grid` | `50E032EA` | 231, 657, 96x96 | 84 | Calendar with a six-dot grid on a glass tile, the My Bookings row |
| `bookmark-ribbon` | `50E032EA` | 231, 781, 96x96 | 84 | Bookmark ribbon on a glass tile, the Saved row |
| `wallet-tile` | `50E032EA` | 231, 906, 96x96 | 84 | Outline wallet on a glass tile, the Wallet row |
| `shield-check-tile` | `50E032EA` | 231, 1031, 96x96 | 84 | Shield with a tick on a glass tile, the Inspections row |
| `role-switch-tile` | `50E032EA` | 229, 1174, 84x84 | 70 | Person with a swap arrow on a glass tile, the Switch role row |
| `person-card` | `7F96BE6C` | 226, 433, 68x68 | 56 | Person glyph on a glass tile, the Account Information row |
| `bell-tile` | `7F96BE6C` | 226, 513, 68x68 | 56 | Bell glyph on a glass tile, the Notifications row |
| `palette` | `7F96BE6C` | 226, 672, 68x68 | 56 | Painter's palette on a glass tile, the Appearance row |
| `globe` | `7F96BE6C` | 226, 752, 68x68 | 56 | Globe on a glass tile, the Language row |
| `headset` | `7F96BE6C` | 226, 832, 68x68 | 56 | Headset on a glass tile, the Help and Support row |
| `card-tile` | `7F96BE6C` | 226, 926, 68x68 | 56 | Payment card on a glass tile, the Payment Methods header |
| `bank-column` | `7F96BE6C` | 241, 1126, 64x64 | 52 | Bank portico on a glass tile, the bank account row |
| `home-ring` | `GOVERNING-landing-desktop-hero` | 496, 689, 60x60 | 46 | House outline in a glowing ring, the Properties stat (also the grid's Buy) |
| `people-ring` | `GOVERNING-landing-desktop-hero` | 711, 689, 60x60 | 46 | Two people in a glowing ring, the Agents stat |
| `city-ring` | `GOVERNING-landing-desktop-hero` | 929, 689, 60x60 | 46 | Three towers in a glowing ring, the Cities stat |
| `shield-ring` | `GOVERNING-landing-desktop-hero` | 1169, 689, 60x60 | 46 | Shield with a tick in a glowing ring, the Verified stat |
| `key-ring` | `GOVERNING-landing-desktop-hero` | 721, 811, 48x48 | 36 | Key in a glowing ring, the grid's Rent |
| `bed-ring` | `GOVERNING-landing-desktop-hero` | 890, 811, 48x48 | 36 | Bed in a glowing ring, the grid's Stays |
| `chart-ring` | `GOVERNING-landing-desktop-hero` | 1061, 811, 48x48 | 36 | Rising line chart in a glowing ring, the grid's Invest |
| `brain-ring` | `GOVERNING-landing-desktop-hero` | 1235, 811, 48x48 | 36 | Brain in a glowing ring, the grid's AI Assistant |
| `wallet-ring` | `GOVERNING-landing-desktop-hero` | 550, 911, 48x48 | 36 | Wallet in a glowing ring, the grid's Wallet |
| `calendar-ring` | `GOVERNING-landing-desktop-hero` | 721, 911, 48x48 | 36 | Calendar with a tick in a glowing ring, the grid's Bookings |
| `chat-ring` | `GOVERNING-landing-desktop-hero` | 890, 911, 48x48 | 36 | Speech bubble in a glowing ring, the grid's Messaging |
| `inspect-ring` | `GOVERNING-landing-desktop-hero` | 1061, 911, 48x48 | 36 | Shield-framed lens in a glowing ring, the grid's Inspections |
| `manage-ring` | `GOVERNING-landing-desktop-hero` | 1240, 911, 48x48 | 36 | Gear cluster in a glowing ring, the grid's Management |
| `brain-chip` | `GOVERNING-landing-desktop-fullpage` | 193, 473, 64x60 | 40 | Brain on a soft glass chip, the AI Powered feature |
| `wallet-chip` | `GOVERNING-landing-desktop-fullpage` | 308, 473, 64x60 | 40 | Wallet on a soft glass chip, the Secure Wallet feature |
| `globe-chip` | `GOVERNING-landing-desktop-fullpage` | 419, 473, 64x60 | 40 | Globe on a soft glass chip, the One Platform feature |
| `building-chip` | `GOVERNING-landing-desktop-fullpage` | 641, 473, 64x60 | 40 | Building on a soft glass chip, the Property Management feature |
| `search-ring` | `GOVERNING-landing-desktop-fullpage` | 38, 1033, 48x48 | 36 | Magnifier in a glowing ring, the Discover step |
<!-- render-crops:end -->

## Tier 2: UiIcon, stroked glyphs (navigation and controls)

`apps/web/src/design-system/icons/UiIcon.tsx`. A 24 grid, SF-quality stroked
set. Used for the dock capsule, headers, chips and small controls, and as the
fallback for any navigation row with no glass object mapped.

**Two weights, one family (29 September 2026, latest).** The founder asked
for the inner icons (settings rows, profile, saved, agreements, cards, chips)
to be "clean, lean and neat", and for only the side nav and bottom nav to
stay bold. So:

- **Bold** (`UI_ICON_STROKE_BY_EDGE`, 2.25 px at 20 and 24) is for the
  navigation chrome only: `.nf-tabbar`, `.nf-dockrow`, `.nf-dockmore`,
  `.nf-nav` (rail and drawer), every `NavTree` glyph (`.nf-nav__glyph`),
  `.nf-drawer`, `.nf-admin-rail`, and anything wrapped in `.nf-icons-bold`.
- **Lean** (`UI_ICON_LEAN_BY_EDGE`: 1.25 at 12, 1.4 at 16, 1.6 at 20, 1.7 at
  24, up to 2.25 at 40) is everything else, and the default.
- Every stroked glyph (`UiIcon`, `SettingsGlyph`, `LineGlyph`,
  `AdminGlyph`) spreads `uiIconStrokeProps(size)`: the lean
  width as the attribute, both widths as `--nf-sw-lean` / `--nf-sw-bold`.
  `app/css/symbols.css` switches the chrome to bold with zero-specificity
  rules, so a rule that already sizes one glyph's line still wins.
- `<UiIcon weight="bold" | "lean">` pins one glyph either way.

The sections below describe the bold line; it is now the chrome's weight.

**Redrawn 29 September 2026 on Lucide geometry.** Against the founder's
references of that date (`docs/design/references/2026-09-29/`), most
outlines are now Lucide's path data (ISC; notice in
`design-system/icons/THIRD_PARTY_NOTICES.md`), copied in with no runtime
dependency. Not all of them: the four brand marks are the owners' own, and
seven glyphs are Vallo's drawings on Lucide's rules (listed below; the menu
and `house` start from Lucide geometry and are altered). The rules the set now
holds, glyph for glyph:

- One live area, 2 to 22 on the 24 grid. The old set ranged from 14 to 19
  units wide, so neighbours in the dock read as different sizes.
- One corner radius, 2 (1 on small parts such as the archive lid), one dot
  (`h.01` on a round cap, so it scales with the line), round caps and joins.
- The bold weight (below): `UI_ICON_STROKE_PX`, 2.25 rendered CSS px at 20
  and 24, scaled optically per size.
- Where Lucide has no drawing, Vallo draws one on the same rules: the
  shorter-third menu, the two-card feed, `house` (Lucide's house with a
  chimney, so it never reads as the Home tab), and the four property-type
  houses (`house-duplex`, `house-terrace`, `house-bungalow`,
  `tower-penthouse`).
- Every name kept its meaning, so no call site changed. The Lucide source of
  each glyph is named in a bracket above it in the TSX.

**Bold pass, 29 September 2026 (same day, second round).** The founder asked
for the icons to read premium: bolder, solid, clean and sharp, with pump.fun's
app icons as the weight target (`22-pumpfun-drawer-bold-icons.png`,
`23-pumpfun-home-bell-dock.png`: about 2 to 2.25 CSS px at 24, round joins, a
solid twin for the active state such as their filled gear). What changed:

- **The weight.** `UI_ICON_STROKE_PX` went from 1.5 to 2, and the rendered
  line now steps with the size through `UI_ICON_STROKE_BY_EDGE` and
  `uiIconStrokeWidth(size)`: 1.5 at 12, 1.75 at 16, 2 at 20 and 24, 2.25 at
  28, 2.5 at 32, 2.75 at 40. One fixed pixel weight clogged the 12 step (2px
  is a third of a counter there) and starved the 40 step; the quarter-pixel
  steps land on the device grid at 2x. `LineGlyph`, `SettingsGlyph`,
  The console's `AdminGlyph` calls the same helper, so they
  went bold with the set.
- **Raised to 2.25 the same day (the ICONS3 audit).** Beside 600-weight
  labels the 20 and 24 steps at 2 still read a shade under pump.fun's, and
  the founder asked for "a bit more bold". The scale is now 1.5 at 12, 1.75
  at 16, **2.25 at 20 and 24**, 2.5 at 28, 2.75 at 32, 3 at 40. 12 and 16
  did not move: heavier there closes Lucide's counters.
- **The library stayed Lucide.** The founder also named "expo icons"
  (`@expo/vector-icons`), which is a React Native package; its web-usable
  faces are Ionicons (MIT) and MaterialCommunityIcons (Apache 2.0). Ionicons'
  outline set draws 32 on a 512 grid, 1.5 at 24, which is the thin line being
  left behind, and its filled set is a different drawing rather than a twin.
  Phosphor Bold (MIT) is 2.25 on rounder, wider geometry and would have meant
  redrawing all ninety glyphs again in the same week. Lucide's geometry is
  DRAWN at 2: its counters, gaps and dot spacing are tuned for exactly the
  weight the founder asked for, so raising the line makes each glyph cleaner
  rather than heavier, and the set stays one family under one licence.
- **Seven glyphs added** for the listing page's cost and utility rows, which
  dropped their glass objects for plated line glyphs: `coins` (the total,
  Lucide), `scale` (legal fee, Lucide), `certificate` (Governor's consent,
  Lucide `award`), `stamp` (stamp duty, Lucide), `droplet` (water, Lucide),
  and two of Vallo's own on the same rules, `survey` (a pin on a measuring
  rule, survey and registration) and `gate` (the estate gate: `verified`'s
  Lucide shield with a solid keyhole on a stem; a first drawing of two posts,
  an arched rail and bars closed into a hash at 20px on the bold line and was
  replaced in the ICONS3 audit). Light keeps `bolt`, which already existed.
- **More twins**, so a selected row can go solid: `sun`, `briefcase`,
  `parking`, `kitchen`, `droplet`, `certificate`, `stamp`, `survey`. The
  existing twins needed no redraw: their body is stroked at the family weight
  and their cuts at the same weight, so they thickened with it and read as
  cleaner, sharper solids.

**Filled twins.** 40 names have a drawn filled twin (`FILLED` in the TSX):
every tab in the dock except Search (a solid lens reads as a dot on a stick), the drawer's destinations that have a closed shape to
fill, and the saved and rated states (heart, star, bookmark). Line-only
glyphs (`search`, `settings-gear`, `sliders`, `history`, the arrows) have no honest
solid form and keep their outline when selected; the colour, the heavier
label and (in the dock) the small dot under it carry the state. The dock
draws no pill behind the current tab since 29 September 2026. A twin is the outline's own
geometry in three layers: a `body` painted solid and stroked at the family
weight, so its outer edge sits exactly where the outline's does; a `cut`
knocked out of the body through an SVG mask at the same weight (the door of
the house, the tick on the calendar, the fold of the document); and `keep`
strokes drawn on top (the clapper, the mast). The mask id is built from
the name, the size and `useId`. A name with no twin ignores `filled` and draws its outline.

**The gallery.** `/preview/icons` draws every name at 16, 20 and 24, regular
and filled, with the real `Button` and `Chip` and a dock-shaped row above;
`?grid=1` outlines each cell. Shoot it with `data-theme` set to each theme.

**Navigation is line glyphs (29 September 2026, the founder's final ruling).**
The side drawer and rail rows (`components/app/NavTree.tsx`), the dock
capsule (`MobileTabBar.tsx`) and the dock's More tray (`DockMore.tsx`) all
draw `UiIcon`, with the filled twin on the current row or tab. The Track M
glass map (`lib/nav/glass-glyph.ts`, `GLASS_FOR`) is deleted: at nav sizes
the glass objects blurred, and they read as a second icon family.

**Glass objects in daylight sit on a navy tile (29 September 2026).** The
glass artwork was drawn for a night ground and fringes on white. In the light
theme, outside a night island (`data-theme="dark"`), every `BrandIcon` ground
(`.nf-brand-icon-ground`) and chip (`.nf-icon-tile`) paints a small navy tile
behind the object, and the object is shown unfiltered at about 72 per cent of
it (`app/css/light.css`, "THE GLASS OBJECTS IN DAYLIGHT").

**`data-host-plate` is the supported opt-out.** A host that draws its own
plate or container around a `BrandIcon` (so a tile inside it would be a tile
inside a tile) puts `data-host-plate` on ITSELF, the element that contains the
icon. The object inside it then draws with no tile and no scale. A handful of
existing hosts (`.nf-plate`, the flip coin, the landing's two-worlds faces,
footer seal and list marks, `.nf-chip`, `.nf-btn`) are listed in light.css by
class because their files belong to other owners; new hosts use the attribute,
never a new class in that list.

**One weight.** `UI_ICON_STROKE_PX` is 2.25 RENDERED CSS pixels at the 20 and
24 steps (1.5 until the bold pass of 29 September 2026, 2 for its first
round), stepped optically
per size by `uiIconStrokeWidth`, and the `stroke-width` attribute is computed
from the size rather than passed in.
There is no `strokeWidth` prop. A fixed number on the 24 grid renders thinner
the smaller the glyph gets, which is why thirty-two call sites had each
hand-tuned a value between 1.5 and 2.6 and the platform ended up with a dozen
weights. State is carried by colour and by the filled pill behind an active
tab, never by a heavier line.

**One size scale.** `UI_ICON_SIZES` is 12, 16, 20, 24, 28, 32, 40: a 4px grid
from 12 to 32, plus 40 for display, and nothing between the steps.

*Corrected 16 September 2026, and corrected again on the 17th. The second
correction is the one worth reading, because the first one was wrong and being
consistent was what hid it.*

On the 16th this file said 12, 16, 20, 24, 28, 32 at a weight of 1.4, and so did
`HANDOFF.md` rule 18 and one executable spec, while the code said 16 to 40 at
1.5. Three documents quoting a superseded number is not a stronger claim than
the code, so the prose was corrected to match. That reasoning was right and the
result was wrong, because **the argument the code was relying on had already
been retired two hundred lines below the decision.**

The argument was that a stroked glyph drawn on a 24 grid renders a 0.7 CSS
pixel line at 12px, which a display either drops or smears. That is true of a
FIXED `strokeWidth`: a constant 1.8 renders 1.8 at 24 and 0.9 at 12. It is the
very thing the weight fix addressed. `stroke-width` is computed per size now
(then `(UI_ICON_STROKE_PX * 24) / edge`, today `uiIconStrokeWidth(edge)`), which
at 12 is 3 grid units, and 3 units on a glyph drawn at half the grid renders at
**1.5 CSS pixels, not 0.7**. The objection was dead before the ban was written
down.

And 12 is the SECOND MOST REQUESTED SIZE IN THE PRODUCT. Counted across `src`,
197 call sites pass an explicit number, and 12 appears at 35 of them, behind
only 16 at 92. Thirty-five call sites were off-scale by decree while rendering
exactly what they should. Adding the step takes on-scale coverage from 137 of
197 to 172.

**The lesson is about the shape of the mistake, not about icons.** A prose line
and a constant disagreed; the prose was corrected to match the constant; the
two then said the same thing and the agreement read as confirmation. Two things
saying the same wrong thing is harder to spot than one of them saying it alone,
because the check most people run is "do these agree" rather than "is the
argument still true". When correcting a document to match code, read the code's
own reasoning and check it has not been superseded somewhere else in its file.

**40 went in** because empty states and role rows use it, and that part was
right both times. The spec parses the constant instead of restating it. `snapUiIconSize` rounds anything else onto the
nearest one, so a size cannot drift off the grid whatever a caller passes.
BrandIcon sits on an 8px grid from 24 up; below 24 the plinth in the artwork
collapses into a coloured square.

**Vector sources are checked in.** `assets/icons/ui/*.svg`, **88 files**, one per
glyph, generated from this component by `node scripts/build-icon-vectors.mjs` and
verified by `--check`, which exits non-zero if the two copies have drifted. Edit
the TSX and re-run the script, never the other way round. Nobody has to trace a
glyph from a screenshot. See `assets/icons/README.md` for where the artwork
lives. The files are drawn at the 24 step, so they carry `stroke-width="2.25"`.

## Listing and stays detail: plated line glyphs, not glass (29 September 2026)

The founder's `20-listing-fees-glass-now.png` and
`21-listing-amenities-glass-now.png` showed the fee rows and the light, water
and gate rows carrying glass objects at 40px, blurred and inconsistent beside
the bold type. They now draw `DetailGlyph`
(`components/app/listing/DetailGlyph.tsx`): the shared `IconPlate` (a soft
brand-tinted tile with a hairline in light, the navy glass plate at night) with
a brand-blue `UiIcon` at 20, the same treatment as the profile rows. At night
the glyph takes the bright end of the brand blue, as the profile page does.
Measured glyph-on-plate contrast at 390: about 4.9:1 in light and 5.3 to
5.7:1 at night.

An UNDECLARED cost's plate steps back by colour, never by opacity: the lit
blue fill, rim and glow give way to the raised neutral surface and the glyph
draws at `--nf-content-muted` at the full family weight (about 5.6:1 in light,
7:1 at night). The first cut faded the whole plate to 0.55, which left the
glyph at 2.3:1 and 2.8:1, under the 3:1 non-text floor, and read as pale
rather than quiet.

| Row | Glyph |
| --- | --- |
| Asking price | `price-tag` |
| Rent | `key` |
| Agency fee | `briefcase` |
| Legal fee | `scale` |
| Agreement fee | `document` |
| Caution deposit | `verified` |
| Service charge | `building-apartment` |
| Governor's consent | `certificate` |
| Stamp duty | `stamp` |
| Survey and registration | `survey` |
| Buy-from and move-in total | `coins` (large plate) |
| Unexplained remainder | `info` (pending plate) |
| Light | `bolt` |
| Water | `droplet` |
| The gate | `gate` |

The same sweep put line glyphs on the rest of the detail pages: the host and
agent avatar fallbacks (`user`), the rooms line of the move-in block (`bed`),
the stay's property type (`building-hotel`, `building-apartment`,
`house-bungalow`, `pool`, `key`) and the rental panel's safety note
(`verified`). One glass object stays on purpose: the booking-requested
confirmation draws `calendar-check` at 56px, above the 32px where the glass
set reads, and its pop-in is keyed to the object's own tile. The stays
category tiles on `/stays` are browse tiles, not detail rows, and keep glass
too. The listing cards drew no glass. The cost models (`move-in-lines.ts`, `purchase-lines.ts`) keep
their `icon` (a `BrandIconName`) for the listing wizard's preview and carry the
line glyph as `glyph`.

## Deleted: TrustIcon

Six marks (globe, shield, ai-chip, africa, app-store, play-store) that existed
for one consumer, the landing trust strip. The strip was deleted in the
September 2026 landing rebuild, its claims having been the most template-shaped
copy on the page, and the component went with it: a mark set with zero
consumers is where retired branding hides from the next sweep. ADR-011 stands
at two tiers, now with nothing beside them.

## Deleted: Icon3D

`Icon3D.tsx`, `glyphs.tsx` and the `Icon` wrapper were the previous content tier,
hand-built SVG 3D objects on gradient tiles with per-instance paint servers.
ADR-003 chose them; ADR-010 reversed that and they were **deleted**.

This section used to say they were kept in the repository, unused, as a fallback,
and asked the reader not to delete them without the owner's word. That has been
wrong for some time. `apps/web/src/design-system/icons/` contains exactly three
files. Never import `Icon3D`. Nothing enforces that today: there is no pre-commit hook,
and the fix is an eslint `no-restricted-imports` rule (THE_AUDIT DOC-11).
No file under `apps/web/src` imports it today.

Historical name mapping, old vector name to pack object, kept because old
screenshots and old comments still use the left-hand names:
help to support-chat, apartment to homes-sparkle, wallet to wallet-secure,
secure to shield-lock, star to reviews, search to home-search, ai-assistant
to bot-home, verified to shield-check, profile to user-check, location to
pin-map, booking to calendar-check, map to map-route, hotel to hotel-star,
home to house-sparkle, experience to luggage-check, favorites to heart-home,
notification to bell-alert, language to globe-pin, settings to doc-shield.

## Added 25 September 2026 (Tracks E and J)

Line icons, all `currentColor`, added to `UiIcon`: `contrast` (the theme control), and for the property-type and space tiles `storefront`, `briefcase`, `land-plot`, `house-duplex`, `house-terrace`, `house-bungalow`, `tower-penthouse`, `door` and a plain `check` (the selected tick; the verified mark is never used as a tick). In light mode the logo and the role-switch coin sit on one dark ground (`--nf-night-tile-*`, `app/css/light.css`), the ground they were drawn for. The glass objects first sat on that ground too; the founder later chose the object alone, so in light mode they now carry no tile, only a soft blue drop shadow and an edge fade (section 1 above).

Also added by Tracks G and L: `archive` (the inbox archive control) and `price-tag` (Price Check in the side navigation).
