/**
 * THE SOCIAL POSTS, NOVEMBER 2026: the October set (posts5.mjs) rebuilt on
 * the upgraded platform, plus the features it now has.
 *
 * Every handset is a November capture in dark mode (docs/marketing/source
 * v3-*, f-host-*), nearly straight on, with the one part that matters lifted
 * beside it on the component's own edges (display px, measured on a grid).
 * New this month: Vallo Circle, Vallo Roommates (schools, corps members,
 * safety, badges), the Vallo passport, split the move-in total, homes for
 * sale with the same full cost, the stay and restaurant pages, and the
 * workspace's own day.
 *
 * Copy rules: scripts/marketing/DESIGN.md section 2 and the films' briefs.
 * No em dashes, no promise words, no invented numbers, "verified" only about
 * people, nothing about paying rent through the app (rent payment is not
 * open), and every quoted line is the product's own words from its screen.
 *
 * `lines` is the headline (a `*starred*` part is the bold one), `tag` the
 * feature pill above it, `caption` the text under the image on every network.
 */
export const LINK = "vallospaces.com";

export const POSE = {
  s: { rotation: { x: 3, y: -7, z: 0 }, fov: 22 },
  m: { rotation: { x: -3, y: 9, z: 0 }, fov: 22 },
};

const GET = "Get Vallo on the App Store and Google Play.";

export const POSTS = [
  {
    n: 1, slug: "vallo-is-live", layout: "hero", ground: "electric", theme: "electric",
    tag: "Now on iPhone and Android", lines: ["Vallo is *live.*"], sub: "Real estate, done right.",
    phone: { screen: "v3-home", pose: "s" },
    lifts: [{ id: "v3-home", box: [112, 2035, 1208, 2361] }],
    objs: [["keys", 200, 150, 1110, -12]],
    caption: `Vallo is live. 🎉

Homes to rent or buy, hotels, shortlets and restaurants. One app, one account.

Get it on the App Store and Google Play, or visit vallospaces.com

#Vallo #ValloIsLive #RealEstateDoneRight #Nigeria`,
  },
  {
    n: 2, slug: "one-account", layout: "bignum", ground: "night", theme: "night",
    num: "1", lines: ["account.", "*Every space.*"],
    phone: { screen: "v3-home-new", pose: "s", cx: 790, cy: 745, h: 900 },
    objs: [["keys", 230, 270, 1050, -12]],
    caption: `One account for every kind of space. 🔑

Homes to rent or buy. Hotels and shortlets. Restaurant tables. Vallo Circle and Vallo Roommates.

Sign in once and it all comes with you, on every device.

${GET}

#Vallo #OneApp #Nigeria`,
  },
  {
    n: 3, slug: "find-a-place-that-fits", layout: "hero", ground: "ice", theme: "light",
    tag: "Search", lines: ["Find a place", "*that fits you.*"],
    phone: { screen: "v3-search", pose: "s" },
    lifts: [{ id: "v3-search", box: [40, 572, 1148, 720] }],
    objs: [["search", 200, 160, 1100, -10]],
    caption: `Search the way you think. 🔍

Type where you want to be, or describe the home. Jump to For you, Near me or New listed, and save the search to come back to it.

${GET}

#Vallo #HouseHuntingNG #FindYourPlace`,
  },
  {
    n: 4, slug: "filter-by-what-you-need", layout: "hero", cardH: 540, ground: "sky", theme: "light",
    tag: "Filters", lines: ["Filter by exactly", "*what you need.*"],
    phone: { screen: "v3-filters", pose: "m" },
    lifts: [{ id: "v3-filters", box: [30, 680, 1290, 1505] }],
    objs: [["price-tag", 190, 160, 1120, -10]],
    caption: `Your budget. Your bedrooms. Your bathrooms. 🎚️

Set a price range, a minimum count of rooms, for rent, for sale or shortlet. Vallo shows only what fits.

${GET}

#Vallo #RentInNigeria #HouseHuntingNG`,
  },
  {
    n: 5, slug: "whole-cost-up-front", layout: "hero", ground: "ivory", theme: "light",
    tag: "The whole cost", lines: ["See the whole cost", "*before you call.*"],
    phone: { screen: "v3-listing-cost", pose: "s" },
    lifts: [{ id: "v3-listing-cost", box: [42, 800, 1278, 1020] }],
    objs: [["earnings", 200, 200, 1010, -12]],
    caption: `No surprises. 💸

Rent. Agency fee. Legal fee. Agreement fee. The refundable caution deposit. It is all on the listing, with who keeps what, before you pick up the phone.

${GET}

#Vallo #RentInNigeria #NoSurprises`,
  },
  {
    n: 6, slug: "one-total", layout: "hero", ground: "electric", theme: "electric",
    tag: "Total to move in", lines: ["Every fee.", "*One total.*"],
    phone: { screen: "v3-listing-total", pose: "s" },
    lifts: [{ id: "v3-listing-total", box: [70, 1218, 1248, 1340] }],
    objs: [["pay", 190, 170, 1100, -10]],
    caption: `Every fee, added up into one number: the total to move in. 🧮

It is on every listing, and it says which costs the lister has not declared, so you know what to ask.

${GET}

#Vallo #RentInNigeria #RealEstateDoneRight`,
  },
  {
    n: 7, slug: "buying-same-full-cost", layout: "hero", ground: "sunset", theme: "sunset",
    tag: "For sale", lines: ["Buying?", "*Same full cost.*"],
    phone: { screen: "v3-listing-sale", pose: "s" },
    lifts: [{ id: "v3-listing-sale", box: [76, 1119, 1242, 1518] }],
    objs: [["buy", 200, 160, 1110, -10]],
    caption: `Buying, not renting? 🏠

Homes for sale on Vallo show the same full breakdown: the asking price, the rooms, the features, and every cost the seller has declared.

${GET}

#Vallo #BuyAHome #NigeriaProperty`,
  },
  {
    n: 8, slug: "split-the-total", layout: "hero", cardH: 560, ground: "ice", theme: "light",
    tag: "Cost splitter", lines: ["Sharing? *Split it,*", "person by person."],
    phone: { screen: "v3-split", pose: "m" },
    lifts: [{ id: "v3-split", box: [40, 1281, 1280, 2069] }],
    objs: [["team", 190, 160, 1130, -10]],
    caption: `Moving in with friends? 👯

Pick how many people are sharing, split equally or by room, and see what each person pays to move in and every month. Then share it with your group.

${GET}

#Vallo #Roommates #RentInNigeria`,
  },
  {
    n: 9, slug: "save-compare-decide", layout: "hero", ground: "ivory", theme: "light",
    tag: "Saved", lines: ["Save. Compare.", "*Decide.*"],
    phone: { screen: "v3-saved", pose: "m" },
    lifts: [{ id: "v3-saved", box: [30, 1160, 925, 1456] }],
    objs: [["saved-heart", 200, 190, 1000, 12]],
    caption: `Save the ones you love. Put two side by side. Then decide. ❤️

Your shortlist is kept on your phone too, so it opens without signal.

${GET}

#Vallo #HouseHuntingNG #SaveCompareDecide`,
  },
  {
    n: 10, slug: "book-a-stay", layout: "hero", cardH: 560, ground: "sunset", theme: "sunset",
    tag: "Stays", lines: ["Going away?", "*Book a stay.*"],
    phone: { screen: "v3-stays", pose: "s" },
    lifts: [{ id: "v3-stays", box: [26, 1603, 1294, 2476] }],
    objs: [["calendar-booked", 200, 160, 1120, -10]],
    caption: `Weekend away? 🧳

Hotels, shortlets, restaurants and local talk, side by side. Find a room, book it in a few taps, and keep it all with one account.

${GET}

#Vallo #Shortlets #WeekendGetaway #Nigeria`,
  },
  {
    n: 11, slug: "see-the-room", layout: "hero", ground: "night", theme: "night",
    tag: "Before you book", lines: ["See the room.", "*Check every detail.*"],
    phone: { screen: "v3-stay", pose: "s" },
    lifts: [{ id: "v3-stay", box: [91, 1288, 1238, 1773] }],
    objs: [["hotel", 200, 160, 1130, -10]],
    caption: `See the room before you book it. 🛏️

Photos, how many it sleeps, the room types, the price per night and what comes with it. Every detail is on the page.

${GET}

#Vallo #Hotels #Shortlets #Lagos`,
  },
  {
    n: 12, slug: "reserve-a-table", layout: "hero", ground: "sunset", theme: "sunset",
    tag: "Restaurants", lines: ["Hungry?", "*Reserve a table.*"],
    phone: { screen: "v3-restaurant", pose: "m" },
    lifts: [{ id: "v3-restaurant", box: [140, 1241, 1169, 1639], cover: [645, 725] }],
    objs: [["restaurant", 200, 160, 1120, -10]],
    caption: `Dinner tonight? 🍽️

See the menu style, the hours, the seats and what the place has, then reserve your table. The restaurant confirms it.

${GET}

#Vallo #LagosEats #AbujaEats #DinnerPlans`,
  },
  {
    n: 13, slug: "meet-vallo-circle", layout: "hero", ground: "night", theme: "night",
    tag: "New · Vallo Circle", lines: ["Meet", "*Vallo Circle.*"],
    phone: { screen: "v3-circle", pose: "s" },
    lifts: [{ id: "v3-circle", box: [30, 462, 1290, 750] }],
    objs: [["local-talks", 200, 160, 1130, -10]],
    caption: `Meet Vallo Circle. 🗣️

Renters, owners, agents and professionals, sharing what they know about homes and areas. Ask, share and learn, before you move.

Join the real estate community on Vallo.

#ValloCircle #Vallo #Nigeria`,
  },
  {
    n: 14, slug: "ask-about-an-area", layout: "hero", ground: "ice", theme: "light",
    tag: "Vallo Circle", lines: ["Ask about an area", "*before you move in.*"],
    phone: { screen: "v3-feed", pose: "m" },
    lifts: [{ id: "v3-feed", box: [30, 1516, 1290, 2240], keep: [[700, 1420]] }],
    objs: [["map", 200, 190, 1010, -12]],
    caption: `Which street has reliable light, and for how many hours a day? 💡

Ask the people who live there. In Vallo Circle, renters, owners, agents and professionals share what they know about homes and areas, so you can ask before you move in.

${GET}

#ValloCircle #Neighbourhoods #Lagos #Abuja`,
  },
  {
    n: 15, slug: "find-a-roommate", layout: "hero", ground: "electric", theme: "electric",
    tag: "New · Vallo Roommates", lines: ["Find a *roommate.*"], sub: "Or a room to share.",
    phone: { screen: "v3-roommates", pose: "s" },
    lifts: [{ id: "v3-roommates", box: [30, 1170, 1290, 1790] }],
    objs: [["team", 200, 160, 1120, -10]],
    caption: `Meet Vallo Roommates. 🏠🤝

A room, a roommate or a place to share. Your profile or listing says who you are and what you want.

${GET}

#ValloRoommates #Roommates #Nigeria`,
  },
  {
    n: 16, slug: "near-your-school", layout: "hero", ground: "sky", theme: "light",
    tag: "Vallo Roommates", lines: ["Near your *school.*"], sub: "Schools, groups and corps members.",
    phone: { screen: "v3-schools", pose: "m" },
    lifts: [{ id: "v3-schools", box: [42, 1349, 1278, 1971], keep: [[670, 870]] }],
    objs: [["explore", 190, 160, 1130, -10]],
    caption: `Students and corps members, this one is for you. 🎓

Find students and rooms near your school, join groups, and meet other corps members, all in Vallo Roommates.

${GET}

#ValloRoommates #NYSC #CampusLife #Nigeria`,
  },
  {
    n: 17, slug: "share-a-home-with-care", layout: "hero", ground: "ivory", theme: "light",
    tag: "Roommate safety", lines: ["Share a home", "*with care.*"],
    phone: { screen: "v3-safety", pose: "s", h: 740 },
    lifts: [{ id: "v3-safety", box: [30, 990, 1290, 1648], cover: [990, 2862] }],
    objs: [["checklist", 200, 200, 1010, -12]],
    caption: `Sharing a home with someone new? Read this first. ✅

View the home in person, or on a live video call, before you pay anything. Check who is offering the room and that they are allowed to. The full checklist is in Vallo Roommates.

${GET}

#ValloRoommates #Roommates #ShareWithCare`,
  },
  {
    n: 18, slug: "what-a-badge-says", layout: "hero", ground: "night", theme: "night",
    tag: "Badges", lines: ["See what was", "*actually confirmed.*"],
    phone: { screen: "v3-roommates-2", pose: "s" },
    lifts: [{ id: "v3-roommates-2", box: [30, 1170, 1290, 1790] }],
    objs: [["verified", 180, 160, 1160, -10]],
    caption: `A badge says exactly what was confirmed. 🏅

A school email, an ID, a phone number. Nothing more is claimed.

${GET}

#Vallo #ValloRoommates #KnowWhoYouMeet`,
  },
  {
    n: 19, slug: "your-vallo-passport", layout: "hero", ground: "electric", theme: "electric",
    tag: "Vallo passport", lines: ["Your Vallo", "*passport.*"],
    phone: { screen: "v3-passport", pose: "s" },
    lifts: [{ id: "v3-passport", box: [30, 470, 1290, 975] }],
    objs: [["id-check", 200, 160, 1110, -10]],
    caption: `Your Vallo passport: what Vallo recorded about you. 🪪

Every line is shown until you switch it off. Members can open your passport from your profile and from a chat.

${GET}

#Vallo #ValloPassport #Trust`,
  },
  {
    n: 20, slug: "never-holds-your-money", layout: "hero", ground: "sunset", theme: "sunset",
    tag: "Payments", lines: ["Vallo never", "*holds your money.*"],
    phone: { screen: "v3-payments", pose: "m" },
    lifts: [{ id: "v3-payments", box: [40, 975, 1280, 1450] }],
    objs: [["bank", 220, 190, 1010, -10]],
    caption: `Vallo never holds your money. 💙

Your payments screen is a record of payments that have already moved, with a statement you can download.

${GET}

#Vallo #ClearMoney #RealEstateDoneRight`,
  },
  {
    n: 21, slug: "ask-vallo-anything", layout: "hero", ground: "electric", theme: "electric",
    tag: "AI assistant", lines: ["Ask Vallo", "*anything.*"],
    phone: { screen: "v3-assistant", pose: "s" },
    lifts: [{ id: "v3-assistant", box: [40, 2195, 760, 2370] }],
    objs: [["assistant", 230, 170, 1080, -8]],
    caption: `Ask Vallo anything. 🤖

Somewhere to rent or buy, a hotel or shortlet, a table to book, or what moving in really costs. The AI assistant is always here, and you can talk to a person too.

Try: "Two bedroom in Lekki under 5m a year."

${GET}

#Vallo #AskVallo #AI #Nigeria`,
  },
  {
    n: 22, slug: "price-check", layout: "hero", ground: "ice", theme: "light",
    tag: "Price Check", lines: ["What are places", "*near you asking?*"],
    phone: { screen: "v3-price", pose: "s" },
    lifts: [{ id: "v3-price", box: [30, 740, 1260, 1148] }],
    objs: [["analytics", 200, 170, 1100, -12]],
    caption: `What are places near you asking? 🏷️

Tell Price Check where and what, and it tells you what similar places near there are currently advertised for. If there is not enough to be sure, it says so rather than guess.

${GET}

#Vallo #PriceCheck #RentInNigeria`,
  },
  {
    n: 23, slug: "list-it-yourself", layout: "hero", ground: "ivory", theme: "light",
    tag: "For owners", lines: ["Own a place?", "*List it yourself.*"],
    phone: { screen: "f-host-start", pose: "s" },
    lifts: [{ id: "f-host-start", box: [42, 2280, 1278, 2595] }],
    objs: [["keys", 240, 190, 1010, -14]],
    caption: `Own a place? List it yourself. 🏡

"I own the property. List it yourself. No agency fee." That is in the app, word for word.

Add a workspace, tell Vallo about your place, and send it for its checks.

${GET}

#Vallo #ListYourProperty #Landlords #NigeriaProperty`,
  },
  {
    n: 24, slug: "start-your-workspace", layout: "hero", ground: "night", theme: "night",
    tag: "Workspace", lines: ["Own, host or manage?", "*Start your workspace.*"],
    phone: { screen: "f-host-home", pose: "s" },
    lifts: [{ id: "f-host-home", box: [86, 836, 1234, 1354] }],
    objs: [["calendar-booked", 200, 160, 1120, -10]],
    caption: `If you own, host or manage property, your account becomes a workspace. 🗂️

Start with one application, saved as you go. Then your workspace shows your day: who is arriving, who is staying tonight, the requests waiting and your messages.

${GET}

#Vallo #Hosts #PropertyManagers #Nigeria`,
  },
  {
    n: 25, slug: "inspect-first", layout: "steps", ground: "sunset", theme: "sunset",
    lines: ["Inspect first.", "*Then decide.*"],
    steps: [["checklist", "Ask for an inspection"], ["list", "Read the report"], ["contract", "Agreement drawn up"]],
    pill: "Vallo charges no inspection fee",
    caption: `Inspect first. Then decide. 🔎

Ask for an inspection. Read the report. Only then is the agreement drawn up.

And Vallo charges no inspection fee.

${GET}

#Vallo #InspectFirst #RentInNigeria`,
  },
  {
    n: 26, slug: "viewings-never-take-money", layout: "stamp", ground: "photo", photo: "living-room-dusk", theme: "electric",
    q: "Do I pay to book a viewing?", a: "No. Viewings never take money.",
    caption: `Do I pay to book a viewing? 🤔

No. On Vallo, viewings never take money. Ask, schedule, go and see.

Got a question about renting, buying or booking? Ask us below.

${GET}

#Vallo #HouseViewing #RentInNigeria`,
  },
  {
    n: 27, slug: "speaks-your-language", layout: "langs", ground: "ivory", theme: "light",
    lines: ["Vallo speaks", "*your language.*"],
    rows: [["EN", "English", "Welcome"], ["HA", "Hausa", "Barka da zuwa"], ["YO", "Yorùbá", "Ẹ káàbọ̀"], ["IG", "Igbo", "Nnọọ"]],
    caption: `Vallo speaks your language. 🇳🇬

English. Hausa. Yorùbá. Igbo.

Pick yours and feel at home from the first screen. Which one are you? 👇

${GET}

#Vallo #Hausa #Yoruba #Igbo #Nigeria`,
  },
  {
    n: 28, slug: "which-home-hunter", layout: "quiz", ground: "sky", theme: "light",
    lines: ["Which home", "*hunter are you?*"],
    tiles: [["A", "The Window Shopper", "villa", "search"], ["B", "The Budget Boss", "flats", "price-tag"], ["C", "The Shortlist Keeper", "terrace", "saved-heart"], ["D", "The Room Sharer", "shortlet", "team"]],
    caption: `Which home hunter are you? 👀

A. The Window Shopper
B. The Budget Boss
C. The Shortlist Keeper
D. The Room Sharer

Drop your letter below.

${GET}

#Vallo #HouseHuntingNG #WhichAreYou`,
  },
  {
    n: 29, slug: "look-for-this-icon", layout: "icon", ground: "electric", theme: "electric",
    lines: ["Look for", "*this icon.*"], sub: "Search “Vallo” on the App Store and Google Play.",
    caption: `Look for this icon. 📲

Search "Vallo" on the App Store or Google Play, tap it, and your next place is a few taps away.

Real estate, done right.

#Vallo #NowLive #AppStore #GooglePlay`,
  },
];
