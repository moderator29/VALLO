# Vallo marketing: the design brief

Everything in `scripts/marketing/` makes pictures of the live product for other people to see: App Store and Google Play screenshots, the first month of social posts, and the launch video. This is the one brief all of it follows, so that 100 images and a video look like one brand.

## 1. What Vallo is, in one breath

A Nigerian app for homes, hotels, shortlets and restaurants, with one account: rent or buy a home and see the full move-in cost before calling anyone, talk straight to the owner, landlord or agent inside the app, book a room, reserve a table, and pay without Vallo ever holding the money. English, Hausa, Yorùbá and Igbo. It is for everyone looking for a place and for owners, hosts, hotels and restaurants; it is **not** an agents' tool first.

## 2. Copy rules (non-negotiable; these are the product's own rules)

- **No em dashes** anywhere (the founder's rule, enforced in the product).
- **"Verified" only about people and businesses, never about listings or homes.** Say "owners, hosts, hotels and restaurants with the verified mark have been checked by a real person at Vallo". Never "verified listings", "verified homes".
- **No promise words without a mechanism:** no "safe", "safely", "secure", "protected", "guaranteed", "insured". "Vallo never holds your money" is true and may be said. Money moves "straight to the owner, the host or the business, through a licensed payment processor" (Paystack may be named).
- **"Vallo charges no inspection fee."** Confirmed by the founder on 30 September 2026, and on the live landing page ("No inspection fee"). It is about Vallo's own charges: say "Vallo charges no inspection fee", never that nobody will ask for one.
- **No valuation words:** never "worth", "valuation", "appraisal", "value of your home". Price Check shows what places nearby are *asking*.
- **No invented numbers:** no user counts, ratings, reviews, testimonials, "#1", "best", "cheapest", "thousands of listings". Amounts shown in pop-up cards are illustrative and must match amounts visible on the captured screens where one is shown (the example villa: rent ₦18,000,000 a year, move-in total ₦26,100,000; Lagoon Crest Resort ₦150,000 a night).
- **Launch line:** "Coming soon on iPhone and Android." Never draw Apple or Google logos, and never draw or imitate their store badges. The one exception is the films' live ending (video/FACTS.md, "The ending"): Apple's and Google's official badge files, unmodified, by their rules, published only once Vallo is in both stores.
- **Never show** an email address, a phone number, or a real person's name. The QA account's first name "omojuni" on the home greeting is acceptable; its email is not (the Settings capture is scrolled past it).
- Every listing, stay and restaurant live today is labelled Example on its own page. Do not crop an Example notice out on purpose, and do not claim anything on screen is available.

## 3. Brand

| Token | Value | Use |
|---|---|---|
| Ink | `#010118` | the app's night canvas |
| Deep navy | `#02063F` → `#010118` | dark grounds |
| Electric | `#0069FE` (600 `#0056D0`, 700 `#003F98`) | the brand blue, buttons, glows |
| Quiet blue | `#5C9FFF`, sky `#8FD3FF` | gradients on text, highlights |
| Paper | `#FFFFFF`, mist `#F3F7FF`, studio grey `#F2F3F6` | light grounds (like the reference mockups) |
| Warm accent | orange `#FF6B1A` → peach `#FFB27A` | sparingly: the orange of the onboarding art, sunsets in the photos |

- **Type:** Poppins 600/700 for headlines (tracking −0.03em, 2 lines max), Inter for everything else. Files: `apps/web/public/fonts/*.woff2` (Poppins 600/700 latin, Inter variable) and `scripts/marketing/node_modules/@fontsource/poppins` (other weights), `@fontsource/instrument-serif` for a rare editorial italic accent (one or two words, never a whole line), `@fontsource-variable/inter`.
- **Logo:** `apps/web/public/brand/vallo-icon.png` (app icon), `vallo-wordmark.png` (on dark), `vallo-wordmark-light.png` (on light), `vallo-mark.png`. Never recolour or stretch them.
- **Brand art:** `apps/web/public/brand/onboarding/step-1..4-dark.webp` (1080 × 1440): the product's own fuzzy 3D scenes (houses on blue velvet hills, a shield, chat bubbles and a lock, an orange arch with stairs). Use them as hero art and backgrounds; they match the reference mockups' style.
- **Photographs:** `apps/web/public/brand/photos/*.jpg` (dusk villas, pools, skylines, restaurants), the same photographs the product serves.
- **Vallo's 3D identity icons** (`apps/web/public/brand/3d/<name>@2x.webp`, 256 px, 53 clay objects in the brand blue with orange accents: analytics, apartment, assistant, bank, bell, boxes, buy, calendar-booked, calendar-pending, camera, card-secure, celebrate, checklist, city, clock, coin, contract, earnings, envelope, explore, folder, gift, handover, home-small, home-verified, hotel, id-check, keys, land, list, local-talks, map, megaphone, passcode-lock, pay, phone-code, power, price-tag, receipt, rent, report-flag, restaurant, saved-heart, search, shield, shortlet, stay-rated, support, team, toolbox, verified, video, villa). The founder's ruling, 30 September 2026:
  - **Social campaign:** they are the campaign's signature, used the clean way (section 6a): one icon per post, naming the post's subject, placed deliberately with a soft contact shadow. Never scattered, never a cloud of objects.
  - **Store images:** none, except on the two "You got paid" style images (section 6a).
  - **Films:** only where they are part of a real platform component, and small; otherwise not at all.
  - Never show one larger than about 260 px on a 1080-wide canvas: the sources are 256 px. Don't mix them with Fluent stickers in one image. Never use `brand/glass/` (the retired glass set). "shield" and "card-secure" must not suggest "safe", "secure" or "protected" in the copy next to them.
- **The motion-film language** (see `video/REFERENCES.md`) suits stills too:
  - platform components (cards, chips, pills, toasts, buttons) lifted off the screen as floating bodies;
  - type in mixed sizes with one word in blue;
  - hand-drawn underlines, rings and sparkles;
  - a title pill with the Vallo mark.
- **Stickers (Fluent 3D, now secondary: only for an object the 3D identity set lacks):** Microsoft Fluent 3D emoji, MIT licence, `scripts/marketing/node_modules/@lobehub/fluent-emoji-3d/assets/<codepoint>.webp` (256 px; never show larger than ~260 px on a 1320-wide canvas). Useful: house `1f3e0`, house with garden `1f3e1`, key `1f511`, bell `1f514`, calendar `1f4c5`, speech balloon `1f4ac`, check `2705`, sparkles `2728`, party popper `1f389`, plate `1f37d-fe0f`, bellhop bell `1f6ce-fe0f`, bed `1f6cf-fe0f`, luggage `1f9f3`, palm `1f334`, sunset `1f305`, cityscape `1f3d9-fe0f`, hotel `1f3e8`, credit card `1f4b3`, bank `1f3e6`, lock `1f512`, magnifier `1f50d`, pin `1f4cd`, Africa globe `1f30d`, robot `1f916`, light bulb `1f4a1`, blue heart `1f499`, star `2b50`, glowing star `1f31f`, rocket `1f680`, handshake `1f91d`, waving hand `1f44b`, mobile phone `1f4f1`, laptop `1f4bb`, megaphone `1f4e3`, memo `1f4dd`, clock `1f552`, clinking glasses `1f942`, stopwatch `23f1-fe0f`.
- **Line icons:** `scripts/marketing/node_modules/lucide-static/icons/<name>.svg` (ISC) inside pills and pop-up cards.
- **Do not use** the retired glass objects (`brand/glass/`) anywhere. (The earlier ban on `brand/3d/` is lifted by the founder's ruling above: the new 3D identity icons are welcome, mainly in the social campaign.)

## 3b. The pop-out container (16 October 2026, the pump.fun blueprint)

The founder sent five pump.fun App Store images as "a perfect blueprint" and
asked for them in both the store set and the films. What those images do, and
what Vallo does in answer. The parts are in
`scripts/marketing/store/callouts.mjs` (stills) and
`scripts/marketing/video/films/popout.js` (film), drawn from one description.

- **The container is the product, not a card we drew.** pump.fun's floating
  card is one row of their own app, lifted off the glass, blown up about 15
  per cent, given a thick bright edge and dropped back over the place it came
  from. So the first container in every image is `mags` (stills) or `lift` /
  `windowLift` (films): a real component, at size, inside one heavy rule.
  **Its box must sit on the component's own edges** — `films/blocks.py` reads
  them off a capture — so nothing can ever be cut.
- **A drawn container is the second one at most**, for what no screen shows in
  one place: a total, a breakdown, a rule, a promise. Four contents: a line, a
  stat, label/value cells on their own plate, a row of counters.
- **Solid, and thick edged.** Solid ink, one heavy rule in the sky blue
  (#8FD3FF), no hairline, no corner marks, nothing translucent, no fuzzy
  glows. The founder's correction, the same day: "ours need to be black, thick
  edges... make the things clean clear!!! Redo them all."
- **The stage panel.** A solid black rounded field inset from the image's
  edge, as the blueprint's is solid green, that the props and badges overhang.
- **The round badges.** The blueprint's scattered coins: solid discs with the
  same rule, carrying one of the brand's 3D objects, a line glyph or the Vallo
  mark. Two to four per image, one white among them at most.
- **The key word in a box.** One word of a headline may sit in a rounded box
  instead of taking the sky colour (`keyStyle: "chip"`). It works on the first
  line only: under a line with descenders it eats the line gap.
- **The oversized outlined figure**, stroked not filled, beside a container,
  for the one loud number.
- **The 3D objects are welcome in the store images now.** The 30 September
  ruling ("store images: none, except the two 'You got paid' images") is
  superseded by this brief, which asks for them by name. The size rule holds:
  never over about 260 px on a 1080-wide canvas.
- **Copy rules are unchanged.** Section 2 governs every word in every
  container: no invented numbers (a figure must be printed on the screen under
  it), no testimonials, no promise words, "verified" only about people.

## 4. Pop-up cards (the "You got paid!" moments)

Floating cards that overlap a phone's edge, like a notification that just arrived. Glass: white at 92% (on light) or navy `rgb(10 16 60 / .82)` with a 1.5 px `rgb(120 170 255 / .35)` edge (on dark), backdrop blur, radius 28–36 px, soft long shadow. An icon chip (Fluent sticker or lucide icon on a tinted circle), a bold title, one line under it, optional amount, optional "now". Only phrasing that describes what the product really does:

- "Payment settled · ₦1,800,000 straight to your bank" (for an owner; never "held by Vallo"; a wallet is held by our licensed payments provider)
- "Room booked · Lagoon Crest Resort · 3 nights"
- "Table for 2 · Tonight, 8:00 PM · Harbour Lights Kitchen"
- "New message · Vallo Examples replied" (match the thread on screen; never "the owner replied" over a thread with an agent)
- "Inspection set · Saturday, 11:00 AM"
- "Agreement confirmed by both of you"
- "Checked by a person · Verified mark added"
- "New home for your saved search"
- "Passcode on · Vallo locks when you step away"

## 5. Phones

- App Store images: the island handset (camera pill at the top). Google Play images: the Android handset (punch hole). Social posts: either.
- Photoreal phones come from the 3D studio in `scripts/marketing/phone3d/` (see its README). Screens are full displays with the status bar composited: `docs/marketing/screens/<id>-ios.png` and `<id>-android.png` (1320 × 2868), built by `scripts/marketing/screens.mjs` from the captures in `docs/marketing/source/`.
- **Store images show whole phones**, big and clear, never cut by the image edge (the founder's ruling). Close-up crops and steep angles belong to social posts and the video.

## 6. Quality bar

The references in the repo root (`IMG_6727.png` … `IMG_6739.jpeg`) and `docs/design/references/` set the bar: Dribbble-grade product renders, generous space, one idea per image, crisp type, real depth. Every image is reviewed at full size before it ships: no text touching an edge, nothing cropped by accident, no blurry screen, no two images alike.

## 6a. The premium bar (the founder's ruling, 30 September 2026, evening)

The founder rated the first sets 20% overall and 5% on premium, and wants 90%: "like a very big design team", clean, sharp, beautiful, next gen. X's App Store screenshots are the example: every image on one unified backing, the app shown plainly and big, one headline. This section overrides anything looser above.

**Everywhere (store and social)**
- **One idea, three elements at most:** a headline, the app, and at most one supporting piece. Everything else goes.
- **Unified backings.** The same ground, pixel for pixel, wherever it is used. No photographs, textures, patterns, grain, vignettes, bokeh or colour glows behind anything.
- **Sharp.** Screens come from the 1320 × 2868 displays and are never upscaled. Render at 2× and bring down with Lanczos. Never let Chromium rasterise a 3D-transformed image layer: tilt phones with the 3D studio or a pre-warped homography. All type is live text.
- **Type is the design.** Poppins 600, sentence case, tracking −0.03em, line height 1.05, two lines at most. At most one key word in sky `#8FD3FF`. Sublines are optional, in Inter 500 at 60% white, and one line only.
- **A strict grid.** The same margins, headline position, sizes and phone scale across the set. Alignment is exact: optical centring for the phone, and text on the grid.
- **One device look.** One model per store, one colour, one light direction and one soft contact shadow (for the store, no contact shadow; see below).
- **Banned:** hand-drawn squiggles, sparkles, rings, particles, glows, stickers (Fluent), "bodies" floating around a phone, lifted duplicates of on-screen UI, and pop-ups placed over rows of text.

**App Store and Google Play (35 each)**
- **The backing:** all 35 of a store share one night ground, a quiet vertical gradient from `#050B3D` (top row) to `#010118` (bottom row), rasterised once and identical in every image, so the set reads as one strip, as X's does. The screens are the app's dark theme.
- **The layout:** the headline centred at the top on the same baseline in every image (Poppins 600, line height 1.08, no line wider than the phone plus 50 px), then the phone: big, centred and whole, never cut by the image edge. The App Store phone is 1080 px wide (82%), Play's 946 px (66%). No icon: at store thumbnail size it does nothing.
- **The phone:** the photoreal handset with the studio's `night` light, a ring that keeps a bright rim on all four sides, so the black frame separates from the navy. No contact shadow: on the night ground it cannot read. The screen is laid in flat with one Lanczos step, never upscaled.
- **Files:** 24-bit RGB PNG, no palette, no alpha.
- **Extras on two images only:** the "You got paid" style, with one of section 4's pop-up cards each ("Room booked" and "Payment settled"), opaque, with the Example chip, overhanging one phone edge by 50 to 90 px and staying at least 64 px from the image edge and 20 px from the camera and from any control it leaves uncovered. It covers the header's controls whole or stays clear of them, and never cuts a button or a word.
- **Connected pairs:** one or two, where a single tilted phone runs across the seam between neighbouring images, and only where the seam cuts no word (today one: 04 and 05).

**Social campaign (30 posts and the X header)**
- **Three grounds only:** Night (the store's ground), Electric (`#0A6CFF` to `#0048C8`, vertical) and Mist (`#F3F7FF`). Most posts are Night, some are Electric, and at most four are Mist. On a Mist post, light screens (the `-lt` captures) and ink type; never a dark screen on a light ground.
- **The same brand furniture on every post:**
  - the Vallo wordmark at the same size and corner;
  - the same small footer line ("Coming soon on iPhone and Android." or "vallospaces.com");
  - story safe zones kept clear (top 250 px, bottom 340 px).
- **The signature:** one 3D identity icon per post, the post's subject (keys for homes, hotel for stays, restaurant for tables, bank for payments, assistant for the AI, verified for the mark, passcode-lock for the passcode, and so on). It is shown at 200 to 240 px on a clean area with a soft contact shadow, never over text or a screen.
- **The product moment:** either one big, crisp phone, or one real component shown cleanly on its own, at native resolution with a soft shadow. Examples of a component: the move-in cost card, a booking summary, a chat bubble. Not both.
- **The 12 remakes:** each keeps its reference's composition (where the phone sits, its angle and crop), rebuilt in this system. A prop that cannot be made photoreal (the pegboard, a hand) is dropped for a clean ground.
- **Carousels:** one continuous ground. Seams cross only ground or bezel, never text.

**How it is judged.** A fresh critic places each set beside top-tier App Store and campaign sets (X, Apple, Revolut, Monzo, Airbnb). It scores each image from 1 to 10 on five things: clean, consistent, sharp, typography and restraint. The set ships at an average of 9 or more with no image under 8, and with every honesty rule in sections 2 and 4 met.

## 7. Sizes and where files go

| Output | Size | Folder |
|---|---|---|
| App Store (6.9") | 1320 × 2868 PNG, no alpha | `docs/store/screenshots/app-store/` |
| Google Play phone | 1440 × 2560 PNG, no alpha, under 8 MB | `docs/store/screenshots/google-play/` |
| Play feature graphic | 1024 × 500 | `docs/store/screenshots/google-play/` |
| Instagram / Facebook feed | 1080 × 1350 (4:5) or 1080 × 1080 | `docs/marketing/social/` |
| Stories / Reels / TikTok cover | 1080 × 1920 | `docs/marketing/social/` |
| X and LinkedIn | 1600 × 900 | `docs/marketing/social/` |
| X header | 1500 × 500 | `docs/marketing/social/` |
| Launch video | 1920 × 1080, 60 fps, H.264 + AAC | `docs/marketing/video/` |

All stills are rendered at 2× in Chromium and brought down with a Lanczos filter, so they are sharp at every size.
