/**
 * THE PRODUCT'S HIERARCHY, WRITTEN DOWN.
 *
 * HISTORY IS NOT HIERARCHY. Every back control on this platform used to call
 * `router.back()`, which walks the BROWSER'S history: the list of places the
 * machinery happened to send somebody, in the order it sent them. A person who
 * arrived at `/settings/account` through a sign-in bounce has `/sign-in` behind
 * them. A person who followed a deep link from a notification has whatever they
 * were reading in another application behind them, or nothing. A redirect leaves
 * the redirector behind them. In none of those cases is the previous entry the
 * parent of the current screen, and in all of them the old control cheerfully
 * went there. That is how a person inside the Console pressed back and landed on
 * the login page, and how somebody inside a feature pressed back and landed on
 * the marketing site.
 *
 * `canGoBackInApp()` in `lib/ui/history.ts` was the previous guard and it is not
 * wrong, it is answering a different question. It proves there is a screen of
 * OURS behind this one. It cannot prove that screen is the PARENT of this one,
 * because two of its three answers (our own sequence stamp, and a same-origin
 * referrer) carry no URL at all, and the third (`navigation.canGoBack`) is a
 * boolean. A control that trusts it is trusting "somewhere in our app" to mean
 * "one level up", and those are not the same claim.
 *
 * So the hierarchy is DECLARED, here, once, and read by
 * `lib/nav/resolve.ts`. This file is meant to be read by a person checking
 * whether the product's shape is what they think it is. It holds no logic on
 * purpose.
 *
 * HOW TO READ AN ENTRY.
 *
 *   "/listing/[id]": "/search",
 *
 * Left: a route pattern, spelled exactly as the directory under `src/app` is
 * spelled, minus the route groups (`(app)`, `(auth)`, `(site)`) which never
 * appear in a URL. `[id]` matches one segment.
 *
 * Right: that route's parent, as a pattern. Dynamic segments in the parent are
 * filled from the ones captured on the left, which is what makes
 * `"/u/[handle]/followers": "/u/[handle]"` resolve `/u/ada/followers` to
 * `/u/ada` rather than to a literal `[handle]`.
 *
 * `ROOT` means this route is the top of the hierarchy. There is nothing above
 * it, no back control belongs on it, and on Android it is the one kind of place
 * where the hardware back button may close the application.
 *
 * A ROUTE THAT IS NOT IN THIS FILE HAS NO DECLARED PARENT, AND THAT IS LOUD
 * RATHER THAN QUIET. `resolve.ts` returns `no-parent-declared`, the control
 * falls through to whatever fallback its caller passed, and a development build
 * prints a warning naming the path. It is deliberately NOT defaulted to "strip
 * the last segment": that guess is right often enough to hide the times it is
 * wrong, and a hierarchy nobody declared is exactly the thing this file exists
 * to stop.
 *
 * WHERE THE PATH DOES NOT MATCH THE HIERARCHY, AND WHY.
 *
 *   /listing/[id] -> /search        A listing's parent is the shelf it was
 *                                   taken off, not `/home`. The old fallback
 *                                   was `/home`, which threw away a filtered
 *                                   hunt every time it fired.
 *   /messages/[id] -> /messages     The inbox, per the founder's own example.
 *   /messages/share/<kind>/[id]     Four entries rather than one, because the
 *                                   thing being shared IS the parent and
 *                                   `kind` is a closed set of literal
 *                                   segments. This reproduces the page's own
 *                                   `back` computation as data.
 *   /rent/move-in/[listingId]       The listing being moved into, not `/rent`.
 *   /around/new -> /around/settings The suggestion flow is entered from the
 *   /around/manage                  feed's settings screen, not from the feed.
 *   /legal/* -> /settings           Reached from Settings, and nowhere else.
 *   /admin/*, /agent/*, /host/*     Each console has its own landing screen,
 *                                   and every screen inside it returns there.
 *                                   Back inside the Console never leaves the
 *                                   Console, which is the founder's first
 *                                   complaint.
 *   /sign-in, /sign-up -> /welcome  NOT `/start`, which is a 307 and not a
 *                                   screen. See the door section below.
 *   /agreements/[id] -> /agreements Track A: the agreement list is where
 *                                   money now lives; the wallet and escrow
 *                                   routes are retired and redirect there.
 *   /price/area/[id] -> /price      What the page itself already passes to
 *                                   `PageHeader`, read off the surface.
 *   /preview/<four decks>/[screen]  Four decks have no index page, so the
 *                                   generic pattern sent back to a 404.
 *
 * EVERY OTHER ROUTE FILE IN `src/app` IS IN `NON_NAVIGABLE` AT THE FOOT OF
 * THIS FILE, with the reason it can never carry a back control, and
 * `route-files.test.ts` fails if any route file is in neither structure. A
 * route nobody has made a decision about is now impossible to add quietly.
 *
 * TWO ENTRIES BELOW DELIBERATELY DRAW NO CONTROL, AND THAT IS NOT THE GAP.
 *
 * A declared parent is a fact about where a screen SITS. It is not a promise
 * that the screen paints an arrow, and these cannot:
 *
 *   /gallery                `notFound()` in a production build by its own
 *                           guard. The control is wired for development, which
 *                           is the only place the board exists.
 *   /offline                the service worker's fallback document, served
 *                           when there is no network at all. Its way up is the
 *                           brand lockup, which links to `/home` - the same
 *                           place a back control would push. A second control
 *                           on a screen that only renders when nothing can be
 *                           fetched would be a control that cannot work.
 *
 * Android is unaffected by both: `isAppRoot` is false for every one of
 * them, so the hardware button goes to the parent rather than closing the
 * shell, which is the half that matters most there.
 *
 * `tests/back-destinations.spec.mjs` walks the rest in a real browser.
 */

/** The top of a hierarchy. Nothing sits above a route marked with this. */
export const ROOT = null;

export type ParentRoute = string | typeof ROOT;

export const ROUTE_PARENTS: Readonly<Record<string, ParentRoute>> = {
  /* ---------------------------------------------------------- the website */
  "/": ROOT,
  "/about": "/",
  /* V-82: a public area price page sits under the landing page, as the
     company pages do; it is a statement about a market, not a shelf. */
  "/areas/[state]/[area]": "/",
  "/cancellations": "/",
  "/careers": "/",
  "/contact": "/",
  "/delete-account": "/",
  "/docs": "/",
  "/docs/[slug]": "/docs",
  "/eula": "/",
  "/help": "/",
  "/r": "/",
  "/r/[code]": "/r",
  "/privacy": "/",
  "/disclaimer": "/",
  "/host-agreement": "/",
  "/safety": "/",
  "/check": "/",
  /* Recommendations A: the supply doors, the calculator, the guides, the
     sign-in-free email preferences and the invite door. */
  "/for-agents": "/",
  "/for-hosts": "/",
  "/for-landlords": "/",
  "/move-in-cost": "/",
  "/guides": "/",
  "/guides/[slug]": "/guides",
  "/email/preferences": "/",
  "/standards": "/",
  "/styleguide": "/",
  "/terms": "/",

  /* ------------------------------------------------------------- the door
   *
   * `/start` IS NOT A SCREEN AND MAY NOT BE ANYBODY'S PARENT. It is
   * `app/(auth)/start/route.ts`, a 307 to `firstRunHref("/sign-up")`, which is
   * `/welcome?next=/sign-up`. `/sign-in`, `/sign-up` and `/auth/callback` all
   * named it as their parent, and on a device that has already seen first run
   * `planFirstRun` forwards that straight on, so BACK FROM SIGN IN LANDED ON
   * SIGN UP. Walked, cold and warm, in a real browser.
   *
   * The screen above both doors is `/welcome`, whose closing panel IS the
   * choice between them (Sign in, Create an account, Look around first). With
   * no `?next` a returning device opens at that choice, which is exactly where
   * a person who pressed back from a door expects to be.
   *
   * `/start` keeps its own entry because it is still a URL that links point at,
   * and a declared route is one `isAppRoot` answers NO for. Nothing is above a
   * redirect, so its parent is the landing page, and no control ever draws on
   * it because no document is ever served from it.
   */
  "/start": "/",
  "/sign-in": "/welcome",
  "/sign-in/email": "/sign-in",
  /* A3 and A2: the email code and the phone doors open from the sign-in
     form, and back returns to it. */
  "/sign-in/code": "/sign-in",
  "/sign-in/phone": "/sign-in",
  "/sign-up": "/welcome",
  "/sign-up/email": "/sign-up",
  "/sign-up/verify": "/sign-up/email",
  /* B-2: the terms and 18+ step for a new Google or Apple account. The
     person is already signed in and every app route leads back here until
     it is done, so there is nothing above it to go back to: a root, like
     `/welcome`. No drawn back control, and Android's hardware back puts the
     app down rather than bouncing between the gate and this screen. Its own
     "Not you? Sign out" is the way out. */
  "/sign-up/finish": ROOT,
  "/forgot-password": "/sign-in",
  "/forgot-password/code": "/forgot-password",
  "/reset-password": "/sign-in",
  /* The landing place of every link out of Supabase Auth. A person pressing
     back here has abandoned a verification, and `/sign-in` is where its own
     refusal path already sends them (`?notice=link-expired`). `/welcome` was
     the other defensible answer and is one step further from what they were
     doing. */
  "/auth/callback": "/sign-in",
  /* The share door (V-07). A stranger arrives from outside Vallo and the
     card's own button is the only way on; the door draws no back control.
     Declared under the landing page because that is the public surface it
     sits beside, and a hardware back that had to go somewhere should go
     there rather than into the platform it is a door to. */
  "/s/[token]": "/",

  /* ------------------------------------------------- the two app homes
   *
   * Two roots, not one, because the product has two sides. `/home` is the rent
   * side and `/stays` is the stays side, and `nav-model.ts` makes each one the
   * first destination of its own tab bar. Both are tops of the hierarchy and
   * both are places Android's hardware back button may close the shell.
   */
  "/home": ROOT,
  "/stays": ROOT,
  /* The third root: the welcome intro is the first screen of the app for
     anybody signed out (`shellStartPath`), and the founder's rule is that it
     cannot be skipped. It used to name `/home` as its parent, so Android's
     hardware back from the intro pushed `/home`, which a stranger meets as
     the sign-in wall: the intro skipped in one press. As a root, back here
     puts the app down, the way back does on any app's first screen. The
     slides inside it are history entries of their own and still step back
     one at a time (`lib/nav/in-page-step.ts`). A signed-in member only
     reaches it by choosing it (Get started on the landing page, itself a
     root), and its ending is their own Continue into the app. */
  "/welcome": ROOT,
  /* Not a screen: a 307 to `/home` for a member and `/` for anybody else. It
     is declared (it used to sit in NON_NAVIGABLE) because the browsing
     screens name it as their parent, and a parent must be a route in this
     map. A ROOT, because it only ever lands on one. No document is served
     from it, so no control ever draws on it. */
  "/home-or-landing": ROOT,
  "/offline": "/home",

  /* ----------------------------------------------------------- rent side */
  /* The two browsing screens, opened cold (a shared link, a pasted address),
     go to WHICHEVER HOME FITS THE READER: `/home-or-landing` answers `/home`
     for a member and `/` for a stranger, on the server, from their cookies.
     C3.2 (23 September) sent them to `/` so a signed-out reader never met
     the sign-in wall; that held, and it also threw every signed-in member
     onto the marketing page, which the owner ruled out in so many words
     ("that button should never take them to the landing page", see the
     route handler). Both rules hold now. Walked in from Home, back returns
     to Home through history before this is ever read. */
  "/search": "/home-or-landing",
  "/listing/[id]": "/search",
  /* D25 inner page: the "why trust this space" record of one listing. It
     answers one question about the listing, so its way up is the listing. */
  "/listing/[id]/trust": "/listing/[id]",
  /* Schedule a visit: step 1 is a flow (resolve.ts FLOWS), so Back never
     returns into a submitted form; both steps go up to the listing they
     belong to. The status screen opened from a notification or Plans goes
     back there through history, as every screen does. */
  "/listing/[id]/visit": "/listing/[id]",
  "/listing/[id]/visit/[inspectionId]": "/listing/[id]",
  "/saved": "/home",
  "/saved/searches": "/saved",
  /* V-35: the gate code for one inspection, where a named delegate lands.
     Its parent is Plans, where inspections now live (V-76). */
  "/inspections/gate/[id]": "/bookings",
  "/rent/move-in/[listingId]": "/listing/[listingId]",
  "/rent/review/[paymentId]": "/bookings",
  "/record/[code]": "/search",
  "/settings/passport": "/settings",
  /* The Vallo passport of another member, opened from a profile or a chat. */
  "/passport/[who]": "/around",
  "/settings/invite": "/settings",
  /* W6, D25: the referral hub's inner pages. */
  "/settings/invite/how-it-works": "/settings/invite",
  "/settings/invite/referrals": "/settings/invite",
  "/settings/invite/referrals/[id]": "/settings/invite/referrals",
  /* D51, Round 3 C3: the Rewards Balance and its inner pages. Linked from the
     member navigation (the Rewards row in `nav-model.ts`), the settings hub
     and the invite hub; until the rewards read is live (R-C3-1) the page
     draws the honest not-live state. */
  "/rewards": "/settings",
  /* P6: Pro sits above Settings in the side navigation and returns there. */
  "/pro": "/settings",
  /* Where Paystack returns a member after paying for a plan. */
  "/pro/confirm": "/pro",
  "/rewards/referrals": "/rewards",
  "/rewards/history": "/rewards",
  "/rewards/withdraw": "/rewards",
  /* D76: the leaderboards sit beside Rewards in the Money group; the one
     directory flips with the side and returns home. */
  "/leaderboard": "/rewards",
  "/directory": "/home",
  "/rent/pay/[inspectionId]": "/bookings",
  "/rent/share/[id]": "/agreements",
  "/tenancy/[id]": "/bookings",
  "/tenancy/[id]/complaint": "/tenancy/[id]",
  "/host/arrival": "/host",
  "/agent/listings/[listingId]/arrival": "/agent/listings",
  "/agent/listings/[listingId]/mandate": "/agent/listings",
  /*
   * PRICE CHECK. Both entries reproduce what the two pages already pass to
   * `PageHeader` as a fallback, which is the honest reading of the surface
   * rather than a guess from the path: `/price` passes `/home` and
   * `/price/area/[id]` passes `/price`. Declaring them changes nothing a
   * person sees on the web and changes the Android answer from "undeclared"
   * to a named destination.
   *
   * `/price` is a row in the member navigation (`nav-model.ts`, track L), and
   * the share cards `lib/price-check/share-card.ts` builds point at
   * `/price/area/[id]`.
   */
  "/price": "/home",
  "/price/area/[id]": "/price",

  /* ---------------------------------------------------------- stays side */
  "/stays/search": "/stays",
  "/stay/[id]": "/stays",
  "/restaurants": "/stays",
  "/restaurant/[id]": "/restaurants",
  "/bookings": "/home",
  "/bookings/[bookingId]": "/bookings",
  "/bookings/[bookingId]/review": "/bookings/[bookingId]",
  "/checkout": "/stays",
  "/checkout/[bookingId]": "/bookings/[bookingId]",
  /* One crypto payment, opened from its notification or email. */
  "/pay/crypto/[reference]": "/bookings",
  /* One table deposit: the Paystack return, every deposit notice, the receipt. */
  "/pay/deposit/[reservationId]": "/bookings",

  /* ------------------------------------------------------------- messages */
  "/messages": "/home",
  "/messages/[id]": "/messages",
  "/messages/new": "/messages",
  "/messages/share/into/[id]": "/messages/[id]",
  "/messages/share/listing/[id]": "/listing/[id]",
  "/messages/share/stay/[id]": "/stay/[id]",
  "/messages/share/booking/[id]": "/bookings/[id]",

  /* --------------------------------------------------------------- money */
  /* Track A: the escrow routes are retired (they redirect to
     /agreements in next.config.ts). The agreement list is where money now
     lives. */
  "/agreements": "/home",
  "/payments": "/home",
  /* R3-05 (C2): the receipt vault and the member's refunds hang off the
     payer's money screen; payouts are the lister's own, off home. */
  "/receipts": "/payments",
  "/refunds": "/payments",
  "/payouts": "/home",
  /* ADR 0003: /wallet is the member balance the escrow partner holds. */
  "/wallet": "/home",
  /* D81: the Wallet's own screens, each one back to the overview. */
  "/wallet/transactions": "/wallet",
  "/wallet/settings": "/wallet",
  "/wallet/add": "/wallet",
  "/wallet/send": "/wallet",
  "/wallet/withdraw": "/wallet",
  "/agreements/[id]": "/agreements",
  "/agreements/[id]/fund": "/agreements/[id]",
  "/agreements/[id]/held": "/agreements/[id]",

  /* -------------------------------------------------------------- social */
  /* As `/search` above: whichever home fits the reader. */
  "/around": "/home-or-landing",
  "/around/[slug]": "/around",
  "/around/settings": "/around",
  "/around/people": "/around",
  "/around/new": "/around/settings",
  "/around/manage": "/around/settings",
  "/post/[id]": "/around",
  "/stories/new": "/around",
  "/stories/[id]": "/around",
  "/u": "/around",
  "/u/[handle]": "/around",
  "/u/[handle]/edit": "/u/[handle]",
  "/u/[handle]/followers": "/u/[handle]",
  "/u/[handle]/following": "/u/[handle]",
  "/u/[handle]/message": "/u/[handle]",

  /* ------------------------------------------------------------- account */
  "/assistant": "/home",
  "/notifications": "/home",
  /* D22: every notification's designed full view, reached by a route so back
     behaves and a push lands. Its way up is the list it belongs to. */
  "/notifications/[id]": "/notifications",
  /* VC1: review call invitations, reached from their notification. */
  "/calls/reviews": "/notifications",
  "/calls/reviews/[id]": "/calls/reviews",
  "/profile": "/home",
  "/profile/application": "/profile",
  "/profile/setup": "/profile",
  "/profile/setup/[role]": "/profile/setup",
  "/profile/setup/agent": "/profile/setup",
  "/profile/setup/firm": "/profile/setup",
  "/profile/setup/owner": "/profile/setup",
  "/verification": "/profile",
  "/settings": "/home",
  "/settings/account": "/settings",
  "/settings/appearance": "/settings",
  /* R3-15, R3-16 (C2). */
  "/settings/accessibility": "/settings",
  "/settings/region": "/settings",
  "/settings/devices": "/settings",
  /* V-19: the new sign-in alert a push lands on; back is the devices screen. */
  "/settings/devices/alert": "/settings/devices",
  "/settings/help": "/settings",
  /* The in-app help and support home, and the member's ticket inbox under it. */
  "/support": "/home",
  "/support/messages": "/support",
  "/support/new": "/support",
  "/support/messages/[id]": "/support/messages",
  "/settings/interests": "/settings",
  "/settings/notifications": "/settings",
  "/settings/payments": "/settings",
  "/settings/place": "/settings",
  "/settings/privacy": "/settings",
  /* DB2: the people you blocked, one level inside Privacy & Security. */
  "/settings/privacy/blocked": "/settings/privacy",
  /* W6, D25: the groups that were crammed into Privacy are pages of their own. */
  "/settings/privacy/money-lock": "/settings/privacy",
  "/settings/privacy/ai": "/settings/privacy",
  "/settings/privacy/data": "/settings/privacy",
  "/settings/phone": "/settings",
  "/settings/passcode": "/settings",
  "/legal/privacy": "/settings",
  "/legal/terms": "/settings",
  "/legal/disclaimer": "/settings",

  /* ------------------------------------------------------------- console
   *
   * Back inside the Console stays inside the Console. Every screen here
   * returns to `/admin`, and `/admin` itself returns to `/home` rather than to
   * whatever the browser remembers, which was the login page for anybody who
   * got here through a sign-in bounce.
   */
  "/admin": "/home",
  "/admin/agents": "/admin",
  "/admin/alerts": "/admin",
  "/admin/analytics": "/admin",
  "/admin/front-door": "/admin/analytics",
  "/admin/audit": "/admin",
  "/admin/lookup": "/admin",
  "/admin/oversight": "/admin",
  "/admin/bookings": "/admin",
  "/admin/bookings/[bookingId]": "/admin/bookings",
  "/admin/bookings/reservations": "/admin/bookings",
  "/admin/bookings/visits": "/admin/bookings",
  "/admin/referrals": "/admin/money",
  "/admin/businesses": "/admin",
  "/admin/agreements": "/admin",
  "/admin/agreements/settings": "/admin/agreements",
  /* C1 sweep: the five desks the rail files under Settings (nav.ts,
     ADMIN_SETTINGS) go back to Settings, the door they are opened from,
     not past it to the overview. */
  "/admin/examples": "/admin/settings",
  "/admin/staff": "/admin/settings",
  "/admin/handbook": "/admin/settings",
  "/admin/handbook/position": "/admin/handbook",
  "/admin/fees": "/admin",
  "/admin/restaurant-fees": "/admin",
  "/admin/account-recovery": "/admin",
  "/admin/kyc": "/admin",
  "/admin/compliance": "/admin/kyc",
  "/admin/listings": "/admin",
  "/admin/listings/[id]": "/admin/listings",
  "/admin/money": "/admin",
  "/admin/operations": "/admin",
  /* V-80: field speed, one panel read from real phones. */
  "/admin/field-speed": "/admin/operations",
  "/admin/payments": "/admin",
  /* Chargebacks: the finance desk, and one case. */
  "/admin/chargebacks": "/admin",
  "/admin/chargebacks/[chargebackId]": "/admin/chargebacks",
  "/admin/people": "/admin",
  /*
   * `/admin/queue` is a DESK, not the console's landing screen, and that is the
   * whole of the founder's item 5: the queue used to BE `/admin` and the
   * console now opens on the overview before any desk. So its way up is
   * `/admin`, like every other desk, and not the other way round.
   */
  "/admin/queue": "/admin",
  "/admin/reference": "/admin/settings",
  "/admin/settings": "/admin",
  "/admin/social": "/admin",
  "/admin/standing": "/admin",
  "/admin/stops": "/admin",
  "/admin/people/[id]": "/admin/people",
  "/admin/supply": "/admin",
  "/admin/support": "/admin",
  /* VC1: the review calls desk, and one review call. */
  "/admin/operations/providers": "/admin/operations",
  "/admin/review-calls": "/admin",
  "/admin/review-calls/[id]": "/admin/review-calls",
  "/admin/switches": "/admin/settings",
  /* Admin coverage (13 October 2026): desks that had a function and no screen. */
  "/admin/blocked-terms": "/admin/queue",
  "/admin/weight-withheld": "/admin/social",
  "/admin/call-usage": "/admin/operations",
  "/admin/retention": "/admin/operations",

  /* ---------------------------------------------------- the agent console */
  "/agent/dashboard": "/home",
  "/agent/analytics": "/agent/dashboard",
  "/agent/analytics/[metric]": "/agent/analytics",
  "/agent/analytics/listings/[listingId]": "/agent/analytics",
  "/agent/bookings": "/agent/dashboard",
  "/agent/earnings": "/agent/dashboard",
  "/host/earnings": "/host",
  "/agent/inspections": "/agent/dashboard",
  "/agent/listings": "/agent/dashboard",
  "/agent/listings/[listingId]/calendar": "/agent/listings",
  "/agent/listings/[listingId]/health": "/agent/listings",
  /* V-08: the TO LET board, under the listing's workspace like its calendar. */
  "/agent/listings/[listingId]/board": "/agent/listings",
  /* V-71: the Status kit, under the listing's workspace like its board. */
  "/agent/listings/[listingId]/status": "/agent/listings",
  /* D60: a listing's promotion results. Linked from the Promote action on a
     live listing's row and from `/agent/promotion`; buying still says it is
     not on sale (`PROMOTION_NOT_ON_SALE`). */
  "/agent/listings/[listingId]/promotion": "/agent/listings",
  /* The door into promotion from the workspace rail and the dashboard: the
     lister's live listings, each with its Promote action. */
  "/agent/promotion": "/agent/dashboard",
  "/agent/list": "/agent/listings",
  "/agent/messages": "/agent/dashboard",
  /* The workspace's own frame round the consumer thread and bell pages, so
     back from either stays inside the workspace. */
  "/agent/messages/[id]": "/agent/messages",
  "/agent/notifications": "/agent/dashboard",
  "/agent/reviews": "/agent/dashboard",
  "/agent/settings": "/agent/dashboard",
  "/agent/portfolio": "/agent/dashboard",
  "/agent/verification": "/agent/dashboard",
  "/agent/firm": "/agent/dashboard",
  /* The assistant inside the workspace (29 September 2026). */
  "/agent/assistant": "/agent/dashboard",

  /* ----------------------------------------------------- the host console */
  /* The host workspace is a STAYS address (`lib/side.constants.ts` paints
     it in the Stays shell), so its way up is the Stays home. It named
     `/home`, the Property home, and a host who opened the workspace cold
     and pressed back had the whole shell turn over to Property under them
     (Session 3 navigation audit, 6 October 2026). The agent workspace is
     Property's and keeps `/home`. */
  "/host": "/stays",
  "/host/apply": "/host",
  "/host/photos": "/host",
  "/host/reservations": "/host",
  "/host/bookings": "/host",
  "/host/rooms": "/host",
  /* C1 to C4 and C9 (30 September 2026). */
  "/host/calendar": "/host",
  "/host/decide": "/host",
  "/host/reviews": "/host",
  "/host/earnings/statement": "/host/earnings",
  "/host/start": "/host",
  "/host/transfer": "/host",
  /* The host workspace's own assistant, settings and bell (29 September 2026). */
  "/host/assistant": "/host",
  "/host/settings": "/host",
  "/host/notifications": "/host",

  /* ------------------------------------------- a feature's first run (D11)
   *
   * `/first-run/[feature]` stands IN FRONT of a feature rather than inside
   * it (north star 14.1: a route, never a modal, so back behaves and a deep
   * link reaches it). So each one's way up is the feature's own way up, not
   * the feature: back from a first run the member did not want returns to
   * where the feature sits, never into the feature they declined to start.
   * Ten literals rather than one pattern, because the parent differs per
   * feature (`LITERAL_EXPANSIONS` below). Its exits replace the page
   * (`FirstRunPanels`), and `resolve.ts` lists it as a flow, so it is never
   * returned to through history once seen.
   */
  "/first-run/host": "/stays",
  "/first-run/agent": "/home",
  "/first-run/verification": "/agent/dashboard",
  "/first-run/agreements": "/home",
  "/first-run/invite": "/settings",
  "/first-run/passport": "/settings",
  "/first-run/analytics": "/agent/dashboard",
  /* R3-12's two: a tenancy file sits under `/bookings`, the owner's
     buildings under the agent dashboard. */
  "/first-run/tenancy": "/bookings",
  "/first-run/portfolio": "/agent/dashboard",
  /* D60: promotion's first run stands in front of the promotion results
     page, which sits under the lister's listings. */
  "/first-run/promotion": "/agent/listings",

  /* ------------------------------------------------- the design harnesses
   *
   * `/preview` and `/gallery` are development surfaces, not product. They are
   * declared so that working in them does not produce a warning on every
   * screen, and they are declared as three patterns rather than a hundred and
   * fifty entries because their hierarchy genuinely IS their path: a deck
   * holds screens, a screen occasionally holds a variant.
   */
  "/gallery": "/",
  "/preview": "/",
  "/preview/[deck]": "/preview",
  "/preview/[deck]/[screen]": "/preview/[deck]",
  "/preview/[deck]/[screen]/[variant]": "/preview/[deck]/[screen]",

  /* --------------------------------------- the decks with no index screen
   *
   * FOUND BY WALKING THE MAP AGAINST THE DIRECTORY TREE, NOT BY READING IT.
   * The three patterns above say a deck screen's way up is its deck, and for
   * seventeen decks that is true because `preview/<deck>/page.tsx` exists. For
   * four of them it does not: `b1b`, `c1`, `imgc` and `session-b` are folders
   * of screens with no index page, so the generic pattern resolved back to a
   * URL that answers not-found. Twenty five harness screens had a back control
   * pointing at a 404, and every one of them read as correctly declared.
   *
   * A literal segment beats a dynamic one in `resolve.ts`, left to right, so
   * each entry below outranks the generic pattern for its own deck and nothing
   * else is affected. The destination is `/preview`, which is the board that
   * lists the decks and is the real screen above a deck that has no index.
   *
   * These are development surfaces and nobody ships them. They are declared
   * for the same reason the generic patterns were: a harness that warns on
   * every screen is a harness people stop reading warnings in.
   */
  "/preview/b1b/[screen]": "/preview",
  "/preview/c1/[screen]": "/preview",
  "/preview/imgc/[screen]": "/preview",
  "/preview/session-b/[screen]": "/preview",
  /* Three more folders one level deeper inside `session-b`, same fault. The
     fourth and fifth (`wallet`, `inspection`) DO have an index page, so they
     keep the generic pattern and their screens go up to their own folder. */
  "/preview/session-b/admin/[screen]": "/preview",
  "/preview/session-b/admin-money/[screen]": "/preview",
  "/preview/session-b/admin-review/[desk]": "/preview",
};

/**
 * ROUTE FILES WHOSE DECISION IS MADE ONE LITERAL AT A TIME.
 *
 * `app/(app)/messages/share/[kind]/[id]/page.tsx` serves four addresses and
 * only four: the page calls `notFound()` on any `kind` that is not `listing`,
 * `booking`, `stay` or `into`. Each of those four has a DIFFERENT parent,
 * because the thing being shared is the parent, so the map declares them
 * separately and the file's own pattern matches nothing.
 *
 * That is correct and it looked exactly like an undeclared route to the gap
 * test, which is why the relationship is written down rather than argued about
 * in a comment. `route-files.test.ts` requires every expansion listed here to
 * be declared above, so adding a fifth kind to the page without declaring its
 * parent fails.
 */
export const LITERAL_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
  /* `components/app/feature-onboarding/first-runs.ts` MOUNTED_FIRST_RUNS:
     the page 404s on any other key. */
  "/first-run/[feature]": [
    "/first-run/host",
    "/first-run/agent",
    "/first-run/verification",
    "/first-run/agreements",
    "/first-run/invite",
    "/first-run/passport",
    "/first-run/analytics",
    "/first-run/tenancy",
    "/first-run/portfolio",
    "/first-run/promotion",
  ],
  "/messages/share/[kind]/[id]": [
    "/messages/share/into/[id]",
    "/messages/share/listing/[id]",
    "/messages/share/stay/[id]",
    "/messages/share/booking/[id]",
  ],
};

/**
 * ROUTE FILES THAT ARE NOT SCREENS, AND THE REASON FOR EACH.
 *
 * WHY THIS EXISTS. `ROUTE_PARENTS` above says where a screen sits. It said
 * nothing at all about the rest of `src/app`, and "nothing at all" is
 * indistinguishable from "nobody has looked at it yet", which is how sixty
 * routes drew no back control for months. Every `route.ts` under `src/app` is
 * listed here with the reason it can never carry a back control, so that the
 * set of route files nobody has made a decision about is EMPTY and provably so.
 *
 * `route-files.test.ts` walks `src/app` and fails if a route file is in
 * neither structure, or is in both. A new API handler needs one line here; a
 * new page needs a real decision above. Neither can be added silently.
 *
 * NONE OF THESE CAN EVER BE `window.location.pathname` IN THE SHELL. A route
 * handler answers JSON, JavaScript or a redirect; the web view never settles
 * on one, so `isAppRoot` is never asked about them. They are written down
 * because a thing nobody wrote down is a thing nobody checked.
 */
export const NON_NAVIGABLE: Readonly<Record<string, string>> = {
  "/agent/listings/[listingId]/board/image": "V-08: the board as a PNG, not a page.",
  "/s/[token]/status": "V-71: the door's card as a Status PNG, not a page.",
  "/api/account/export": "the member's own data as a JSON download, not a page.",
  "/admin/audit/export": "the audit log for a period as a CSV download, not a page.",
  "/admin/money/export": "the platform payments history as a CSV download for the finance scope, not a page.",
  "/admin/oversight/export": "the oversight tables as a CSV download, not a page.",
  "/api/assistant": "POST only, the assistant's model call.",
  "/api/auth/email-hook": "Supabase Auth's send-email webhook.",
  "/api/client-error": "the browser's error beacon.",
  "/api/passcode/touch": "POST only, the passcode unlock's heartbeat (docs/PASSCODE.md).",
  "/api/vitals": "the browser's field speed beacon (V-80).",
  "/gallery/ported": "a development harness for the ported component library (Session 3, D34), behind the preview flag like /gallery; not product, so it has no place in the hierarchy.",
  "/gallery/features": "a development harness for W7's components and first runs (Session 3), behind the preview flag like /gallery/ported; not product.",
  "/gallery/containers": "a development harness for the container tiers (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/figures": "a development harness for Figure, Amount, CountUp and Odometer (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/segmented": "a development harness for Segmented and SegmentedPanel (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/buttons": "a development harness for button roles and the action morph (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/toast": "a development harness for the one toast (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/status-chip": "a development harness for the status chip in every state (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/skeleton": "a development harness for skeletons and SkeletonSwap (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/document-sheet": "a development harness for the document sheet, kinds document and receipt (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/charts": "a development harness for the chart system (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/today-hero": "a development harness for the workspace today hero (B-33), behind the preview flag like /gallery; not product.",
  "/gallery/brand-icons": "a development harness for the tiered brand objects on night and on paper (B-33), behind the preview flag like /gallery; not product.",
  "/api/cron/account-purge": "scheduled job, bearer token.",
  "/api/calls/webhook": "media provider webhook (VC1), signed.",
  "/api/cron/calls-sweep": "scheduled job, bearer token.",
  "/api/cron/canary": "scheduled job, bearer token.",
  "/api/cron/calendar-sync": "scheduled job, bearer token (C2, behind CALENDAR_SYNC_ENABLED).",
  "/api/calendar/feed": "C2: a room's calendar as iCal for another site to subscribe to, behind its secret token.",
  "/host/earnings/statement/csv": "C9: one month's payout statement as a CSV download, not a page.",
  "/api/cron/complete-stays": "scheduled job, bearer token.",
  "/api/cron/crypto-reconcile": "scheduled job, bearer token.",
  "/api/cron/arrangements-reconcile": "scheduled job, bearer token.",
  "/api/cron/email-outbox": "scheduled job, bearer token.",
  "/api/cron/hold-sweep": "scheduled job, bearer token.",
  "/api/cron/rent-share-refunds": "scheduled job, bearer token.",
  "/api/cron/reservation-deposit-refunds": "scheduled job, bearer token (D75, table deposit refunds).",
  "/api/cron/inventory-drift": "scheduled job, bearer token.",
  "/api/cron/landlord-line": "scheduled job, bearer token.",
  "/api/cron/sanctions-lists": "scheduled job, bearer token.",
  "/api/compliance/sanctions-upload": "POST only, staff upload of a sanctions list file.",
  "/api/cron/sanctions-screen": "scheduled job, bearer token.",
  "/api/cron/pg-cron-watch": "scheduled job, bearer token.",
  "/api/cron/photo-hash-backfill": "scheduled job, bearer token.",
  "/api/cron/risk-classes": "scheduled job, bearer token.",
  "/api/cron/saved-search-alerts": "scheduled job, bearer token.",
  "/api/cron/store-readiness": "scheduled job, bearer token.",
  "/api/cron/new-match-alerts": "scheduled job, bearer token.",
  "/api/health/catalogue": "health check polled by an external uptime monitor; answers JSON, not a page.",
  "/api/csp-report": "the browser's policy violation report.",
  "/api/email/unsubscribe": "RFC 8058 one-click unsubscribe (A12), POSTed by a mailbox provider with a signed token; a GET goes on to /email/preferences.",
  "/api/funnel": "the first-party funnel beacon (A6); answers 204, not a page.",
  "/api/auth/sms-hook": "Supabase Auth's Send SMS hook (A2), Standard Webhooks signature; delivers a phone code, not a page.",
  "/join/[code]": "an invite link: keeps the code in a cookie and goes on to the sign-up door, which shows the one onboarding first (A5, 7 October 2026); a redirect, not a page.",
  "/join/[code]/start": "the old invite door's address, the same hand-off as /join/[code] (A5); a redirect, not a page.",
  "/api/documents/[id]": "a signed document stream, not a page.",
  "/api/landlord/inbound": "the SMS aggregator's inbound webhook, bearer token.",
  "/api/whatsapp/inbound": "Meta's WhatsApp webhook (V-96), signed with the app secret.",
  "/api/plans/next": "the home-screen widget's next-up read (V-98), device-bound bearer token.",
  "/api/map/listings": "JSON read for the map.",
  "/api/paystack/reconcile": "processor reconciliation.",
  "/api/paystack/webhook": "processor webhook.",
  "/api/payluk/webhook": "processor webhook.",
  "/api/push/drain": "scheduled job, bearer token.",
  "/api/push/key": "the public VAPID key as JSON.",
  "/api/push/register": "POST only, a subscription write.",
  "/api/push/revoke": "POST only, a subscription delete.",
  "/api/push/self-test": "POST only, a diagnostic send.",
  "/api/push/sw": "a retired service worker, serving only its own unregister.",
  "/api/support": "POST only, the contact form.",
  "/api/yellowcard/webhook": "processor webhook.",
  "/admin/enter": "303 into the console with the entry cookie.",
  "/landlord/[token]":
    "a landlord's single-use reply page, opened from an SMS by somebody with no account; there is nowhere inside the platform for it to go back to.",
  "/safe/[token]":
    "the page a renter's trusted contact opens from a link the renter sent; the contact has no account and nowhere inside the platform to go back to.",
  "/open": "307 to `/home`, `/search` or `/welcome`: where the native app starts (STORE-04).",
};
