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
    currency: "Currency",
    currencyValue: "Naira (₦, NGN)",
    currencySub:
      "Every price on Vallo is set and paid in naira. A converted view would need a dated exchange rate, which Vallo does not show, so no other currency is offered here.",
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
};
