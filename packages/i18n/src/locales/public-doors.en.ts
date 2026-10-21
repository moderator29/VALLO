/**
 * THE PUBLIC DOORS, in English (Recommendations A, 30 September 2026): the
 * "Check before you pay" card on the landing, the move-in total calculator,
 * the supply pages' chrome, the guides' chrome, the sign-in-free email
 * preferences, the email-code and phone sign-in entry points, and the
 * member's invite link.
 *
 * Its own file for the reason `front-door.en.ts` gives: `en.ts` is contested,
 * and a namespace here costs it one import and one line.
 *
 * Every sentence is read by a stranger. No claim the code cannot back, no
 * invented figure, no percentage presented as typical. The other three
 * locales inherit this through `withFallback`, which is the honest state
 * until a speaker translates it (nothing here is a machine draft).
 */
export const publicDoorsEn = {
  nav: {
    checkAgent: "Check an agent",
    checkReceipt: "Check a receipt",
    moveInCost: "Move-in cost",
    guides: "Guides",
    forAgents: "For agents",
    forHosts: "For hosts",
    forLandlords: "For landlords",
  },

  /** The landing card and its twin at the foot of `/check`. */
  checkCard: {
    label: "Check before you pay",
    title: "Is this a Vallo agent?",
    body: "Paste the number or the VA- code from any advert, status or flyer. You get the answer here, with no account.",
    receipt: "Got a Vallo receipt? Check it",
    open: "Open the full check",
  },

  /** After a "no match": a fixed warning that never carries the number. */
  warning: {
    share: "Share this warning",
    text: "This number is not a registered Vallo agent. Check any agent at {url}",
    note: "The message does not include the number you checked.",
  },

  moveIn: {
    metaTitle: "Move-in cost calculator",
    metaDescription:
      "Work out what a yearly rent really costs to move in: rent, agency, legal, caution, agreement and service charge, added up. Free, with no account.",
    chip: "Move-in cost",
    title: "What will it really cost to move in?",
    lede: "Type the yearly rent and each fee you were quoted. The total adds them up, with the rent for every year the landlord wants up front.",
    /** The compact card in the landing hero. */
    compactLabel: "Move-in total",
    compactTitle: "Rent is only part of it",
    compactBody: "Add the agency, legal, caution and service charge you were quoted, and see the whole amount.",
    compactSubmit: "Work out my total",
    /** The hero's search surface: its two tabs, and the move-in field's hint. */
    tabSearch: "Find a place",
    tabMoveIn: "Move-in total",
    tabsLabel: "What would you like to do?",
    compactPlaceholder: "Yearly rent in naira",
    rentLabel: "Yearly rent",
    rentHint: "In naira, for one year.",
    rentPlaceholder: "1,500,000",
    upfrontLabel: "Years asked up front",
    upfrontOne: "1 year",
    upfrontTwo: "2 years",
    upfrontThree: "3 years",
    stateLabel: "State",
    stateOther: "Another state",
    feesTitle: "The fees you were quoted",
    feesHint: "Leave a fee empty if nobody asked for it. Each one can be an amount or a percent of a year's rent.",
    asAmount: "Amount",
    asPercent: "% of rent",
    lines: {
      rent: "Rent",
      rentYears: "Rent ({years} years)",
      agency: "Agency fee",
      legal: "Legal fee",
      caution: "Caution deposit",
      agreement: "Agreement fee",
      service: "Service charge",
    },
    ruleTitle: "The published rule in {state}",
    ruleBody: "Agency fee at most {agency} of a year's rent, and legal fee at most {legal}. Source: {source}.",
    ruleFill: "Fill in the published maximums",
    ruleNote: "These are the most the rule allows, not what every landlord asks. Change them to what you were quoted.",
    totalLabel: "Estimated move-in total",
    totalNote: "An estimate from the figures you typed. Each listing on Vallo shows its own total, set by the lister.",
    emptyTotal: "Type the yearly rent to see the total.",
    barLabel: "What the total is made of",
    share: "Share this total",
    shareText: "Moving in on {rent} a year comes to {total} with every fee. Work out yours at {url}",
    copyLink: "Copy the link",
    copied: "Link copied",
    cta: "See listings with the total already worked out",
    ctaNote: "Every rental on Vallo prints its move-in total before you call anybody.",
    guideLink: "What each line means",
    invalid: "Type an amount in naira, using numbers only.",
  },

  supply: {
    startNew: "Create an account to start",
    startExisting: "I already have an account",
    stepsTitle: "How it works",
    feesTitle: "What it costs",
    payoutTitle: "How and when you are paid",
    checksTitle: "What Vallo checks, and what it does not",
    checksDo: "What Vallo checks",
    checksDont: "What Vallo does not do",
    exampleTitle: "What your desk looks like",
    exampleBadge: "Example",
    exampleNote: "An example of the desk with made-up enquiries. Nothing here is a real person or property.",
    otherDoors: "Not you?",
    faqTitle: "Common questions",
    closeBody: "Create your account first. Your profile setup opens straight after.",
    factsLabel: "In short",
  },

  guides: {
    metaTitle: "Guides for renters and guests",
    metaDescription:
      "Plain guides to renting in Lagos and Abuja, spotting rental scams, what a move-in total includes, and how stays work on Vallo.",
    chip: "Guides",
    title: "Guides for renting and staying in Nigeria",
    lede: "Plain answers to the questions people ask before they pay for a home or a stay. Free to read, with no account.",
    reviewed: "Last reviewed {date}",
    readTime: "{minutes} min read",
    englishOnly: "This guide is in English for now.",
    onThisPage: "On this page",
    more: "More guides",
    all: "All guides",
    kind: "Guide",
    sources: "Sources",
    nextLabel: "Next step",
  },

  prefs: {
    metaTitle: "Email preferences",
    title: "Email preferences",
    lede: "Choose which emails Vallo sends to {email}. You do not need to sign in to change them here.",
    save: "Save my choices",
    saved: "Saved. Your choices apply to the next email we send.",
    failed: "That did not save. Nothing has changed. Please try again.",
    unsubscribed: "You will no longer get {channel} emails from Vallo.",
    undo: "Turn it back on",
    invalidTitle: "This link has expired or is not valid",
    invalidBody: "Open the newest email from Vallo and use its link, or sign in and choose in Settings.",
    signInLink: "Open Settings",
    alwaysSent:
      "Security emails (a new sign-in, a password change, your sign-in codes) and receipts for payments you make are always sent. They are about your account, not a mailing list.",
    channels: {
      bookings: { title: "Bookings and viewings", body: "Requests, confirmations and changes to your bookings and inspections." },
      messages: { title: "Messages", body: "When somebody writes to you on Vallo." },
      wallet: { title: "Payments and agreements", body: "Updates on agreements and payments you are part of." },
      marketing: { title: "News from Vallo", body: "Occasional news about new features. Off unless you turn it on." },
    },
  },

  emailCode: {
    offer: "Email me a code instead",
    title: "Sign in with a code",
    /** `{count}` is the code's length as a word ("six"), from `codeLengthWord`, so the line follows the code. */
    lede: "We will email a {count}-digit code to your address. No password needed.",
    emailLabel: "Email address",
    send: "Send me a code",
    sentTo: "We sent a code to {email}.",
    codeLabel: "{count}-digit code",
    verify: "Sign in",
    resend: "Send a new code",
    usePassword: "Use my password instead",
    passkey: "Sign in with a passkey",
    badEmail: "Enter a valid email address.",
    badCode: "Enter the {count} digits from the email.",
    /* The server answers for the whole code and cannot say which digit is
       wrong, or whether it was mistyped or replaced by a newer one; the one
       action that covers both is the newest code, and the field has the last
       try selected for it (`CodeInput`). */
    wrongCode: "That code did not work. Type the code from your newest email; your last try is selected, so typing replaces it.",
    /* The CHECK's own limit (ten tries in ten minutes), not the send's. */
    verifyLimited: "Too many tries at the code. Wait ten minutes, then type it again.",
    noAccount: "If an account uses this address, a code is on its way.",
    limited: "Too many codes were asked for. Wait a minute and try again.",
    failed: "We could not send a code just now. This is on our side. Please try again.",
  },

  phone: {
    offer: "Continue with phone number",
    title: "Sign in with your phone",
    /** `{count}` as in `emailCode.lede`. */
    lede: "We will send a {count}-digit code to your number, by WhatsApp first, or by text message.",
    phoneLabel: "Phone number",
    prefix: "+234",
    placeholder: "803 123 4567",
    send: "Send me a code",
    sentTo: "We sent a code to {phone}.",
    codeLabel: "{count}-digit code",
    verify: "Continue",
    resend: "Send a new code",
    badPhone: "Enter a Nigerian mobile number, like 0803 123 4567.",
    badCode: "Enter the {count} digits you were sent.",
    wrongCode: "That code did not work. Type the code from your newest message; your last try is selected, so typing replaces it.",
    verifyLimited: "Too many tries at the code. Wait ten minutes, then type it again.",
    off: "Phone sign-in is not available yet. Use your email instead.",
    failed: "We could not send a code just now. Please try again, or use your email.",
  },

  invite: {
    rowTitle: "Invite someone to Vallo",
    rowSub: "Your own link. When somebody signs up with it, it is recorded as yours.",
    linkLabel: "Your invite link",
    codeLabel: "Your invite code",
    copy: "Copy the link",
    copied: "Link copied",
    whatsapp: "Share on WhatsApp",
    shareText: "I use Vallo to find homes and stays in Nigeria. Join with my link: {url}",
    unavailable: "Your invite link could not be made just now.",
    doorTitle: "{name} invited you to Vallo",
    doorTitleNoName: "You were invited to Vallo",
    doorBody: "Homes, land and stays across Nigeria, with the move-in cost written down before you call anybody.",
    doorStart: "Create your account",
    doorSignIn: "I already have an account",
    doorUnknown: "This invite code is not one we know. You can still join.",
  },
};
