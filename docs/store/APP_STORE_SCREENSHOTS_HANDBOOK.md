# App Store and Google Play screenshots: the handbook

Produced on 30 September 2026 and redrawn on 14 October 2026 against that afternoon's recapture of the live app. This records what is in `docs/store/screenshots/`, how every image was made, the sizes each store takes, and which images to submit. Everything in it can be regenerated with two commands (section 8).

**The short version.** There are 35 images for each store, in store order, made to DESIGN.md section 6a (`scripts/marketing/DESIGN.md`):

- every image sits on one night ground, the headline is at the top, and the app is shown big, whole and straight on;
- the App Store images use the handset with the camera island, at 1320 x 2868, and the phone's frame is 82% of the image's width;
- the Google Play images use the Android handset with the punch hole, at 1440 x 2560, and the phone's frame is 66% of the width;
- the frame of every phone is lit so it reads as a bright line on the dark ground;
- the app's screen is laid on flat, as sharp as the capture allows;
- two images carry a card that has just arrived, and one pair (04 and 05) shares one tilted phone across its seam;
- Play also has a 1024 x 500 feature graphic.

---

## 1. What is here

```
docs/store/screenshots/
├── app-store/              35 images, 01-...png to 35-...png, 1320 x 2868, 24-bit RGB PNG, no alpha
├── google-play/            35 images, the same names, 1440 x 2560 (9:16), 24-bit RGB PNG, no alpha, each under 8 MB
│   └── feature-graphic.png 1024 x 500, 24-bit RGB PNG, no alpha
├── app-store-overview.jpg        the 35 App Store images side by side, as the store shows them
├── google-play-overview.jpg      the same for Google Play
├── app-store-overview-grid.jpg   the 35 seven to a row, with their file names, for review
└── google-play-overview-grid.jpg
```

Each file is named `<NN>-<slug>.png` after its place in the list (section 3) and its headline, so the same number is the same image in both stores. Each store folder holds exactly these 35 (plus Play's feature graphic).

## 2. What to submit

The App Store takes up to 10 screenshots per display size; Google Play takes up to 8 per device type. The first three are what a person sees in search results before opening the listing. The pair (04 and 05) goes in whole or not at all: both images, next to each other and in order, since on its own each half shows a phone cut at its edge.

- **App Store (10), in this upload order:** `01`, `02`, `03`, `04` + `05` (the pair, with "Room booked"), `06`, `07`, `08`, `12`, `13`.
- **Google Play (8):** `01`, `02`, `04` + `05`, `06`, `07`, `12`, `13`; plus `feature-graphic.png`, which Play requires.

The picks are the store order's first eight or ten, plus 12 and 13. They cover homes and the move-in total, one account, stays and booking, the money rule, a stay's own page, the assistant, the verified mark, and hosts with their payout.

- They never hold two screens that look alike.
- To lead on the whole cost rather than the home, swap `03` forward; it is the strongest single image in the set.

## 3. The 35

Every screen is the live product at <https://www.vallospaces.com>, in its dark theme (23 in light), captured on **14 October 2026** as the QA member account (the welcome pages signed out), and composited into a whole phone display with its status bar by `scripts/marketing/screens.mjs`. The capture ids are the files in `docs/marketing/source/` (see `capture-report.json` there); they are the same `n-`, `f-` and `sc-` captures the October films use, so the store set and the films now show one and the same build.

| # | Headline | Screen (capture id) | Notes |
|---|---|---|---|
| 01 | Find your next home / in Nigeria | `n-home` | the home's own hero reads "Find your next home" |
| 02 | The move-in total, / before you call | `n-listing` | the Maitama villa, its Example chips and the foot bar "₦26.1m Move-in total" |
| 03 | Every fee, / added up | `sc-listing-cost` | "What you will actually pay": rent, agency fee, legal fee, agreement fee, refundable caution deposit |
| 04 | Hotels, shortlets / and restaurants | `n-stays` | the pair's left half; the stays home's own tiles are Hotels, Shortlets, Restaurants and Local talk; card "Room booked · Lagoon Crest Resort · 3 nights", Example |
| 05 | Book a room / in a few taps | `n-stays` | the pair's right half |
| 06 | Vallo never holds / your money | `sc-payments` | the payments page says it in its own words; it opens on "No payments yet" for this account |
| 07 | See the stay / before you book | `n-resort` | Lagoon Crest Resort |
| 08 | Ask the AI assistant / any time of day | `sc-assistant-start` | "AI Assistant. Always here. Ask anything." The assistant's long answer is left out: it still shows raw markdown asterisks |
| 09 | Save favourites, / compare later | `sc-saved` | "4 places saved", Compare |
| 10 | Find a restaurant / you love | `sc-restaurant` | Harbour Lights Kitchen; the example restaurant has no photographs of its own, so the page carries a "No photographs yet" chip |
| 11 | Featured homes, / see them all | `n-home-featured` | the home scrolled to its Featured listings row |
| 12 | Each verified mark, / checked by a person | `sc-verification` | "Each one names what a person at Vallo actually looks at" |
| 13 | Have a property? / Put it on Vallo | `f-host-start` | "Add a workspace"; "I own the property: List it yourself. No agency fee."; card "Payment settled · Straight to your bank", Example, no amount |
| 14 | Search homes / across Nigeria | `n-search` | 40 properties found; For you, Near me, New listed |
| 15 | Ask to view, / schedule a visit | `sc-thread` | the thread's own buttons: "Ask to view this home", "Schedule a visit" |
| 16 | Vallo speaks / your language | `n-welcome-yo` | public, Yorùbá; subline "English, Hausa, Yorùbá and Igbo." |
| 17 | Price check, / area by area | `sc-price` | "Price Check. What are properties near here asking?" |
| 18 | Pick your dates, / see the price | `n-stays-dates` | British dates, 16/10/2026 to 19/10/2026 |
| 19 | Homes to buy, / not just to rent | `n-home-premium` | the Premium listings row, led by the Karsana terrace for sale at ₦95m; header cleaned (section 6) |
| 20 | Rooms and nights, / set by you | `f-host-rooms` | Grand Vista Hotel's room types and the nights they are on sale |
| 21 | Inspect first, / then pay on Vallo | `f-agreements` | the page's own first line: "Payment opens as soon as the inspection report is submitted and both of you confirm the agreement" |
| 22 | Filter down / to what you need | `sc-filters` | price range, bedrooms, bathrooms, "See 52 homes" |
| 23 | Light or dark, / your call | `f-host-home-lt` | the one light capture in the set |
| 24 | Rooms, amenities, / all laid out | `n-stay` | Grand Vista Hotel: sleeps, room types, star, the amenity chips and "About this stay" |
| 25 | The guest pays / the price you set | `f-host-bookings` | the page's own words: "The guest pays the price you set, with nothing added" |
| 26 | Earn the / verified mark | `f-agent-dashboard` | "Verification in review ... the tick appears on all of them at once when the check clears" |
| 27 | New homes, / as they arrive | `n-home-new` | the home scrolled to its New listings row; header cleaned (section 6) |
| 28 | Your calendar, / night by night | `f-host-calendar` | October 2026, a rate on every night |
| 29 | Restaurants, / all in one place | `sc-restaurants` | "Book a table on Vallo. The restaurant confirms" |
| 30 | Paste the message / you already send | `f-agent-listing-edit` | "Start from your WhatsApp message ... Nothing is sent to anybody." |
| 31 | Pro adds tools / to your workspace | `f-pro` | the page's own sentence: "Pro adds tools to the workspace you already run" |
| 32 | One account, / every business | `f-host-settings` | three businesses, all live, on one account |
| 33 | The agent's fees, / spelled out | `f-rent-movein` | "Agency fee: the agent's own fee, 10.0% of a year's rent", under the total move-in cost |
| 34 | All homes, / list or map | `n-search-all` | the screen's own heading; 52 properties found, with the Map button |
| 35 | Vallo. Real estate, / done right. | `n-welcome-en` | public; subline "Homes, hotels, shortlets and restaurants." |

**Screens the 14 October pass did not take.** The lock and passcode screens, the help centre, Appearance, sign-up, a listing for sale, the listing and stay amenity sections, and the signed-out stay dates were not recaptured, and the welcome carousel was captured on its last slide only. The images that used them (old 03, 15, 17, 19, 20, 21, 23, 25, 27, 28, 30, 31, 32, 34) were pointed at other 14 October screens and their headlines rewritten to what those screens say. Recapturing those routes would let the old lines come back.

The layouts are in `scripts/marketing/store/shots/premium.mjs`.

**The order.** The first swipe shows 1, 2 and 3 and then the pair (4 and 5). No more than two screens without a photograph or artwork come in a row. Screens that look alike at store size sit at least nine places apart, and never both in the picks:

- 03 and 33 (cost lines), 30 places apart;
- 11, 19 and 27 (the home's rows), 8 and 16 places apart;
- 14 and 34 (search), 20 places apart;
- 07 and 24 (a stay's own page), 17 places apart;
- 10 and 29 (the same restaurant), 19 places apart;
- 20, 25 and 28 (the stays workspace), 5 and 8 places apart.

The Maitama living-room photograph, which the example stock reuses for several listings, leads 02. It also leads 09 (the Chevron Drive house uses the same stock photograph) and 14's first card, and appears twice on 27. That is the example stock's own repeat.

**Changes from round 2:**

- **The restaurant pair is gone.** A search over 450 poses of `restaurant` and `restaurants` found none whose seam crosses no word, so 10 is a plain image and 11 is a different screen.
- **The thread (round 2's 22) is cut.** Its shared listing cards carry no Example tag.
- **02 now shows `listing`**, so position 2 no longer reads "Kept by / Paid to Vallo Examples".
- **Search is `search-villas`**, whose Map button hides no Example chip. `search-buy` is cut.
- **Headlines rewritten:**
  - "Each verified mark" and "Back where you left off", for line spacing;
  - "Rooms, amenities, / all laid out", so line 1 no longer ends on "and";
  - "Inspect first, then pay on Vallo" and "One account for all of Vallo", so they no longer repeat the screen's own words;
  - "Real help, from real people", for line spacing on Play;
  - in round 4, "Power, water / and the gate" (17) and "Filter down / to what you need" (22), for line spacing and so 17 no longer copies its section's title.

### The system (DESIGN.md section 6a)

- **One ground.** Every image sits on the same raster, a vertical gradient from `#050B3D` (the top row reads 5, 11, 61) to `#010118` (the last row reads 1, 1, 24). `compose.mjs` draws it pixel by pixel, not the browser, so it is identical in every file. Nothing else is drawn on it: no photographs, glows, textures or vignettes. On the one ground, the pair's seam disappears.
- **One grid, no icon.** The headline sits at the top and is centred on its ink (a line's letters, not its type box, are centred, to the pixel). It is set in Poppins 600, tracking −0.03em, leading 1.08, white, on two lines, at the same size and on the same baselines in every image:
  - App Store: 112 px, the block from y 140, the phone from y 490 to 2768;
  - Play: 100 px, the block from y 130, the phone from y 470 to 2470.

  The cap height is 2.7% of the image's height in both stores, so the two sets read the same size in their store rows. No line is wider than the phone's frame plus 50 px: 1130 px on the App Store (the frame is 1080 px wide) and 996 px on Play (946). The widest, "checked by a person", is 1114 px and 995 px. Play's type is 100 px rather than 112 because at 112 that line and "Find your next home" would overrun its measure. `compose.mjs` fails any headline that would need shrinking to fit. Sublines appear only on 16 and 35, in Inter 500 at 60% white (30 px on the App Store, 34 on Play), at least 60 px above the phone's rim. The pair sets its headlines flush left, on the same baselines.
- **One phone, lit for the dark ground.**
  - Every image has the same handset, colour (black titanium) and light, from the 3D studio in `scripts/marketing/phone3d/`: the island handset on the App Store, the punch-hole handset on Play.
  - The studio's "night" light is a ring of light around the phone, a little in front of it and a little behind. Its frame's rounded front edge catches one continuous highlight on all four sides, the bottom included. Measured on the finished App Store images, it is at least 4 px wide at luminance 150 or more on every side, with peaks of 181 to 202. The Android's narrower edge takes a wider, brighter ring and reads at least 3 px wide.
  - There is no shadow, because on this ground it cannot read.
  - On the plain images the phone is straight on, at the same size and position, centred on its screen: the side buttons make the body's box lopsided, so the screen is centred rather than the box.
- **Screens laid on flat.**
  - For a straight-on phone, the capture is brought down to the display's size in one Lanczos step and laid into the display. The page is drawn twice, with the display black and with it white; the difference is exactly the part of the display that shows. This covers its rounded corners, the camera cut-out and a card drawn over it.
  - The screen then matches a direct Lanczos reduction of the capture: 0.99 of its edge energy and 0.98 of its fine detail.
  - The glass reflection is kept, at half the studio's default, and lifts the screen by about one level.
  - The two tilted phones keep the studio's own mapping of the capture.
- **Two cards, one rule.** 04 and 13 each carry one of DESIGN.md section 4's cards: opaque navy, the Example chip, no amount, two lines, 1.3 times round 2's size (a 45 px title), so they read at store size.
  - Each overhangs the phone's left edge (50 px on the App Store, 80 on Play past the rim beside the header). It keeps at least 64 px from the image edge and at least 20 px from the camera and from every control it leaves uncovered. `compose.mjs` fails any card that breaks that.
  - Its shadow is limited, so the ground next to every image edge stays pixel-identical.
  - On 13 the page is scrolled to its foot, so its title sits right under the header. The card takes the band between the camera (or the clock) and the title, 22 px clear of each, and so is a little smaller there than on 04 (0.82 of the set's card size). It covers the menu and the logo whole and stays clear of the bell.
  - On 04 the card is level with the header and lies over the tilted phone's rim.
    - App Store: 24 px from the menu button and 37 px clear of the greeting; its rounded top corner overlaps the rim by 11 px, measured where the corner's curve meets the rim (at 45 degrees).
    - Play: 22 px from the menu and 23 px clear of the greeting ("Good evening" is whole); its corner overlaps the rim by 9 px.
    - `compose.mjs` fails the card if it comes within 20 px of the menu, the greeting or the camera, or if its corner overlaps the rim by less than 8 px.
- **One pair.** 04 and 05 share one phone, tilted by the 3D studio across their seam (the stays home, leaning right). The phone slides left until the seam crosses no word: it passes clear of the area line and the hero's headline, and between two words of the small line under it. Across the two images the phone is whole; only the seam between them cuts it.
- **Files.** 24-bit truecolour PNG (IHDR colour type 2), no alpha, no palette.

## 4. The sizes each store takes

Checked against the stores' own pages on 29 September 2026.

**App Store** ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)):

| Display | Accepted portrait sizes | Required? |
|---|---|---|
| 6.9" | 1260 x 2736, 1290 x 2796, **1320 x 2868** | The top of the scaling chain: supply it and every smaller iPhone uses it |
| 6.5" | 1284 x 2778, 1242 x 2688 | Only if 6.9" is not supplied |
| iPad | various | Only if the app runs on iPad. Vallo is iPhone only |

One to ten screenshots per display size and language, in .png, .jpg or .jpeg, with no alpha channel. Every image here is RGB with no alpha, which `compose.mjs` checks as it writes each file.

**Google Play** ([Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)):

| Asset | Rule |
|---|---|
| Phone screenshots | JPEG or 24-bit PNG, no alpha; each side 320 to 3,840 px; the long side at most twice the short side; up to 8 MB each. The images here are 1440 x 2560 (9:16) |
| Count | At least 2 to publish, up to 8 per device type |
| Promotion eligibility | At least 4 screenshots of at least 1080 px, 9:16 portrait or 16:9 landscape |
| Feature graphic | 1024 x 500, JPEG or 24-bit PNG, no alpha. Required |

## 5. How the set was checked

- Every image was looked at at full size, both halves.
- The pair was proofed side by side with a 40 px gap, as the stores show them.
- PIL checks on every file:
  - the size, mode RGB, IHDR colour type 2 at 8 bits;
  - far more than 256 colours;
  - the top row reads 5, 11, 61 and the bottom row 1, 1, 24;
  - the whole top and bottom rows, and eight points on the corners and mid-edges, are identical in every image of a store (the pair's seam sides excepted);
  - every Play file is under 8 MB.
- `compose.mjs` also checked each image as it drew it:
  - every word and card is at least 40 px inside its image;
  - every headline line has at least 4.5:1 contrast;
  - no headline had to shrink;
  - every card keeps 20 px from the camera and from the controls it leaves uncovered;
  - the space between a headline's two lines, measured column by column, is at least 16 px (App Store) or 14 px (Play).

## 6. Before you submit: things to know

- **Every listing, stay and restaurant on screen is example stock**, because that is all the platform holds today. Their own pages show the Example notice and cards show the Example tag; no image crops either out. The two cards (04, 13) carry the Example chip; their names and nights are illustrative, from DESIGN.md section 4, and neither shows an amount.
- **The QA account's home area is "Ibeju-Lekki, Lagos State"** (the founder's choice). It shows on 01, 04 and the feature graphic, and in a pill on the home and stays hero photographs.
- **The QA account's first name, "omojuni", is on screen** on the home greetings (01, 04) and on 20 ("Hi omojuni") and 15 ("Welcome back, omojuni"). No email address or phone number appears in any image.
- **Two headers are cleaned (19 and 27):** both captures are the home scrolled to a row, and the labels that scroll under the translucent header are rebuilt from the unscrolled home of the same pass (`n-home`). `clean.mjs` holds the map. No capture needs the column patch now.
  - These captures were taken scrolled, and the app's translucent header let what scrolled under it show through as faint ghost text.
  - `scripts/marketing/store/clean.mjs` finds the header's own parts (the status bar, the menu, the logo and the bell) on an unscrolled capture of the same header. It keeps them as captured and sets the rest of the band to the band's own colour. Nothing below the header's hairline is touched.
- **Product text that is shown but never lifted:**
  - "Kept by / Paid to Vallo Examples" on the fee lines (11, 33): the example lister's name;
  - "Nobody can pay to be higher" (14), a ranking promise that is not in the facts file;
  - "within 1 day, and within 4 hours" (20);
  - "5 minutes away" (30);
  - the counts "52 properties found" (14) and "69 stays" (18, 34);
  - the onboarding art's "₦450,000" (21) and "₦2,150,000" (35), both labelled Example.

  None is repeated in a headline or a card.
- **Four product fixes, for a later recapture.** None blocks this set:
  1. An Example tag on listing cards shared into a chat. The thread can then return, under "Talk to the owner / or the agent".
  2. Rename the example lister from "Vallo Examples" to "Example Lettings". 11 and 33 can then be submitted, and "Kept by / Paid to Vallo" no longer reads as Vallo taking fees.
  3. No "No photographs yet" chip printed on a photograph (10, 29). Show placeholder art with the chip, or relabel it "Illustrative photo".
  4. Translate the onboarding buttons. The Yorùbá slide on 16 still says "Continue".

## 7. What the captures wrote to production

Only to the QA member account, and only through the product's own screens: sign-ins (each writes a "New sign-in to Vallo" notification) and the assistant's consent and question (08, 28). `scripts/marketing/capture/plan.mjs` lists every capture and its steps.

## 8. Regenerating

Everything lives in `scripts/marketing/`:

| File | What it does |
|---|---|
| `capture/plan.mjs`, `capture/run.mjs` | The live captures, into `docs/marketing/source/` |
| `screens.mjs` | Turns each capture into a whole phone display with its status bar, into `docs/marketing/screens/` |
| `phone3d/` | The 3D studio that draws the photoreal handsets; its `night` light is the ring used here (an option; the studio's defaults are unchanged) |
| `store/shots/premium.mjs` | The 35 images: the grid, the order, the pairs and the two cards |
| `store/clean.mjs` | Cleans the ghost labels out of the three scrolled headers |
| `store/compose.mjs` | Renders both stores: drawn at twice the size in Chromium on a transparent page, laid over the ground, brought down with a Lanczos filter, the flat screens laid in, written as 24-bit RGB PNG with no alpha. Checks every phone, word and card against the image's edges, every headline's contrast and measure |
| `store/overview.mjs` | Writes the two overview strips (`--bg` for another page colour) and, with `--grid`, the named review grids |

From the repository root, with the displays in place:

```bash
# Both stores and Play's feature graphic, at 2x (about 15 minutes on four CPUs with a warm phone cache, 25 cold).
node scripts/marketing/store/compose.mjs --feature
#   a few images, one store, or a quick proof folder that touches nothing here:
#   ... compose.mjs --only 5,18 --store app-store --proof /tmp/proof

# The overview strips and the named review grids.
node scripts/marketing/store/overview.mjs --grid
```

**To change the words:** edit the headline in `store/shots/premium.mjs` and run `compose.mjs --only <n>`. Keep to DESIGN.md section 2 (no em dashes, "verified" only about people, no promise or valuation words, no invented numbers), to two lines, and within the measure (the phone's width plus 50 px).
