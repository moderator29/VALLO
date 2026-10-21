# Architecture Decision Record

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

Every entry states the decision, why it was made, what else was considered, and
what it would cost to change later.

**Corrected 2026-08-09.** Three entries had drifted from the code and are amended
in place: ADR-003 and ADR-010 said `Icon3D` was retired and kept in the
repository, and it does not exist at all any more; ADR-007 described a flat
twelve-destination consumer rail that the code groups into a tree; ADR-009's
advisory count is a moving number and now says so. Two decisions have been made
since and are recorded as ADR-013 and ADR-014.

**The live decisions, in one line each.** ADR-002 two layer tokens, CSS first.
ADR-004 money is always integer kobo. ADR-010 use the supplied artwork rather
than redraws. ADR-011 two icon tiers. ADR-012 the stride. Those five are the ones
a new surface has to obey.

---

## ADR-001. npm workspaces monorepo

**Decision.** `apps/*` plus `packages/*`, wired with npm workspaces.

**Why.** The build specification calls for `apps/mobile`, `apps/web`,
`apps/admin`, `apps/api` and shared packages. Starting single-app and splitting
later means rewriting every import path across four surfaces. Master Rule 75
says not to take shortcuts because the current MVP is small.

**Considered.** pnpm and Turborepo. Both are better at scale, but npm ships with
Node and adds no toolchain to learn or break. Turborepo can be added later
without moving a single file.

**Cost to change.** Low. Moving to pnpm is a lockfile regeneration.

**Status.** Active. `apps/web`, `packages/design-tokens`, `packages/i18n` exist.

---

## ADR-002. Two layer design tokens, CSS first

**Decision.** `packages/design-tokens/src/tokens.css` holds a raw palette
(layer 1) and a semantic layer (layer 2). Components may only reference layer 2.
A TypeScript mirror exists for SVG and canvas, where `var()` and `color-mix()`
are not reliable.

**Why.** Master Rules 27 and 29 demand a centralised system and forbid stray
colours. CSS custom properties theme at runtime with no re-render, which a JS
token object cannot do.

**Considered.** A JS-only token object consumed through Tailwind config. Rejected
because runtime theme switching then requires a full React re-render, and the
light theme and reduced motion overrides get much harder.

**Cost to change.** Moderate. Renaming semantic tokens is a repo wide find and
replace.

---

## ADR-003. Vector icon family instead of the supplied raster pack

> **VOID. Superseded by ADR-010**, which reverses it and explains why. Read that
> entry instead. This banner is here because ADR-010 sits two hundred lines
> further down and nothing at this end of the file said so, while the text below
> still describes `Icon3D` as the production component.
>
> **`Icon3D` does not exist.** Corrected 2026-08-09: it is not retired-and-kept,
> it was deleted. `apps/web/src/design-system/icons/` contains exactly three
> files, `BrandIcon.tsx`, `UiIcon.tsx` and `TrustIcon.tsx`. There is no
> `Icon3D.tsx`, no `glyphs.tsx` and no `Icon` wrapper. A grep for `Icon3D` across
> `apps/web/src` and `packages/` returns two hits and both are prose in comments
> telling the reader it is retired. The live tiers are `BrandIcon` for content
> objects and `UiIcon` for navigation, per ADR-011, plus `TrustIcon`, a
> landing-only mark set that is not a tier.

**Decision.** The production icon set is authored as SVG in
`apps/web/src/design-system/icons/`. The supplied pack is kept in
`assets/icon-pack/` as visual reference only.

**Why.** Measured: the supplied sheet is 1300 x 1209 for roughly 192 icons, so
each glyph is about 61 x 59 real pixels, largest 72. A 64px category tile on a
3x display needs 192px of source. Upscaling produces visible softness, and no
slicing technique recovers detail that was never captured. Master Rule 28 asks
for one coherent 3D family; Master Rule 60 says visual effects must not cost
usability, and blurred icons do.

**Considered.** Slicing and serving at native size only. Rejected because it caps
icons at roughly 24px logical on a 3x screen, which is far smaller than the
references use them.

**Cost to change.** Low. `Icon3D` is one component with a glyph registry behind
it, so genuine vector sources can be dropped in without touching call sites.

**Reversal condition.** If vector or high resolution sources for the original
pack appear, prefer them and keep the `Icon3D` API.

---

## ADR-004. Money is always integer minor units

**Decision.** All amounts are stored and passed as integer kobo. Division happens
in exactly one place, `formatMoney` in `packages/i18n`.

**Why.** Floating point money produces rounding drift that surfaces as
reconciliation failures. Paystack transacts in kobo, so this also removes a
conversion at the payment boundary. Master Rule 48 puts financial correctness on
the server; the representation has to be right before that matters.

**Considered.** Decimal strings. Heavier and needs a library for arithmetic.

**Cost to change.** Very high after any real transaction exists. This is the
cheapest possible moment to fix it, which is why it is fixed now.

---

## ADR-005. Data access behind a repository interface from day one

**Decision.** Discovery reads through `ListingRepository`. `NF_DATA_SOURCE`
selects a seed implementation or the real API, and the seed source is labelled
in the UI wherever it renders.

> **Half of this decision was reversed and this entry did not say so.**
> Corrected 2026-08-07. The interface stands and was worth every line of it:
> `SupabaseListingRepository` slotted in behind it and every surface widened
> without a component change, which is the whole argument below.
>
> The seed implementation is gone. It held twenty-three invented places, and
> twenty-two of them carried `verified: true` with fabricated ratings on
> addresses that do not exist, which put this platform's own trust mark on
> inventory nobody had checked. The labelling this entry promised also never
> reached discovery: `isSeed` was read in exactly two places, neither of them
> search, a listing page or the map. The owner then banned sample, preview and
> demo strings from UI copy outright, which closed the option of fixing it by
> labelling harder.
>
> What replaced it is not a second source but an honest absence. With no
> Supabase credentials, discovery returns nothing and every screen draws its
> designed empty state. The full reasoning is written at the top of
> `apps/web/src/lib/listings/repository.ts`, where anyone tempted to put a
> catalogue back will read it first.

**Why.** Master Rule 8 forbids fake functionality and Master Rule 66 requires
provider abstraction. Hardcoding sample listings into components creates work
that has to be deleted later and risks sample data reaching production
unlabelled.

**Considered.** Building the pages against a live API first. Not possible, the
API does not exist. Hardcoding into components. Rejected per above.

**Cost to change.** Very low. One factory function.

---

## ADR-006. Inter as the typeface

**Decision.** Inter Variable, `latin` plus `latin-ext` subsets.

**Why.** Coverage, not fashion. The face has to carry all of: the naira sign
U+20A6; Yoruba `ẹ ọ ṣ` and Igbo `ị ọ ụ`, which are Latin Extended Additional and
need a combining dot below; Hausa `ɓ ɗ ƙ ƴ` from Latin Extended-B; and tone marks
stacking above vowels that already carry a dot below. That last case breaks most
display faces. The supplied mockups themselves show the failure mode, rendering
the naira sign as a plain capital N in several places.

**Considered.** A geometric display face for headings. Deferred until a candidate
is validated against a real four language string set plus ₦.

**Cost to change.** Low. One token and one font import.

---

## ADR-007. Consumer navigation frozen at twelve destinations

**Decision, as originally made.** Home, Hotels, Apartments, Homes, Restaurants,
Experiences, then Bookings, Messages, Wallet, AI Assistant, Profile, Settings.

**Why.** Master Rule 17 freezes navigation. Three independent source-of-truth
references agree on exactly this list and order, including the brand sheet whose
icon row enumerates all twelve. A fourth reference shows a different consumer
rail, which is recorded as contradiction C-10 and is not adopted.

**Amended 2026-08-09: the twelve are grouped, not flat, and the destinations
have moved.** `apps/web/src/components/app/nav-model.ts` is the one source both
the desktop rail and the phone drawer read. It builds a tree: Home, Rent, Explore
(with Hotels, Apartments, Homes, Restaurants and Experiences as `?type=`
children), Around (with three children), then an Account section holding
Bookings, Messages, Notifications, Wallet, AI Assistant and Profile (with Saved
and Settings as children), then Agent Mode and the Console for whoever has one,
then Legal.

The reason is written in that file at lines 8 to 16 and is good: five of the
twelve were `?type=` variants of one screen sitting at the same level as Wallet.
**Rent** is new and is the pivot arriving in the navigation. The phone dock is a
deliberately different six destinations
(`components/app/MobileTabBar.tsx:9-12`), because a twelve item rail does not
fit a thumb.

**Still not in the navigation: Buy and Sell.** The product is a marketplace for
renting, buying and selling and no rail, dock or chip mentions sale. That is
downstream of the data model, which cannot express one: `RECOMMENDATIONS.md`
P-1 and N-6.

**Cost to change.** Moderate and rising. Routing, layout shells and permission
boundaries all key off it.

**The admin rail, resolved 2026-07-28.** It had four conflicting variants. The
owner picked reference 04 (B-10) and the console was built on it: **14
destinations** in `app/admin/_components/nav.ts`, being overview, flags,
moderation, alerts, reports, applications, stops, listings, bookings, tickets,
social, standing, reference and switches. This entry stood as "NOT decided. No
admin surface is built" for ten days after the console shipped, and then said 13
for a further ten, which is the kind of line that gets an ADR file disbelieved as
a whole.

---

## ADR-008. Security headers at the edge, secrets server side only

**Decision.** `next.config.ts` sets HSTS, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` on every route.
Modules that read credentials import `server-only`.

**Why.** Master Rules 9 and 10. The `server-only` guard turns a leaked secret
into a build failure rather than a runtime disclosure, which is the difference
between an inconvenience and an incident.

**Not yet done.** Content Security Policy needs a nonce strategy that works with
Next streaming. Tracked in KNOWN_GAPS.

---

## ADR-009. Dependency overrides for transitive vulnerabilities

**Decision.** Root `overrides` pin `sharp` to ^0.35.3 and `postcss` to ^8.5.23.

**Why.** Next 16.2.12 depends on `sharp` 0.34.5 and `postcss` 8.4.31, which carry
four libvips CVEs and two postcss advisories. `npm audit fix --force` proposes
downgrading Next to version 9, which is absurd. The overrides resolve all six
while the build stays green.

**Residual, last re-run 2026-08-07. Not re-run 2026-08-09, so treat the number
as unverified.** `npm audit` reported **2** high severity advisories, not the
nine this entry originally recorded. Both were lint-time only and neither reaches
the shipped bundle or the request path, which is the reason the decision stands
unchanged:

- `brace-expansion`, the original residual, reduced from nine advisories to one.
- `js-yaml` 4.3.0, reached through `eslint > @eslint/eslintrc`. Newer than this
  entry and never recorded until now. Quadratic CPU consumption resolving
  `!!omap`, on input that is only ever an ESLint config file we wrote.

Tracked rather than papered over. Re-count before quoting this number: it moved
by seven without anybody noticing, in both directions.

---

## ADR-010. Use the supplied artwork, not redraws

**Decision.** The brand mark, the hero island and the icon family are the
owner's supplied artwork, cut from the source sheets with alpha preserved.
Extraction is scripted in `scripts/extract-brand-assets.py` and
`scripts/build-icon-assets.py`, with the sheets kept in `assets/source-sheets/`.

**Why.** ADR-003 previously chose to redraw the icons as vector on resolution
grounds. That was the wrong trade. The redraw did not match the supplied
identity, and matching the identity is the point. Redrawn glyphs were also not
what the owner asked for.

**Supersedes.** ADR-003, which is now void. The vector glyph registry and the
vector isometric scene have been deleted.

**Consequence.** Icons are capped by source resolution at roughly 91 x 100 and
the island at 546 x 493. Both are resampled 2x with Lanczos plus a light unsharp
pass so high density screens get a better source than a browser bilinear
upscale, which is where they were visibly soft. This adds no detail the source
never had, and that limit is real: above about 64px for icons and about 550 CSS
px for the island, softness returns.

**Reversal condition.** If vector or higher resolution originals appear, rerun
the scripts against them. No call site changes.

---

## ADR-011. Two icon tiers

**Decision.** Tier two is the 3D signature object family, `BrandIcon`, 57
commissioned objects, used at 32px and above. Tier one is `UiIcon`, a stroked set
on a 24 grid inheriting `currentColor`, 40 glyphs, used below 32px.

**Plus one mark set that is not a tier.** `TrustIcon` holds six marks (globe,
shield, ai-chip, africa, app-store, play-store) and is used on the landing trust
strip and nowhere else. It is deliberately not exported for general use.
`docs/ICON_SYSTEM.md` called this "tier 3" and it is not: a tier is a rule about
which family answers a job, and there is no job anywhere else in the product that
this set answers.

**Why.** The design direction asks for exactly this split, and the reason became
concrete in review: the 3D objects carry a lit tile, and at 14px that tile
collapses into an unreadable coloured square. Star ratings, bed and bath counts,
amenity marks and the search affordance were all illegible. Tier one stays crisp
at 12px and takes the colour of the text beside it.

**Cost to change.** Low. Two components, clear size boundary.

---

## ADR-012. The stride

**Decision.** Every container, button, chip and field carries a luminous
gradient ring drawn on the border box while the fill sits on the padding box.
One element, no wrapper, no pseudo element.

**Why.** It is the single treatment that makes cards, buttons, chips, fields and
auth rows read as one material. The ring runs brightest at the upper left and
decays toward the lower right, matching the light direction the 3D icon family
already uses, so painted UI and rendered artwork agree about where the light is.

**Buttons** additionally stack five layers: outer bloom, vertical body gradient,
inset top hairline, inset bottom shade, and a specular sheen over the top half.
Pressing translates down one pixel and pulls the bloom in, so the control reads
as physically depressing rather than just changing colour.

**Fallback.** Surfaces relying on `backdrop-filter` fall back to a solid body
where it is unsupported, so low end Android gets a legible panel rather than a
washed out one.

---

## ADR-013. First-party inventory only

**Decision, 2026-08-09.** Every listing on RentMe was listed on RentMe by a
person who applied, was verified and was approved. No Google Places, no LiteAPI,
no Amadeus, no scraped feed, no affiliate deep link.

**Why.** A hybrid model was designed, built and shipped: one provider interface,
a registry, per-provider kill switches in `public.feature_flags`, a hard 2.5s
timeout collected with `allSettled`, and a dedupe rule requiring both a 150 metre
haversine match and a name token match before two records collapse. It worked.
It was removed anyway, and the reason is the one thing a partner feed can never
give: an agent to message, a property to inspect, and somebody accountable when
it is not what the photographs showed. The verified badge, the verification
ladder and escrow are all claims the platform makes about a person. There is no
person behind a rate feed.

There is a second reason and it is commercial. `POST /rates/book` with a card
would have made RentMe the merchant of record: paying the supplier from a funded
wallet, collecting naira ourselves, and owing the guest a refund out of our own
pocket every time a supplier failed after we had taken their card. That is a
funded account and an accepted liability before it is a line of code.

**Considered.** Keeping partner stock priced but not bookable, which is what
shipped for a while and is honest. Rejected because a shelf of things you cannot
buy trains people to leave.

**Cost to change.** Low to reverse in code and high to reverse in trust. The
interface is deleted but the shape is recorded in
`docs/archive/HYBRID_INVENTORY.md`.

**Consequence.** Discovery is empty until agents list. That is correct rather
than broken, and four specs skip out loud when the catalogue is empty rather than
passing on invented rows. Do not make them pass by putting a seed catalogue back.

**Residue to clear.** `public.places_cache` (243 rows), `partner_stay_intents`,
and two feature flag rows. `RECOMMENDATIONS.md` S-2.

---

## ADR-014. Scheduled work runs in Postgres, not in the deployment

**Decision, 2026-08-04.** `pg_cron` inside the database, applied by
`supabase/migrations/20260804184423_the_scheduler_exists_now.sql`. Six jobs.

**Why.** The obvious alternative was a route Vercel's cron calls, and on the
Hobby plan that is **one invocation per day**. Releasing a stale booking hold
once a day means a guest who abandons a checkout at nine in the morning keeps
somebody else's room until the following night: a real bed nobody could book, for
a whole day. Rate limit rows would pile up for twenty four hours between sweeps.

`pg_cron` is not an HTTP request, so it does not touch the deployment's cron
budget at all, it cannot be lost to a cold start or a function timeout, and it
keeps running when the web application is down. The one Vercel cron stays free
for something that genuinely has to be a request.

**Considered.** One authenticated maintenance route the platform calls on a
schedule from outside. Rejected: it needs a secret, it needs somebody to own the
caller, and it fails silently the day that caller stops.

**Cost to change.** Low. Six `cron.schedule` calls.

**The two traps.** Every schedule is **UTC** and Lagos is UTC+1, so a job written
for a Lagos hour must be shifted; this project has been caught by that once
already, and each schedule in the migration names the Lagos time it means. And
the jobs are unattended with no alert on failure: `cron.job_run_details` carries
the outcome and nothing reads it. `RECOMMENDATIONS.md` T-3.
