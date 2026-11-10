/**
 * Every live screen the store images, the social posts and the launch video
 * use, captured from production as the QA member account.
 *
 *   id        file name in docs/marketing/source/<id>.webp
 *   kind      "mobile" (the 6.9" iPhone's web view, 440 x 894 pt at 3x) or
 *             "desktop" (1440 x 900 at 2x)
 *   theme     "dark" (the default) or "light"
 *   auth      false for a public screen captured signed out
 *   locale    the language cookie the in-app switcher writes (yo, ha, ig)
 *   full      also capture the whole page, top to bottom, at 2x, for the
 *             video's scrolling shots (<id>-full.webp)
 *   steps     run in order after the page loads:
 *     { goto }                      navigate
 *     { click }                     tap the first match
 *     { clickIf }                   tap it only if it is there
 *     { reveal, offset }            scroll a section to `offset` px below the top
 *     { type: selector, text }      type into a field, key by key
 *     { press: key }                press a key
 *     { waitStable: selector }      wait until an element's text stops changing
 *     { wait }                      settle
 *
 * What a capture writes to production, only ever to the QA account: the AI
 * assistant capture records the assistant consent and asks one question; the
 * passcode capture opens "Create your passcode" and types four of six digits,
 * which saves nothing (step 1 of 2). Nothing else is created or changed.
 */

export const LISTING_RENT = "/listing/ed000000-0000-4000-8000-00000000003e"; // Four bedroom villa in Maitama
export const LISTING_SALE = "/listing/ed000000-0000-4000-8000-000000000040"; // Three bedroom terrace, Karsana
export const LISTING_BANANA = "/listing/ed000000-0000-4000-8000-00000000003f"; // Chevron Drive
export const STAY = "/stay/ea000000-0000-4000-8000-000000000003"; // Lagoon Crest Resort
export const RESTAURANT = "/restaurant/eb000000-0000-4000-8000-000000000006"; // Harbour Lights Kitchen
export const THREAD = "/messages/d140e186-9fa3-41f4-8234-32ef75a1060e"; // the QA member's rental enquiry
const PRICE = "/price?state=LA&area=Lekki&lat=6.44&lng=3.47&type=apartment&intent=rent&period=year&beds=2";
const STAYS_DATES = "/stays/search?in=2026-10-16&out=2026-10-19&guests=2";

const go = (path) => [{ goto: path }];
const HOME = [{ goto: "/home" }, { clickIf: "[data-testid=welcome-skip-all]" }, { goto: "/home" }];
const reveal = (path, selector, offset = 96) => [{ goto: path }, { reveal: selector, offset }];
const ask = (question) => [
  /* A fresh conversation: the assistant keeps its threads in this browser. */
  { goto: "/assistant" },
  { clear: ["nf_ai_threads", "nf_ai_thread"] },
  { goto: "/assistant" },
  { type: "textarea, input[placeholder='Type your message']", text: question },
  { press: "Enter" },
  { wait: 1500 },
  { clickIf: "button:has-text('I understand, continue')" },
  { wait: 2500 },
  { clickIf: "button[aria-label*='end' i]:not([disabled])" },
  { waitStable: "main", ms: 4000, max: 90000 },
  { into: `main >> text="${question}"`, offset: 40 },
  { blur: true },
];
/* The inbox opens on the side last used; the rental enquiry is under Property. */
const INBOX = [{ goto: "/messages" }, { clickIf: "main button:text-is('Property'), main [role=tab]:text-is('Property')" }, { wait: 1500 }];
/* Filter sheets narrowed for real, so the Apply count is the true count. */
const FILTER = (...clicks) => [{ goto: "/search?filters=open" }, ...clicks.map((c) => ({ clickIf: c, pause: 900 })), { wait: 1500 }];
const FILTERS_SET = [
  { goto: "/search?filters=open" },
  { clickIf: "button:has-text('Villas')", pause: 700 },
  { clickIf: "button:has-text('Apartments')", pause: 700 },
  { clickIf: "[role=switch]", pause: 900 },
  { wait: 1500 },
];

const BASE_CAPTURES = [
  /* ---------------------------------------------------------- signed out */
  ...[1, 2, 3, 4].map((n) => ({ id: `welcome-${n}`, auth: false, steps: [{ goto: "/welcome" }, { click: `[data-testid=welcome-dot-${n}]` }, { wait: 1800 }] })),
  /* /welcome opens on its last slide for a returning browser; the dot brings slide 1. */
  ...["yo", "ha", "ig"].map((loc) => ({ id: `welcome-${loc}`, auth: false, locale: loc, steps: [{ goto: "/welcome" }, { click: "[data-testid=welcome-dot-1]" }, { wait: 2600 }] })),
  { id: "welcome-yo-4", auth: false, locale: "yo", steps: [{ goto: "/welcome" }, { click: "[data-testid=welcome-dot-4]" }, { wait: 1800 }] },
  { id: "sign-in", auth: false, steps: go("/sign-in") },
  { id: "sign-up", auth: false, steps: go("/sign-up") },

  /* ---------------------------------------------------------- property */
  { id: "home", full: true, steps: HOME },
  /* "Looked at recently" is what this phone remembers (lib/search/memory.ts),
     so the capture looks at three places first. */
  { id: "home-featured", steps: [...HOME, { reveal: "[data-testid=featured-properties]", offset: 96 }] },
  { id: "wallet", steps: go("/wallet") },
  { id: "passport", steps: go("/settings/passport") },
  { id: "workspace", steps: go("/agent/dashboard") },
  { id: "welcome-first", auth: false, steps: [{ goto: "/welcome" }, { clickIf: "[data-testid=welcome-dot-1]" }, { wait: 1800 }] },
  { id: "home-recent", steps: [{ goto: LISTING_BANANA }, { goto: LISTING_SALE }, { goto: LISTING_RENT }, ...HOME, { reveal: "h2:text-is('Looked at recently')", offset: 60 }] },
  { id: "drawer", steps: [...HOME, { click: "button[aria-label='Open menu']" }, { wait: 1200 }] },
  { id: "search", steps: go("/search?market=rent") },
  { id: "search-buy", steps: go("/search?market=buy") },
  { id: "filters", steps: go("/search?filters=open") },
  { id: "filters-set", steps: FILTERS_SET },
  { id: "filters-villas", steps: FILTER("button:has-text('Villas')") },
  { id: "filters-detached-bq", steps: FILTER("button:has-text('Detached house')", "[role=switch]") },
  { id: "search-villas", full: true, steps: [...FILTER("button:has-text('Villas')"), { click: "button:has-text('Apply (')" }, { wait: 2500 }] },
  { id: "listing", full: true, steps: go(LISTING_RENT) },
  { id: "listing-cost", steps: reveal(LISTING_RENT, "h2:text-is('What you will actually pay')", 96) },
  { id: "listing-cost-total", steps: reveal(LISTING_RENT, "[data-testid=move-in-line-caution]", 150) },
  /* v2: the "Light, water and getting in" section whole, with all three items. */
  { id: "listing-amenities", steps: reveal(LISTING_RENT, "h2:text-is('Light, water and getting in')", 102) },
  { id: "listing-share", steps: [{ goto: LISTING_RENT }, { click: "[data-testid=listing-share]" }, { wait: 1200 }] },
  { id: "listing-sale", full: true, steps: go(LISTING_SALE) },
  { id: "listing-banana", steps: go(LISTING_BANANA) },
  { id: "price", steps: go(PRICE) },
  /* The Banana Island villa saved last, so the list opens on it (the QA
     account's own favourites; un-saved and saved again). */
  { id: "saved", full: true, steps: [
    { goto: LISTING_BANANA },
    { clickIf: "[data-testid=listing-save][aria-pressed=true]" }, { wait: 1500 },
    { click: "[data-testid=listing-save][aria-pressed=false]" }, { wait: 2500 },
    { goto: "/saved" },
  ] },

  /* ---------------------------------------------------------- stays and tables */
  { id: "stays", full: true, steps: go("/stays") },
  { id: "stays-dates", steps: go(STAYS_DATES) },
  { id: "stays-filters", steps: go("/stays/search?filters=open") },
  { id: "stay", full: true, steps: go(STAY) },
  /* v2: scrolled so no sticky button is sliced under the status bar. */
  { id: "stay-amenities", steps: reveal(STAY, "h2:text-is('Amenities')", 54) },
  { id: "restaurants", full: true, steps: go("/restaurants") },
  { id: "restaurant", full: true, steps: go(RESTAURANT) },
  { id: "restaurant-hours", steps: reveal(RESTAURANT, "h2:text-is('Opening hours')", 96) },

  /* ---------------------------------------------------------- people and messages */
  { id: "around", full: true, steps: go("/around") },
  { id: "messages", steps: INBOX },
  { id: "thread", steps: go(THREAD) },
  { id: "notifications", steps: go("/notifications") },
  { id: "assistant", steps: go("/assistant") },
  /* The assistant, asked a real question: the consent note is accepted, the
     answer is waited for, and the conversation is scrolled back to the question. */
  { id: "assistant-answer", steps: ask("What documents should I ask for before I rent a flat?") },
  { id: "assistant-areas", steps: ask("Is Yaba or Lekki better for a young family?") },
  { id: "assistant-caution", steps: ask("What is a caution deposit?") },
  /* The same question with the field blurred; the answer is worded afresh (FACTS.md quotes both). */
  { id: "assistant-caution-2", steps: ask("What is a caution deposit?") },

  /* ---------------------------------------------------------- account and money */
  { id: "profile", steps: go("/profile") },
  { id: "plans", steps: go("/bookings") },
  { id: "agreements", steps: go("/agreements") },
  { id: "payments", steps: go("/payments") },
  { id: "payment-methods", steps: go("/settings/payments") },
  { id: "support", steps: go("/support") },
  /* Two of the help centre's popular answers, opened: the product's own words
     for "Vallo never holds your money" and "Vallo charges no inspection fee". */
  ...[["support-money", "Does Vallo hold my money?"], ["support-inspection", "Do I pay to inspect a property?"]].map(([id, q]) => ({
    id,
    steps: [{ goto: "/support" }, { click: `summary:has-text("${q}")` }, { wait: 900 }, { reveal: `summary:has-text("${q}")`, offset: 330 }, { blur: true }, { wait: 500 }],
  })),
  { id: "settings", steps: reveal("/settings", "text=Data saver", 150) },
  { id: "appearance", steps: [{ goto: "/settings/appearance" }, { into: "text=Opening splash", offset: 675 }] },
  { id: "passcode", steps: go("/settings/passcode") },
  {
    id: "passcode-create",
    steps: [
      { goto: "/settings/passcode" },
      { click: "button:has-text('Change passcode')" },
      { wait: 1500 },
      ...["1", "9", "6", "0"].map((d) => ({ clickIf: `button:text-is('${d}')`, pause: 350 })),
      { wait: 700 },
      { top: true },
    ],
  },
  { id: "verification", steps: go("/verification") },

  /* ---------------------------------------------------------- workspaces */
  { id: "agent-dashboard", steps: go("/agent/dashboard") },
  { id: "agent-properties", steps: go("/agent/listings") },
  { id: "agent-earnings", steps: go("/agent/earnings") },
  { id: "host", steps: go("/host") },
  /* "Start an application" asks what kind of host you are (a page, nothing is saved). */
  /* The page fits the screen (it does not scroll); wait for every icon. */
  { id: "host-start", steps: [{ goto: "/profile/setup?side=stays" }, { wait: 3000 }, { reveal: "text=I am an agent", offset: 0 }] },
  { id: "host-bookings", steps: go("/host/bookings") },
  { id: "host-earnings", steps: go("/host/earnings") },
  { id: "host-assistant", steps: go("/host/assistant") },

  /* ---------------------------------------------------------- a few in light */
  { id: "home-light", theme: "light", steps: HOME },
  { id: "drawer-light", theme: "light", steps: [...HOME, { click: "button[aria-label='Open menu']" }, { wait: 1200 }] },
  { id: "search-light", theme: "light", steps: go("/search?market=rent") },
  { id: "listing-light", theme: "light", steps: go(LISTING_SALE) },
  { id: "listing-cost-light", theme: "light", steps: reveal(LISTING_RENT, "h2:text-is('What you will actually pay')", 96) },
  { id: "stays-light", theme: "light", steps: go("/stays") },
  { id: "stay-light", theme: "light", steps: go(STAY) },
  { id: "restaurant-light", theme: "light", steps: go(RESTAURANT) },
  { id: "thread-light", theme: "light", steps: go(THREAD) },
  { id: "saved-light", theme: "light", steps: go("/saved") },

  /* ---------------------------------------------------------- desktop */
  { id: "d-landing", kind: "desktop", auth: false, steps: go("/") },
  { id: "d-home", kind: "desktop", steps: HOME },
  { id: "d-search", kind: "desktop", steps: go("/search?market=rent") },
  { id: "d-listing", kind: "desktop", steps: go(LISTING_RENT) },
  { id: "d-listing-cost", kind: "desktop", steps: reveal(LISTING_RENT, "h2:text-is('What you will actually pay')", 110) },
  { id: "d-stays", kind: "desktop", steps: go("/stays") },
  { id: "d-stay", kind: "desktop", steps: go(STAY) },
  { id: "d-restaurants", kind: "desktop", steps: go("/restaurants") },
  { id: "d-thread", kind: "desktop", steps: go(THREAD) },
  { id: "d-host", kind: "desktop", steps: go("/host") },
  { id: "d-host-start", kind: "desktop", steps: go("/profile/setup?side=stays") },
  { id: "d-payments", kind: "desktop", steps: go("/payments") },
  { id: "d-home-full", kind: "desktop", full: true, steps: HOME },
  { id: "d-search-full", kind: "desktop", full: true, steps: go("/search?market=rent") },
  { id: "d-filters", kind: "desktop", steps: go("/search?filters=open") },
  { id: "d-filters-set", kind: "desktop", steps: FILTERS_SET },
  { id: "d-filters-villas", kind: "desktop", steps: FILTER("button:has-text('Villas')") },
  { id: "d-search-villas", kind: "desktop", steps: [...FILTER("button:has-text('Villas')"), { click: "button:has-text('Apply (')" }, { wait: 2500 }] },
  { id: "d-assistant", kind: "desktop", steps: [{ goto: "/assistant" }, { clear: ["nf_ai_threads", "nf_ai_thread"] }, { goto: "/assistant" }] },
  { id: "d-assistant-caution", kind: "desktop", steps: ask("What is a caution deposit?") },
  { id: "d-assistant-caution-2", kind: "desktop", steps: ask("What is a caution deposit?") },
  { id: "d-listing-share", kind: "desktop", steps: [{ goto: LISTING_RENT }, { click: "[data-testid=listing-share]" }, { wait: 1200 }] },
  { id: "d-listing-full", kind: "desktop", full: true, steps: go(LISTING_RENT) },
  { id: "d-stays-dates", kind: "desktop", steps: go(STAYS_DATES) },
  { id: "d-restaurant", kind: "desktop", steps: go(RESTAURANT) },
  { id: "d-messages", kind: "desktop", steps: INBOX },
  { id: "d-saved", kind: "desktop", steps: go("/saved") },
  { id: "d-around", kind: "desktop", steps: go("/around") },
  { id: "d-notifications", kind: "desktop", steps: go("/notifications") },
  { id: "d-assistant-answer", kind: "desktop", steps: ask("What documents should I ask for before I rent a flat?") },
  { id: "d-assistant-areas", kind: "desktop", steps: ask("Is Yaba or Lekki better for a young family?") },
  { id: "d-verification", kind: "desktop", steps: go("/verification") },
  { id: "d-price", kind: "desktop", steps: go(PRICE) },
  { id: "d-agent-dashboard", kind: "desktop", steps: go("/agent/dashboard") },
  { id: "d-agent-list", kind: "desktop", steps: go("/agent/list") },
  { id: "d-host-bookings", kind: "desktop", steps: go("/host/bookings") },
  { id: "d-passcode-create", kind: "desktop", steps: [
    { goto: "/settings/passcode" }, { click: "button:has-text('Change passcode')" }, { wait: 1500 },
    ...["1", "9", "6", "0"].map((d) => ({ clickIf: `button:text-is('${d}')`, pause: 350 })), { wait: 700 }, { top: true },
  ] },
  { id: "d-sign-in", kind: "desktop", auth: false, steps: go("/sign-in") },
  ...[null, "yo", "ha", "ig"].map((loc) => ({ id: loc ? `d-welcome-${loc}` : "d-welcome", kind: "desktop", auth: false, ...(loc ? { locale: loc } : {}), steps: [{ goto: "/welcome" }, { click: "[data-testid=welcome-dot-1]" }, { wait: 2600 }] })),
  { id: "d-welcome-4", kind: "desktop", auth: false, steps: [{ goto: "/welcome" }, { click: "[data-testid=welcome-dot-4]" }, { wait: 2600 }] },
  { id: "d-home-light", kind: "desktop", theme: "light", steps: HOME },
  { id: "d-listing-light", kind: "desktop", theme: "light", steps: go(LISTING_SALE) },
  { id: "d-stays-light", kind: "desktop", theme: "light", steps: go("/stays") },

  /* The date screen signed out, so it can be retaken without the QA account:
     the browser runs in British English, so the fields read 16/10/2026. */
  { id: "stays-dates-gb", auth: false, steps: go(STAYS_DATES) },
  { id: "d-stays-dates-gb", kind: "desktop", auth: false, steps: go(STAYS_DATES) },
];

/* Light twins for the films' light chapters (the same steps, the light theme). */
const LIGHT_TWINS = [
  "filters", "filters-villas", "messages", "listing-share", "stays-dates", "verification", "passcode-create",
  "welcome-1", "welcome-ha", "welcome-yo", "welcome-ig", "host-start", "home", "stays", "assistant",
  "listing", "plans", "payments",
  "d-filters", "d-filters-villas", "d-listing-cost", "d-thread", "d-listing-share", "d-messages", "d-stays-dates",
  "d-restaurant", "d-verification", "d-welcome", "d-welcome-ha", "d-welcome-yo", "d-welcome-ig", "d-host-start",
  "d-search", "d-stays", "d-stay", "d-assistant", "d-passcode-create",
  "stays-dates-gb", "d-stays-dates-gb",
  "assistant-caution-2", "d-assistant-caution-2", "search", "d-search-full", "d-listing",
];
/* Twins that keep their whole-page capture, for the films' scrolls. */
const FULL_TWINS = ["search", "d-search-full"];

/* The showcase set (October 2026): the screens the two films, the device
   showcase and the launch graphics use, each in dark (sc-<name>) and light
   (sc-<name>-lt). Routes are those on main on 13 October 2026. */
const SHOWCASE_BASE = [
  { id: "sc-home", steps: HOME },
  { id: "sc-search", steps: go("/search?market=rent") },
  { id: "sc-filters", steps: go("/search?filters=open") },
  { id: "sc-listing", steps: go(LISTING_RENT) },
  { id: "sc-listing-cost", steps: reveal(LISTING_RENT, "h2:text-is('What you will actually pay')", 96) },
  { id: "sc-price", steps: go(PRICE) },
  { id: "sc-stays", steps: go("/stays") },
  { id: "sc-stay", steps: go(STAY) },
  { id: "sc-restaurants", steps: go("/restaurants") },
  { id: "sc-restaurant", steps: go(RESTAURANT) },
  { id: "sc-around", steps: go("/around") },
  { id: "sc-saved", steps: go("/saved") },
  { id: "sc-messages", steps: INBOX },
  { id: "sc-thread", steps: go(THREAD) },
  { id: "sc-inspections", steps: go("/inspections") },
  { id: "sc-assistant", steps: ask("What documents should I ask for before I rent a flat?") },
  { id: "sc-assistant-start", steps: [{ goto: "/assistant" }, { clear: ["nf_ai_threads", "nf_ai_thread"] }, { goto: "/assistant" }, { clickIf: "button:has-text('I understand, continue')" }, { wait: 1500 }] },
  { id: "sc-payments", steps: go("/payments") },
  { id: "sc-receipts", steps: go("/receipts") },
  { id: "sc-rewards", steps: go("/rewards") },
  { id: "sc-profile", steps: go("/profile") },
  { id: "sc-host", steps: go("/host") },
  { id: "sc-host-rooms", steps: go("/host/rooms") },
  { id: "sc-host-bookings", steps: go("/host/bookings") },
  { id: "sc-host-reservations", steps: go("/host/reservations") },
  { id: "sc-host-calendar", steps: go("/host/calendar") },
  { id: "sc-agent", steps: go("/agent/dashboard") },
  { id: "sc-agent-listings", steps: go("/agent/listings") },
  { id: "sc-verification", steps: go("/verification") },
  { id: "sc-calls", steps: go("/calls") },
  { id: "d-sc-home", kind: "desktop", steps: HOME },
  { id: "d-sc-search", kind: "desktop", steps: go("/search?market=rent") },
  { id: "d-sc-listing", kind: "desktop", steps: go(LISTING_RENT) },
  { id: "d-sc-stays", kind: "desktop", steps: go("/stays") },
  { id: "d-sc-assistant", kind: "desktop", steps: ask("What documents should I ask for before I rent a flat?") },
];
const SHOWCASE = [
  ...SHOWCASE_BASE,
  ...SHOWCASE_BASE.map((c) => ({ ...c, id: `${c.id}-lt`, theme: "light" })),
];
/*
 * THE GUIDES SET (DOCS_AND_PRESENCE_UPGRADE.md section 5, 9 November 2026).
 * The screens the help centre and the step-by-step guides embed, captured
 * signed in, in both themes, written to apps/web/public/help/shots/<id>.webp
 * at web size (`dest: "guides"`), never to the marketing folder. `usedBy`
 * names the guide that shows each one; capture-report.json carries it, and
 * apps/web/src/components/docs/guide-shots.test.ts fails when a page references a
 * shot this plan no longer produces.
 *
 * Every capture blanks every email address on the page before the shot, and
 * refuses to write one that still shows the signed-in account's address
 * (run.mjs). What these write to production, only to the QA account: nothing
 * beyond what the steps below type; the wizard captures stop before the step
 * that saves a server draft.
 *
 * NOT IN THIS SET, AND WHY: the wizard's steps after Location type answers
 * that save a real draft, so they are captured from a QA draft once one is
 * seeded (add its id as LISTING_DRAFT and the steps here); the admin desks ask
 * for the staff security key at the console door, which a script cannot press,
 * so the staff manual's shots are taken with a staff member present or from
 * the preview harness.
 */
const LIST_NEW = "/agent/list?new=1";
const CONTINUE = "[data-testid=step-continue]";
const GUIDE_BASE = [
  /* How to list your property (guides/how-to-list) */
  { id: "g-list-kind", usedBy: "how-to-list", steps: go(LIST_NEW) },
  { id: "g-list-type", usedBy: "how-to-list", steps: [{ goto: LIST_NEW }, { click: "[role=radio]" }, { click: CONTINUE }, { wait: 1200 }] },
  { id: "g-list-location", usedBy: "how-to-list", steps: [{ goto: LIST_NEW }, { click: "[role=radio]" }, { click: CONTINUE }, { click: "[role=radio]" }, { click: CONTINUE }, { wait: 1200 }] },
  /* How verification works (help/verification) */
  { id: "g-verify-start", usedBy: "how-verification-works", steps: go("/verification") },
  /* How bookings and payments work (help/paying) */
  { id: "g-stay", usedBy: "how-paying-works", steps: go(STAY) },
  { id: "g-stay-dates", usedBy: "how-paying-works", steps: go(STAYS_DATES) },
  { id: "g-receipts", usedBy: "how-paying-works", steps: go("/receipts") },
  { id: "g-payments", usedBy: "how-paying-works", steps: go("/payments") },
  /* Messages, voice notes and reactions (help/messages) */
  { id: "g-inbox", usedBy: "messages", steps: INBOX },
  { id: "g-thread", usedBy: "messages", steps: go(THREAD) },
  /* The host and agent desks (guides/hosting, guides/agents) */
  { id: "g-host", usedBy: "hosting", steps: go("/host") },
  { id: "g-agent", usedBy: "agents", steps: go("/agent/dashboard") },
  { id: "g-agent-listings", usedBy: "agents", steps: go("/agent/listings") },
  /* Circle and Roommates, the first screens a newcomer meets */
  { id: "g-circle", usedBy: "circle", steps: go("/circle") },
  { id: "g-roommates", usedBy: "roommates", steps: go("/roommates") },
  /* The states members photograph and send to support */
  { id: "g-saved", usedBy: "saved-and-offline", steps: go("/saved") },
  { id: "g-offline", usedBy: "saved-and-offline", steps: go("/offline") },
  { id: "g-notifications", usedBy: "notifications", steps: go("/notifications") },
  /* The help centre itself, for the index cards */
  { id: "g-help", usedBy: "help-home", auth: false, steps: go("/help") },
];
const GUIDES = [
  ...GUIDE_BASE.map((c) => ({ ...c, dest: "guides" })),
  ...GUIDE_BASE.map((c) => ({ ...c, id: `${c.id}-lt`, theme: "light", dest: "guides" })),
  ...["g-list-kind", "g-host", "g-agent", "g-help"].map((id) => {
    const c = GUIDE_BASE.find((g) => g.id === id);
    return { ...c, id: `d-${id}`, kind: "desktop", dest: "guides" };
  }),
];
/** Every guide shot id, for the reference check. */
export const GUIDE_SHOT_IDS = GUIDES.map((c) => c.id);


/* The film set (October 2026): the host, agent and member screens for the two
   promo films, on the QA account's example hotel, apartments, restaurant and
   agent profile. Dark as f-<name>, desktop as d-f-<name>, light as f-<name>-lt.
   `seen` marks the feature first runs as already shown on this device (the
   cookie the app itself writes), so a workspace opens on its desk and not on
   its intro. `fullMax` caps a whole-page capture's height in pixels. Every
   one of these only navigates: nothing is paid, sent or saved. */
const HOTEL = "/stay/ea000000-0000-4000-8000-000000000001"; // Grand Vista Hotel
const HOTEL_BIZ = "eb000000-0000-4000-8000-000000000001";
const HARBOUR = "eb000000-0000-4000-8000-000000000006"; // Harbour Lights Kitchen
const FILM_BASE = [
  { id: "f-host-home", full: true, fullMax: 8000, steps: go("/host") },
  { id: "f-host-rooms", steps: go(`/host/rooms?business=${HOTEL_BIZ}`) },
  { id: "f-host-calendar", full: true, fullMax: 8000, steps: go(`/host/calendar?business=${HOTEL_BIZ}&month=2026-10`) },
  { id: "f-host-bookings", steps: go("/host/bookings") },
  { id: "f-host-reservations", steps: go("/host/reservations") },
  { id: "f-host-settings", steps: go("/host/settings") },
  { id: "f-host-start", steps: go("/host/start") },
  { id: "f-agent-dashboard", full: true, fullMax: 8000, steps: go("/agent/dashboard") },
  { id: "f-agent-listings", steps: go("/agent/listings") },
  { id: "f-agent-listing-edit", steps: go("/agent/list") },
  { id: "f-agent-portfolio", steps: go("/agent/portfolio") },
  { id: "f-agent-analytics", full: true, fullMax: 8000, steps: go("/agent/analytics") },
  { id: "f-agent-inspections", steps: go("/agent/inspections") },
  { id: "f-agent-earnings", steps: go("/agent/earnings") },
  { id: "f-agent-promotion", steps: go("/agent/promotion") },
  { id: "f-rewards", full: true, fullMax: 8000, steps: [{ goto: "/rewards" }, { clickIf: "[data-testid=rewards-explainer] button[aria-label=Skip]" }, { wait: 800 }] },
  /* The invite's first run, opened as "how it works" (a sheet; nothing is saved). */
  { id: "f-rewards-how", steps: [{ goto: "/rewards" }, { clear: ["nf-explainer-rewards-v1"] }, { goto: "/rewards" }] },
  { id: "f-host-deposits", steps: [{ goto: "/host/reservations" }, { reveal: "text=Table deposits", offset: 90 }] },
  { id: "f-rent-movein", steps: go(`/rent/move-in/${LISTING_RENT.split("/").pop()}`) },
  { id: "f-rewards-withdraw", steps: go("/rewards/withdraw") },
  { id: "f-rewards-history", steps: go("/rewards/history") },
  { id: "f-passport", steps: go("/settings/passport") },
  { id: "f-pro", steps: go("/pro") },
  { id: "f-agreements", steps: go("/agreements") },
  { id: "f-bookings", steps: go("/bookings") },
  { id: "f-receipts", steps: go("/receipts") },
  { id: "f-around", steps: go("/around") },
  { id: "f-verification", steps: go("/verification") },
  { id: "d-f-host-home", kind: "desktop", steps: go("/host") },
  { id: "d-f-host-calendar", kind: "desktop", steps: go(`/host/calendar?business=${HOTEL_BIZ}&month=2026-10`) },
  { id: "d-f-host-reservations", kind: "desktop", steps: go("/host/reservations") },
  { id: "d-f-agent-dashboard", kind: "desktop", steps: go("/agent/dashboard") },
  { id: "d-f-agent-analytics", kind: "desktop", steps: go("/agent/analytics") },
  { id: "d-f-agent-portfolio", kind: "desktop", steps: go("/agent/portfolio") },
  { id: "d-f-rewards", kind: "desktop", steps: [{ goto: "/rewards" }, { clickIf: "[data-testid=rewards-explainer] button[aria-label=Skip]" }, { wait: 800 }] },
  { id: "d-f-pro", kind: "desktop", steps: go("/pro") },
  { id: "d-f-around", kind: "desktop", steps: go("/around") },
].map((c) => ({ seen: true, ...c }));
const FILM_LIGHT = ["f-host-home", "f-agent-dashboard", "f-rewards", "f-passport"];
const FILM = [
  ...FILM_BASE,
  ...FILM_LIGHT.map((id) => ({ ...FILM_BASE.find((c) => c.id === id), id: `${id}-lt`, theme: "light", full: false })),
];
export const CAPTURES = [
  ...BASE_CAPTURES,
  ...GUIDES,
  ...FILM,
  ...SHOWCASE,
  ...LIGHT_TWINS.map((id) => {
    const cap = BASE_CAPTURES.find((c) => c.id === id);
    if (!cap) throw new Error(`no capture ${id} to twin`);
    return { ...cap, id: `${id}-lt`, theme: "light", full: FULL_TWINS.includes(id) ? cap.full : false };
  }),
];

/* The films' second pass (14 October, afternoon): every screen the films had
   from before main's 13 October home, icons and dock, captured again from the
   live app. */
export const NOW = [
  { id: "n-home", full: true, fullMax: 9000, steps: HOME },
  { id: "d-n-home", kind: "desktop", full: true, fullMax: 6000, steps: HOME },
  { id: "n-welcome-en", auth: false, steps: [{ goto: "/welcome" }, { wait: 2600 }] },
  ...["yo", "ha", "ig"].map((loc) => ({ id: `n-welcome-${loc}`, auth: false, locale: loc, steps: [{ goto: "/welcome" }, { wait: 2600 }] })),
  { id: "n-stays-dates", steps: go(STAYS_DATES) },
  { id: "n-stays", steps: go("/stays") },
  { id: "d-n-stays-dates", kind: "desktop", steps: go(STAYS_DATES) },
  { id: "d-n-search", kind: "desktop", steps: go("/search?market=rent") },
  { id: "n-search", full: true, fullMax: 7000, steps: go("/search?market=rent") },
  { id: "n-wallet", steps: go("/wallet") },
  { id: "f-stay-checkout", steps: go(HOTEL) },
  /* tall captures the films scroll through (14 October, afternoon) */
  { id: "n-home2", stitch: 9, full: true, fullMax: 9000, steps: HOME },
  { id: "n-search2", stitch: 9, full: true, fullMax: 8000, steps: go("/search") },
  { id: "n-listing", full: true, fullMax: 8000, steps: go(LISTING_RENT) },
  { id: "n-stay", full: true, fullMax: 8000, steps: go(HOTEL) },
  { id: "n-resort", full: true, fullMax: 8000, steps: go(STAY) },
  { id: "n-staysd", stitch: 8, full: true, fullMax: 8000, steps: go(STAYS_DATES) },
  { id: "n-restaurant", full: true, fullMax: 8000, steps: go(RESTAURANT) },
  { id: "d-n-listing", kind: "desktop", steps: go(LISTING_RENT) },
  { id: "d-n-stay", kind: "desktop", steps: go(STAY) },
  { id: "n-search-all", steps: go("/search") },
  { id: "d-n-search-all", kind: "desktop", steps: go("/search") },
  { id: "f-restaurant-reserve", steps: go(RESTAURANT) },
  /* the home's sections, each scrolled into view (they load as they come on screen) */
  ...[["premium", "Premium listings"], ["featured", "Featured listings"], ["best", "Best matches"], ["new", "New listings"], ["space", "Browse by space"]].map(([k, title]) => ({ id: `n-home-${k}`, steps: [...HOME, { reveal: `text="${title}"`, offset: 300 }, { wait: 2200 }] })),
  ...[["premium", "Premium listings"], ["featured", "Featured listings"]].map(([k, title]) => ({ id: `d-n-home-${k}`, kind: "desktop", steps: [...HOME, { reveal: `text="${title}"`, offset: 140 }, { wait: 2200 }] })),
];
CAPTURES.push(...NOW);
