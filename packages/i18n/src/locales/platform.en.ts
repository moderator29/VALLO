import type { PluralForms } from "../plural";

/**
 * THE PLATFORM AND THE CRAFT, in English: the devices screen and the new
 * sign-in alert (V-19), the wallet hold that alert can place, and the other
 * platform surfaces built beside them.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ITS OWN FILE RATHER THAN A BLOCK INSIDE `en.ts`.
 *
 * The same reason `price-check.en.ts` gives: `en.ts` is nearly six thousand
 * lines and several workers write to it in the same hour, and a namespace in
 * its own module costs the contested file one import and one line.
 *
 * ---------------------------------------------------------------------------
 * THE CLAIMS RULE, APPLIED HERE.
 *
 * Nothing below names a place, and the omission is deliberate. The address on
 * a session is whichever of our servers refreshed its token, so "Lagos" on a
 * security alert would be a confident lie in the one place a person makes a
 * security decision (`lib/security/sessions.ts` gives the full reasoning).
 * Nor does the alert say "just now": it is read later than it is written, and
 * the screen shows the time the device was first seen instead.
 *
 * The other three locales inherit this through `withFallback`; untranslated
 * keys are a copy gap for a speaker to close, not something to paper over by
 * pasting English into `yo.ts`.
 */

const sessionsCount: PluralForms = { one: "{count} session", other: "{count} sessions" };

export const platformEn = {
  devices: {
    /* The folded list. */
    currentTitle: "This device",
    othersTitle: "Everywhere else",
    othersEmpty: "Nothing else is signed in to this account.",
    sessions: sessionsCount,
    firstSignedIn: "First signed in {when}",
    lastUsed: "Last used {when}",
    endGroup: { one: "Sign out this session", other: "Sign out these {count} sessions" } as PluralForms,
    showSessions: "Show each session",
    endedGroup: { one: "1 session is over.", other: "{count} sessions are over." } as PluralForms,
    groupFailed:
      "We could not end those sessions just now. Nothing has changed. Try again, or use Sign out everywhere else.",
    strangerHint:
      "Look for a line you do not recognise, or one that was used when you were not using Vallo. If you find one, sign it out and tap This was not me below.",

    /* The button, on the devices screen and on the alert. */
    notMeTitle: "Something here is not you?",
    notMeBody:
      "This signs out every other device, pauses payments and changes to your payout details for 24 hours, and takes you to change your password.",
    notMe: "This was not me",
    notMeConfirm: "Tap again to hold your money",
    notMeWorking: "Holding your money",
  },

  alert: {
    screenTitle: "New sign-in",
    heading: "A new device signed in to your account",
    deviceUnnamed: "A device we could not name",
    firstSeen: "First seen {when}",
    question: "Was this you?",
    yes: "Yes, it was me",
    yesNote: "Then there is nothing to do. You can see every device signed in to your account at any time.",
    unknownTitle: "We could not find that sign-in",
    unknownBody:
      "The link may be old, or it belongs to a different account. Every device signed in to your account is on the devices screen, and This was not me is below if you need it.",
    openDevices: "See every device",
  },

  notMe: {
    heldVerdict: "Your money is on hold",
    heldConsequence:
      "No payment can be made and no payout detail can change until {until}. {ended} Change your password now: until you do, whoever has it can sign in again.",
    /* Placed beside a hold the member is not told about: no date (SCUML items 6 and 8). */
    heldUndatedConsequence:
      "No payment can be made and no payout detail can change for now. {ended} Change your password now: until you do, whoever has it can sign in again.",
    extendedConsequence:
      "The hold now lasts until {until}. {ended} Change your password now: until you do, whoever has it can sign in again.",
    alreadyHeldConsequence:
      "Your account was already on hold until {until}; pressing again does not change that. {ended} Change your password now if you have not.",
    alreadyHeldOtherConsequence:
      "Your account was already on hold until {until} while a change to your account is checked; pressing this does not shorten it. {ended} Change your password now if you have not.",
    rateLimitedHeld:
      "{ended} You have pressed this several times in the last hour, so the hold was left as it was: no payment can be made and no payout detail can change until {until}. Change your password now if you have not.",
    /* A plain hold (see account-hold.ts): no cause, no date. */
    alreadyHeldPlainConsequence:
      "Your account was already on hold; pressing this does not change that. {ended} Change your password now if you have not.",
    rateLimitedHeldPlain:
      "{ended} You have pressed this several times in the last hour, so the hold was left as it was. Change your password now if you have not.",
    rateLimitedNoHold:
      "{ended} You have pressed this several times in the last hour, so no new hold was placed this time. Change your password now, and press again later if you still need the hold.",
    signedOutVerdict: "Every other device is signed out",
    ended: { one: "We signed out 1 other device.", other: "We signed out {count} other devices." } as PluralForms,
    endedNone: "Nothing else was signed in.",
    changePassword: "Change your password",
    failedVerdict: "Nothing was held",
    failedConsequence:
      "We could not reach the hold just now, so nothing has changed. Try again in a moment. If you think somebody is in your account, sign out everywhere else and change your password.",
    signedOut: "Sign in to use this. It belongs to your account.",
    close: "Close",
  },

  hold: {
    /* Track A: there is no wallet. A hold pauses payments and payout changes. */
    title: "Payments are paused on this account for now",
    bodyNotMe:
      "You told us a sign-in was not you. Until {until}, no payment can be made from this account and payout details cannot be changed.",
    bodyOther:
      "The email address on this account was changed with help from support. Until {until}, no payment can be made from this account and payout details cannot be changed.",
    refusalNotMe:
      "No payment can be made from this account until {until}, because you told us a sign-in was not you. Nothing was charged.",
    refusalOther:
      "No payment can be made from this account until {until}, because the email address on this account was changed with help from support. Nothing was charged.",
    refusalUnknown: "No payment can be made from this account while a hold is on it. Nothing was charged.",
    bodyPlain:
      "No payment can be made from this account for now, and payout details cannot be changed.",
    refusalPlain: "No payment can be made from this account for now. Nothing was charged.",
  },


  /* V-30: the five kinds of the feedback grammar, as the styleguide names them. */
  feedback: {
    select: "Select",
    selectNote: "A tab, a segment, a chip",
    confirm: "Confirm",
    confirmNote: "An action was accepted",
    success: "Success",
    successNote: "Money settled, a booking confirmed",
    warning: "Warning",
    warningNote: "Pending, or with a person to review",
    error: "Error",
    errorNote: "Refused, declined, reversed",
  },

  /* V-35: the gate handshake and the inspection pack. "Signed in as", never
     "verified": a matching code proves which account's phone is at the gate,
     not what that account has been checked for. */
  gate: {
    title: "Gate code",
    loading: "Getting this inspection ready for the gate",
    ready: "Ready for {day}: works without signal",
    readyNote: "This phone holds what it needs for the gate. It is deleted a day after the inspection.",
    notReady: "The gate code appears here once the inspection is confirmed for a time.",
    expired: "This inspection has passed, so its gate code has been deleted.",
    noPack:
      "This phone has no gate code for this inspection yet. Open this screen once while you have signal and it will work at the gate without any.",
    failed: "We could not get the gate code just now. If this phone already has it, it still works; otherwise try again while you have signal.",

    /* The one who shows it. */
    showHeading: "Show this code at the gate",
    showButton: "Show the code",
    showPrompt: "When the renter is in front of you, show them the code. Showing it is recorded.",
    showBody: "The renter types it into their Vallo app. It changes every 30 seconds and works with no signal on either phone.",
    secondsLeft: { one: "Changes in 1 second", other: "Changes in {count} seconds" } as PluralForms,
    showingFor: "You are showing this for {principal}.",

    /* The one who checks it. */
    checkHeading: "At the gate, ask for their Vallo code",
    checkBody: "Type the six digits their app shows. This works with no signal on either phone.",
    codeLabel: "Their six-digit code",
    check: "Check the code",
    noCode: "They cannot show me a code",
    matchTitle: "The code matches",
    matchBody: "The code matches the one Vallo gave {name} for this inspection.",
    matchDelegate: "The code matches the one Vallo gave {name}, who is showing this inspection for {principal}.",
    mismatchTitle: "That code does not match",
    warning: "This person has not shown you a Vallo code. Do not pay anybody anything.",
    tryAgain: "Check another code",
    unnamed: "the person showing it",
    recorded: "This is recorded when your phone next has signal.",

    /* Naming who shows it. */
    delegateHeading: "Someone else showing it?",
    delegateBody:
      "Ask one person to show this inspection for you. They need a Vallo account with a confirmed phone number, or to be in your firm on Vallo, and they have to say yes. When they do, the code changes and the renter is told to refresh it.",
    delegateLabel: "Their email address on Vallo",
    delegateSave: "Ask them",
    delegateClear: "I will show it myself",
    delegateNamed:
      "If that address belongs to somebody who can show inspections for you, we have asked them. Nothing changes until they say yes; then the renter is told to refresh their code.",
    delegateTooLate:
      "It is too close to the inspection to change who shows it; the renter may already be on the way with their code.",
    delegateRateLimited: "You have asked several people in the last hour. Try again later.",
    inviteHeading: "You have been asked to show an inspection",
    inviteBody:
      "{principal} asked you to show an inspection in {place} on {when}. If you say yes, your phone gets the gate code for it, and the renter is told who is coming.",
    inviteAccept: "Yes, I will show it",
    inviteDecline: "No",
    inviteAccepted: "Thank you. Open this again while you have signal before you go, so the code works at the gate.",
    inviteDeclined: "We have told them you will not show it.",
    inviteGone: "This request has ended.",
    delegateCleared: "You are showing this inspection yourself.",
    delegateClearedRotated: "You are showing this inspection yourself. The code has changed and the renter has been told to refresh it.",
    delegateInvalid: "Enter their email address as it is on their Vallo account.",
    delegateClosed: "This inspection is closed, so nobody else can be named for it.",
    delegateFailed: "That did not go through. Nothing changed. Try again while you have signal.",

    /* The offline page. */
    offlineHeading: "Your inspections on this phone",
    offlineWhen: "{day} at {time}",
  },

  /* V-53: the buttons a notification carries. Each opens a screen in Vallo;
     none acts from the lock screen, so each says where it goes. */
  pushActions: {
    reply: "Reply",
    answer: "Open inspections",
    openBooking: "Open the booking",
  },

  /* V-77: the shortlist on the phone. MB and dates only; no claim the phone
     cannot prove. */
  shelf: {
    changesTitle: "Since this phone first kept these",
    moveInChanged: "{name}: the move-in total was {was} when this phone first kept it on {date}; it is {now} now.",
    priceChanged: "{name}: the price was {was} when this phone first kept it on {date}; it is {now} now.",
    rentChanged: "{name}: the rent was {was} when this phone first kept it on {date}; it is {now} now.",
    /* A copy is named by its rooms and area, never the lister's title. */
    name: "{beds} in {place}",
    nameNoPlace: "{beds}",
    onPhone: "Your shortlist is kept on this phone too, so it opens without signal.",
    offlineHeading: "Your shortlist on this phone",
    storedAt: "Saved on your phone {when}. Prices may have changed.",
    storedToday: "today at {time}",
    storedOn: "on {date}",
    moveIn: "{amount} to move in",
    moveInFrom: "From {amount} to move in",
    rentLine: "Rent {amount}{suffix}",
    priceLine: "{amount}{suffix}",
    noPrice: "No price stated",
    beds: { one: "{count} bed", other: "{count} beds" } as PluralForms,
    baths: { one: "{count} bath", other: "{count} baths" } as PluralForms,
    compare: "Compare",
    compareHint: "Tick up to three to see them side by side.",
    compareClose: "Close the comparison",
    compareMoveIn: "To move in",
    compareRent: "Rent",
    comparePlace: "Area",
    compareRooms: "Rooms",
    comparePower: "Power",
  },

  /* V-79: data saver. Megabytes only, never naira: the price of a megabyte
     depends on the network and the bundle, which the code cannot know. */
  lite: {
    label: "Data saver",
    sub: "Skips decorative art and loading pages ahead.",
    on: "On",
    off: "Off",
    meterOn: "This week Vallo used about {mb} MB that this phone could measure. Data saver is on.",
    meterOff: "This week Vallo used about {mb} MB that this phone could measure. Data saver is off.",
    phoneAsks: "Your phone or network is asking to save data, so some pages load lighter anyway.",
    welcomeTitle: "Are you usually on mobile data?",
    welcomeSub: "Use less data. You can change this in Settings.",
  },

  /* V-80: the admin desk's field speed panel. */
  fieldSpeed: {
    title: "Field speed",
    lede: "How fast Vallo is on the phones people actually use, from one page view in ten over the last seven days. The 75th percentile: three in four visits were at least this fast.",
    panel: "By route and connection",
    route: "Route",
    connection: "Connection",
    samples: "Page views",
    lcp: "Largest paint",
    inp: "Response to a tap",
    cls: "Layout shift",
    weight: "Page weight",
    unknown: "Not reported",
    emptyTitle: "Nothing measured yet",
    emptyBody: "Phones report their speed as people use the app. Nothing has arrived in the last seven days, so there is nothing to show rather than a guess.",
    what: "the field speed figures",
  },

  /* V-40: the outbox and the payments that lost their connection. */
  outbox: {
    savedWaiting: "Saved. Waiting for signal",
    removedWaiting: "Removed. Waiting for signal",
    couldNotKeep: "You are offline, and this phone could not keep that for later.",
    sentTitle: "Sent now that you have signal",
    failedTitle: "Something you did offline did not go through",
    failedItem: "{what}: {reason}",
    what: {
      save: "Saving a place",
      unsave: "Removing a saved place",
      saveListing: "Saving a listing",
      unsaveListing: "Removing a saved listing",
      message: "A message you sent",
      inspection: "Your inspection request",
      review: "Your review",
      post: "Your post",
    },
    waiting: "Waiting for signal. It sends when you are back online with Vallo open.",
    notYours: "it was kept under a different sign-in on this phone, so it was not sent. Do it again if you still want it",
    waitingShort: "Waiting for signal",
    reviewKeptVerdict: "Your review is kept on this phone",
    close: "Close",
  },
  inflight: {
    paidVerdict: "Your payment went through",
    paidBody: "The payment that lost its connection reached us. Reference {reference}.",
    failedVerdict: "Your payment did not go through",
    failedBody: "Nothing was taken for reference {reference}. You can pay again.",
    pendingVerdict: "Paystack has not told us yet",
    pendingBody: "We are checking reference {reference} every minute. Do not pay again until this changes.",
    offline: "You are offline. Paying needs a connection. Nothing has been charged.",
    returnedVerdict: "Your payment was sent back",
    returnedBody: "The payment for reference {reference} reached us and was returned to you. Check your history before paying again.",
    history: "See your history",
    close: "Close",
  },

  /* V-96: WhatsApp is a doorbell. The auto-reply is the only thing Vallo
     ever says on WhatsApp unprompted by an event; the safety line is drawn
     only when the number is configured. */
  whatsapp: {
    autoReply: "We only talk inside Vallo, so there is always a record. Open your messages: {link}",
    safetyLine: "Vallo's only WhatsApp number is {number}. It will never ask you for money or send you an account number.",
  },

  /* V-89: the queue as a desk. */
  queueDesk: {
    dueIn: "Due in {hours}h",
    dueSoon: "Due within the hour",
    late: "Late by {hours}h",
    offClock: "Off the clock",
    takenBy: "Taken by {name}",
    takenByYou: "Yours",
    take: "Take it",
    release: "Let it go",
    someone: "another operator",
    weightAttended: "Attended an inspection of this listing on {date}",
    weightPhone: "Confirmed phone",
    weightRecord: "{upheld} of {closed} past reports upheld",
    weightFirst: "First report from this person",
    lanes: { all: "Everything", late: "Late", mine: "Mine", free: "Nobody has it", spam: "Probably not a person" },
    lanesLabel: "Lanes",
    spamNote: "Support tickets from people with no account that carry a link or a domain pitch. Off the clock. Close them in one go if they are what they look like.",
    select: "Select {ref}",
    bulkLabel: "Decide the selected rows",
    bulkVerb: "Do",
    verbs: { approve: "Approve", send_back: "Send back", assign: "Hand to", take: "Take", close_spam: "Close as not a person" },
    bulkReason: "Reason for sending back",
    bulkTo: "Operator",
    bulkApply: "Apply to selected",
    bulkDone: "{done} done, {skipped} did not apply, {failed} did not go through. One batch in the audit log.",
    bulkNone: "Select at least one row and a verb.",
    claimTaken: "It is yours for the next 30 minutes of work.",
    claimHeld: "Another operator has it. It frees up after 30 minutes without work.",
    claimReleased: "Let go. Anybody can take it now.",
    claimFailed: "That did not go through. Refresh and try again.",
    sendBackReasons: {
      listing: {
        photos: "The photos do not show the property clearly. Add clear photos of every room and the outside.",
        price: "The price or the move-in total is missing or does not add up. Check each figure.",
        description: "The description does not match the photos or leaves out something a renter needs to know.",
      },
      application: {
        documents: "A document we need is missing or cannot be read. Upload a clear copy.",
        identity: "The name on your documents does not match the name on your application. Correct one of them.",
        licence: "We could not confirm the licence or registration you gave. Check the number and upload the certificate.",
      },
    },
    sendBackGroups: { listing: "Listings", application: "Agent applications" },
    sendBackLabels: {
      photos: "Photos unclear",
      price: "Price does not add up",
      description: "Description does not match",
      documents: "A document is missing",
      identity: "The name does not match",
      licence: "Licence not confirmed",
    },
    bulkNoReason: "No reason",
    bulkNoOperator: "Nobody",
    viewsLabel: "Saved views",
    viewsNone: "No saved views yet. Set the tab, lane and search you use, then save it here.",
    viewName: "Name this view",
    viewShared: "Share with the desk",
    viewSave: "Save view",
    viewDelete: "Delete",
    viewSharedTag: "Shared",
    viewSaved: "Saved.",
    reporterNoteLabel: "A line for the person who reported it (they will see this)",
  },

  /* V-89: the reporter's side. */
  myReports: {
    title: "Your reports",
    lede: "What you reported, where it stands, and what the moderator told you. You can take back anything still open.",
    empty: "You have not reported anything. If something on Vallo looks wrong, use Report on it and it will show here.",
    failed: "We could not load your reports just now. Try again in a moment.",
    status: {
      open: "Waiting for a moderator",
      reviewing: "A moderator is looking at it",
      resolved: "Acted on",
      dismissed: "Closed without action",
      withdrawn: "You took it back",
    },
    /* B-7a: the social kinds are lower case now, so they get words too. */
    target: {
      listing: "A listing",
      user: "A person",
      message: "A message",
      review: "A review",
      post: "A post",
      story_comment: "A comment on a story",
      social_profile: "A person's profile",
    },
    targetOther: "Something on Vallo",
    reportedOn: "Reported {date}",
    note: "From the moderator: {note}",
    withdraw: "Take it back",
    withdrawConfirm: "Tap again to take it back",
    withdrawn: "Taken back. Nobody will act on it now.",
    withdrawClosed: "This one is already closed.",
    withdrawFailed: "That did not go through. Try again.",
  },

  /* V-81: the lock on money. */
  moneyLock: {
    needed: "Confirm it is you with this phone's face or fingerprint lock, or your password, before this goes ahead. Nothing has changed.",
    confirmTitle: "Confirm it is you",
    confirmBody: "This changes where money goes. Use this phone's face or fingerprint lock.",
    confirm: "Use face or fingerprint",
    usePassword: "Use my password instead",
    notConfirmed: "Not confirmed, so nothing has moved.",
    useCode: "Email me a code instead",
    sendCode: "Email me a code",
    codeLabel: "The code we emailed you",
    passwordRecent:
      "Your password changed in the last day, so it cannot confirm this. We can email you a code instead. Nothing has moved.",
    passwordLabel: "Your Vallo password",
    passwordConfirm: "Confirm",
    cancel: "Cancel",
    rejected: "That did not confirm it is you. Nothing has changed. Try again.",
    failed: "We could not check that just now. Nothing has changed. Try again in a moment.",
    settingsTitle: "Lock money with this phone",
    settingsBody:
      "Sending and withdrawing will ask for this phone's face or fingerprint lock. If the lock will not answer, your password still works.",
    settingsEnrol: "Lock money with this phone",
    settingsEnrolled: "Money is locked with {count}",
    phones: { one: "{count} phone", other: "{count} phones" } as PluralForms,
    settingsRemove: "Remove this phone",
    settingsPasswordFirst: "Enter your password first, or a code we email you if your account has no password.",
    settingsDone: "Done. Sending and withdrawing will now ask for this phone's lock.",
    settingsRemoved: "Removed. This phone no longer locks your money.",
    settingsUnsupported: "This browser cannot use the phone's face or fingerprint lock for Vallo.",
    thisPhone: "This phone",
    settingsUnknown: "We could not read which phones lock your money just now. Try again in a moment.",
    settingsRemoveNeedsProof: "Removing a phone asks for the same proof as sending money.",
    added: "Added {when}",
    /* A staff account's keys also open the Vallo console, so a password alone never adds or removes one. */
    staffFirstKey:
      "This is a staff account, so setting up its first key takes your password and a code we email you.",
    staffAnotherKey:
      "This is a staff account, so adding another key needs your existing key first. A password alone cannot add one.",
    staffKeyOnly: "This is a staff account, so only your existing key can confirm this. A password alone cannot.",
  },
};
