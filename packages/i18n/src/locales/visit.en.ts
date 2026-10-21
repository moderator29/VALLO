/**
 * SCHEDULE A VISIT, in English: the two-step flow at `/listing/[id]/visit`
 * (pick a time) and `/listing/[id]/visit/[inspectionId]` (where it stands).
 *
 * Its own module for the reason `member-kit.en.ts` gives: `en.ts` is written
 * by several people in the same hour, and a namespace here costs that file one
 * import and one line. Other locales read machine drafts from
 * `drafts/<locale>/visit.ts` until a speaker reviews them.
 *
 * EVERY SENTENCE SAYS WHAT THE RECORD HOLDS. A request is "sent" until the
 * lister answers it; only a confirmed row is "confirmed"; a time the lister
 * opened is "booked" because the database confirms it in the same write.
 * Nothing here calls a person or a place safe or checked, and viewing never
 * costs money. No em dashes.
 *
 * `{name}` is the lister's public name, `{role}` their role word, `{when}` a
 * Lagos date and time already formatted for the reader's locale.
 */
export const visitEn = {
  title: "Schedule a visit",
  statusTitle: "Your visit",
  /** A sheet's close control. */
  close: "Close",
  /** The two-dot progress, read aloud. */
  progress: "Step {step} of {total}",

  /**
   * The door on a listing (`RequestInspection`), and the line it becomes once
   * a request exists. `{when}` is the day and the hour, `{zone}` is
   * `tiles.lagos`. Moved out of the component in the language audit.
   */
  entry: {
    ask: "Schedule a visit",
    askedFor: "You asked to see this on {when} ({zone}).",
    confirmedFor: "Your visit is confirmed for {when} ({zone}).",
    offered: "They have offered {when} ({zone}).",
    track: "See where it stands.",
  },
  property: {
    /** The card's accessible name. */
    label: "The property",
    /** `{size}` is a whole number of square metres. */
    size: "{size} m²",
  },

  mode: {
    heading: "Visit type",
    inPerson: "In-person visit",
    inPersonSub: "See the property yourself",
    video: "Video visit",
    videoSub: "A live video call from the property",
  },

  date: {
    heading: "Select date",
    fullView: "Full view",
    calendarTitle: "Pick a day",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    legendSelected: "Selected",
    legendTimes: "Has open times",
    legendNone: "No open times",
    legendAsk: "You can suggest a time",
    done: "Done",
    /** The strip button's name when the day has open times. `{day}` is a date. */
    dayWithTimes: "{day}, has open times",
    dayNoTimes: "{day}, no open times",
  },

  time: {
    heading: "Select time",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    lagos: "Times are Lagos time.",
    noneThatDay: "No open times on this day. Pick another day.",
    noneInPart: "Nothing open in this part of the day. Try another tab.",
    /** Suggested times: the earliest is two hours from now. */
    askEarliest: "Suggest a time at least two hours from now.",
  },

  /** The lister opened viewing times: the renter books one. */
  open: {
    lead: "These are times the lister opened for viewings. The one you pick is booked as soon as you confirm.",
  },

  /** No open times: the renter suggests one and the lister confirms. */
  ask: {
    heading: "Suggest a time",
    lead: "The {role} has not opened viewing times yet. Suggest a time that suits you. They will confirm it, offer another time, or decline.",
    leadNoRole: "The lister has not opened viewing times yet. Suggest a time that suits you. They will confirm it, offer another time, or decline.",
    slotsFailed: "We could not load open times just now. You can still suggest a time, and the lister will confirm it.",
  },

  lister: {
    heading: "Who you will meet",
    /** When the public read carries no name. */
    fallbackName: "The lister",
    message: "Message {name}",
    call: "Call {name}",
    /** The call control when the in-app call opens a voice call. */
    callInApp: "Call {name} on Vallo",
  },

  note: {
    heading: "Additional information",
    optional: "(optional)",
    placeholder: "Add a message or a question for the lister",
  },

  footer: {
    cancel: "Cancel",
    continue: "Continue",
    send: "Send request",
    book: "Book this visit",
    sending: "Sending",
  },

  review: {
    title: "Check your visit",
    date: "Date",
    time: "Time",
    type: "Visit type",
    note: "Your note",
    /** A request: nothing is booked until the lister answers. */
    askLine: "The lister confirms the time. Nothing is booked until they do.",
    /** An open time: `book_viewing_slot` writes it confirmed. */
    bookLine: "This time is open, so it is booked as soon as you confirm.",
    free: "Viewing is free. You pay nothing to visit, and nobody on Vallo may ask you to.",
  },

  problems: {
    pickDay: "Pick a day first.",
    pickTime: "Pick a time first.",
    videoOff: "Video visits are not available just now. Choose an in-person visit.",
    failed: "That did not go through. Try again in a moment.",
    kept: "You are offline. Your request is kept on this phone and sends by itself when you are back online.",
    notKept: "You are offline and this phone could not keep the request. Try again when you have signal.",
  },

  /** States the page answers instead of the flow. */
  page: {
    ownTitle: "This is your property",
    own: "This is your own property, so there is nothing to visit.",
    exampleTitle: "An example listing",
    example: "This is an example listing, so there is nothing to visit. Open a real listing from search.",
    notViewableTitle: "Booked, not viewed",
    notViewable: "Stays and restaurants are booked, not viewed. Open the listing to book it.",
    backToListing: "Back to the listing",
    openSearch: "Open search",
    notFoundTitle: "We could not find that visit",
    notFoundBody: "It may belong to another account, or the link is old. Your visits are listed in Plans.",
    openPlans: "Open Plans",
    listerSideTitle: "This request is to you",
    listerSide: "You listed this property. Answer the request from your inspections.",
    openInspections: "Open inspections",
    loading: "Loading your visit",
  },

  status: {
    sent: "Request sent",
    /** `{role}` is "owner" or "agent", lower case in the sentence. */
    sentSub: "The {role} will confirm shortly.",
    sentSubNoRole: "The lister will confirm shortly.",
    confirmed: "Visit confirmed",
    confirmedSub: "The {role} is expecting you.",
    confirmedSubNoRole: "The lister is expecting you.",
    proposed: "A new time was offered",
    proposedSub: "The time you asked for does not work for them. Accept the new time, or cancel the request.",
    asked: "You asked for",
    accept: "Accept this time",
    declined: "Request declined",
    declinedSub: "The lister cannot show the property at that time. You can ask for another time.",
    cancelledByLister: "Visit cancelled",
    cancelledByListerSub: "The lister cancelled this visit. You can ask for another time.",
    withdrawn: "Request cancelled",
    withdrawnSub: "You cancelled this request.",
    withdrawnConfirmed: "Visit cancelled",
    withdrawnConfirmedSub: "You cancelled this visit.",
    completed: "Visit done",
    completedSub: "This visit is recorded as done.",
    noShow: "Marked as a no-show",
    noShowSub: "One side said the other did not come. Open Plans to see the details and the dispute window.",
    listerNote: "Their note",
    askAgain: "Ask for another time",
  },

  tiles: {
    date: "Date",
    time: "Time",
    type: "Visit type",
    /** Under the time in its tile: whose clock it is. */
    lagos: "Lagos time",
  },

  sentNote: "Your note",

  timeline: {
    heading: "What happens next",
    sent: "Request sent",
    sentSub: "Sent on {when}.",
    confirm: "Lister confirms",
    confirmWaiting: "They confirm your time, offer another, or decline.",
    /** PROPOSED: the next move is the renter's. */
    confirmOffered: "They offered another time. Accept it above, or cancel the request.",
    confirmDone: "Confirmed on {when}.",
    confirmBooked: "You booked an open time, so it was confirmed straight away.",
    confirmDeclined: "They declined on {when}.",
    eve: "Reminder the evening before",
    eveSub: "Sent to you the evening before the visit.",
    reminderDone: "Sent {when}.",
    day: "Reminder on the day",
    daySub: "Sent to you shortly before the visit.",
    visit: "The visit",
    visitInPerson: "Meet the lister at the property.",
    visitVideo: "Join the video call from this screen.",
    visitDone: "Recorded as done on {when}.",
    decision: "Your decision after the visit",
    decisionSub: "Decide in your own time. Money moves only after the visit and your decision.",
    decisionDone: "Recorded on {when}.",
    /** The timeline's line where a closed request stopped. */
    stopped: "Stopped here.",
    /** Read before each step's state for a screen reader. */
    done: "Done",
    current: "In progress",
    upcoming: "Not yet",
  },

  actions: {
    viewProperty: "View property",
    addToCalendar: "Add to calendar",
    calendarWhy: "Add it to your calendar once the visit is confirmed.",
    calendarPassed: "This visit time has passed.",
    join: "Join video visit",
    /** `{time}` is the slot's Lagos time. */
    joinOpens: "The video call opens 10 minutes before {time}.",
    joinEnded: "The video visit time has passed.",
    joinNoThread: "Open the conversation with the lister to start the call.",
    changeTime: "Change time",
    cancelRequest: "Cancel request",
    cancelVisit: "Cancel visit",
    seeAll: "See all your visits",
  },

  /** Confirming before a move that cannot be undone. */
  sheets: {
    cancelRequestTitle: "Cancel this request?",
    cancelRequestBody: "The lister is told you no longer need this time. You can ask again from the listing.",
    cancelVisitTitle: "Cancel this visit?",
    cancelVisitBody: "The lister is told you are not coming. You can ask for another time from the listing.",
    changeTitle: "Change the time?",
    changeBody: "Your current request is cancelled first and the lister is told. Then you pick a new time.",
    confirmCancel: "Yes, cancel it",
    confirmChange: "Cancel and pick again",
    keep: "Keep it",
  },

  /** The lister in a sentence ("The owner will confirm shortly"), by role. */
  roleNoun: {
    landlord: "owner",
    agent: "agent",
    agency: "agency",
  },

};

export type VisitCopy = typeof visitEn;
