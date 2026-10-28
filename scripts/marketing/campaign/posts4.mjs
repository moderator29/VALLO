/**
 * THE SOCIAL POSTS, 28 OCTOBER 2026. Twenty posts for a brand-new account, in
 * the founder's "Favex" direction: light grounds, two-tone headlines (one
 * light line, one bold line), the handset floating at an angle, big numbers,
 * quiz and persona cards, the stamp card, and the store badges on every one.
 *
 * Copy rules are scripts/marketing/DESIGN.md section 2 and are the product's
 * own: no em dashes, no promise words (safe, secure, protected, guaranteed),
 * no invented numbers or counts, "verified" never about a listing, and every
 * claim is one FACTS-OCT.md marks Live. The referral programme is left out on
 * purpose: payouts are still switched off in the policy, so a post that says
 * "earn" would promise what the app cannot yet pay.
 *
 * `lines` is the headline: a line that is wrapped in *stars* is the bold one.
 * `caption` is what goes under the image on every network.
 */
export const LINK = "vallospaces.com";

/* the four phone attitudes, from the pose test (28 October) */
export const POSE = {
  a: { rotation: { x: -4, y: -20, z: 12 }, fov: 22 },
  b: { rotation: { x: -10, y: 26, z: 16 }, fov: 24 },
  c: { rotation: { x: -18, y: -30, z: -8 }, fov: 28 },
  d: { rotation: { x: 8, y: -16, z: 20 }, fov: 20 },
  corner: { rotation: { x: 0, y: 16, z: -16 }, fov: 24 },
};

export const POSTS = [
  {
    n: 1, slug: "hello-nigeria", layout: "welcome", ground: "electric", theme: "electric",
    lines: ["Hello, Nigeria.", "*We are Vallo.*"],
    sub: "Homes, stays and tables, all in one app.",
    caption: `Hello, Nigeria. 👋

We are Vallo. Homes, stays and tables, all in one app.

We just opened our doors, so you are early. Come and see what we are building.

Get Vallo on the App Store and Google Play.

#Vallo #RealEstateDoneRight #NigeriaProperty`,
  },
  {
    n: 2, slug: "real-estate-done-right", layout: "hero", ground: "electric", theme: "electric", hl: "left",
    lines: ["Real estate,", "*done right.*"],
    phone: { screen: "sc-home-lt", pose: "a", h: 840, cx: 610, cy: 800 },
    objs: [["keys", 230, 150, 1010, -12]],
    slabs: [{ x: 800, y: 1070, rot: -3, size: 31, tab: "One account", rows: [["title", "Homes, stays, tables"], ["line", "All in one app"]] }],
    caption: `Real estate, done right. 🔑

No guessing. No runaround. Just a clear way to find your next place.

We are brand new and the doors are open. Be one of the first on Vallo.

App Store and Google Play. Link in bio.

#Vallo #RealEstateDoneRight #HouseHuntingNG`,
  },
  {
    n: 3, slug: "one-app-four-ways", layout: "grid4", ground: "paper", theme: "light",
    lines: ["One app.", "*Four ways to find a place.*"],
    cells: [["apartment", "Homes", "to rent or buy"], ["hotel", "Hotels", "rooms and nights"], ["shortlet", "Shortlets", "stay your way"], ["restaurant", "Restaurants", "reserve a table"]],
    caption: `One app. Four ways to find a place. 🏠🏨🌴🍽️

Homes to rent or buy. Hotels. Shortlets. Restaurant tables.

Stop juggling apps. Everything lives under one Vallo account.

Get it on the App Store and Google Play.

#Vallo #HomesNG #Shortlets #LagosLiving`,
  },
  {
    n: 4, slug: "find-a-place-that-fits", layout: "hero", ground: "paper", theme: "light", hl: "right",
    lines: ["Find a place", "*that fits you.*"],
    phone: { screen: "sc-search-lt", pose: "a", h: 800, cx: 540, cy: 800 },
    objs: [["search", 210, 200, 1000, -10]],
    caption: `Search the way you think. 🔍

Type where you want to be. Filter by what matters to you. Save the ones you love.

New here? Perfect. You are early. 😉

Download Vallo on the App Store and Google Play.

#Vallo #HouseHuntingNG #FindYourPlace`,
  },
  {
    n: 5, slug: "whole-cost-up-front", layout: "hero", ground: "paper", theme: "light", hl: "right",
    lines: ["See the whole cost", "*before you call.*"],
    phone: { screen: "sc-listing-cost-lt", pose: "d", h: 780, cx: 470, cy: 830 },
    lifts: [{ id: "sc-listing-cost-lt", box: [42, 807, 1278, 1044], cx: 770, cy: 1010, w: 560, rot: 3 }],
    caption: `Rent. Fees. Deposit. All of it, up front. 💸

On Vallo the whole cost sits on the listing, so the number you plan around is the number you see.

No surprises after the call.

Get the app on the App Store and Google Play.

#Vallo #RentInNigeria #NoSurprises`,
  },
  {
    n: 6, slug: "six-things", layout: "bignum", ground: "electric", theme: "electric",
    num: "6", lines: ["things you can", "*do on Vallo*"],
    phone: { screen: "sc-home-lt", pose: "b", h: 960, cx: 870, cy: 900 },
    caption: `6 things you can do on Vallo 👇

1. Search homes to rent or buy
2. Book hotels and shortlets
3. Reserve a restaurant table
4. Message owners and agents
5. See the full cost up front
6. List your own place

Which one are you trying first? Tell us below.

App Store and Google Play.

#Vallo #Nigeria #HomesNG`,
  },
  {
    n: 7, slug: "which-home-hunter", layout: "quiz", ground: "sky", theme: "light",
    lines: ["Which home", "*hunter are you?*"],
    tiles: [["A", "The Window Shopper", "villa", "search"], ["B", "The Budget Boss", "flats", "price-tag"], ["C", "The Shortlist Keeper", "terrace", "saved-heart"], ["D", "The All-Rounder", "hotel", "keys"]],
    caption: `Which home hunter are you? 👀

A. The Window Shopper
B. The Budget Boss
C. The Shortlist Keeper
D. The All-Rounder

Drop your letter below. We will not judge. (We are A and D.)

Get Vallo on the App Store and Google Play.

#Vallo #HouseHuntingNG #WhichAreYou`,
  },
  {
    n: 8, slug: "the-window-shopper", layout: "persona", ground: "sky", theme: "light",
    title: "THE WINDOW SHOPPER", quote: "“One more listing. Just one more.”", photo: "villa", chip: "search",
    caption: `The Window Shopper. 🪟

"One more listing. Just one more."

Hours later, you are still scrolling. We get it.

Tag a friend who does this. Then both of you grab Vallo on the App Store and Google Play.

#Vallo #TheWindowShopper #HouseHuntingNG`,
  },
  {
    n: 9, slug: "the-budget-boss", layout: "persona", ground: "sky", theme: "light",
    title: "THE BUDGET BOSS", quote: "“Show me the total cost first.”", photo: "flats", chip: "price-tag",
    caption: `The Budget Boss. 💼

"Show me the total cost first."

Good news: on Vallo the whole cost is on the listing before you ever pick up the phone.

Tag the friend who always asks. Get Vallo on the App Store and Google Play.

#Vallo #TheBudgetBoss #RentInNigeria`,
  },
  {
    n: 10, slug: "the-all-rounder", layout: "persona", ground: "sky", theme: "light",
    title: "THE ‘ONE APP FOR EVERYTHING’", quote: "A home. A hotel. A table for two.", photo: "hotel", chip: "keys",
    caption: `The All-Rounder. 🙌

A home. A hotel. A table for two. One app.

If your phone has too many apps and not enough room, Vallo was made for you.

Tag the friend who wants it all. App Store and Google Play.

#Vallo #TheAllRounder #OneApp`,
  },
  {
    n: 11, slug: "viewings-never-take-money", layout: "stamp", ground: "photo", photo: "living-room-dusk", tone: "electric", theme: "electric",
    q: "Do I pay to book a viewing?", a: "No. Viewings never take money.",
    caption: `Do I pay to book a viewing? 🤔

No. On Vallo, viewings never take money. Ask, schedule, go and see.

Quick questions like this are what we are here for. Ask us anything below.

Get Vallo on the App Store and Google Play.

#Vallo #HouseViewing #RentInNigeria`,
  },
  {
    n: 12, slug: "talk-to-the-owner", layout: "stampphone", ground: "electric", theme: "electric", tone: "paper",
    q: "Who do I talk to?", a: "The owner or agent, straight from the listing.",
    phone: { screen: "sc-thread-lt", pose: "c", h: 660, cx: 560, cy: 850 },
    caption: `Who do you actually talk to? 💬

The owner or agent. Straight from the listing, inside the app. No middle layers.

Ask to view. Schedule a visit. Keep the whole conversation in one place.

Get Vallo on the App Store and Google Play.

#Vallo #DirectChat #HouseHuntingNG`,
  },
  {
    n: 13, slug: "make-room", layout: "homescreen", ground: "tiles", theme: "electric",
    kicker: "NOW ON IPHONE AND ANDROID", lines: ["MAKE", "ROOM ON", "*YOUR HOME*", "*SCREEN*"],
    caption: `Make room on your home screen. 📲

Vallo is live on the App Store and Google Play. Find the icon, tap it, and your next place is a few taps away.

Be early. Be one of the first.

#Vallo #NowLive #AppStore #GooglePlay`,
  },
  {
    n: 14, slug: "book-a-table-book-a-room", layout: "hero", ground: "sunset", theme: "sunset", hl: "right",
    lines: ["Reserve a table.", "*Book a room.*"],
    phone: { screen: "sc-restaurants-lt", pose: "c", h: 800, cx: 540, cy: 810 },
    caption: `Dinner plans. Weekend away. Sorted. 🍽️🛏️

Reserve a table at a restaurant. Book a room at a hotel or shortlet. All from one app.

Treat yourself. You have earned it.

Get Vallo on the App Store and Google Play.

#Vallo #WeekendGetaway #LagosEats #Shortlets`,
  },
  {
    n: 15, slug: "save-compare-decide", layout: "hero", ground: "sky", theme: "light", hl: "right",
    lines: ["Save. Compare.", "*Decide.*"],
    phone: { screen: "sc-saved-lt", pose: "b", h: 800, cx: 520, cy: 810 },
    lifts: [{ id: "sc-saved-lt", box: [47, 1140, 1273, 1413], cx: 790, cy: 1010, w: 600, rot: -3 }],
    caption: `Save the ones you love. Put two side by side. Then decide. ❤️

That is the Shortlist Keeper's way (Option C, if you were in the quiz). 😄

Be early on Vallo. App Store and Google Play.

#Vallo #TheShortlistKeeper #HouseHuntingNG`,
  },
  {
    n: 16, slug: "speaks-your-language", layout: "langs", ground: "paper", theme: "light",
    lines: ["Vallo speaks", "*your language.*"],
    rows: [["EN", "English", "Welcome"], ["HA", "Hausa", "Barka da zuwa"], ["YO", "Yorùbá", "Ẹ káàbọ̀"], ["IG", "Igbo", "Nnọọ"]],
    caption: `Vallo speaks your language. 🇳🇬

English. Hausa. Yorùbá. Igbo.

Choose yours and feel at home from the first screen.

Which language will you pick? Tell us below. 👇

Get Vallo on the App Store and Google Play.

#Vallo #Hausa #Yoruba #Igbo #Nigeria`,
  },
  {
    n: 17, slug: "list-it-yourself", layout: "owner", ground: "electric", theme: "electric",
    lines: ["Own a place?", "*List it yourself.*"],
    lift: { id: "host-start-lt", box: [45, 2223, 1275, 2498], cx: 540, cy: 760, w: 840, rot: -2 },
    caption: `Own a place? List it yourself. 🏡

"I own the property. List it yourself. No agency fee." That is right there in the app.

Add a workspace, tell us about your place, and send it for its checks.

Landlords and owners: come and meet Vallo. App Store and Google Play.

#Vallo #ListYourProperty #Landlords #NigeriaProperty`,
  },
  {
    n: 18, slug: "never-holds-your-money", layout: "trust", ground: "paper", theme: "light",
    lines: ["Vallo never", "*holds your money.*"],
    sub: "Payments go straight to the owner, the host or the business, through a licensed payment processor.",
    caption: `Vallo never holds your money. 💙

When you pay, your money goes straight to the owner, the host or the business, through a licensed payment processor.

Clear rules. Clear money. That is how it should be.

Get Vallo on the App Store and Google Play.

#Vallo #ClearMoney #RealEstateDoneRight`,
  },
  {
    n: 19, slug: "day-or-night", layout: "daynight", ground: "split",
    caption: `Day mode. Night mode. Your call. 🌗

Vallo looks great both ways, so you can house hunt at noon or at midnight.

Which team are you? ☀️ or 🌙? Tell us below.

Get Vallo on the App Store and Google Play.

#Vallo #DarkMode #LightMode #HouseHuntingNG`,
  },
  {
    n: 20, slug: "what-should-we-show-next", layout: "poll", ground: "sky", theme: "light",
    lines: ["What should we", "*show you next?*"],
    opts: [["A", "Homes", "apartment"], ["B", "Stays", "hotel"], ["C", "Tables", "restaurant"], ["D", "List my place", "keys"]],
    caption: `We are brand new, and you get a say. 🗳️

What should we show you next?

A. Homes
B. Stays
C. Tables
D. List my place

Drop your letter below. We are listening.

Be early. Get Vallo on the App Store and Google Play.

#Vallo #YouChoose #HouseHuntingNG`,
  },
];
