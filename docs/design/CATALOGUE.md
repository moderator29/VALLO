# Vallo design reference catalogue

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

**Light mode was removed on 23 September 2026 and restored on 25 September 2026** (`LIGHT_MODE_REMOVED.md`). It ships today with a Light / Dark / System choice (default Dark). Rows below that describe light-theme captures from before the removal, or the light twins, are kept as history: the restored light theme does not draw the twins or the navy icon plate (`apps/web/src/app/css/light.css`).

Source: `docs/design/references/` and its two SUBFOLDERS. Every UUID file was opened and inspected. Exact duplicates were confirmed by MD5 checksum, so "exact duplicate" below means byte-identical, not merely similar.

**THIS CATALOGUE INDEXED ONLY THE TOP LEVEL FOLDER UNTIL 22 SEPTEMBER, AND THAT WAS A MAP WITH THE MOST IMPORTANT ROADS MISSING.** Two subfolders hold twenty three files between them, eleven of them the founder's own corrective targets and twelve a complete new governing set, and this document had never mentioned either. Every worker doing image work has been reading a stale map. A FOUNDER TARGET BEATS A GENERATED RENDER, ALWAYS, and that is the ordering rule for every conflict below.

---

## `references/roles/`: the twelve governing images of 22 September

**Read `docs/design/references/roles/README.md` before using any of them.** It is the authority on this set and it lists what is translated rather than copied. The table here exists so that somebody reading the catalogue cannot miss the folder; it does not replace that file.

These twelve are the target for HANDOFF 09 Tracks G, N, O and P. Each is a row of phone screens carrying a whole flow rather than a single surface.

| File | Screens | Governs |
|---|---|---|
| GOVERNING-01-switch-home-sheet-drawer.png | 3 | The property home page, the dock with the raised centre switch, the Switch profile sheet, the side drawer carrying the same switch |
| GOVERNING-02-add-workspace-chooser.png | 3 | Add a workspace: the three supplier doors, the selected state, the "what we will ask you for" overview |
| GOVERNING-03-register-owner.png | 4 | Owner registration, including proof of ownership with "I have none of these" as a first class answer |
| GOVERNING-04-register-agent.png | 4 | Agent registration, including fees in the open with a live tenant total |
| GOVERNING-05-register-firm.png | 4 | Firm registration: RC and LASRERA, prove you work here, your team, under review |
| GOVERNING-06-list-property-1-the-property.png | 4 | Listing wizard: what, where with the map pin, the rooms, condition and availability |
| GOVERNING-07-list-property-2-light-water-media.png | 4 | Listing wizard: light, water, amenities, photos with the video walkthrough uploading |
| GOVERNING-08-list-property-3-money-and-id.png | 4 | Listing wizard: the price, what a tenant actually pays, check it over, and the listing ID screen |
| GOVERNING-09-stays-home-switch-and-doors.png | 4 | The Stays home page, the Stays switch sheet, the three stays doors, the first hotel page |
| GOVERNING-10-set-up-hotel.png | 4 | Hotel setup: details, room types, rates with cancellation, facilities and photos |
| GOVERNING-11-set-up-shortlet-and-restaurant.png | 4 | Shortlet: your place and house rules. Restaurant: your restaurant, tables and hours |
| GOVERNING-12-review-desk-notification-search-by-id.png | 4 | The admin review queue, the listing under review with its actions, the lister's notification centre, search by listing ID |

**Translated rather than copied, from that README, repeated here because it is the part people skip:** every capsule becomes a rounded rectangle on `--nf-radius-control` and the test is the ratio of radius to short side, not the token name; round avatars stay round; the dock reads "Saved" in the renders and ships as "Feed"; the stays renders read "Explore" and ship as "Search"; "Short Let" is in image 01's category row and does not ship there; the Apple Maps mark in image 03 is not ours; and every count, price and statistic in them is example content.

---

## `references/founder/`: the founder's own targets and defect captures

**Eleven files, and they split into two kinds that must never be confused.** A file named `-target` is what a surface SHOULD look like and governs the work. A file named `-as-shipped` is a photograph of OUR OWN LIVE PRODUCT that the founder sent to show a defect. An as-shipped file governs nothing. It is evidence. Building towards one would be building towards the bug.

| File | Kind | Governs, or shows |
|---|---|---|
| GOVERNING-home-markets-target.png | TARGET, governing | The in-app phone home. The CHROME authority for the whole product: the desktop hero has no bottom dock and its header floats over a photograph, so the header, the dock, the market tiles and the city chips can only be read honestly here. Sampled values are recorded in BUILD_06_LEDGER 13.6. |
| GOVERNING-home-markets-target-2.jpg | TARGET, variant | The same screen as a NINE tile grid (Rent, Buy, Shortlets, Hotels, Resorts, Guest Houses, Restaurants, Commercial, Land) over an invest band and a featured cities row. Useful for the tile anatomy and the arrow affordance. THREE THINGS ARE NOT COPIED: every tile carries an invented count ("12,450+ listings"), which rule 15 forbids and which the `platform_stats` fix exists to prevent; the hotel glyph has the word HOTEL baked into the artwork, which rule 5 forbids; and the body copy carries an em dash. |
| GOVERNING-search-filters-target.png | TARGET, governing | The search surface and its filter sheet. |
| GOVERNING-thread-hotel-booking.jpg | TARGET, governing | A stay booking thread. Paired with `GOVERNING-chat-booking-card.png` above; the bubble colours were sampled from this file. |
| GOVERNING-thread-rental-enquiry.jpg | TARGET, governing | A property enquiry thread, including the role tag and the verified mark beside a name. |
| landing-fullpage-target.png | TARGET, governing | The full desktop landing: hero with phone mockup, a six tile feature band, a community stats row, How Vallo Works in four steps, an eight tile category grid, the Stays band, the app download band and the footer. NOT COPIED: the stats row prints "10K+ Properties, 5K+ Happy Clients, 200+ Agents", invented numbers the product never prints; the category tiles print counts for the same reason; and the AI-rendered body text is garbled in several bands and is never transcribed. |
| home-as-shipped-0919.png | DEFECT CAPTURE | Our own in-app home as it shipped on 19 September. Evidence, not a target. |
| landing-phone-as-shipped-0919.png | DEFECT CAPTURE | Our own landing on a phone, 19 September. Evidence, not a target. |
| landing-feature-orbs-as-shipped.jpg | DEFECT CAPTURE | The landing feature band as it shipped, the founder's "wtf is that those our house image" complaint about the orbs. |
| home-light-black-icon-plates-as-shipped.jpg | DEFECT CAPTURE | The home in LIGHT theme with black icon plates. This is the single best piece of evidence for the light mode track: 121 of 144 objects have no light twin, so they keep painting their dark artwork and land as a dark navy chip on a white page. |
| broken-photo-and-fat-cards-as-shipped.png | DEFECT CAPTURE | A live capture from vallospaces.com at 07:29 showing four separate defects at once: a broken image placeholder inside a card, a card title overflowing on top of its own photograph, cards far taller than the reference, and capsules on "Get Started", "Per night" and "Third party". Every one of those four is a named item in a current track. |

**Which target wins where.** For the in-app phone chrome, `GOVERNING-home-markets-target.png`. For the desktop landing, `landing-fullpage-target.png` beside `GOVERNING-landing-desktop-hero.png` below, and where they disagree the founder's file wins. For anything in Tracks G, N, O or P, the twelve in `roles/` win over both, because they are the newest and they were drawn for that work.

---

## The top level folder

## Governing references (already decided, keep as named)

| File | Shows |
|---|---|
| GOVERNING-landing-desktop-hero.png | Landing desktop hero: nav Home/Properties/Stays/AI/More, "Real Estate reimagined.", city chips Lagos/Abuja/Lekki/Ikeja, search pill with Buy/Rent/Stay/Invest tabs, stats row, 10-tile feature grid |
| GOVERNING-landing-desktop-fullpage.png | Full landing page: hero with phone mockup, feature grid, community stats, How Vallo Works (Discover/Verify/Experience/Manage), category tiles, Stays band, app download, footer |
| GOVERNING-feed-plus-bloom.png | Phone feed: location bar, stories row, For You/Following tabs, post cards, bloom FAB open in an arc (Post/Story/Review), bottom nav Home/Search/Saved/Profile |
| GOVERNING-chat-booking-card.png | Phone booking thread with hotel: embedded booking card (Confirmed badge, check-in/out, guests, room summary, View Booking Details / Contact Hotel), composer, Stays bottom nav |
| GOVERNING-flip-mid-turn.png | Phone home mid-flip: glass pane rotating with 3D building icon, home content dimmed behind, bottom nav visible |

## UUID file catalogue

Columns: filename | what it shows | category | governs | duplicate flag | notable details.

| File | Shows | Category | Governs | Flag | Notable details |
|---|---|---|---|---|---|
| 09A476D8-E963-4950-B2B9-8EE2A741DFBF.png | Photo asset: luxury apartment tower entrance at dusk, skyline and lagoon behind | PHOTO-ASSET | apartment/hotel exterior imagery | KEEPER | Clean plate, no text; warm entrance lighting is photographic, not UI |
| 0AE47CBC-9077-4916-A74F-593572E05AB3.png | Photo asset: villa infinity pool terrace at dusk, skyline across water | PHOTO-ASSET | listing/stay hero imagery | KEEPER | Landscape 16:9, strong dusk-blue sky, usable as hero plate |
| 0BD2193A-9FFD-4506-A624-04C366ABF36F.png | Landing desktop hero (identical to governing file) | UI-REFERENCE | landing | VARIANT of GOVERNING-landing-desktop-hero (exact duplicate) | Redundant copy; safe to delete |
| 0CC96E00-82D2-4DEC-897C-B6FAC4A2E489.png | Photo asset: waterfront city skyline at dusk, Lagos-like, no foreground | PHOTO-ASSET | skyline background imagery | KEEPER | Clean wide plate, good for section backgrounds |
| 0D3D34D2-1D1D-4CCC-BA69-125529B57417.png | Phone listing detail: 5 Bedroom Detached Duplex, Lekki, N12m/yr, spec chips, description, interior gallery grid, amenities, agent card, Book Inspection bar | UI-REFERENCE | listing detail | KEEPER (differs from 7B5335E0: inline photo grid mid-page, no thumbnail strip, 5-bed content) | Sticky price + Book Inspection footer; Verified Listing pill next to price |
| 0F25E224-53E5-42FD-9F0F-60836CEFBE51.png | Background asset: abstract deep-blue light-wave gradient, no text or UI | BACKGROUND-ASSET | app/site backgrounds | KEEPER | Only pure abstract background in the set; matches house blue |
| 1362BF36-CD60-42F9-BD75-8F9CF4695986.png | Photo asset: modern villa with infinity pool and waterfall edge at dusk, skyline left | PHOTO-ASSET | listing/stay hero imagery | KEEPER (differs from 0AE47CBC: full villa in frame, waterfall edge) | Very high quality hero candidate |
| 1A655910-07AE-404D-B85C-BEE0ECA7DE04.png | Phone feed with stories, Posts/Community tabs, bloom FAB open as vertical stack (Post/Story/Review + X close) | UI-REFERENCE | feed | KEEPER (differs from GOVERNING-feed-plus-bloom: Posts/Community tabs instead of For You/Following; vertical bloom with close button) | Alternative bloom choreography; governing file still rules the feed |
| 213F6F47-1AE0-4044-A266-2DCE0B0647FE.png | Phone crypto market dashboard (BTC/ETH/SOL/BNB, market cap chart, meme-coin gainers, VTX Agent bot) branded Vallo | OTHER | none (off-brief crypto content) | KEEPER (unique) | Do not build; useful only for card/chart styling. OFF-BRAND: gold coin icons, orange flame icon, off-domain content |
| 2298F702-D31B-4CA4-9D38-813E6248F8F3.png | Photo asset: villa exterior at sunset, SUV in drive, skyline right | PHOTO-ASSET | listing exterior imagery | KEEPER | Clean plate; strong orange sunset (photographic) |
| 278CC66A-1769-40BF-9F69-EE340A110ED4.png | Phone admin queue: tabs All/Listings/Bookings/Users/Payments with counts, search, status filter chips, row table with View actions, pagination | UI-REFERENCE | admin queue phone | KEEPER | Status colours: Pending cyan, In Review blue, Approved emerald, Rejected rose (on-palette); checkbox column on phone is questionable |
| 2A0FAC02-08EA-4D04-88C7-DE1BB18626AF.png | Photo asset: villa terrace with infinity pool and dining pavilion at dusk, skyline left | PHOTO-ASSET | listing/stay hero imagery | KEEPER (differs from 1362BF36: closer terrace viewpoint, lantern candles) | Clean plate |
| 2A49E2F7-F99C-47D3-BB79-075DCC1A0F5D.png | Phone welcome/onboarding: "Two worlds. One platform.", Property and Stays glass cards, coin flip motif, page dots, Get Started, Skip | UI-REFERENCE | welcome/onboarding, flip narrative | KEEPER | Coin between the two cards sells the flip metaphor. OFF-BRAND: "HOTEL" text baked into the Stays icon; capsule Get Started button |
| 2AA604D7-04C4-47D0-9067-C6A623D72DE9.png | Brand render: floating glass phone with glowing hotel icon and "Stays" wordmark, no app UI | LOGO-BRAND | stays brand/marketing | KEEPER | Marketing plate for Stays mode. OFF-BRAND: "HOTEL" text baked into icon |
| 2C23179E-11DE-4299-8ED3-AA7D5171D3A9.png | Desktop landing full page: hero with phone mockup, feature grid, trust pipeline (Property Found to Verified Listing), Stays cards, ecosystem stats, app download, footer | UI-REFERENCE | landing | VARIANT of GOVERNING-landing-desktop-fullpage (same page role, weaker: garbled AI text "Learn Mores", gold price on Resort card) | Trust pipeline diagram is worth lifting even though the file is a variant |
| 30C3ADA1-92CB-4520-9110-E1A9326A17CF.png | Photo asset: resort pool deck at dusk, loungers, umbrellas, candles, skyline across water | PHOTO-ASSET | stays/resort imagery | KEEPER | Clean plate, restaurant-resort mood |
| 337771A2-AAEF-41BB-97FD-3B9C86100B7A.png | Photo asset: luxury hotel bedroom, warm cove lighting, skyline window | PHOTO-ASSET | stay detail room imagery | KEEPER (differs from 5195AC07: tighter crop, bench at bed foot) | Clean plate |
| 34695B18-30CA-42F1-BF00-ECD9C03F32A4.png | Photo asset: villa with infinity pool at dusk, portrait orientation | PHOTO-ASSET | phone-format hero imagery | KEEPER | Only portrait villa plate; suits phone hero/story format |
| 3594441E-553F-404D-BE84-A4DE48F229F3.png | Feed plus bloom (identical to governing file) | UI-REFERENCE | feed | VARIANT of GOVERNING-feed-plus-bloom (exact duplicate) | Redundant copy; safe to delete |
| 3EB3E2A9-E375-4085-B19E-6A40A96625B1.png | Phone search results with filter sheet: chips Buy/2 Bed/N500k-N2M/More(3), result cards, sheet with property type, market Buy/Rent/Shortlet, price slider, bed/bath counts, amenity toggles, Reset / Apply (342) | UI-REFERENCE | search results, filters | KEEPER | Result count in Apply button; Verified badge on card corners; For Rent/For Sale tags on thumbnails |
| 50E032EA-4141-4237-88D5-01B3720D87B6.png | Phone profile: cover photo, avatar, bio, followers/following, Belongings/Posts tabs, rows My Bookings/Saved/Wallet/Inspections, Switch role (user/agent/admin) | UI-REFERENCE | profile | KEEPER | "Belongings" tab naming; Switch role row is the role-switch entry point |
| 5195AC07-1FB4-4F5F-8671-32744C4F72B7.png | Photo asset: luxury bedroom, wide view with armchair and dresser, sunset skyline window | PHOTO-ASSET | stay detail room imagery | KEEPER (differs from 337771A2: wider room, different palette) | Clean plate |
| 531C7B61-9269-4546-8E2D-60963CFC5C3B.png | Desktop marketing page: phone home mockup left, feature grid, Built on Trust stats, Africa map "One Platform. Every City.", testimonials, footer with store badges | UI-REFERENCE | landing (secondary sections) | KEEPER (differs from governing fullpage: trust stats, Africa map and testimonial sections not present there) | Africa map panel and testimonial cards worth lifting. OFF-BRAND: gold stars; garbled AI text ("Verfieum", "Lagoe", "ibadro") must not be copied |
| 55A56F21-0654-4F2D-984B-60A8CE97BB17.png | Phone sign-in: Vallo app icon and 3D wordmark, "Real Estate reimagined!", Welcome Back card with email, Continue, Google, Sign up link | UI-REFERENCE | sign-in, logo/brand | KEEPER | Cleanest render of the app icon + wordmark in the set; email-first auth flow |
| 56087700-7424-4B67-AFEB-B3DAEF6BDBA2.png | Photo asset: marble bathroom, freestanding tub, glass shower, skyline window at dusk | PHOTO-ASSET | stay/listing room imagery | KEEPER | Clean plate; brass fittings are photographic |
| 6AF37222-1D2E-4200-AB23-E55A24AE5E4F.png | Phone wallet home: Total Balance N245,680 with 3D wallet icon, Send/Receive/Top Up/Swap, Quick Actions (Send Money/Buy Airtime/Pay Bills/Request Money), Recent Transactions with Completed badges, bottom nav Home/Wallet/Saved/Profile | UI-REFERENCE | wallet | KEEPER | Emerald Completed badges and +green amounts on-palette; wallet tab replaces Search in bottom nav here (inconsistent with other screens) |
| 710CD2DE-10F0-4BD7-AFB1-BDA561C910C5.png | Photo asset: penthouse open-plan living room, kitchen island, sunset skyline glazing | PHOTO-ASSET | listing interior imagery | KEEPER | Clean plate |
| 77A54EA3-BBB5-4BF4-B3A5-144C99CABAF7.png | Phone wallet + send money hybrid: balance card, four wallet actions, then Send Money form (recipient, bank, amount chips N5k-N50k, narration, Send Money CTA, NDIC/256-bit badges) | UI-REFERENCE | send money | VARIANT of 95840448 (same purpose; this one crams wallet header + form on one screen, weaker hierarchy) | NDIC / 256-bit encryption trust footer worth keeping |
| 7B5335E0-5FC2-474E-B408-5C90BC729F00.png | Phone listing detail: Modern 4 Bedroom Duplex, gallery with thumbnail strip and +7, spec chips, description, amenities, agent card, price + Book Inspection bar | UI-REFERENCE | listing detail | KEEPER (differs from 0D3D34D2: thumbnail strip under hero, 3-dot menu, 4-bed content) | Thumbnail strip pattern is the best gallery treatment of the four listing variants |
| 7F96BE6C-BF8C-4413-BD58-25531B27D549.png | Phone settings: profile row, Account/Notifications/Privacy/Appearance(Dark)/Language/Help rows, Payment Methods (Verve card Default, Access Bank Verified), Log Out | UI-REFERENCE | settings, payments settings | KEEPER | Covers payments settings too; Verve red is a real brand mark, acceptable |
| 82AC015B-DC21-4E35-B5D5-241753DC0370.png | Photo asset: upscale restaurant interior, bar left, sunset skyline glazing | PHOTO-ASSET | restaurants imagery | KEEPER | Clean plate |
| 84054CE9-D87A-4812-A7E6-729D3AA856A9.png | Phone stay detail: Eko Pearl Apartments, N85,000/night, feature chips, Property Type card, About, room-type gallery (Bedrooms/Bathrooms/Living/Kitchen), Book Now, Stays bottom nav | UI-REFERENCE | stay detail | KEEPER (differs from BB0C2C85: serviced apartment, room-type gallery, no date/guest pickers) | Room-count gallery tiles are a strong pattern. OFF-BRAND: gold rating star |
| 8AA6F0DD-5440-4159-A5B0-DD6A6DEBCC3F.png | Same as 34695B18 | PHOTO-ASSET | phone-format hero imagery | VARIANT of 34695B18 (exact duplicate) | Safe to delete |
| 8D58A2DA-9748-4B4A-AFDF-404C7E9429B1.png | Same as 2A0FAC02 | PHOTO-ASSET | listing/stay hero imagery | VARIANT of 2A0FAC02 (exact duplicate) | Safe to delete |
| 94846372-7595-4228-83E1-2F2882516AFB.png | Chat booking card (identical to governing file) | UI-REFERENCE | booking thread | VARIANT of GOVERNING-chat-booking-card (exact duplicate) | Redundant copy; safe to delete |
| 95840448-AEBA-4671-9CAA-9B77B6A5D383.png | Phone send money: wallet balance strip, recipient search with scan, recent contact chips (AO/TK/MB/SO/All Contacts), amount with N10k-N100k chips, optional bank, note, Continue | UI-REFERENCE | send money | KEEPER | Recent-recipient chips and QR-scan affordance; cleanest transfer flow |
| 97080069-BE2A-4A80-B850-F9173FA4E118.png | Same as 0AE47CBC | PHOTO-ASSET | listing/stay hero imagery | VARIANT of 0AE47CBC (exact duplicate) | Safe to delete |
| 9A9A4168-E12F-45E1-BAE3-82C140CE6768.png | Flip mid-turn (identical to governing file) | UI-REFERENCE | flip | VARIANT of GOVERNING-flip-mid-turn (exact duplicate) | Redundant copy; safe to delete |
| 9BE8F2D4-B4C3-4DFA-AF41-3FA55D3DDE85.png | Same as 56087700 | PHOTO-ASSET | stay/listing room imagery | VARIANT of 56087700 (exact duplicate) | Safe to delete |
| 9E06F51C-A235-43A0-A9A0-429015DF4D2E.png | Phone rental thread: listing header with Verified, Rental Inquiry context card, Tenant vs Vallo Agent bubbles with role tags, photo bundle with +6 inside a bubble, composer | UI-REFERENCE | rental thread, messages | KEEPER | Role tag on sender name and in-thread listing context card are the patterns to keep |
| 9E8B56ED-FD28-4C33-BB7A-DF19B642A680.png | Phone listing detail: Luxury 4 Bedroom Duplex, Move-in Total block, spec card, amenity tiles, tabs Overview/Amenities/Location/Reviews, agent card, Calculate Breakdown + Book Inspection footer | UI-REFERENCE | listing detail, move-in ledger entry | KEEPER (differs from other listing variants: Move-in Total framing and section tabs; best canonical rent detail) | Calculate Breakdown CTA links straight to the ledger. OFF-BRAND: gold star |
| 9F384CFE-AE5E-4618-B9A0-204828131E57.png | Phone move-in cost: listing summary, Cost Breakdown (rent, agent fee 10%, caution deposit, legal fee), Total Move-in Cost, Area Comparison ("5% lower than average"), Proceed to Booking | UI-REFERENCE | move-in ledger | KEEPER | Area comparison strip is the standout idea; trust microcopy under CTA |
| A379C6E6-8211-40E9-B4BA-27066187D6FB.png | Photo asset: daytime penthouse living room, sectional sofa, skyline glazing | PHOTO-ASSET | listing interior imagery | KEEPER | Only daytime interior plate in the set |
| AC7A17CE-5298-465A-B029-85239A9F9405.png | Landing desktop full page (identical to governing file) | UI-REFERENCE | landing | VARIANT of GOVERNING-landing-desktop-fullpage (exact duplicate) | Redundant copy; safe to delete |
| B047A0CE-4AC0-43C5-9E05-D2425EFB5CF4.png | Phone listing detail: Luxury 4 Bedroom Duplex, N12m/yr, About, Verified Host row with Message, Check Availability (check-in/check-out) + Book Now, Stays bottom nav | UI-REFERENCE | listing detail (rent/stay hybrid) | KEEPER (differs: availability pickers on a yearly rental; treat as the pattern for bookable stays, not rent) | Inconsistent: yearly price with nightly-style date pickers; do not copy literally. OFF-BRAND: gold star |
| B8EE3E49-0771-40B2-93A6-D0015890B69F.png | Same as 710CD2DE | PHOTO-ASSET | listing interior imagery | VARIANT of 710CD2DE (exact duplicate) | Safe to delete |
| BB0C2C85-DA53-47A5-ADCA-A4C67BFA2E72.png | Phone stay detail: Oceanview Luxury Villa, N250,000/night, check-in/check-out dates, guests row, amenity tiles, About, Book This Stay, Stays bottom nav | UI-REFERENCE | stay detail | KEEPER (differs from 84054CE9: date + guest pickers, villa content) | Canonical bookable stay detail. OFF-BRAND: gold star |
| BC882C5A-9A14-4AC5-BF94-3AD389697F26.png | Same as 09A476D8 | PHOTO-ASSET | apartment/hotel exterior imagery | VARIANT of 09A476D8 (exact duplicate) | Safe to delete |
| BCD39CA8-E92F-4E72-B4BA-7203AA2F93E7.png | Phone side-nav drawer over dimmed results: profile header, Home/Explore/Feed/Bookings/Messages(3)/Notifications(5)/Saved/Wallet/AI Assistant, Workspace: Agent Mode, Flip Coin "Switch to Stays" card, Dark Theme toggle, Vallo Spaces Ltd footer | UI-REFERENCE | side-nav drawer | KEEPER | Flip Coin switch inside the drawer is the key navigation idea; badge counts on Messages/Notifications |
| BD5F3AE7-9A56-4E99-974D-52BFB26A22D1.png | Photo asset: wide waterfront skyline at dusk with cable bridge (Lekki-Ikoyi-like) | PHOTO-ASSET | skyline background imagery | KEEPER (differs from 0CC96E00: bridge landmark, wider panorama) | Clean plate; Nigerian landmark reference |
| BE1093DD-3772-40EE-8274-7DF691A6882E.png | Phone explore markets: headline, search, category grid Rent/Buy/Shortlets/Hotels/Resorts/Guest Houses/Restaurants/Commercial/Land with listing counts, invest banner, Featured Cities chips, bottom nav Home/Search/Saved/Messages/Profile | UI-REFERENCE | home/explore hub, restaurants entry | KEEPER | Only screen showing Restaurants and Land as first-class categories; five-tab nav variant with Messages. OFF-BRAND: "HOTEL" text baked into hotel icon |
| BF49B814-5C2F-4761-A48C-89A12C040ED1.png | Phone AI assistant chat: query bubble, reply, two inline verified listing cards with price/specs, follow-up, Thinking state, suggestion chips, sparkle composer | UI-REFERENCE | AI assistant | KEEPER | Inline listing cards in chat plus suggestion chips; Thinking spinner state included |
| C1A62A8D-65EC-45B9-9355-4F0EB60AB8C7.png | Photo asset: large family villa exterior at dusk, palm and driveway, gate pillars | PHOTO-ASSET | listing exterior imagery | KEEPER (differs from 2298F702: symmetrical frontal composition, gated drive) | Clean plate |
| C94E4E85-5250-4DAA-80B3-2D2338F305C7.png | Same as 5195AC07 | PHOTO-ASSET | stay detail room imagery | VARIANT of 5195AC07 (exact duplicate) | Safe to delete |
| CDA4B82B-B87A-44DC-8831-326692FEA9CB.png | Desktop admin console: sidebar Dashboard/Admin Queue(42)/Listings/Users/Agents/Bookings/Payments/Reports/Support/Settings, queue table with type icons, status badges, Bulk Actions, Export, pagination | UI-REFERENCE | admin desktop | KEEPER | Command-K search hint, per-row kebab, Operations Console v1.0.0 footer; status palette matches phone admin |
| DD8EFFA8-F0A8-4F54-A9FA-68FD802EE722.png | Photo asset: moody restaurant-lounge interior, water feature wall, curved banquettes, amber lighting | PHOTO-ASSET | restaurants imagery | KEEPER (differs from 82AC015B: night lounge mood, no skyline) | Clean plate |
| E108E610-17E5-4D49-B740-98C7683A9569.png | Photo asset: penthouse terrace lounge at night, candles, glass rail, skyline across water | PHOTO-ASSET | stays/terrace imagery | KEEPER | Clean plate |
| E1CBDA9E-EAC8-4BE2-BD6B-79EBD306F2F8.png | Same as 30C3ADA1 | PHOTO-ASSET | stays/resort imagery | VARIANT of 30C3ADA1 (exact duplicate) | Safe to delete |
| EBC8FC19-8486-465F-A573-CDCDA08EF5F9.png | Photo asset: restaurant interior with backlit bar shelving and dusk skyline glazing | PHOTO-ASSET | restaurants imagery | KEEPER (differs from 82AC015B and DD8EFFA8: bar-forward composition) | Clean plate |
| F6A8A482-657B-4836-B30A-1A0578BC3FBA.png | Phone property inspection: scheduled listing card, date/agent/status row, 8-item checklist (Exterior to Overall Condition) with progress 0/8, notes, Add Photos, Submit Inspection Report (disabled), Stays bottom nav | UI-REFERENCE | inspections | KEEPER | Checklist progress bar and disabled-until-complete submit are the patterns to keep |
| FD3DFE84-0D2F-4CC9-AEC7-5D438F97CD53.png | Phone stays home: headline with 3D hotel icon, search "Where are you going?", category tiles Hotels/Apartments/Resorts/Guest Houses/Serviced Apartments, Featured Stays cards with per-night price and amenity chips, Stays bottom nav | UI-REFERENCE | stays home | KEEPER | Category tile row + featured cards; per-night pricing format. OFF-BRAND: gold stars; uses real brand name "Radisson Blu" in sample data |

## 1. Coverage

Covered (has at least one usable reference):
- landing (governing hero + fullpage, plus 531C7B61 extra sections)
- search results and filters (3EB3E2A9)
- listing detail (0D3D34D2, 7B5335E0, 9E8B56ED, B047A0CE)
- move-in ledger (9F384CFE, entry CTA in 9E8B56ED)
- flip (governing flip + 2A49E2F7 onboarding narrative)
- stays home (FD3DFE84)
- stay detail (84054CE9, BB0C2C85)
- wallet (6AF37222)
- send money (95840448, 77A54EA3)
- rental thread (9E06F51C)
- booking thread (governing chat-booking-card)
- feed (governing feed + 1A655910)
- profile (50E032EA)
- side nav drawer (BCD39CA8)
- settings and payments settings (7F96BE6C)
- inspections (F6A8A482)
- AI assistant (BF49B814)
- admin queue phone (278CC66A) and admin desktop (CDA4B82B)
- sign-in (55A56F21)
- welcome/onboarding (2A49E2F7)
- home/explore hub (BE1093DD; partial, see below)

Partial only (appears inside another screen, no dedicated reference):
- home: no clean dedicated phone home; it appears only dimmed in the flip shot and inside desktop phone mockups (531C7B61, 2C23179E)
- transactions: list embedded in wallet home only, no full-screen history
- stories: row in feed only, no story viewer
- restaurants: category tile + three photo assets, no restaurant UI screen
- verification: badges and landing trust pipeline only, no flow screens

No reference at all:
- stay search results
- trips
- receive money
- payment pending/failed sheets
- checkout
- messages inbox (list of threads)
- post thread
- edit profile
- notifications screen
- agent dashboard
- listing wizard
- sign-up
- host onboarding

## 2. Off-brand flags (do NOT copy)

- 213F6F47: whole screen is off-brief crypto content; gold/amber coin icons; orange flame "Trending Now" icon.
- Gold/amber rating stars (warm colour in UI): 84054CE9, BB0C2C85, B047A0CE, 9E8B56ED, FD3DFE84, 2C23179E, 531C7B61. Re-tint stars to house palette when building.
- Text baked into icons: "HOTEL" label inside the hotel glyph in 2A49E2F7, 2AA604D7 and BE1093DD.
- Capsule/pill CTAs and chips appear across most phone screens (Get Started in 2A49E2F7, filter chips in 3EB3E2A9, city chips in the governing hero, bloom pills in both feed shots). House law bans capsule buttons, so square these off when building; note the governing files themselves contain pill chips, which needs a founder ruling.
- Garbled AI text that must never be transcribed: 531C7B61 ("Verfieum", "Lagoe Lagos", "ibadro Ibadan"), 2C23179E ("Learn Mores", blurred card copy), plus small blur artefacts in the governing fullpage hero mockup.
- Real third-party brands in sample data: FD3DFE84 ("Radisson Blu"), 94846372/GOVERNING-chat-booking-card ("Grand Vista Hotel" is fictional, fine), 7F96BE6C (Verve, Access Bank; real payment brands are acceptable in payment contexts only).
- B047A0CE: yearly rental price paired with nightly check-in/check-out pickers; logic error, not just styling.
- 6AF37222 vs others: bottom nav swaps Search for Wallet; BE1093DD uses a five-tab nav with Messages. Nav sets are inconsistent across references and need one canonical decision.

No warm-coloured UI surfaces (orange/gold/amber/purple panels or buttons) were found outside 213F6F47; warm tones elsewhere are photographic lighting, which is fine.

## 3. Assets (pure photography/background plates, no UI, no text, no watermark)

- 0F25E224: abstract deep-blue wave background
- 09A476D8 (dup BC882C5A): apartment tower entrance, dusk
- 0AE47CBC (dup 97080069): villa pool terrace with skyline, dusk
- 0CC96E00: waterfront skyline, dusk
- 1362BF36: villa with infinity pool and skyline, dusk
- 2298F702: villa exterior with SUV, sunset
- 2A0FAC02 (dup 8D58A2DA): villa terrace pool with pavilion, dusk
- 30C3ADA1 (dup E1CBDA9E): resort pool deck with loungers, dusk
- 337771A2: hotel bedroom, warm light
- 34695B18 (dup 8AA6F0DD): villa pool, portrait format
- 5195AC07 (dup C94E4E85): bedroom, wide view
- 56087700 (dup 9BE8F2D4): marble bathroom with skyline
- 710CD2DE (dup B8EE3E49): penthouse living room, sunset
- 82AC015B: restaurant interior with bar and skyline
- A379C6E6: penthouse living room, daytime
- BD5F3AE7: skyline panorama with bridge, dusk
- C1A62A8D: gated family villa exterior, dusk
- DD8EFFA8: restaurant lounge with water feature, night
- E108E610: penthouse terrace lounge, night
- EBC8FC19: restaurant with backlit bar, dusk

(2AA604D7 is a brand render, not a neutral plate; the AI-generated skylines are generic, not literal Lagos.)

## 4. Recommended canonical names (keepers only; do not rename yet)

UI references:
- 0D3D34D2 -> ref-listing-detail-rent-01.png
- 7B5335E0 -> ref-listing-detail-rent-02-thumbstrip.png
- 9E8B56ED -> ref-listing-detail-rent-03-movein.png (suggested canonical rent detail)
- B047A0CE -> ref-listing-detail-rent-04-availability.png
- 1A655910 -> ref-feed-posts-community.png
- 213F6F47 -> ref-style-market-dashboard-offbrief.png
- 278CC66A -> ref-admin-queue-phone.png
- CDA4B82B -> ref-admin-queue-desktop.png
- 2A49E2F7 -> ref-onboarding-two-worlds.png
- 3EB3E2A9 -> ref-search-results-filters.png
- 50E032EA -> ref-profile-belongings.png
- 531C7B61 -> ref-landing-desktop-sections.png
- 55A56F21 -> ref-sign-in.png
- 6AF37222 -> ref-wallet-home.png
- 95840448 -> ref-send-money.png
- 7F96BE6C -> ref-settings.png
- 84054CE9 -> ref-stay-detail-apartment.png
- BB0C2C85 -> ref-stay-detail-villa.png
- FD3DFE84 -> ref-stays-home.png
- BCD39CA8 -> ref-side-nav-drawer.png
- BE1093DD -> ref-explore-markets.png
- BF49B814 -> ref-ai-assistant-chat.png
- 9E06F51C -> ref-rental-thread.png
- 9F384CFE -> ref-move-in-ledger.png
- F6A8A482 -> ref-inspection-checklist.png

Brand and backgrounds:
- 2AA604D7 -> asset-brand-stays-phone.png
- 0F25E224 -> asset-bg-blue-wave.png
- 0CC96E00 -> asset-skyline-waterfront-dusk.png
- BD5F3AE7 -> asset-skyline-bridge-dusk.png

Photography:
- 09A476D8 -> photo-tower-entrance-dusk.png
- 0AE47CBC -> photo-villa-pool-skyline-01.png
- 1362BF36 -> photo-villa-pool-skyline-02.png
- 2A0FAC02 -> photo-villa-pool-terrace.png
- 34695B18 -> photo-villa-pool-portrait.png
- 2298F702 -> photo-villa-exterior-sunset.png
- C1A62A8D -> photo-villa-exterior-gate.png
- 30C3ADA1 -> photo-resort-pool-deck.png
- 337771A2 -> photo-bedroom-01.png
- 5195AC07 -> photo-bedroom-02.png
- 56087700 -> photo-bathroom-01.png
- 710CD2DE -> photo-living-room-dusk.png
- A379C6E6 -> photo-living-room-day.png
- E108E610 -> photo-terrace-lounge-night.png
- 82AC015B -> photo-restaurant-01.png
- DD8EFFA8 -> photo-restaurant-02-lounge.png
- EBC8FC19 -> photo-restaurant-03-bar.png

Deletable exact duplicates (13): BC882C5A, 97080069, 8D58A2DA, 8AA6F0DD, C94E4E85, 9BE8F2D4, B8EE3E49, E1CBDA9E, and the five governing copies 0BD2193A, 3594441E, 9A9A4168, AC7A17CE, 94846372.

**Removed on 23 September 2026.** Those thirteen exact duplicates were deleted
from `references/`; each one's keeper above is byte-identical, so nothing a
row in this catalogue describes was lost. The rows stay so a UUID quoted in an
older document still resolves to its keeper.

## The admin console renders (`references/admin/`)

The four desktop renders that govern `/admin`. They arrived at the repository
root under UUID names and moved here on 23 September 2026 under descriptive
names. Code comments cite them by the first eight characters of the original
UUID, so both names are listed.

| Short id | File | What it draws |
|---|---|---|
| 5EAA44CB | admin/admin-01-overview.png | One full desktop window (1586 x 992): the rail, the pulse strip, four KPI cards, naira over time, supply by type, new listings per month, recent alerts |
| C1D98B3C | admin/admin-02-listings-review-money.png | Three panels: the listings review queue, one listing under review with its action bar, the money desk |
| 8E9602E2 | admin/admin-03-escrow-verification-supply.png | Three panels: the escrow desk, identity verification, supply |
| 01F7DFC7 | admin/admin-04-moderation-operations-analytics.png | Three panels: moderation, operations (jobs, alerts, audit log), analytics |
