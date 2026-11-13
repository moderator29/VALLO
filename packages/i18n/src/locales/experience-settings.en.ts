/**
 * Round 3's settings screens: the area navigation every settings route
 * carries (R3-08), the notification matrix (R3-14), Accessibility (R3-15) and
 * Language and currency (R3-16). These were English-only constants in
 * `apps/web/src/lib/settings/*-copy.ts` while `en.ts` was held; they live here
 * now so the screens read the reader's language.
 *
 * One module per owner so agents can add strings without editing en.ts at
 * the same time. English only: ha, ig and yo fall back to it through
 * `withFallback` until a translator supplies a line, because an invented
 * translation of a new line is worse than none.
 *
 * D48: payment notifications are still stored under the `wallet` key in
 * `profiles.settings.notifications`. That is a storage key, never a word on a
 * screen: the row here is "Payments".
 */
export const experienceSettingsEn = {
  /* ------------------------------------------- the settings area's navigation */
  area: {
    label: "Settings",
    toggle: "Settings sections",
    /** Prefixed to a page's own section in the shared menu: "On this page: Security". */
    onThisPage: "On this page",
    /** One per destination in `lib/settings/area.ts`, keyed by its id. */
    destinations: {
      home: "All settings",
      account: "Account information",
      notifications: "Notifications",
      appearance: "Appearance",
      accessibility: "Accessibility",
      region: "Language and currency",
      payments: "Payment methods",
      privacy: "Privacy and security",
      passcode: "Passcode",
      phone: "Phone number",
      devices: "Devices",
      passport: "Vallo passport",
      place: "Your place",
      interests: "Interests",
      invite: "Invite",
      help: "Help and support",
    },
  },

  /* ---------------------------------------------------------- accessibility */
  accessibility: {
    title: "Accessibility",
    sub: "Contrast, transparency, text size and motion",
    lede: "Kept on this device and applied at once. If your phone asks for more contrast, less transparency or less motion, Vallo follows it whatever is set here.",
    seeing: "Seeing",
    contrast: "Increase contrast",
    contrastSub: "Stronger lines and darker supporting text, and the current tab underlined as well as coloured.",
    transparency: "Reduce transparency",
    transparencySub: "Glass panels become solid, so nothing shows through behind what you are reading.",
    textSize: "Text size",
    textSizes: { s: "Small", m: "Medium", l: "Large" },
    on: "On",
    off: "Off",
  },

  /* ------------------------------------------------- the notification matrix */
  notifications: {
    title: "What reaches you, and where",
    caption: "Notifications by event and channel",
    colEvent: "Event",
    colEmail: "Email",
    colPush: "Push",
    note: "Bookings, messages and offers also follow the Email switch in the app. Payments always appear in the app, whatever you choose here.",
    notEmailed: "Not sent by email",
    rows: {
      bookings: { label: "Bookings", sub: "Requests, confirmations and changes to your stays" },
      messages: { label: "Messages", sub: "New replies from hosts and agents" },
      payments: { label: "Payments", sub: "Payments, refunds, receipts and payouts" },
      savedPriceDrops: { label: "Price drops", sub: "A place you saved comes down in price" },
      marketing: { label: "Ideas and offers", sub: "Occasional news and highlights. On unless you turn it off" },
    },
    quiet: {
      title: "Quiet hours",
      switch: "Hold push notifications overnight",
      sub: "Held pushes arrive when your quiet hours end. Payments still reach you at once.",
      from: "From",
      to: "Until",
      zone: "Lagos time",
      save: "Save quiet hours",
    },
    saved: "Saved",
  },

  /* --------------------------------------------------- language and currency */
  region: {
    title: "Language and currency",
    sub: "How Vallo writes words, money and dates for you",
    language: "Language",
    money: "Money",
    /* `currency`, `currencyValue` and `currencySub` stood here and said no
       other currency was offered. The Currency row now lives in
       `preferences` below (13 November 2026). */
    dates: "Dates and times",
    /** `{date}` is today, in the reader's language and Lagos time. */
    datesSub: "Shown in Lagos time, wherever you are. Today reads: {date}.",
    numbers: "Numbers",
    numbersSub: "Written with commas between thousands and a point before kobo, in every language.",
  },

  /* ------------------------------------------------------------- appearance */
  appearance: {
    /** The note under the theme control on `/settings/appearance`. */
    themeNote: "Dark is the default. System follows your phone.",
  },

  /* ------------------------------------------------------------ preferences */
  /**
   * Currency and floor area on `/settings/region` (Agent CURRENCY, 13 November
   * 2026), and the guide figure beside naira prices (`components/currency`).
   * Naira is the price of record: every line here says a converted figure is
   * a guide and that payment is in naira. Never word it as a price or offer.
   */
  preferences: {
    currency: "Currency",
    currencySub: "Adds a rough guide beside naira prices. You always pay in naira.",
    sheetTitle: "Show a guide in",
    sheetIntro:
      "Prices on Vallo are set and paid in naira. Choose another currency and we add an approximate figure beside each naira price, worked out from a daily exchange rate. You always pay in naira, and you see the exact amount before you pay.",
    automatic: "Automatic",
    /** `{currency}` is what Automatic shows this reader now, e.g. "Nigerian naira (NGN)". */
    automaticSub: "Follows where you are. Right now: {currency}",
    nairaSub: "Naira only, with no guide figure",
    /** The guide beside a naira price. `{amount}` is "£2,516". */
    about: "about {amount}",
    /** Below one whole unit. `{amount}` is "£1". */
    under: "less than {amount}",
    /** Said to a screen reader after the naira price. `{amount}` is "2,516 British pounds". */
    aboutSpoken: "approximately {amount}, as a guide. You pay in naira.",
    /** Shown on this page only, when the reader chose a currency and no fresh rate is stored. */
    noRate: "Today's exchange rate is not available yet, so prices show in naira only.",
    /** `{date}` is when the source last updated; `{rate}` is "₦1,788.34"; `{code}` is "GBP". */
    rateLine: "Guide rate: 1 {code} is about {rate}, updated {date}.",
    example: "How a price reads",
    /** The example price is a stay at this many naira a night. */
    exampleSub: "A stay at {naira} a night",
    /** The source's required credit, worded as its terms ask. Do not reword. */
    attribution: "Rates By Exchange Rate API",
    area: "Floor area",
    areaSub: "Listings give floor area in square metres. Choose square feet to see it converted.",
    areaSqm: "Square metres (m²)",
    areaSqft: "Square feet (sq ft)",
    sqmShort: "m²",
    sqftShort: "sq ft",
    /** The example floor area line. `{area}` is "120 m²" or "1,292 sq ft". */
    areaExample: "A 120 m² flat reads: {area}",
    /** A distance in miles, after the figure ("17 mi"). */
    miShort: "mi",
    saveFailed: "That did not save. Check your connection and try again.",
    choose: "Choose",
  },

  /* -------------------------------------------------------------- your time */
  /**
   * The reader's own clock beside a Lagos time on the viewing screens
   * (`components/your-time/YourTime.tsx`), shown only when the two differ.
   * Lagos time stays the time of record.
   */
  yourTime: {
    /** `{time}` is "09:00" on the reader's clock. */
    yourTime: "{time} your time",
    /** `{day}` is "Fri", when the reader's day differs from Lagos's. */
    yourTimeDay: "{day} {time} your time",
  },
};
