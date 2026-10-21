# Brand marks: the glass system

> **SUPERSEDED on 5 October 2026.** The live bar is `docs/design/PREMIUM-STANDARD.md` and the rulings D78, D81 and D82 in `docs/RULINGS.md`. Kept because code comments cite this file; it governs nothing.
> That document carries the founder's four locked decisions for the
> platform-wide next-generation upgrade: theme leading by surface, matte clay 3D
> for content with line glyphs for chrome (glossy 3D banned), full redesign
> surface by surface, and oversized live figures as the signature. Where this
> file disagrees with it, this file is history. It is kept because code comments
> cite it. Do not take icon, container, glow or motion direction from here.

> **THE LOGO CHANGED ON 8 OCTOBER 2026 (D81, and D82 the same day: one colour
> set in both themes). Read section 0 first.** Every
> description below of the logo as a glass tile, five glass towers, a swoosh,
> a keyed extraction or a re-toned "daylight twin" is history.

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

**Rewritten 16 September 2026, and the thing it used to say is now wrong.**

This file used to open by saying there are two 3D languages in the brand, that
the logo is glass and neon and the 87 objects are soft matte clay, and that **new
marks must match the clay, not the logo**. That was correct when it was written
and the world moved. The founder has supplied ten sheets of glass artwork in the
logo's own language, and the clay set is what is being replaced. **The
instruction is now the opposite: match the logo.**

The old section 3 of this file was a commission for twenty four transaction and
status marks. **That commission has been delivered.** Section 4 below says which
arrived, under which names, and which one must not be used.

Read `docs/archive/HANDOFF_03_FRONTEND.md` for the direction, `docs/ICON_SYSTEM.md` for
the two tiers, and `docs/archive/FRONTEND_REVAMP.md` for the full replacement map.

---

## 0. The logo, from 8 October 2026 (D81)

The founder supplied a new mark and wordmark
(`docs/design/references/2026-10-08/logo-mark-new.png`,
`logo-wordmark-new.png`): four towers, three blue and one orange, inside an
orbit ring that sweeps from cyan to royal blue to orange; and VALLO in
cyan-to-royal-blue letters with an orange triangle in the A and an orange
sweep on the O. They replace every older mark and wordmark on the platform.

**They are vectors now.** `scripts/brand/logo-art.mjs` redraws both from the
references, in the references' own pixel coordinates, so the drawing can be
laid over the render and checked shape for shape. No ground and no glow are
baked in; a glow, where a surface wants one, is CSS and on dark only.

**One colour set, never recoloured (D82, the founder, 8 October 2026).** "the
logo im seeing it changing color on light mode ... make the logo and the text
to be not change color should be same either on light mode or dark mode". So
the mark and the wordmark are the founder's own colours (`COLOURS` in
`logo-art.mjs`: cyan `#3FDCFF` to electric `#1C86FF` to royal `#1238C8`, the
orange `#FFA04A` to `#FF8A3C` to `#F2561E`) on every ground and in both themes.
The D81 day palette (deepened blues for paper) and reverse palette (white
letters for the brand blue) are retired, and so is the founder's earlier rule
of 29 September that put the light-theme `.nf-logo` on a navy pill with lights
lapping its rim: D82 supersedes it. Nothing may recolour, filter or swap the
logo per theme. Where the artwork's own blue would vanish (the brand-blue auth
block and its focal ring) the lockup stands on a white plate
(`--nf-logo-plate`), the same in both themes; the artwork itself never
changes. `vallo-mark-light.*` and `vallo-wordmark-light.*` stay on disk only
as byte-for-byte copies of the one artwork, so an old reference still draws it.

**One build writes every file.** `node scripts/build-brand-logo.mjs` writes
the SVGs, the transparent PNGs (`vallo-mark.png` 1024 wide,
`vallo-wordmark.png` 1664 by 352), `vallo-logo.png` (the square lockup on
navy), `vallo-icon.png` (the app icon), the favicon (a real 16, 32 and 48
ICO), `public/pwa/icon-*.png`, `apple-touch-icon.png`, the maskable icon,
`apps/web/assets/icon-*.png`, every Android `mipmap-*/ic_launcher*.png` (the
adaptive foreground is now transparent), the iOS `AppIcon`, the older
startup and sign-in cuts, the welcome coin's face (a solid navy disc with the
logo's blue rim; it was the old glass coin with the old towers), the Android
notification icon `drawable/ic_stat_vallo.xml` (the mark as a white
silhouette; it was a door in an arch), and two generated modules:
`apps/web/src/lib/brand/logo-geometry.ts` (the mark in parts, for
`LogoMarkLive`) and `apps/web/src/lib/brand/og-logo.ts` (data URIs for the
share cards Satori draws). Then `node scripts/build-email-lockup.mjs` (the
email band) and `node scripts/build-og-image.mjs` (the default share card).
`scripts/build-brand-marks.mjs` and `assets/brand-sheets/vallo-wordmark-source.png`
(the extraction from the old glass tile) are deleted.

**Drawing it in the app.** `Logo`, `LogoMark` and `LogoWordmark`
(`design-system/brand/Logo.tsx`) render the one SVG each, in both themes.
`LogoMarkLive` draws the mark inline so it can move: `reveal` (the towers rise
out of the ring, the ring sweeps from its cyan tip to its orange end; the
sign-out threshold) and `orbit` (a light runs round the ring; the landing's
loading screen and the sign-in verifying panel). `app/css/logo-motion.css`
holds the motion; reduced motion, data saving, Calm and Off draw it at rest.
The launch image still carries no mark at all (D68c).

**The sweep is a test.** `design-system/brand/logo-sweep.test.ts` fails if any
file in the web app, the native projects, `assets/`, `packages/`, `scripts/`
or the Supabase email templates is byte-for-byte one of the old logo files
(by SHA-256, under any name), if the old path data appears in any source file,
if a call site still declares the old 614 by 587 or 758 by 167 boxes, or if
the shipped SVGs drift from `logo-art.mjs`. Since D82 it also fails if any
logo SVG carries a colour outside the founder's set, if a kept twin differs
from the one artwork, if source picks a logo file or class by theme, or if
any stylesheet filters, recolours or theme-scopes a logo selector. The D81
recolourings, the old glass coin face and the PWA install screenshots that
showed the old glass mark are on its list of retired files.

---

## 1. The house style, and it is the logo's style now

**Glass.** A transparent object lit from inside, rendered on black, with an
electric blue body, a bright rim where the light catches an edge, white where a
surface is nearly normal to the light, and a soft bloom around the whole thing.
No plinth, no white paper, no contact shadow. Three-quarter view from slightly
above, same as before.

The important property, and the one every rule below follows from: **these
objects are additive light.** The render is close to `object + black`, so the
glow is not decoration around the mark, **the glow is part of the mark**, and its
brightness is its opacity. Crop it off and the object stops looking like the
logo.

**And "brightness" means the brightest channel, never luminance.** Luminance
weights blue at 0.0722 and the subject here is blue, so a luminance key reads the
most saturated parts of the mark as background and keeps the white highlights.
The first cut of these objects made exactly that mistake and came back pale cyan.
`scripts/cut-icon-ground.mjs` carries the full account.

The clay set is the other language: soft matte white, brand blue only on the
part carrying the meaning, on a white rounded-square plinth, lit as a studio
photograph. **The two cannot coexist in one product.** Every surface moves
together or the set reads as two sets.

---

## 2. What exists today

Ten unique sheets, in `assets/brand-sheets/`. Twelve were supplied and two were
byte-for-byte duplicates, confirmed by checksum before deletion.

**210 objects, all sliced, keyed to alpha and named.** 139 are delivered as
files in `apps/web/public/brand/glass/`: 103 objects at 256px, 24 light twins,
and 12 wide hero scenes at source resolution. 3.3MB in total, against 6.5MB for
the 87 clay objects still live in `apps/web/public/brand/icons/`.

`scripts/icon-manifest.mjs` is the authority on what each of the 210 is and which
drawing of a repeated object wins. `assets/README.md` says how to rebuild the
whole set from the sheets, which is three commands.

**Nothing is wired up.** The glass set sits beside the clay set rather than on
top of it, so it can be reviewed in place, at real sizes, in both themes, before
anything moves.

---

## 3. Light and dark, which is a pairing and not a filter

**This was tested rather than assumed**, and the evidence is two images in this
repository: `docs/img/glass-on-four-grounds.png` and
`docs/img/glass-in-daylight.png`. Both artworks, against all four real surfaces
in `packages/design-tokens/src/tokens.css`.

| | Dark surfaces | Light surfaces |
| --- | --- | --- |
| **The dark artwork** | Excellent. No halo, no edge anywhere | Usable, but its glow becomes a soft blue field around a roughly square footprint |
| **The light twin** | **Fails.** The white tick inside `seal-check` turns black | Excellent |

**No filter crosses that gap.** Not `invert()`, not `hue-rotate()`, not an
opacity change, because the difference between the two is **which parts of the
object are transparent**. A frosted white object keyed off white leaves the white
as the transparent part, so on a dark ground it inverts.

So a mark that must work in both themes needs **two files, not one recolouring**,
and the two share a name: `glass/<name>.png` and `glass/light/<name>.png`.

**Only the 24 transaction marks have a twin today.** For the other 79 objects the
answer is not 79 more files. **The dark artwork on a navy chip in daylight was
tested and is visibly the most premium the set looks anywhere**, and it removes
the square halo the bare object leaves on white. `--nf-icon-ground` is already the flat plate `BrandIcon`
draws behind an untiled object, and it already resolves to `transparent` in the
light theme because the clay artwork needs nothing there. Pointing it at the base
navy solves 79 objects with one token.

Commission the light pass of the remaining six sheets only for the places an
object must sit bare on paper with no chip allowed: **email, print, and a
light-theme empty state where a chip would read as a hole.**

One honest limit. **A glass object is see-through by design**, so its alpha is
partial across the interior. That is correct on a dark surface and reads thin on
a pale one, and it is exactly why the chip works: the chip gives the glass
something to be glass against.

> **What ships now (28 September 2026).** Light mode was removed on 23 September
> and restored on 25 September (`docs/design/LIGHT_MODE_REMOVED.md`). The
> restored light theme does not use the navy chip or the light twins. The
> founder chose the object alone on white: no ground, a soft blue drop shadow,
> and a fade over the outer tenth of the image (`apps/web/src/app/css/light.css`,
> "THE ICON TILES"). The twin files are still on disk under
> `public/brand/glass/light/` and nothing references them. The reasoning above
> is kept as the record of what was tested.

---

## 4. The commission, delivered

The old section 3 of this file ordered twenty four marks by name, each with the
state it serves and a description of the object to build. **Sheet `CF5A4150` is
that order, filled.** Twenty three of the twenty four are on it, and several
match the written description object for object: mark nine was specified as a
"blue-banded strongbox with a naira note half inside", and index 09 is a
blue-banded strongbox with a naira note half inside.

**The delivered marks keep the names this file gave them**, because a document
that already specifies a name is the authority and renaming a delivered
commission strands the document that ordered it. Three deviations:

| Ordered as | Delivered as | Why |
| --- | --- | --- |
| `hourglass-blue` | `hourglass` | A colour does not belong in an object's name. The light twin of this object is not blue |
| `info-round` | `info` | The roundness is not the meaning |
| `payment-pending` | **not delivered** | Index 03 is a plain naira coin, not a pending state, so it is named `coin-naira` rather than pressed into a role it does not play |

**`payment-pending` needs no commission.** Pending is covered twice over by
`seal-pending` and `hourglass`.

### One mark is delivered and withheld

**`escrow-hold`, mark nine.** This file said of it: build it, do not ship it
until escrow exists. **Escrow does not exist**, and
`apps/web/src/lib/legal/terms.tsx` now says in as many words that Vallo does not
hold your money in escrow, so an escrow mark on a screen would be the artwork
contradicting the contract.

It is cut, named, and in `WITHHELD` in the manifest so that nothing can reach for
it by accident. Since 25 September 2026 Vallo never holds customer money
([ADR 0002](adr/0002-vallo-never-holds-customer-money.md)), so there is no
screen this mark could ever belong on. It stays withheld.

### The defect this mark pointed at (resolved by Track A)

> **Dated note, 28 September 2026.** The wallet screen described below no
> longer exists. `components/app/wallet/` was deleted when the wallet and escrow
> were retired on 25 September 2026. The paragraph is kept as the record.

`apps/web/src/components/app/wallet/BalanceBreakdownSheet.tsx` rendered, to a
user: "Escrow moves money out of it and holds it until both sides are done",
"Money in escrow", "What you have in escrow", and "You have paid this into
escrow. It comes back if the deal does not happen." **The wallet screen and the
terms of service say opposite things about where somebody's rent money is.** That
is not an artwork problem and it is the highest-priority item in
`docs/archive/FRONTEND_REVAMP.md`.

---

## 5. What is still to commission

Small, and much smaller than expected.

**Two objects**, both in live use, both with no glass equivalent anywhere on the
ten sheets:

| Name | What it is for | Interim |
| --- | --- | --- |
| `homes-sparkle` | Several homes, recommended | `cluster-home` |
| `house-sparkle` | One home, featured | `modern-house` |

**One improvement rather than a gap.** `support-chat` is currently taken from
`2676C1FC` index 14, which is a bare headset, where the object it replaces is a
headset with a speech bubble. The headset is a fair drawing of support and it
keeps four live call sites working with no edit. A bubble-and-headset object
would be better.

**The light pass of six sheets**, per section 3 above, and only for the surfaces
named there.

Everything else is either already drawn, substituted in
`docs/archive/FRONTEND_REVAMP.md` section 2.6, or dead artwork that should be deleted
rather than redrawn.

---

## 6. Rules when new files come back

- **Rendered on black, not on white, and not on transparent.** The cutout is
  computed from the black ground; an object supplied on a transparent background
  has already had that decision made for it, usually badly. Give us the render.
- **Square, at least 1024px** for an object; a hero scene may be wider than it is
  tall and must not be squared.
- **The glow must be inside the frame.** A generous margin is not wasted space,
  it is the mark. The commonest way to ruin one of these is to crop tight.
- **No text, no letters, no numbers, anywhere in the artwork.** This platform
  ships `packages/i18n` and text baked into an image cannot be translated.
  `9795AD6E` index 23 is a hotel with the word HOTEL rendered into it as pixels;
  it is named `hotel-sign` and is used by nothing, for exactly this reason.
- **Filenames are lowercase with hyphens**, and where an object replaces one that
  exists, **it keeps that object's name**. That is what makes a swap a file change
  rather than a code change.
- **Add it to `scripts/icon-manifest.mjs` and rerun.** Never drop a file straight
  into `public/brand/glass/`: the manifest is what makes the set reproducible,
  and a file nobody recorded is a file nobody can regenerate.
- **Never mix these with `UiIcon`** in one row. `UiIcon` is the 40 stroked
  navigation glyphs, these are content objects, and the two tiers do not meet.
  See `docs/ICON_SYSTEM.md`.
- **No orange, amber, gold or purple**, ever, in any of them.
- **Check the render against the set before accepting it**, on the night canvas
  and on a white card, at 24px and at 96px. If the rim light, the bloom or the
  blue is different, regenerate rather than ship an object that looks like a
  visitor.

---

## 7. Every place money moves, and what the person sees while they wait

Added 15 September 2026. HANDOFF 02 section 24 calls pending "the most neglected
state in this product and the most anxious one for the user", and asks for every
place money moves with what the user sees while they wait. This is that list,
read from the code rather than from memory.

> **Dated note, 28 September 2026.** The four wallet rows and "pay from wallet"
> below no longer exist: the wallet was retired on 25 September 2026 and every
> payment is now a Paystack payment split at the moment it is made
> (`docs/MONEY_ARCHITECTURE.md`). The table is kept as the 15 September record.

**The finding is not that pending states are missing. It is that they are
inconsistent, and that the worst one is on the screen carrying the most money.**

| Where | Action | What the person sees while it happens | Verdict |
| --- | --- | --- | --- |
| Wallet, fund | `fundWallet` | Button spinner **plus** a `role="status" aria-live="polite"` region | Good |
| Wallet, crypto top up | `startCryptoDeposit` | Button spinner plus a live region | Good |
| Wallet, withdraw | `withdraw` | Button spinner, a live region, and a sentence saying the withdrawal shows as pending until the bank confirms it | **Best in the product. This is the pattern** |
| Wallet, transfer to a user | `transferToUser` | Button spinner plus a live region | Good |
| Return from Paystack | `verifyFunding` | A banner with a live region and "Checking with the payment service. This takes a moment." | Good |
| **Checkout, pay by card** | `card-starting`, `card-redirecting` | **A `loading` prop on a button. No sentence, no amount, no live region** | **Worst, and it is the largest amount of money on the platform** |
| **Checkout, pay from wallet** | `wallet-paying` | **A `loading` prop on a button. Nothing else** | **Worst** |
| Agent application | submitted | A status page, no in-flight state | Weak |
| Listing submitted for review | `SUBMITTED` to `UNDER_REVIEW` | A status pill, no consequence line | Weak |

### The three things missing from every one of them

Even the good ones. This is where the marks in section 4 earn their place, and
**they now exist**: when this list was written they were a commission, and
`seal-pending` and `hourglass` have since been delivered on `CF5A4150`.

1. **A mark.** Every pending state in this product is a spinner. A spinner is
   the absence of a design. `seal-pending` and `hourglass` were drawn for exactly
   this and neither is used yet, because nothing is wired up.
2. **The amount.** A person who has just sent 850,000 naira wants to see
   850,000 naira on the screen that says it is going. Only the withdraw sheet
   does.
3. **The consequence, which is the line that removes fear.** "This usually takes
   a few seconds. If it takes longer, your money has not moved and nothing is
   lost." Only the withdraw sheet has anything like it, and it is the one people
   are least anxious about, because withdrawing is money coming back.

### One defect found and fixed while writing this

`PayPanel.tsx` painted the payment FAILURE branch in `--nf-state-warning`, which
resolves to `--nf-cyan-400`, which is this product's PENDING colour:
`--nf-status-pending` is defined as that same token. **A declined payment was
drawn in the pending colour**, on the one screen where the difference decides
whether somebody believes their rent money is gone. `--nf-state-error` existed,
resolves to rose and was reachable from nowhere on that path.

That is the same mistake the design system notes record about stars borrowing
the warning token to obtain a gold: a state token reused for the colour it
happens to be, rather than for the state it means.

It is now rose, with the cross glyph rather than a bell. **The missing pending
sentence and the missing mark are not fixed**, because those need the shared
confirmation component rather than another bespoke branch, and building a tenth
bespoke success screen is the thing section 24.3 says not to do.

### And the marks that are already right

`user-verified` is already the scalloped rosette with a white tick, which is
precisely the mark the founder's reference screenshot rendered in orange. **The
anatomy does not need redesigning**, and it survives the move to glass: it exists
on `B04429B0` index 17, under the same name, so the swap keeps it.

The generic version of the same shape is `seal-check`, and the reference's
anatomy is worth taking while its execution is everything this brand is not.

---

## 8. The logo in daylight, and the icon plate

Added 29 September 2026. **The logo half of this section is history since
8 October 2026: section 0 is the logo now.** The icon plate below still
stands.

> **Superseded the same day for the lockup.** The founder then asked for the
> navy pill back, with a light "like snakes" running round its edge,
> "all areas or place our logo is on light mode". So in light every `.nf-logo`
> lockup is the navy pill showing the NIGHT artwork, and two arcs of light
> lap its rim everywhere it appears (`app/css/light.css`, "THE LOGO"); the
> lap stops to a steady rim under reduced motion, data saving and Calm/Off.
> The daylight twin below now serves only a bare `LogoMark` outside a pill
> and outside a night island.

**The logo has a daylight twin.** `public/brand/vallo-mark-light.png` and
`public/brand/vallo-wordmark-light.png` are the night files re-toned for
paper, pixel for pixel the same drawing. They replace the navy pill and the
two looping edge lights that the light theme used to wrap round the night
artwork, which the founder read as wrapped oddly and not bright enough.

The recipe, so the twins can be rebuilt from any new night render:

- **Alpha.** The glow is keyed away by re-ramping alpha linearly from 0.35
  (transparent) to 0.80 (opaque). The wordmark is almost binary already
  (70,168 transparent pixels, 48,200 above 90 per cent). On the mark this
  removes the bloom, which is correct on paper: on white the bloom reads as
  a blue smudge, not as light.
- **Colour.** Each pixel's whiteness (its lowest channel, the counterpart of
  the brightest-channel key in section 1) sets a tone between a deep ink
  `#0038B0` for the glass body and `#2E7CFF` for the catch-lights, with a 0.8
  curve. The modelling survives: the white catch-lights that vanished on
  paper (28 per cent of the wordmark's opaque pixels) become the brighter blue.
- **On white** the ink is 9.6:1 and the catch-light is 3.9:1 (WCAG relative luminance), so
  every opaque pixel clears the 3:1 a graphic needs.

`Logo.tsx` renders both files and `app/css/light.css` shows one, keyed on
`data-theme`, which the before-paint script sets. A night island
(`data-theme="dark"`) keeps the night artwork. The hidden twin loads lazily,
so the first switch of theme in a session can show the logo a moment late.

Draw the logo through `Logo`, `LogoMark` or `LogoWordmark`, never a raw
`<Image>` of `vallo-mark.png` or `vallo-wordmark.png`: a raw image has no twin
and paints pale night glass on a light page. The dark-island surfaces
(`WelcomeScene`, `FirstRun`, `SystemMoment`) are the exception, because they
are night in both themes. Emails have their own lockup
(`vallo-email-lockup.png`).

**The header is a night island in both themes** (founder reference 05): the
app header and the site bar carry `data-theme="dark"`, and in light they are
a solid navy band, so the logo there is the night artwork on the ground it
was drawn for. The daylight twin is for the logo on paper: the desktop rail,
the drawer, the loading screen and the menus.

**A proper render beats the extraction**, as it does for the night mark: ask
for the lockup rendered as ink on white, and replace the two files under the
same names.

**The icon plate.** In daylight every glass object stands on one pale plate,
`--nf-icon-plate-day` (`#F1F5FC`) with a brand-tinted hairline, and the
artwork takes one quiet step deeper (`--nf-icon-art-day`, brightness 0.8 and
saturate 1.15). It replaces the heavier saturate, contrast and drop
shadow filters and the ten per cent edge fade, which made the objects glossy
stickers beside the flat line glyphs and ate the edges of small ones.
