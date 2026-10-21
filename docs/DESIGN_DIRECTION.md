# The Vallo design direction: the images are the law

> **SUPERSEDED on 5 October 2026.** The live bar is `docs/design/PREMIUM-STANDARD.md` and the rulings D78, D81 and D82 in `docs/RULINGS.md`. Kept because code comments cite this file; it governs nothing.
> That document carries the founder's four locked decisions for the
> platform-wide next-generation upgrade: theme leading by surface, matte clay 3D
> for content with line glyphs for chrome (glossy 3D banned), full redesign
> surface by surface, and oversized live figures as the signature. Where this
> file disagrees with it, this file is history. It is kept because code comments
> cite it. Do not take icon, container, glow or motion direction from here.

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

Written 18 September 2026 on the founder's ruling. This file governs the
entire frontend visual sweep. **The reference images in
`docs/design/references/` are the target: the shipped product must look as
close to identical to them as the web can honestly render.** The founder's
words: "make it looks almost exactly if not exactly", "this frontend work is
the most important part for this build". `docs/design/CATALOGUE.md` maps
every file in that folder to its area, flags duplicates (keepers marked) and
lists the off-brand details that must be translated rather than copied.

## 1. How to work from a reference image

1. **Open the image and look at it before building the surface, and again
   after.** Claude Code reads images; every frontend worker builds with the
   governing image open and re-audits the shipped screen against it side by
   side. A surface is not done until a screenshot of the built page and the
   reference read as the same design.
2. **Match composition, hierarchy, glow, spacing rhythm, glass depth, and
   mood exactly.** Implement through the token system (the render's glass is
   our `.nf-glass` ladder, its glow is our glow scale, its type is our
   Poppins and Inter). Where the render's geometry disagrees with a token,
   extend the token system deliberately (new depth, new glow rung) rather
   than hardcoding, and record it in the ledger.
3. **Translate, never copy, the render's mistakes.** AI renders contain
   impossibilities: garbled text, fake blur, inconsistent spacing, and
   occasional off-brand details flagged in the catalogue. The rules that
   OVERRIDE any render, always: one blue family (any warm hue in a render
   becomes its blue-family equivalent: gold rating stars ship blue, the
   off-brand crypto render's gold and orange are ignored entirely and the
   crypto surface is built in the register), no text baked into icons
   (the "HOTEL"-lettered icon in three renders is never cropped or
   copied), real copy never lorem (the garbled AI text in the landing
   fullpage renders is never transcribed; write real copy in its place),
   honest data never invented counts, and no logic errors copied (one
   render pairs yearly rent with nightly date pickers; the market decides
   the panel, as built). The
   neon edge-glow around phone frames in the renders is presentation
   framing for the image, not UI chrome; do not draw a glowing border
   around the real viewport.
4. **THE SHAPE LAW, AND IT IS CLOSED.** Any control that carries TEXT is a
   ROUNDED RECTANGLE on `--nf-radius-control`. Every button, chip, segment,
   tab, filter chip, input, dock label, sheet action and admin control. There
   is no capsule variant of a control and no surface on which one is correct:
   not the city chips, not the search segments, not the filter row, not the
   welcome CTA, not a status pill. **Zero occurrences of `rounded-full`,
   `border-radius: 999px`, `9999px`, `var(--nf-radius-pill)` or
   `var(--nf-radius-control-pill)` on a text-bearing control.** TWO
   EXCEPTIONS, and there are no others: an AVATAR, and a BARE ICON BUTTON
   that carries no text and is drawn round in a governing image, which today
   means the landing nav's search glyph and nothing else. Where no image
   governs a control, the control is a rectangle, because a surface with no
   reference inherits the register and the register's control is the
   rectangle. A dot, a spinner, a progress bar, a range track, a sheet grip,
   a switch track and knob, an avatar ring, a story ring and a skeleton
   placeholder are SHAPES and not controls, and this law does not reach them.
   **THIS SUPERSEDES THE EARLIER NOTE IN THIS SECTION**, which read "control
   shape follows the governing image ... where a render shows pill chips and
   capsule buttons, ship them", **and it supersedes the section 8 amendment
   in `docs/archive/BUILD_06_LEDGER.md`** that added `--nf-radius-control-pill` as a
   second control role. Both are withdrawn. The founder's ruling of
   19 September, with `GOVERNING-landing-desktop-hero.png` open: not one
   capsule in that image, and the only circle in it is the search glyph at
   the top right. `GOVERNING-chat-booking-card.png` settles the icon-only
   case the same way, drawing send, back, call and overflow as rounded
   squares and reserving the circle for avatars. It is not a preference and
   it is not reopened by a render that disagrees: where a render draws a
   capsule, that is a render mistake and rule 3 above governs it.
   `apps/web/scripts/check-css-tokens.mjs` rule 10 (part of `npm run lint`,
   which CI runs; the Vercel build does not) fails on a pill
   radius on a control, in the stylesheets and in TSX, so drift cannot
   reopen it either.

   **AND THE PART A NAME CHECK CANNOT SEE, WHICH IS WHY THIS LAW HAS BEEN
   BROKEN TWICE WITH EVERY GREP PASSING: A SHAPE RULING IS ABOUT THE RATIO,
   NEVER ABOUT THE TOKEN NAME.** The same `--nf-radius-*` value is a rounded
   rectangle on a tall element and a capsule on a short one. We shipped
   `--nf-radius-sm` at 14px on a 28px chip, which is a capsule, and
   `--nf-radius-2xl` at 32px on a 66px dock, which draws semicircular ends,
   and neither contains the word pill, so rule 10 passed both. THE TEST IS
   THE DRAWN RADIUS AS A FRACTION OF THE DRAWN SHORT SIDE: at or above 0.5
   the element is a capsule however it was spelled, and anything above about
   0.35 is looked at on the running page rather than in the file.
   A real-browser sweep (`apps/web/scripts/design/session-b-shots/sweep-orphans.mjs`
   measures it on every route and state) reports that ratio, which is the
   only check that can see this. A source grep proves what was written; it never proves
   what the browser drew. The same lesson, in the same week, as the unlayered
   `*` border reset that read perfectly in the file and resolved to white 8%
   in the browser.
5. **Areas with no reference inherit the register.** Every page the images
   do not cover (edit profile, notifications, verification, host wizard,
   agent console, stories, help, checkout and everything else) is designed
   in the same language: same glass, same glow discipline, same card
   anatomy, same rhythm, so the whole product reads as one object. The
   founder: "the ones we didn't create image should be done too in this
   idea".

### 1.1 The measurement rules, R-A to R-G

Code comments cite these by letter. They settle questions that come up every
time a surface is built to a render, so the same question gets the same answer
everywhere.

- **R-A. Type at the render's size, with a floor, per role.** Every text role
  takes the render's measured size. A role is raised only where that would be
  unreadable, and only to the floor, never by a whole-surface factor: body,
  subtitle, caption and label 11px; a value typed into an input 16px (iOS
  zooms the page below that); names, titles, headings and figures at the
  render's measured size, not scaled.
- **R-B. Controls at the render's height, with a 44px floor.** A pressable
  control takes the render's measured height unless that is under 44px, in
  which case it is 44px. Everything around it keeps the render's proportions.
- **R-C. Containers at the render's measured width.** Where a real string
  cannot fit at the floor sizes, the text wraps before the container grows.
- **R-D. Controls clear the shape review line.** A clean shape sweep means no
  control at or above 0.35 (radius over short side), not only none at 0.5.
- **R-E. The admin console lands on the overview on every entry, including by
  address.** The first request to any `/admin/**` desk in a browser session
  goes to `/admin`, which offers the desk the operator was heading for as its
  first link.
- **R-F. Real function beats pixel parity, and is drawn compactly.** A control
  the product needs and the render does not draw stays, drawn in the render's
  register as compactly as the render's own nearest element.
- **R-G. Proofs are reproducible.** Every fixture harness a screenshot comes
  from is committed under `apps/web/src/app/(dev)/preview/`, behind the preview
  gate, so anyone can re-run the shots and the shape sweep.

## 2. The five governing images (founder-chosen, named in the folder)

- **`GOVERNING-landing-desktop-hero.png`**: the landing page's top. The
  built landing hero follows it: full-bleed dusk villa photograph (the
  matching background plate is in the asset set), glass top nav with logo
  left and Sign in / Get started right, breadcrumb overline
  (PROPERTY / STAYS / INVEST / MANAGE), the two-line headline with gradient
  "reimagined.", sub-line, two CTAs (Explore Properties primary, Explore
  Stays glass), city chips, the floating glass SEARCH PILL with
  Buy / Rent / Stay / Invest segments, a floating verified listing card on
  the photo, and beneath the fold the trusted-stats band and the
  "Everything you need in one platform" glass feature grid. **This is a
  desktop composition: derive the 390px version from it** (stacked, photo
  as the hero background with the calm left-third rule, search pill full
  width, feature grid two-up), keeping every element and the exact mood.
- **`GOVERNING-landing-desktop-fullpage.png`**: the whole landing scroll:
  feature chip row, community band with layered floating listing cards
  (including one honest Third party tag), How Vallo Works four steps,
  Explore-by-category photo tile grid, the Stays band, the take-Vallo-
  with-you app band, and the footer with newsletter field. The rebuilt
  landing follows this section order and treatment on desktop and phone.
- **`GOVERNING-feed-plus-bloom.png`**: the social feed. Location chip
  header, story ring row with "Your story" +, For You / Following glass
  toggle, post cards (avatar, verified tick, handle, time, text, photo,
  heart/repost/reply/share counts), and THE + BUTTON: a floating glass
  circle bottom-right above the dock that blooms open into three glass
  lozenge actions (Post, Story, Review) fanned on a curve with line
  glyphs. The founder: "make it exactly how it's please, when click it
  should be exactly like that". Build the bloom with real spring physics,
  reduced-motion fallback, and the three actions wired to the real
  composers.
- **`GOVERNING-chat-booking-card.png`**: messaging. Thread header with
  counterpart avatar, name, verified tick, context line and location; rich
  BOOKING CARD inline in the thread (photo, name, stars, location,
  check-in/check-out/guests grid, room row with price and nights chip,
  View booking details primary + Contact hotel glass buttons); bubbles
  (theirs glass-dark left, mine blue right with read ticks); composer with
  attach and send. Cards in chat are REAL and FORWARDABLE: listing and
  booking cards can be shared into any thread and render this way. The
  existing three thread faces restyle to this register.
- **`GOVERNING-flip-mid-turn.png`**: the side flip. The phone stays
  static; the SCREEN CONTENT rotates as a glass card mid-turn with a
  glowing edge, the incoming face carrying the glass building mark. The
  built `SideFlip` already does this mechanically; restyle the card edge,
  cover and glow to match this image's intensity.

## 3. Founder rulings on chrome (these override the renders where stated)

1. **The bottom dock has FIVE destinations plus context.** The renders show
   four; the founder chose five: on the Property side **Home, Search, Feed,
   More, Profile**; on the Stays side the first slot becomes **Stays**.
   "More" opens the side navigation drawer. The dock keeps the floating
   glass treatment and per-side swap already built, restyled to the
   renders' dock look.

   **The dock's look, the founder's ruling of 29 September 2026 (the later
   one that day; it SUPERSEDES the morning's "light-mode dock is a dark
   neon capsule", and the latest ruling wins):**
   - **In light mode the capsule, the round More button beside it and the
     tray that button opens are WHITE, with brand-blue line glyphs and
     brand-blue labels.** One white material for all three
     (`app/css/light.css`, "THE DOCK IN DAYLIGHT"). **In dark mode they
     keep the navy neon glass** (`app/css/shell-m.css`, "THE DOCK").
   - **No container behind the current or tapped item, in either theme.**
     The travelling pill is not drawn. The current tab is its filled glyph,
     its label at the brand ink and a heavier weight, and a 4px dot under
     the label; the current tray item is the same (a ringed glyph tile and a
     heavier blue word, no box). `aria-current` is unchanged.
   - **The capsule is a little wider:** the dock row sits 10px from each
     edge (or the safe area, if larger), 12px wider in total than before,
     still centred, no overflow at 320.
   - **The centre "+" is 50px** (inside the 56px tab, so the capsule does
     not grow), the brand-blue button with a white plus and a glow, and the
     logo pill's running "snake" rim light, in both themes. The ring is
     drawn once and turned on the compositor (`nf-edge-turn`, the round dock
     button's turn in `edge-m.css`); under reduced motion, data saving and
     the Calm or Off motion setting the rim is a steady glow.

   **The theme default is DARK for everybody who has not chosen (the
   founder, 29 September 2026: "anyone that enters our website should be on
   dark mode ... severely important").** The operating system's
   `prefers-color-scheme` never decides the default: only an explicit Light
   (or an explicit System) in the theme control paints light. The server
   renders `data-theme="dark"` without a cookie and the before-paint script
   (`lib/theme/theme.ts`) resolves the same before first paint, so there is
   no light flash on the landing, the auth screens or the app; the native
   shell starts dark too (`capacitor.config.ts`). Pinned by
   `lib/theme/theme.test.ts` and the first-visit half of
   `tests/theme-choice.spec.mjs`.

   **The support hero ("Hi ..., how can we help?") follows the theme:** a
   white card with dark text and the blue action in light, the raised navy
   card at night (`components/support/SupportHero.tsx`).
2. **The hamburger is incorporated even though the renders lack it.** The
   in-app header carries a hamburger (line glyph) that opens the side
   drawer, on every in-app page, both sides. Header anatomy: hamburger,
   logo lockup, bell with unread dot, avatar (per the feed render's
   header).
3. **The side drawer is a designed surface, per the drawer render** (see
   catalogue): user block at top (avatar, name, view profile), then the
   rows that are NOT in the dock: Messages, Notifications, Saved,
   Bookings (Trips on Stays side), Inspections, AI Assistant, **Crypto**,
   workspace rows (Agent Mode where earned, Console where admin), Become
   an agent, Settings; at the foot the FLIP COIN as the star (two-faced
   glass coin, other side's mark, "Switch to Stays"/"Switch to Property"
   with one-line sub, edge tease on hover, spin on press) and the theme
   toggle beneath it.
4. **Crypto is a new side-nav feature.** A market surface driven by the
   CoinGecko API with GeckoTerminal for pair/DEX data: prices, movers,
   simple detail pages, in the glass register. (It was also to surface
   wallet funding in crypto through Yellow Card; the wallet was retired on
   25 September 2026, and crypto is now accepted only through Yellow Card,
   settling in naira straight to each party; see `docs/MONEY_ARCHITECTURE.md`.) Server-side proxy route,
   key from the founder (`COINGECKO_API_KEY`), cached responses, graceful
   dark state until the key lands, display-only (no trading, no advice
   copy). No new colour: price-up is emerald, price-down is rose.
5. **Icons: the blue glass objects everywhere content icons appear.** The
   repo's glass pack (the dark objects in `public/brand/glass/`) is the source. Where a
   render uses a glass object we do not have (catalogue lists them), CROP
   it from the reference PNG, alpha-key it with the existing
   `scripts/cut-icon-ground.mjs` pipeline, file it through
   `scripts/icon-manifest.mjs` with a lowercase-hyphen name, and use it,
   provided it carries no baked text. The dock capsule and headers stay on
   the stroked UiIcon tier restyled to the renders' line weight, and since
   29 September 2026 so do the side drawer, the rail and the dock's More
   tray (the Track M glass map is deleted). No black-and-white content icons
   anywhere the renders show glass ones.
6. **Photography ships now.** The background plates and property photos in
   the reference folder (catalogue's ASSETS list) are the product's
   imagery: the landing hero plate behind the hero, the skyline plates
   behind sections, the aurora plate behind auth, and the property photos
   attached to the demo listings so cards and galleries finally show real
   rooms (bedroom, bathroom, kitchen, exteriors, hotel rooms, resort,
   restaurant). Wire them through the existing scene manifest and
   `listing_photos` seeding paths, sized and compressed properly
   (next/image, correct sizes, no multi-megabyte originals shipped raw).
7. **The profile, settings, stays and admin renders in the folder
   govern their surfaces** (the wallet render governs nothing since the
   wallet was retired) exactly as the five governing images do theirs;
   the catalogue names which file rules which page. Profile follows the
   new profile render (cover, avatar, counts, tabs); its children (edit
   profile, followers) inherit. Feed inner pages (post thread, place
   pages, stories) inherit the feed register.

## 4. The definition of done for every visual surface

A surface closes only when ALL of these hold:
1. Screenshot at 390px dark matches the governing image's composition,
   depth and mood side by side, with the comparison kept with the change.
2. Both themes: the surface is checked at 390px in dark and in light.
   Light mode was removed on 23 September 2026 and restored on 25 September
   (`docs/design/LIGHT_MODE_REMOVED.md`); the palette is the
   `:root[data-theme="light"]` block in `tokens.css` plus
   `apps/web/src/app/css/light.css`, and
   `apps/web/scripts/design/light/sweep.mjs` screenshots both themes.
   The auth screens (sign in, sign up, the email steps, the code, the reset
   and the recovery) are no longer pinned dark: the auth layout follows the
   document's theme and `app/css/auth.css` sets its ground, fields and lines
   for each theme. First run (`WelcomeStage`) still pins dark. Auth is
   checked at 390x844 and 360x740 in both themes, with the primary button
   in the first screen with the keyboard up.
3. Every control on the screen is FUNCTIONAL end to end (the ONE LAW):
   real action, real data, real state change, notification where deserved.
   Nothing ships as a picture of a feature.
4. Reduced motion, keyboard focus, live regions, safe areas and 44px taps
   survive the restyle.
5. Desktop is derived from the mobile character (rail world, wider grids),
   not invented fresh, except the landing which has its own desktop
   governing image.
6. `npx tsc --noEmit -p apps/web` and the narrow tests pass before the
   lead commits.
