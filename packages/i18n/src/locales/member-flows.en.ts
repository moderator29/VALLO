/**
 * THE SIGNED-IN MEMBER FLOWS' OWN WORDS, MOVED OUT OF THE COMPONENTS
 * (language audit, 17 October 2026).
 *
 * Booking a table, reserving a stay, the rental panel: sentences that were
 * written into the components in English, so a Hausa, Yoruba or Igbo reader
 * met them in a language they had not chosen on the screens they use most.
 * The words are the components' own, unchanged except where a line was not
 * true (said beside each).
 *
 * Its own module for the reason `price-check.en.ts` gives: `en.ts` is written
 * by several people at once, and a namespace here costs that file one import
 * and one line. The three translations are MACHINE DRAFTS in
 * `drafts/<locale>/memberFlows.ts`, recorded in `review-status.ts` until a
 * native speaker has read them.
 *
 * Money sentences do not live here; they come from `lib/money/copy.ts`.
 * No em dashes. No claim words without a mechanism behind them.
 */
export const memberFlowsEn = {
  /** Shared day words for the quick-date rails. */
  days: {
    today: "Today",
    tomorrow: "Tomorrow",
  },

  /** Asking a restaurant to hold a table (`ReserveTable`). */
  table: {
    title: "Book a table",
    sentTitle: "Request sent",
    /** `{party}` is a counted phrase ("2 guests"), `{day}` is "Today", "Tomorrow" or "Fri 9", `{time}` is "19:00". */
    sentBody:
      "The restaurant has your request for {party} on {day} at {time}. They will confirm or decline it, and you will see the answer in your bookings.",
    seeBookings: "See your bookings",
    day: "Day",
    time: "Time",
    noTimesLeftToday: "No times left today. Pick another day.",
    closedThatDay: "Not seating on this day. Pick another day.",
    guests: "Guests",
    fewerGuests: "One fewer guest",
    moreGuests: "One more guest",
    /** `{link}` is drawn as a link reading `largerPartyLink`. */
    largerParty: "For a larger party, {link}.",
    largerPartyLink: "message the restaurant",
    largestTable: "That is the largest table that can be held here.",
    note: "Anything they should know",
    notePlaceholder: "A birthday, a wheelchair, an allergy",
    sending: "Sending",
    submit: "Request a table",
    promise: "The restaurant confirms it. Nothing is held until they do.",
  },

  /** What a listing's loading screens announce while they wait. */
  loading: {
    listing: "Loading this place",
    listingTrust: "Loading the checks on this space",
    messages: "Loading your messages",
    conversation: "Loading this conversation",
    newMessage: "Loading a new message",
    booking: "Loading your booking",
    plans: "Loading your plans",
    stay: "Loading this stay",
  },

  /** Reserving a shortlet (`ReservePanel`). */
  stayReserve: {
    perNight: "/ night",
    total: "total",
    instantBook: "Instant Book available",
    checkInRail: "Check in",
    checkInRailLabel: "Check-in date",
    howLong: "How long",
    howLongLabel: "Length of stay",
    lengths: {
      weekend: "Weekend",
      week: "1 week",
      twoWeeks: "2 weeks",
      month: "1 month",
    },
    checkIn: "Check-in",
    checkOut: "Check-out",
    adults: "Adults",
    children: "Children",
    /** The steppers' accessible names. `{what}` is the row's own label ("Adults"). */
    fewer: "Fewer: {what}",
    more: "More: {what}",
    someoneElse: "Someone else is arriving",
    someoneElseBody: "Booking this for a family member or a friend.",
    theirName: "Their full name",
    theirNamePlaceholder: "As it appears on their ID",
    theirPhone: "Their phone number",
    theirPhoneHint: "The estate gate rings this number when they arrive.",
    theirEmail: "Their email address, if you have it",
    optional: "Optional",
    theirEmailHint:
      "We send them the dates and how to get through the gate once the host confirms. Leave it blank and it all comes to you to pass on.",
    showBreakdown: "See per night",
    hideBreakdown: "Hide the breakdown",
    cleaning: "Cleaning",
    serviceCharge: "Service charge",
    totalRow: "Total",
    nothingAdded: "Vallo adds nothing of its own. Every figure here is the host's.",
    signIn: "Sign in",
    reserve: "Reserve",
    message: "Message agent",
    payAfterInspecting: "Pay only after you have inspected the property",
    /* The moment after reserving. The heading follows what is true: held when
       the stay books instantly, requested when the agent confirms it. It said
       "Booking requested" on an instant booking whose next line said the
       dates were held. */
    heldTitle: "Dates held",
    requestedTitle: "Booking requested",
    /** `{from}` and `{to}` are dates. */
    range: "{from} to {to}",
    /** `{name}` is the person arriving. */
    arriving: "{name} is the one arriving. We send them the details the moment the host confirms.",
    heldBody: "Your dates are held. Paying now confirms the stay straight away.",
    requestedBody:
      "The agent will confirm your dates personally. You can pay now to secure them, and we will notify you the moment the agent confirms.",
    /** `{amount}` is drawn as the money figure. */
    pay: "Pay {amount} for this stay",
    payLater: "Pay later, view your bookings",
  },

  /** A stay's booking page (`/bookings/[bookingId]`): the tracker cells and the getting-there panel. */
  booking: {
    nextStep: "Next step",
    yourPart: "Your part",
    noAction: "No action needed from you",
  },
  stayDetails: {
    title: "Getting there",
    unpaid: "The address, check-in details and a way to reach your host appear here once the stay is paid.",
    address: "Address",
    checkInFrom: "Check-in from",
    checkOutBy: "Check-out by",
    estate: "Estate",
    atGate: "At the gate",
    security: "Security",
    accessCode: "Access code",
    houseRules: "House rules",
    noDetails: "Your host has not added arrival details yet. Message them for directions.",
    /** `{name}` is the host's name. */
    messageNamed: "Message {name}",
    messageHotel: "Message the hotel",
    messageHost: "Message your host",
  },
  /** Cancelling a stay (`CancelBookingSheet`). */
  cancelBooking: {
    open: "Cancel",
    title: "Cancel this booking?",
    done: "Done",
    cancelledTitle: "Booking cancelled",
    /** `{title}` the stay, `{dates}` its date range. */
    cancelledBody: "{title} for {dates} is cancelled. The dates are free again.",
    context: "This releases your dates and cannot be undone.",
    stay: "Stay",
    dates: "Dates",
    total: "Total",
    released: "Your dates are released at once.",
    keep: "Keep my booking",
    confirm: "Yes, cancel the booking",
  },
  /** Reviewing a stay (`/bookings/[bookingId]/review`). */
  review: {
    title: "Review your stay",
    unreachableTitle: "We cannot reach reviews right now",
    unreachableBody: "This is on our side, not yours. Nothing has been lost. Try again in a few minutes.",
    missingTitle: "We could not find that stay",
    missingBody: "It may belong to another account. Your stays are all in one place.",
    failedTitle: "Reviews did not load",
    failedBody: "Your stay is unchanged and nothing was lost. Try again in a few minutes.",
    notEligible: {
      cancelledTitle: "This stay was cancelled",
      cancelledBody: "There is nothing to review, because the stay did not go ahead. The dates are open again if you still want them.",
      unconfirmedTitle: "The agent has not accepted yet",
      unconfirmedBody: "Reviews are for stays that actually happened, so this one opens up once the agent accepts and the dates pass.",
      unpaidTitle: "This stay was not paid for",
      unpaidBody: "Reviews are for stays that were paid for through Vallo and actually happened.",
      notFinishedTitle: "Your stay is not finished yet",
      /** `{date}` is the check-out date. */
      notFinishedBody: "You can share a review from {date}, once you have checked out. Enjoy the rest of it.",
      noShowTitle: "This stay was recorded as not attended",
      noShowBody: "Reviews are for stays that happened. If you did arrive, contact support from your bookings and we will look into it.",
      tenancyTitle: "A tenancy is not reviewed as a stay",
      tenancyBody: "Your move-in and rent are on the tenancy page. Support can help with anything about the home.",
    },
    viewStay: "View the stay",
    thanksTitle: "Thank you for the review",
    /** `{title}` is the stay. */
    thanksBody: "Your review of {title} is live. Other guests can see it now, and the agent has been told.",
    seeOnListing: "See it on the listing",
    seeStays: "See your stays",
    howWasIt: "How was the stay?",
    /** `{value}` and `{max}` are numbers, `{label}` is the rating's word. */
    starLabel: "{value} out of {max}, {label}",
    ratings: {
      1: "Poor",
      2: "Disappointing",
      3: "Fine",
      4: "Good",
      5: "Excellent",
    },
    bodyLabel: "Anything you would tell the next guest?",
    bodyPlaceholder: "Was there steady light and water? How was the agent? Would you go back?",
    bodyHint: "Optional. Your first name and last initial appear with it.",
    sharing: "Sharing your review...",
    share: "Share review",
    publicNote:
      "Reviews are public and cannot be edited once shared, so please write what you would want to read. Never put a bank account number in a review.",
    /** `{date}` is the check-out date. */
    checkedOut: "You checked out on {date}.",
    alreadyTitle: "You have already reviewed this stay",
    alreadyBody: "This is what other guests see on {title}.",
  },

  /** One viewing's card (`InspectionSheet`), on /plans and the agent's inspections. */
  inspection: {
    state: {
      REQUESTED: "Requested",
      CONFIRMED: "Scheduled",
      PROPOSED: "New time offered",
      DECLINED: "Declined",
      COMPLETED: "Inspected",
      WITHDRAWN: "Withdrawn",
      NO_SHOW: "No-show",
    },
    rung: {
      asked: "Requested",
      agreed: "Time agreed",
      visited: "Inspected",
      recorded: "Recorded",
    },
    outcome: {
      inspected: "I inspected it",
      deal_done: "Inspected, and we have a deal",
      no_deal: "Inspected, no deal",
    },
    outcomeShort: {
      inspected: "Inspected",
      deal_done: "Deal done",
      no_deal: "No deal",
    },
    failed: "That did not go through.",
    photoFailed: "That photo did not upload. Try again in a moment.",
    example: "Example listing",
    gone: "A property that is no longer listed",
    date: "Inspection date",
    listedBy: "Listed by",
    requestedBy: "Requested by",
    notNamed: "Not named yet",
    /** `{name}` the other side, `{phone}` their number. */
    call: "Call {name} on {phone}",
    them: "them",
    status: "Status",
    progress: "Inspection progress",
    checklist: "Inspection checklist",
    /** `{done}` and `{total}` are numbers. */
    roomsDone: "{done} of {total} done",
    roomsChecked: "Rooms checked",
    /** A room's tick box. `{room}` is the room's name. ("checked" is a claim word; this is the inspector's own tick.) */
    roomChecked: "{room} done",
    reportOff: "Ticking the rooms starts when inspection report storage is switched on. Nothing here is saved yet.",
    notes: "Notes",
    youWrote: "You wrote",
    theyWrote: "They wrote",
    listerWrote: "The lister wrote",
    notesPlaceholder: "Add any additional notes or observations...",
    howItWent: "How did it go?",
    listerDeclined: "The lister declined this request, so there is no viewing to report on.",
    youDeclined: "You declined this request, so there is no viewing to report on.",
    youWithdrew: "You withdrew this request, so there is no viewing to report on.",
    theyWithdrew: "They withdrew this request, so there is no viewing to report on.",
    askAgain: "Open the listing to ask again",
    addPhotoLabel: "Add a photo to the report",
    addingPhoto: "Adding photo",
    /** `{count}` is how many photos the report holds. */
    addPhotosCount: "Add photos ({count})",
    addPhotos: "Add photos",
    addPhotosInChat: "Add photos, in the conversation about this inspection",
    submit: "Submit inspection report",
    waitsReport: "Tick the rooms as you go round. The report can be sent once the viewing time has come.",
    waitsOutcome: "How it went can be recorded once the viewing time has come.",
    chooseOutcome: "Choose how it went, and the report can be sent.",
    opensWhenAgreed: "The report opens once a time is agreed on both sides.",
    /** `{photos}` is a counted phrase ("3 photos"). */
    photosShort:
      "Still needed: {photos} taken at the property. Add them, then submit. The agreement is drawn up from this report, and photos cannot be added once it is sent.",
    agreementCancelledYou: "The agreement drawn up from this report was cancelled. You can draw up a new one from the same report.",
    agreementCancelledThem: "The agreement drawn up from this report was cancelled. The renter can draw up a new one from the same report.",
    seeCancelled: "See the cancelled agreement",
    openAgreement: "Open the agreement",
    renterDrawsUp: "The renter draws up the agreement from this report. You will be told when it is waiting for you.",
    /** The dashboard rows (`InspectionRows`): the state as each side reads it. */
    rowLister: {
      REQUESTED: "Waiting on you",
      CONFIRMED: "Confirmed",
      PROPOSED: "New time offered",
      DECLINED: "Declined",
      COMPLETED: "Inspected",
      WITHDRAWN: "Withdrawn",
      NO_SHOW: "No-show",
    },
    rowRequester: {
      REQUESTED: "Waiting for a reply",
      CONFIRMED: "Confirmed",
      PROPOSED: "New time offered",
      DECLINED: "Declined",
      COMPLETED: "Inspected",
      WITHDRAWN: "Withdrawn",
      NO_SHOW: "No-show",
    },
    askedFor: "Asked for",
    noShow: {
      marked: "This viewing was marked as a no-show.",
      overturned: "This no-show was disputed and Vallo took it off the record.",
      upheld: "This no-show was disputed and Vallo decided it stands.",
      youMarkedRenterDisputed: "You marked the renter as a no-show. They disputed it, and Vallo is looking at both sides.",
      youMarkedListerDisputed: "You marked the lister as a no-show. They disputed it, and Vallo is looking at both sides.",
      youMarkedRenter: "You marked the renter as a no-show. They have 48 hours to dispute it.",
      youMarkedLister: "You marked the lister as a no-show. They have 48 hours to dispute it.",
      youDisputed: "You were marked as a no-show and you disputed it. Vallo is looking at both sides.",
      theySay: "The other side says you did not come to this viewing. If that is not right, you can dispute it within 48 hours of their report.",
    },
  },

  /** A rental or a sale (`RentalPanel`). */
  rental: {
    saleTerms: "Agreed with the agent after an inspection.",
    annualTerms: "Annual tenancy, agreed with the agent after an inspection.",
    tenancyTerms: "Tenancy agreed with the agent after an inspection.",
    steps: {
      message: "Message the agent",
      messageDetail: "Ask your questions inside Vallo.",
      inspect: "Inspect the property",
      inspectDetail: "Arrange an inspection before anything is agreed.",
      pay: "Pay through Vallo",
      payDetail: "Only once you have seen the place.",
    },
    message: "Message agent",
    /** The tenancy length stepper (`TenancyTerm`). */
    howLong: "How long",
    shorter: "Shorter tenancy",
    longer: "Longer tenancy",
    /** `{term}` is a counted phrase ("2 years"). */
    rentFor: "Rent for {term}",
    rentOnly: "Rent only, before caution, agency and legal fees. The agent agrees the final terms with you.",
    /** The owner's canonical safety rule, verbatim (`SAFETY_EDUCATION_COPY`, docs/PRODUCT.md section 6). */
    keepInside:
      "For your safety, keep every chat and payment inside Vallo. Deals made outside the platform are not protected by us. Pay only after you have inspected the property.",
  },
};
