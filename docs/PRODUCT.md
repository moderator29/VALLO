# Vallo

Read this first. It says what the product is, who it is for, what a listing is,
who can do what, and which words we use. Everything else in `docs/` is detail
underneath it.

Three things are the source of truth, in this order: the **code**, the
**database**, and **this document**. Where a fourth document disagrees with any
of them, the fourth document is wrong. Where this document describes something
the code does not do yet, it is marked NOT BUILT and the work is in
the code, never in a register (the old RECOMMENDATIONS register was retired on 17 October 2026).

Last verified against the code and the live Supabase project
`uccixoonmbhrnyczyigt` on 2026-08-09; sections 4, 7 and 8 corrected on
2026-09-23. The checked, finding-by-finding state of the platform is
read from the code; the dated audits were retired on 17 October 2026.

---

## 1. What Vallo is

**A Nigeria first property, stays and restaurants marketplace, with a social
layer, an agreement gate before every negotiated payment and a verification
ladder. Vallo never holds customer money.**

**Money (current, 17 October 2026).** A licensed partner holds escrow for rent,
shortlets and sales where the payer chooses it (ADR 0003, `pov01` to `pov05`);
a hotel room, or a rent or shortlet paid by card, is split by the processor at
the moment of payment, the
host's share to their bank and Vallo's commission to Vallo, read from policy
rows (`fee_rates`, `scoped_commission_rates`), never from a constant. The Vallo
Guarantee is retired (`guarantee_bps` is 0; the machinery stays built, nothing
flows through it). `docs/MONEY_ARCHITECTURE.md` is the mechanism and
`docs/RULINGS.md` the rulings.

Everything on the platform was listed on the platform by a real person who
applied, was verified and was approved. There is no third-party inventory, no
Google Places feed, no hotel rate aggregator and no scraped stock. That is not a
gap, it is the whole argument: it is the only reason the verified badge and an
inspection can mean anything, and the ground on which an agreed deal can mean
anything.

**This is now true of the database as well as the code.** `places_cache` and its
243 rows of cached Google payloads are dropped, `partner_stay_intents` is
dropped, the `hybrid_hotels` and `hybrid_restaurants` flags are deleted, and
6,043 lines of provider code are gone.

The product began as NaijaFinds, a discovery, stay, food and experience
platform, became RentMe, and is now Vallo. Both earlier names are dead and
appear nowhere in the product. The parts of the original scope that survive do
so because a Nigerian looking for a place to live also eats, travels and stays,
and because a hotelier or a restaurateur listing their own venue is a supplier
like any other. What does not survive is anybody else's inventory.

## 2. What it offers

| Market | What happens | Money |
|---|---|---|
| **Rent** | Annual tenancy. Message the agent, inspect the property, then pay. **No Reserve button, ever.** | `rent_amount_minor` per `rent_period`, plus the full move-in breakdown |
| **Buy and sell** | A property offered for sale, enquiry and inspection, then a transaction. **SCHEMA BUILT, UI NOT BUILT.** `listings` now carries `listing_intent`, `sale_price_minor`, `tenure`, `sale_status`, `year_built` and `size_sqm`. No screen renders any of it and there is no Buy in the navigation | `sale_price_minor`, with `price_negotiable` |
| **Stay** | Nightly lodging: hotel, apartment, shortlet, villa, home. Reserve, hold, pay | `rate_minor` per `rate_period` |
| **Eat** | A restaurant lists itself. A guest requests a table, the venue accepts or declines | Free to request. A fixed fee per seated table is billed to the restaurant (decided and built 13 October 2026; the amount is 1,000 naira per table). Card deposits (D75) exist behind a flag that is off |
| **Around** | The social layer. Places, posts, stories, people, the assistant answering in comments | Free |
| **Agreements** | Both sides confirm the same terms, then payment opens. No staff approval stands in between by default (`agreement_staff_review` is off, D83); the direct rail reviews only on a risk signal (D77) | Rent and sales: escrow held by a licensed partner, or card where the rules allow. Fixed-price bookings: card, split at payment. Vallo holds nothing |

## 3. The fee position

> **Updated 13 October 2026.** The founder's position, in
> [DECISIONS_2026-10-13.md](DECISIONS_2026-10-13.md): Vallo is free to use,
> listing is free, no monthly subscription is required of anyone, a Pro plan is
> optional, and Vallo charges only on a completed deal. The paragraphs below are
> the engineering history of the fee engine (set to zero when written) and are
> not changed; where they say "charges nothing today" read the decisions file,
> and note that the Terms (section 6) still say commission is zero pending the
> solicitor. The public statement is `/docs/what-vallo-costs`.

**The platform charges nothing today, and the engine that will one day charge
something is being built now and set to zero.**

That is the owner's decision and it is deliberate. A fee engine bolted on later
prices transactions it cannot explain and cannot reverse correctly. A fee engine
built early, exercised at zero, and switched on once there is a user base is
boring on the day it matters.

**What is true today.**
- `ledger_entries` enforces `gross_minor = platform_fee_minor + agent_share_minor
  + processor_fee_minor` as a check constraint. `platform_fee_minor` is always
  zero.
- Copy must never mention a platform fee as a thing that is charged. If a payment
  processor takes something, it is labelled as the processor's.

**The rules for when a rate becomes non-zero**, which are policy and not
implementation detail:
- Rates live in a table with effective dates, never in code. Every transaction
  records which schedule priced it.
- A fee is shown before the action that incurs it, on the same screen, at the
  same visual weight as the amount, with the rate and the base beside it.
- The platform's fee and the processor's fee are never bundled.
- Thirty days' notice, by email and in product, before any rate rises above zero.
- Listings and bookings created under one rate complete under that rate.
- Show "Platform fee: 0 naira" from today rather than hiding the row, so the line
  is familiar long before it has a number in it.
- Never charge a member to look, save, message or enquire. Fees attach to
  transactions and to supply-side services.

The fee engine itself is `lib/money/lister-fee.ts` and the `fee_rates` table.

## 4. Role architecture and the access rule

Four roles, in `public.app_role`: `user`, `agent`, `admin`, `super_admin`. A
person can hold more than one. Roles are read through helpers in a private,
non-exposed schema, never from a client.

**The access rule: sign in to see the platform. Founder's ruling, 23 September 2026.**

In the founder's words: "Nothing inside the platform is visible without
signing up or signing in." This replaced the earlier "view only, then gate"
rule, under which a stranger could browse the catalogue.

- `apps/web/src/proxy.ts` holds the door. **The list is inverted**: the OPEN
  routes are the enumerated set (`PUBLIC_SEGMENTS` and `PUBLIC_PATHS`) and
  every other route needs a session, so a new route is born locked. Open to
  anybody: the landing page `/` and its company and support pages (`about`,
  `careers`, `contact`, `docs`, `help`), every legal and policy page (`terms`,
  `privacy`, `eula`, `cancellations`, `standards`, `safety`),
  `delete-account` (a store requirement, and the only way back from a deletion
  in progress), the sign-in and sign-up doors, `start` (the browser install
  page), `welcome` (first run), `offline`, the `preview` and `gallery` fixture
  harnesses (which answer not-found on Vercel regardless), and the webhook, cron and support API routes that authenticate themselves.
  Everything else, including `search`, `listing`, `stays`, `restaurants`,
  `around` and `u`, redirects to sign-in and carries the address back.
- `apps/web/tests/gate.spec.mjs` walks the open list in a browser.
- The proxy is not the only check: every server action resolves its own
  session and every read is behind RLS.

**What the ruling accepts, deliberately:** no listing is indexed by a search
engine (`app/sitemap.ts` publishes no listing URL), a shared listing link
unfurls as a sign-in page, and both app stores need reviewer credentials
(`docs/STORE_SUBMISSION_NOTES.md`).

**The public catalogue flag, `VALLO_PUBLIC_CATALOGUE`.** Apple's guideline
5.1.1(v) makes a catalogue behind a sign-in wall a likely rejection (THE_AUDIT
STORE-P2-04). The flag is server-only and read by `proxy.ts` on every request,
so switching it needs an environment change and a redeploy, not a code change.

- **Off (the default):** unset, or any value other than `1`, `true` or `on`.
  The ruling above holds exactly.
- **On:** signed-out visitors can open `/search`, `/stays`, `/restaurants`,
  `/listing/*`, `/stay/*` and `/restaurant/*` read-only. Anonymous page
  requests are rate-limited per IP. `/u`, messages, agreements, bookings and
  every action stay behind sign-in either way, and an exact address is never
  selected for a signed-out reader (the address columns are not granted to
  anon).
- **The native app starts on `/open`**, a public route: signed in goes to
  `/home`; signed out goes to `/search` when the flag is on and to `/welcome`
  when it is off.

Whether to switch it on for a store submission is the founder's decision.

**The roles.**

- **Visitor, signed out.** Sees the landing page, the company, support and
  legal pages, and first run. Everything inside the platform raises sign in
  (unless the public catalogue flag above is on, in which case they can read
  the catalogue and a listing, and any action raises sign up or sign in).
- **Member (`user`).** Books, pays, saves, messages, posts, reviews, earns member
  badges. Created by the signup trigger. **Never asked to verify their
  identity.** A person looking for somewhere to live does not upload a passport
  to browse, save, message or pay.
- **Agent.** Applies through `/agents/apply`, uploads identity documents to a
  private bucket, is approved by an admin, then lists property, answers bookings,
  replies to reviews and is paid to a verified NUBAN account. Climbs the
  verification ladder in `public.agent_verification_checks`. **Verification is
  for this role and for sellers, and for nobody else.**
- **Admin and super admin.** The console at `/admin`, 14 destinations. Approves
  agents and listings, works the safety queues, grants and revokes standing,
  stops and unstops agents, flips kill switches. Every privileged action writes
  an append-only `audit_log` row. The first admin arrives through
  `public.admin_bootstrap`, an allow-list the signup trigger consults. No
  signed-in user can promote themselves.

## 5. The listing model

`public.listings` carries **60 columns**. This is the centre of the product and
it changed substantially on 2026-08-09.

### What a listing is for

`listing_intent` is an enum of **two** values, `rent` and `sale`. Nightly stays
are expressed as `rent` with a `rate_period` of `night`, and a restaurant table
as `rent` with a `rate_period` of `guest`. **This is a known rough edge**: the
column that exists to answer "what is this listing for" cannot distinguish four
markets with two values, and the answer is currently re-derived from
`property_type` and `rate_period` in several places. (The finding register that tracked this was retired on 17 October 2026.)

### What kind of property it is

`public.property_type` is the database enum and it is the authority. Ten values:

| Value | Market |
|---|---|
| `rental` | Annual tenancy |
| `shop`, `office`, `land` | Commercial and land, let on a tenancy or sold |
| `apartment`, `hotel`, `home`, `villa`, `shortlet` | Stay, or sale |
| `restaurant` | Eat |

`ListingKind` in `apps/web/src/lib/listings/types.ts` carries one extra value,
`experience`, which the database does not have. **The TypeScript union is
wrong.** (The finding register that tracked this was retired on 17 October 2026.)

### What it costs

**To rent.** `rent_amount_minor` per `rent_period` (`month`, `quarter`, `year`),
`rent_negotiable`, and then the part that matters most in this market: the real
cost of moving in. `caution_deposit_minor`, `service_charge_minor` per
`service_charge_period`, `agency_fee_minor`, `legal_fee_minor`,
`agreement_fee_minor`, and `total_move_in_cost_minor` as a first-class indexed
column. Also `minimum_tenancy_months` and `available_from`.

**The product rule: the card leads with the total move-in cost and the rent is
the secondary line.** Every competitor leads with the rent and buries the fees.
Leading with the truth is the differentiator and it costs nothing to build.

**To buy.** `sale_price_minor`, `price_negotiable`, `sale_status`
(`available`, `under_offer`, `sold`).

**Per night or per head.** `rate_minor` and `rate_period` (`night`, `guest`).
This column was `price_per_night_minor` and was renamed because it had been
holding annual rent since the rental pricing migration reinterpreted it. The
hotel-shaped columns are gone: no `max_guests`, `beds`, `min_stay_nights`,
`instant_book`, `cleaning_fee_minor` or `service_fee_minor`.

### What it actually is

`tenure` is a closed enum of Nigerian titles: `certificate_of_occupancy`,
`governors_consent`, `deed_of_assignment`, `gazette`, `freehold`, `leasehold`.
**It records what the seller claims. Nothing yet records whether anybody
looked.** Do not render it as though it were verified.

`size_sqm`, `bedrooms`, `bathrooms`, `toilets` counted separately as this market
counts them, `parking_spaces`, `floor`, `total_floors`, `year_built`,
`condition` (`newly_built`, `renovated`, `old`, `off_plan`), `furnished`
(`unfurnished`, `semi_furnished`, `fully_furnished`).

Every listing also answers the two questions a Nigerian asks first, as structured
columns rather than a tick box: `power_grid` (Band A through none),
`power_backup`, `power_backup_hours`, `water_supply`, `prepaid_meter`, and
`has_estate_access` for the gate.

### Where it is

`latitude` and `longitude`, both nullable, plus `location`, a PostGIS
`geography` column maintained by trigger from those two, with a partial GiST
index. `public.listings_in_bounds()` answers a viewport query in Postgres and is
deliberately not `SECURITY DEFINER`, so RLS decides visibility.

**Nothing in the application calls it yet.** The map reads the whole catalogue
and places pins on area centroids. A listing with no pin has no geography and is
invisible to every viewport query, so the pin must become mandatory before the
catalogue fills. (The finding register that tracked this was retired on 17 October 2026.)

### Its state and its media

`public.listing_status`: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`,
`MORE_INFO_REQUIRED`, `APPROVED`, `PUBLISHED`, `REJECTED`, `SUSPENDED`. Search
reads `PUBLISHED` only. Admin approval is mandatory and is the quality gate.

Photos and videos share one uploader (`lib/agent/listings-model.ts`): at
least 3 items (`MIN_MEDIA`), 5 recommended, the cover must be a photo, up to 3
videos (`MAX_VIDEOS`) of 60 seconds and 100 MB each, in MP4, MOV or WebM.
The video bucket limit is set on the live database as well as in the app.
`DECISIONS_2026-10-13.md` row 9 is the ruling.

## 6. Trust

Five things carry the trust and they are separate on purpose. **They must never
collapse into one tick.**

1. **The verified badge** means an admin approved the listing and the agent is
   verified. Both, and nothing else.
2. **`address_verified_at`, `physically_inspected_at`, `verified_by`** are
   timestamps, not flags. Render them as dates. "Inspected 12 July 2026" is a
   fact a reader can weigh; a tick is a promise the platform has to keep. A null
   is not a negative and must not look like one.
3. **The verification ladder** is about the agent, not the listing. Rungs are
   recorded in `agent_verification_checks`; `agents.verification_tier` is the
   count of rungs passed with no gap below.
4. **Badges** are earned standing, 15 defined in `public.badges`, split into an
   AGENT ladder and a MEMBER ladder, awarded nightly by `private.sweep_badges`
   and grantable by an admin with a mandatory reason and an audit row.
5. **Vallo never holds customer money** (Track A, 25 September 2026, and ADR
   0003). No user-facing copy may say it does: every money sentence is read
   from `apps/web/src/lib/money/copy.ts`. A negotiated deal runs on an
   **agreement** both sides confirm; since D83 the second confirmation approves
   it, and a direct payment waits for a person only when a risk signal fires.
   For rent and shortlets the payer picks Escrow, held by a licensed partner
   while `protectedRailLive()` reads it as working, or card; a sale is always
   escrow. The **Vallo Guarantee is retired** (`guarantee_bps` 0, D51); claims
   on payments made while it ran are still honoured.
   `docs/MONEY_ARCHITECTURE.md` is the whole mechanism.

**The badge is earned and is never for sale.** A paid inspection is a service
with a real cost and may be charged for; the badge that results depends on the
inspection's outcome and not on the payment. The moment a badge can be bought,
every badge on the platform is worth nothing.

The standing safety rule, stated on `/rent`, on every rental detail and in first
message education: keep every chat and payment inside Vallo, deals made outside
are not protected by us, pay only after you have inspected the property. A
database trigger flags ten digit account numbers and payment keywords in
messages, listing text, reviews and posts into an admin queue.

## 7. Terminology

Use these words. Do not invent synonyms.

| Word | Means | Not |
|---|---|---|
| **Listing** | One property, venue or place offered by one agent | Property, unit, item |
| **Agent** | A verified supplier who lists | Host, landlord, vendor, seller |
| **Member** | A signed-in person who is not an agent | User, customer, guest, unless they are actually staying |
| **Guest** | A member who has booked a stay | |
| **Stay** | A nightly booking | Reservation, unless it is a restaurant table. ("Trips" is the Stays surface that lists them, `/trips`.) |
| **Reservation** | A restaurant table request | |
| **Around** | The social layer | Feed, community, compound. A compound is a different thing in Nigerian property |
| **Place** | A named area inside Around, backed by a local government | Hub, district, neighbourhood |
| **Post** | Anything somebody writes in Around | Gist, talk, echo. The lexicon was tested and cut |
| **Story** | A picture post with a headline; it stays up until its author or a moderator takes it down (nothing expires it) | |
| **Standing** | Badges and trust, as a whole | Reputation, score, karma |
| **Stop** | An admin suspending an agent's ability to trade | Ban, block. Block is a member muting another member |
| **The console** | `/admin` | Dashboard, backend, admin panel |
| **Workspace** | Who you are being: Personal, or one of owner, agent, firm, hotel, shortlet, restaurant (`/agent/*`, `/host/*`). One "Add a workspace" chooser at `/profile/setup` | Profile, role, mode, portal, host dashboard. `apps/web/src/lib/i18n/workspace-terms.test.ts` fails on them in English UI copy |

**Banned in UI copy:** `demo`, `sample`, `preview`, `not live`, `coming soon`,
`lorem`. Enforced by the vitest scan in `apps/web/src/lib/copy/`
(`banned-phrases.test.ts`), which runs with `npm test`. The synonyms in the
"Not" column above are enforced by `BANNED_SYNONYMS` only where no product
string still uses them; the rest join that list in the change that rewrites
their copy (THE_AUDIT DOC-08). The ban exists because this repository once
shipped twenty-three invented places, twenty-two of them carrying
`verified: true` with fabricated ratings on addresses that do not exist. Any
example content must say what it is in plain words and must never carry a trust
signal.

Money is always **integer kobo**, a bigint, and only `formatMoney` from
`@vallo/i18n` turns it into naira on screen. Never float money. Never
divide by 100 by hand. Percentages are integer basis points for the same reason.

British spelling in documentation and product copy. **Zero em dashes anywhere.**

### How the product presents itself

**The slogan is "Real Estate reimagined!"**, set by the founder on 16 September
2026. It replaces "Find it. Rent it. Love it.", which is retired.

**A slogan is a positioning line and not a product description**, so it belongs
beside the logo: the page title, the Open Graph card, the footer, the auth shell
and the email sign off.

**One exception, made by the founder on 16 September 2026 and recorded here so
it reads as a decision rather than a drift: the landing `h1` is the brand line,
"Real Estate, reimagined."** The rule's reason still holds, so the h1 does not
carry the job alone: the overline above it names what this is (Nigeria's real
estate marketplace), the subtitle carries the offer and the proof, and the
move-in argument keeps its own band. The h1 stays in English in every locale,
the way the wordmark does.

**The sentence that says what the product does is the one in section 1 of this
document**, and it is the one a headline should be built from. A visitor's first
four seconds should tell them there are properties, roughly what one costs, and
where. A slogan does none of that.

**Changing it is not a find and replace**, and this is recorded because the first
attempt at it was. The three words are an i18n key, `landing.hero.line1/2/3`, the
auth shell and the footer reach it through that key, it is translated into
Yorùbá, Hausa and Igbo, and **it is reused as the titles of the three
how-it-works steps**. The retired revamp record had the full inventory
and the three separate jobs it breaks into.

## 8. Language and theme

Four locales ship: English, Yorùbá, Hausa and Igbo. `en` is the typed source of
truth; the other three are complete and awaiting native review. `Accept-Language`
is negotiated, plurals go through `Intl.PluralRules`.

**Dark by default, light by choice (Track E, 25 September 2026).** Light mode
was removed on 23 September (`docs/design/LIGHT_MODE_REMOVED.md`, now history)
and reintroduced properly after the five root causes in
the retired light mode survey were answered: a complete light palette in
`tokens.css` with `apps/web/src/app/css/light.css`, a dark ground behind the logo
and the role-switch coin, glass objects standing alone on white with a soft blue
shadow, and anything over a photograph kept dark on purpose. The choice (Light, Dark, System) sits at the
foot of the side navigation, is painted by the server from the `nf_theme`
cookie, and defaults to Dark. Both themes are swept at 390px
(`apps/web/scripts/design/light/sweep.mjs`).

The brand is one blue family. Deep navy-black, dark neon blue, electric blue
glow. Anchors: base `#010118`, glow `#0C39EF`, mid `#000F98`. **No orange, amber,
gold, purple or magenta.** The only two hues outside the family are emerald for
success and rose for error; the attention state is bright cyan. A lint check
(`check-css-tokens.mjs`, part of `npm run lint`) fails on a raw colour, and layer-1 token leakage in components and
stylesheets is zero.

Because the palette is one hue, **colour alone may never be the only signal**.
Rent against sale, held against available, and every status pill must be
distinguishable by label or shape as well.

**No Google or Apple sign in.** Email and password only. **NOT BUILT AS
DESCRIBED:** `startGoogleOAuth` and `startAppleOAuth` still exist in
`apps/web/src/lib/auth/actions.ts:660` and `:664` and are still referenced by
`components/auth/AuthChoices.tsx`, gated on `NEXT_PUBLIC_AUTH_PROVIDERS`. See
RECOMMENDATIONS N-4.

## 9. Where the platform actually stands

Counted live on 2026-08-09, project `uccixoonmbhrnyczyigt`. (Dated note, 28
September 2026: `wallets` and `wallet_entries` moved to the `retired_custody`
schema on 25 September 2026 and no role can reach them.)

```
profiles 1   user_roles 2   agents 0   agent_applications 0
listings 0   listing_videos 0   bookings 0   reviews 0
wallets 0   wallet_entries 0   transactions 0   ledger_entries 0
posts 18 (all author_kind SYSTEM)   areas 7   badges 15   user_badges 1
feature_flags 8   local_governments 774   occupations 749   states 37
70 base tables and 1 view in public, RLS on every table
130 migrations applied.  PostGIS 3.3.7.  pg_cron 1.6.4 with 6 active jobs
```

**The supply chain has not started.** One person has an account, holding the two
bootstrap roles. Nobody has applied to be an agent, so nothing is published, so
every discovery surface is genuinely empty.

That is correct rather than broken, and the honest answers to it are real
listings from real agents, an empty state that says why and captures the demand,
and the place layer, which is already populated with 774 local governments and 7
live areas. It is **not** a reason to reinvent the fabricated catalogue. See
(The finding register that tracked this was retired on 17 October 2026.)

## 10. Known divergences between this document and the code

Kept here so the list is short and visible rather than scattered. The finding
register these rows once pointed at was retired on 17 October 2026; each row is
to be re-read against the code before anybody acts on it.

| What | Status |
|---|---|
| `ListingKind` declares `experience`; `property_type` does not | Unverified since the register was retired |
| `listing_intent` has two values for four markets | Unverified since the register was retired |
| Buy and sell exist in the schema and nowhere in the interface | Unverified since the register was retired |
| PostGIS and `listings_in_bounds` exist and nothing calls them | Unverified since the register was retired |
| No storage bucket has a size or type limit | Unverified since the register was retired |
| The money write path still logs nothing and still answers 200 on a misconfiguration | Unverified since the register was retired |
| The npm scope, the workspace and the live domain still say Vallo, or worse, vallo | Unverified since the register was retired |
