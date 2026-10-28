/**
 * THE SOCIAL POSTS, SECOND PASS, 28 OCTOBER 2026.
 *
 * The founder rejected the first twenty: the phones were turned too far to
 * read, the home-screen mock did not look like iOS, the light-mode screens
 * were wrong ("all platform views in dark mode"), the day/night post had to
 * go, and posts a platform this size needs were missing. So:
 *
 *   - every handset is dark mode and nearly straight on, large, with the
 *     one part that matters lifted off the glass beside it, in a thick rule;
 *   - the home-screen mock is gone, replaced by the app icon itself;
 *   - cut: day/night, the poll, "hello", "real estate done right", the
 *     four-ways grid, the all-rounder persona;
 *   - added: the launch itself, Price Check, verification, inspect first, the
 *     assistant, and agents.
 *
 * Copy rules are scripts/marketing/DESIGN.md section 2: no em dashes, no
 * promise words, no invented numbers, "verified" only about people and
 * businesses, and every claim is one FACTS-OCT.md marks Live. The referral
 * programme stays out: payouts are still switched off in the policy.
 *
 * `lines` is the headline (a `*starred*` part is the bold one), `caption` goes
 * under the image on every network.
 */
export const LINK = "vallospaces.com";

/* two handsets, both near straight on: a hint of the edge, never turned away */
export const POSE = {
  s: { rotation: { x: 3, y: -7, z: 0 }, fov: 22 },
  m: { rotation: { x: -3, y: 9, z: 0 }, fov: 22 },
};

export const POSTS = [
  {
    n: 1, slug: "vallo-is-live", layout: "phone", ground: "electric", theme: "electric",
    kicker: "NOW ON IPHONE AND ANDROID", lines: ["Vallo", "is *live.*"], sub: "Real estate, done right.",
    phone: { screen: "sc-home", pose: "s" },
    slabs: [{ x: 330, y: 930, rot: -2, size: 30, tab: "One app", rows: [["title", "Homes. Stays. Tables."], ["line", "One account for all of it."]] }],
    objs: [["keys", 200, 150, 1110, -12]],
    caption: `Vallo is live. 🔥

Real estate, done right: homes, stays and tables in one app.

The first people in set the tone. Get it now on the App Store and Google Play.

#ValloIsLive #RealEstateDoneRight #Nigeria`,
  },
  {
    n: 2, slug: "six-things", layout: "bignum", ground: "electric", theme: "electric",
    num: "6", lines: ["things you can", "*do on Vallo*"],
    phone: { screen: "sc-search", pose: "s", cx: 770, cy: 850, h: 1000 },
    caption: `6 things you can do on Vallo, starting today 👇

1. Search homes to rent or buy
2. Book hotels and shortlets
3. Reserve a restaurant table
4. Message owners and agents
5. See the full cost up front
6. List your own place

Which one are you trying first?

App Store and Google Play.

#Vallo #HomesNG #Nigeria`,
  },
  {
    n: 3, slug: "find-a-place-that-fits", layout: "phone", ground: "ice", theme: "light",
    lines: ["Find a", "place that", "*fits you.*"],
    phone: { screen: "sc-search", pose: "s" },
    lifts: [{ id: "sc-search", box: [30, 393, 1320, 744], cx: 350, cy: 790, w: 560, rot: -2 }],
    objs: [["search", 210, 170, 1060, -10]],
    caption: `Search the way you think. 🔍

Type where you want to be. Jump to For you, Near me or New listed. Save the search and come back to it.

Be early. Get Vallo on the App Store and Google Play.

#Vallo #HouseHuntingNG #FindYourPlace`,
  },
  {
    n: 4, slug: "whole-cost-up-front", layout: "phoneC", ground: "ivory", theme: "light",
    lines: ["See the whole cost", "*before you call.*"],
    phone: { screen: "sc-listing-cost", pose: "s" },
    lifts: [{ id: "sc-listing-cost", box: [42, 807, 1278, 1044], cx: 780, cy: 1010, w: 560, rot: 3 }],
    objs: [["price-tag", 200, 200, 1010, -12]],
    caption: `No surprises. 💸

Rent. Agency and legal fees. Agreement fee. Refundable caution deposit. It is all on the listing before you pick up the phone.

See the number first. Then decide.

Get Vallo on the App Store and Google Play.

#Vallo #RentInNigeria #NoSurprises`,
  },
  {
    n: 5, slug: "price-check", layout: "phone", ground: "ice", theme: "light",
    lines: ["What are", "places near", "*you asking?*"],
    phone: { screen: "sc-price", pose: "s" },
    lifts: [{ id: "sc-price", box: [40, 720, 1290, 1190], cx: 330, cy: 870, w: 520, rot: -2 }],
    objs: [["price-tag", 200, 170, 1090, -12]],
    caption: `What are places near you asking? 🏷️

Price Check shows what similar places nearby are currently advertised at. If there is not enough to be sure, it says so instead of guessing.

Know the market before you make the call.

Get Vallo on the App Store and Google Play.

#Vallo #PriceCheck #RentInNigeria`,
  },
  {
    n: 6, slug: "know-who-you-deal-with", layout: "phoneC", ground: "ivory", theme: "light",
    lines: ["Know who you are", "*dealing with.*"],
    phone: { screen: "sc-verification", pose: "m" },
    lifts: [{ id: "sc-verification", box: [170, 920, 1280, 1296], cx: 300, cy: 1010, w: 540, rot: -2 }],
    objs: [["id-check", 210, 860, 560, 10]],
    caption: `Know who you are dealing with. ✅

Owners, agents, hosts and businesses with the verified mark have been checked by a real person at Vallo. Four steps, in order: ID seen, address confirmed, bank account in their own name, and met in person.

A name and a face behind every listing.

Get Vallo on the App Store and Google Play.

#Vallo #KnowWhoYouDealWith #RealEstateDoneRight`,
  },
  {
    n: 7, slug: "ask-the-owner-directly", layout: "phone", ground: "electric", theme: "electric",
    lines: ["Ask the", "owner", "*directly.*"],
    phone: { screen: "sc-thread", pose: "s" },
    lifts: [{ id: "sc-thread", box: [14, 388, 1296, 907], cx: 340, cy: 860, w: 560, rot: -2 }],
    objs: [["envelope", 190, 170, 1090, -10]],
    caption: `Ask the owner directly. 💬

Message them from the listing. Ask to view. Schedule a visit. The whole conversation stays in one place.

Get Vallo on the App Store and Google Play.

#Vallo #DirectChat #HouseHuntingNG`,
  },
  {
    n: 8, slug: "viewings-never-take-money", layout: "stamp", ground: "photo", photo: "living-room-dusk", theme: "electric",
    q: "Do I pay to book a viewing?", a: "No. Viewings never take money.",
    caption: `Do I pay to book a viewing? 🤔

No. On Vallo, viewings never take money. Ask, schedule, go and see.

Got a question about renting, buying or booking? Ask us below.

Get Vallo on the App Store and Google Play.

#Vallo #HouseViewing #RentInNigeria`,
  },
  {
    n: 9, slug: "inspect-first", layout: "steps", ground: "sunset", theme: "sunset",
    lines: ["Inspect first.", "*Then decide.*"],
    steps: [["checklist", "Ask for an inspection"], ["list", "Read the report"], ["contract", "Agreement drawn up"]],
    pill: "Vallo charges no inspection fee",
    caption: `Inspect first. Then decide. 🔎

Ask for an inspection. Read the report. Only then is the agreement drawn up.

And Vallo charges no inspection fee.

Get Vallo on the App Store and Google Play.

#Vallo #InspectFirst #RentInNigeria`,
  },
  {
    n: 10, slug: "never-holds-your-money", layout: "trust", ground: "ivory", theme: "light",
    lines: ["Vallo never", "*holds your money.*"],
    sub: "Payments go straight to the owner, the host or the business, through a licensed payment processor.",
    caption: `Vallo never holds your money. 💙

When you pay, it goes straight to the owner, the host or the business, through a licensed payment processor.

Clear rules. Clear money.

Get Vallo on the App Store and Google Play.

#Vallo #ClearMoney #RealEstateDoneRight`,
  },
  {
    n: 11, slug: "reserve-a-table-book-a-room", layout: "phone", ground: "sunset", theme: "sunset",
    lines: ["Reserve a", "table.", "*Book a room.*"],
    phone: { screen: "sc-stays", pose: "s" },
    slabs: [{ x: 330, y: 900, rot: -2, size: 30, tab: "One app", rows: [["title", "Hotels. Shortlets."], ["line", "Restaurants too."]] }],
    objs: [["restaurant", 200, 160, 1090, -10]],
    caption: `Dinner tonight. Weekend away. 🍽️🛏️

Reserve a table at a restaurant. Book a room at a hotel or shortlet. One app, one account.

Get Vallo on the App Store and Google Play.

#Vallo #WeekendGetaway #LagosEats #Shortlets`,
  },
  {
    n: 12, slug: "save-compare-decide", layout: "phoneC", ground: "ice", theme: "light",
    lines: ["Save. Compare.", "*Decide.*"],
    phone: { screen: "sc-saved", pose: "m" },
    lifts: [{ id: "sc-saved", box: [47, 1140, 1273, 1413], cx: 790, cy: 1010, w: 560, rot: -3 }],
    objs: [["saved-heart", 200, 190, 1000, 12]],
    caption: `Save the ones you love. Put two side by side. Then decide. ❤️

Your shortlist stays with your account, on every device you use.

Get Vallo on the App Store and Google Play.

#Vallo #TheShortlistKeeper #HouseHuntingNG`,
  },
  {
    n: 13, slug: "ask-vallo-anything", layout: "phone", ground: "electric", theme: "electric",
    lines: ["Ask Vallo", "*anything.*"], sub: "Always here. Ask anything.",
    phone: { screen: "sc-assistant-start", pose: "s" },
    lifts: [{ id: "sc-assistant-start", box: [48, 2425, 790, 2590], cx: 330, cy: 830, w: 520, rot: -2 }],
    objs: [["assistant", 230, 170, 1070, -8]],
    caption: `Ask Vallo anything. 🤖

Our AI assistant helps with questions about renting, buying, staying and booking, and it always tells you it is an AI.

Try: "Two bedroom in Lekki under 5m a year."

Get Vallo on the App Store and Google Play.

#Vallo #AskVallo #AI #Nigeria`,
  },
  {
    n: 14, slug: "list-it-yourself", layout: "phoneC", ground: "ivory", theme: "light",
    lines: ["Own a place?", "*List it yourself.*"],
    phone: { screen: "host-start", pose: "s" },
    lifts: [{ id: "host-start", box: [42, 1944, 1278, 2190], cx: 790, cy: 1010, w: 560, rot: -2 }],
    objs: [["keys", 240, 190, 1010, -14]],
    caption: `Own a place? List it yourself. 🏡

"I own the property. List it yourself. No agency fee." That is in the app, word for word.

Add a workspace, tell us about your place, and send it for its checks.

Landlords and owners, come and meet Vallo. App Store and Google Play.

#Vallo #ListYourProperty #Landlords #NigeriaProperty`,
  },
  {
    n: 15, slug: "agents-apply-to-list", layout: "phone", ground: "ice", theme: "light",
    lines: ["Agents,", "*apply to*", "*list.*"],
    phone: { screen: "sc-agent-listings", pose: "s" },
    lifts: [{ id: "sc-agent-listings", box: [28, 1468, 1292, 2452], cx: 350, cy: 900, w: 560, rot: -2 }],
    caption: `Agents, apply to list on Vallo. 🏢

Listing is open to approved agents. The application takes about two minutes, and a real person reviews it within 24 to 48 hours.

A named person behind every listing. You keep what you charge.

Get Vallo on the App Store and Google Play.

#Vallo #RealEstateAgents #NigeriaProperty`,
  },
  {
    n: 16, slug: "speaks-your-language", layout: "langs", ground: "ivory", theme: "light",
    lines: ["Vallo speaks", "*your language.*"],
    rows: [["EN", "English", "Welcome"], ["HA", "Hausa", "Barka da zuwa"], ["YO", "Yorùbá", "Ẹ káàbọ̀"], ["IG", "Igbo", "Nnọọ"]],
    caption: `Vallo speaks your language. 🇳🇬

English. Hausa. Yorùbá. Igbo.

Pick yours and feel at home from the first screen. Which one are you? 👇

Get Vallo on the App Store and Google Play.

#Vallo #Hausa #Yoruba #Igbo #Nigeria`,
  },
  {
    n: 17, slug: "which-home-hunter", layout: "quiz", ground: "sky", theme: "light",
    lines: ["Which home", "*hunter are you?*"],
    tiles: [["A", "The Window Shopper", "villa", "search"], ["B", "The Budget Boss", "flats", "price-tag"], ["C", "The Shortlist Keeper", "terrace", "saved-heart"], ["D", "The All-Rounder", "hotel", "keys"]],
    caption: `Which home hunter are you? 👀

A. The Window Shopper
B. The Budget Boss
C. The Shortlist Keeper
D. The All-Rounder

Drop your letter below.

Get Vallo on the App Store and Google Play.

#Vallo #HouseHuntingNG #WhichAreYou`,
  },
  {
    n: 18, slug: "the-window-shopper", layout: "persona", ground: "sky", theme: "light",
    title: "THE WINDOW SHOPPER", quote: "“One more listing. Just one more.”", photo: "villa", chip: "search",
    caption: `The Window Shopper. 🪟

"One more listing. Just one more."

Tag the friend who has been scrolling for hours.

Get Vallo on the App Store and Google Play.

#Vallo #TheWindowShopper #HouseHuntingNG`,
  },
  {
    n: 19, slug: "the-budget-boss", layout: "persona", ground: "sky", theme: "light",
    title: "THE BUDGET BOSS", quote: "“Show me the total cost first.”", photo: "flats", chip: "price-tag",
    caption: `The Budget Boss. 💼

"Show me the total cost first."

On Vallo the whole cost is on the listing before you ever pick up the phone.

Tag the friend who always asks.

Get Vallo on the App Store and Google Play.

#Vallo #TheBudgetBoss #RentInNigeria`,
  },
  {
    n: 20, slug: "look-for-this-icon", layout: "icon", ground: "electric", theme: "electric",
    lines: ["Look for", "*this icon.*"], sub: "Search “Vallo” on the App Store and Google Play.",
    caption: `Look for this icon. 📲

Search "Vallo" on the App Store or Google Play, tap it, and your next place is a few taps away.

Real estate, done right.

#Vallo #NowLive #AppStore #GooglePlay`,
  },
];
