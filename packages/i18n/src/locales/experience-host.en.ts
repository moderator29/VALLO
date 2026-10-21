/**
 * THE HOST PAGES' REMAINING WORDS (C5, the route sweep, 6 October 2026).
 *
 * The host pages still spelled these in English, in `title=`, `body=` and as
 * JSX text, where no dictionary could see them. They are the pages' own words,
 * moved here unchanged.
 *
 * WHY NOT `hostWorkspace`. That namespace carries Hausa, Yoruba and Igbo
 * MACHINE DRAFTS (`locales/drafts/<locale>/`, registered in
 * `review-status.ts`), and a registered draft must stay nearly whole. A new
 * English line there would need a machine draft in three languages written
 * on the spot, and an invented translation of a new line is worse than none.
 * So, like the experience-* modules, these are English only: ha, ig and yo
 * fall back to them through `withFallback` until a translator supplies a line.
 */
export const experienceHostEn = {
  tryAgain: "Try again",
  /** The headings of the screens whose page wrote its own. */
  screens: {
    photos: "Photographs",
    tables: "Tables",
    reviews: "Reviews",
    transfer: "Hand over a business",
  },
  photosNone: "{name} has no photographs yet, so its page shows a Vallo plate with a label saying so.",
  tablesNothingWaiting: "Nothing is waiting on you.",
  tablesYourVenue: "Your venue",
  reviews: {
    signedOutTitle: "Your reviews",
    signedOutBody: "Sign in to read what guests wrote about your stays, and to answer them.",
    subtitle: "What guests wrote about their stay",
    none: "No reviews yet",
    notReadyTitle: "Reviews of hotel stays open soon",
    notReadyBody:
      "Guests will be able to review a stay at your hotel after they check out, and you will answer them here. Nothing is needed from you.",
    unavailable: "Your reviews could not be read just now. Refresh to try again.",
    emptyBody: "After a guest checks out they can review their stay. It appears here, and you can answer it in public.",
    ratingLabel: "Your rating",
    /** After the average: "4.6 of 5". */
    ofFive: "of 5",
    /** `{count}` is five or more: the rating is only shown from five reviews. */
    ratingSentence: "From {count} reviews guests can read. A review we hid does not count.",
    barLabel: "Reviews by stars",
    ratingPending: "Your rating shows here once {min} guests have reviewed a stay. Until then each review speaks for itself.",
  },
  /* /host/bookings and its answer sheet (RoomRequestAnswer). The money
     sentences on this screen are not here: they are in lib/money/copy.ts. */
  bookings: {
    title: "Room bookings",
    signedOutTitle: "Your room bookings",
    signedOutBody: "Sign in to see the rooms guests have asked for at your hotel, and to accept or decline them.",
    /** Followed on screen by the payment sentence from lib/money/copy.ts. */
    lede: "Accept a request and the stay agreement is drawn up for you and the guest to confirm.",
    unavailable: "Your room bookings could not be read just now. Nothing has changed. Refresh to try again.",
    emptyTitle: "No room requests yet",
    emptyBody: "When a guest asks for one of your rooms, the request appears here and we tell you straight away.",
    sections: { waiting: "Waiting for you", accepted: "Accepted", past: "Past and closed" },
    status: {
      PENDING: "Waiting for you",
      CONFIRMED: "Accepted",
      CANCELLED: "Cancelled",
      COMPLETED: "Stayed",
      NO_SHOW: "No-show",
    },
    agreement: {
      awaiting_parties: "Agreement waiting for you or the guest to confirm",
      in_review: "Agreement with Vallo for checking",
      approved: "Agreement approved: the guest can pay",
      rejected: "Agreement sent back",
      cancelled: "Agreement cancelled",
      paid: "Paid",
    },
    paid: "Paid",
    openAgreement: "Open the agreement",
    /** "Sat 4 Oct to Mon 6 Oct". */
    dateRange: "{from} to {to}",
    /** After the guest's name, when the stay is for somebody else: "Ada Obi, for Tunde". */
    forSomebody: ", for {name}",
    answer: {
      accept: "Accept",
      decline: "Decline",
      acceptTitle: "Accept {name}'s booking?",
      declineTitle: "Decline {name}'s request?",
      /** "Deluxe double at Marina Court Hotel". */
      roomAt: "{room} at {hotel}",
      guest: "Guest",
      dates: "Dates",
      room: "Room",
      nextAgreement: "The stay agreement is drawn up for you and the guest to confirm.",
      /* A room is paid by card: the agreement is approved by the system unless a risk signal asks a person to look (D68d, D83). */
      nextChecked: "The agreement is approved at once, unless something needs a second look at Vallo.",
      nextNightsBack: "The nights go back on sale at once.",
      told: "{name} is told at once.",
      cancel: "Cancel",
      acceptBooking: "Accept booking",
      keepIt: "Keep it",
      declineRequest: "Decline the request",
      why: "Tell the guest why (optional)",
      failed: "That did not go through.",
    },
  },
  /* A business's application state, said the same way on every host screen
     (it was three separate English tables: today.ts, settings, transfer). */
  businessStatus: {
    DRAFT: "Draft",
    SUBMITTED: "With our team",
    UNDER_REVIEW: "Being read",
    MORE_INFO_REQUIRED: "Needs more from you",
    APPROVED: "Approved",
    PUBLISHED: "Live",
    REJECTED: "Not approved",
    SUSPENDED: "Suspended",
  },
  businessKind: {
    hotel: "Hotel",
    serviced_apartments: "Serviced apartments",
    guest_house: "Guest house",
    resort: "Resort",
    shortlet_operator: "Shortlets",
    restaurant: "Restaurant",
    agency: "Agency",
  },
  /** The doors under each business on the home and in settings. */
  businessDoors: {
    tables: "Tables",
    rooms: "Rooms and nights",
    photos: "Photographs",
    arrival: "Charges at the door",
    handOver: "Hand over",
  },
  /* /host, the workspace home. */
  home: {
    metaTitle: "Host",
    /** After a counted phrase: "2 businesses on this account." */
    onAccount: "{businesses} on this account.",
    draftWithTeam: "With our team",
    draftInProgress: "In progress",
    yourBusiness: "Your business",
    draftReadNext: "A person reads it next. We write to you when it has been read.",
    draftReady: "Everything is in. Open it and send it for review.",
    /** `{things}` is a counted phrase: "3 things". */
    draftMissing: "{things} still to add before it can be sent.",
    businessesTitle: "Your businesses",
    tier: "Tier {tier} of 4",
    tierVerified: "Tier {tier} of 4, verified",
    stopped: {
      SUSPENDED:
        "Our team has stopped this business. Guests cannot find or book it until the stop is lifted. Bookings already confirmed still stand.",
      REJECTED: "This application did not pass review, so guests cannot find it.",
      MORE_INFO_REQUIRED: "A reviewer needs something more before this can go live. Open the application to answer.",
    },
    noReason: "No reason was written on the business. Contact us and a person will tell you why.",
    reviewerWrote: "The reviewer wrote: {note}",
    contactUs: "Contact us",
  },
  /* /host/settings. */
  settingsPage: {
    metaTitle: "Host settings",
    title: "Settings",
    sub: "Your businesses, what reaches you, and your assistant.",
    /** "Hotel, tier 3 of 4". */
    kindTier: "{kind}, tier {tier} of 4",
    notificationsUnreachable: "We cannot reach your notification preferences right now.",
    assistantTitle: "Assistant",
    assistantSub: "Ask about running your stay or restaurant, without leaving.",
    elseLabel: "Everything else",
    elseBody:
      "Language, theme, privacy, security and account deletion are one account wide, so they live on your Vallo settings page rather than being kept in two places.",
    elseOpen: "Open account settings",
  },
  /* /host/decide. */
  decide: {
    metaTitle: "Decide by",
    signedOutTitle: "Requests waiting for you",
    signedOutBody: "Sign in to see every room and table request waiting for your answer, and how long each one has left.",
  },
  /* /host/earnings and its statement. The money sentences are in lib/money/copy.ts. */
  earnings: {
    title: "Earnings",
    signedOutTitle: "Sign in to see your earnings",
    seeReservations: "See your reservations",
    statements: "Statements",
  },
  statement: {
    metaTitle: "Payout statement",
    signedOutTitle: "Your payout statements",
  },
  /* /host/calendar. */
  calendar: {
    title: "Calendar",
    signedOutTitle: "Your rates and nights",
    signedOutBody: "Sign in to price your nights and open or close them on one calendar.",
    propertiesLabel: "Your properties",
    unavailable: "Your calendar could not be read just now. Nothing has changed. Refresh to try again.",
    noRoomTypesTitle: "No room types yet",
    noRoomTypesBody: "Add a room type with its rate in your application, and its nights appear here to price.",
    addRoomType: "Add a room type",
  },
  /* /host/rooms. `{types}` is a counted phrase ("2 room types"). */
  rooms: {
    title: "Rooms and nights",
    noTypes: "{name} has no room types yet, so there is nothing a guest could book.",
    noneOnSale: "{name} has {types} and no nights on sale, so a search with dates on it will not find it.",
    someOnSale: "{name} has {types}, {onSale} of them on sale.",
    addRoomType: "Add a room type",
  },
  /** What the host screens without a shaped wait of their own say while they load (C5; hostWorkspace.loadingScreens has the rest). */
  loadingScreens: {
    statement: "Loading your statement",
    bookings: "Loading your room bookings",
    photos: "Loading your photographs",
    arrival: "Loading the charges at the door",
    transfer: "Loading your businesses",
    settings: "Loading your host settings",
    apply: "Loading your application",
    assistant: "Loading the assistant",
    notifications: "Loading your notifications",
  },
  /* ------------------------------------------------------------------
   * The host's client islands (C5): the words they wrote in English,
   * read through the route's CopyScope (`useHostPageCopy`).
   * ------------------------------------------------------------------ */
  reviewCard: {
    /** The stars' accessible name: "4 out of 5". */
    outOfFive: "{rating} out of 5",
    noWords: "A rating with no words.",
    hidden: "Hidden",
    removedByVallo: "Removed by Vallo",
    /** After the Hidden badge. `{note}` is what guests see in the review's place. */
    hiddenInstead: "Guests see instead: \u201c{note}\u201d. It no longer counts toward your rating.",
    askedVallo: "Asked Vallo",
    decided: "Decided",
    yourReply: "Your reply",
    replyLabel: "Your public reply",
    replyHint: "Guests read this under the review. Thank them, and say what you changed.",
    saveReply: "Save the reply",
    postReply: "Post the reply",
    cancel: "Cancel",
    editReply: "Edit reply",
    reply: "Reply",
    takeBack: "Take the reply back",
    askVallo: "Ask Vallo to look",
    contestTitle: "Ask Vallo to look at this review",
    send: "Send to Vallo",
    contestBody:
      "We keep a review that is about the stay, even a hard one. We hide a review only when it breaks one of these standards, and we never delete one. The review stays up while we look, and both you and the guest are told what we decide.",
    whichStandard: "Which standard does it break?",
    noteLabel: "Anything we should know (optional)",
    noteHint: "Only Vallo reads this.",
    /**
     * The five published reasons (`lib/host/review-contest.ts` holds their
     * values, the database's `review_contests_criterion_chk`). The console and
     * the stored public note keep the English label there, which a test holds
     * equal to these.
     */
    criteria: {
      personal_data: {
        label: "Shares personal information",
        hint: "A phone number, an address, a full name or anything else that identifies someone.",
      },
      threats: { label: "Threats or abuse", hint: "Threats, insults, or hate towards a person or a group." },
      not_about_the_stay: {
        label: "Not about the stay",
        hint: "It is about something else, such as a different place or a dispute that is not the stay.",
      },
      conflict_of_interest: {
        label: "Conflict of interest",
        hint: "Written by a competitor, a relative, or someone paid to write it.",
      },
      off_topic: { label: "Off topic", hint: "Politics, religion, or anything that does not help a guest decide." },
    },
    /** Where a contest stands, after its badge (`contestWords`). `{note}` is the public note staff wrote. */
    contestStatus: {
      open: "With Vallo. The review stays up while we look.",
      hiddenWithNote: "Hidden by Vallo: \u201c{note}\u201d",
      hidden: "Hidden by Vallo.",
      kept: "Vallo looked and kept it: it meets the review standards.",
      withdrawn: "You withdrew the request. The review stays up.",
    },
  },
  tables: {
    answered: "Answered. The guest has been told.",
    guest: "Guest",
    when: "When",
    party: "Party",
    accept: "Accept",
    decline: "Decline",
    acceptTitle: "Accept {name}'s table?",
    declineTitle: "Decline {name}'s table?",
    nextBooked: "The table is booked for this time.",
    nextClosed: "The request is closed.",
    told: "{name} is told at once.",
    cancel: "Cancel",
    saving: "Saving",
    acceptTable: "Accept table",
    declineTable: "Decline table",
    statusWaiting: "Waiting on you",
    statusAccepted: "Accepted",
    statusClosed: "Declined or called off",
    talkTo: "Talk to {name}",
    groupWaiting: "Waiting on you",
    groupWaitingEmpty: "No requests to answer.",
    groupComing: "Coming up",
    groupComingEmpty: "No tables accepted yet.",
    groupPast: "Past",
    groupPastEmpty: "Nothing yet.",
  },
  transfer: {
    kind: {
      hotel: "Hotel",
      serviced_apartments: "Serviced apartments",
      guest_house: "Guest house",
      resort: "Resort",
      shortlet_operator: "Shortlet operator",
      restaurant: "Restaurant",
      agency: "Agency",
    },
    verifiedSuffix: ", verified",
    noBusiness: "There is no business on this account.",
    nothingTrading: "Nothing here is trading, so none of it is holding anything up.",
    /** After the counted phrase ("1 of your businesses is still trading."). */
    whyItMatters:
      "A business a stranger can book cannot be left with nobody behind it, so it has to move or close before an account can be deleted.",
    offeredDescription:
      "Nothing has moved. It is yours only if you accept it, and taking it on means taking on its bookings and its obligations.",
    businessesDescription:
      "Two ways out of each one: hand it to somebody who accepts it, or close it and take it off the market. Both leave every record where it is.",
    backToAccount: "Back to my account",
    partial: "We could not check every part of this just now, so the list above may be short. Nothing has been changed.",
    live: "It is live, so anybody can find it.",
    settleDiary: "Settle the diary",
    offerWaiting: "Offered, waiting on an answer",
    sentTo: "Sent to @{handle}.",
    sent: "Sent.",
    runsOutNothingMoved: "It runs out on {date} and nothing has moved yet.",
    takeOfferBack: "Take the offer back",
    offerSent: "Offer sent. It runs out on {date}, and the business stays yours until they accept.",
    emailLabel: "Their email address on Vallo",
    emailHint: "They must already have a Vallo account. We send them the offer and nothing moves until they accept it.",
    noteLabel: "A note for them, if you want one",
    cancel: "Cancel",
    sendOffer: "Send the offer",
    handOver: "Hand it over",
    closeIt: "Close it",
    from: "From @{handle}.",
    runsOut: "Runs out on {date}.",
    takingOn:
      "If you accept, its bookings and its diary become yours. The verified badge starts again from your own identity check, and the consents and attestations are yours to make.",
    noThanks: "No thank you",
    acceptIt: "Accept it",
  },
  /** PhotoManager's words, per spine. `{max}` is the ceiling on photographs. */
  photoManager: {
    /** `PhotoManager`'s own controls and lines, the same for a venue and a property. `{n}` and `{max}` are whole numbers. */
    controls: {
      coverNote:
        "The first photograph is the one guests see on your card and at the top of your page. Take it down and the next one takes its place. Up to {max}.",
      coverAlt: "The photograph guests see first",
      /** `{subject}` is `ofSubject` below: "Photograph 2 of your venue". */
      photoAlt: "Photograph {n} {subject}",
      cover: "Cover",
      photo: "Photograph {n}",
      takeDown: "Take down",
      uploading: "Uploading",
      addFirst: "Add the first photograph",
      addAnother: "Add another",
      /** `{formats}` is `acceptedFormats`, `{size}` is "10MB". */
      formats: "{formats}, up to {size} each. One at a time.",
      /** The three types the picker takes (`PHOTO_ACCEPTED_MIME`), as a list a person reads. */
      acceptedFormats: "JPG, PNG or WEBP",
      /** `rejectPhoto` (lib/host/photos.ts), before anything is uploaded. `{formats}` is `acceptedFormats`, `{size}` is "10MB". */
      notAccepted: "That file is not {formats}. A photograph straight from a phone is one of those.",
      tooLarge: "That photograph is over {size}. Send it at a smaller size and choose it again.",
      uploadFailed: "The upload did not finish. Check your connection and choose the photograph again.",
    },
    venue: {
      title: "Photographs of the venue",
      guidance:
        "The room as a guest first sees it, a table laid, the frontage so somebody can recognise it from the street, and two or three plates you are known for. A phone camera in good light beats a bad professional shoot.",
      ofSubject: "of your venue",
      fullNote: "That is {max} photographs, which is as many as a venue carries. Take one down to add another.",
    },
    property: {
      title: "Photographs of the property",
      guidance:
        "The room made up as a guest walks into it, the bathroom, the view from the window, the frontage so somebody can recognise it from the street, and anything a guest uses: the pool, the generator house, the parking. A phone camera in good light beats a bad professional shoot.",
      ofSubject: "of your property",
      fullNote: "That is {max} photographs, which is as many as a property carries. Take one down to add another.",
    },
  },
  /* components/host/DecideView.tsx, the decide-by list. `{count}` phrases are countOf's. */
  decideView: {
    title: "Decide by",
    nothingWaiting: "Nothing is waiting for you",
    /** `{requests}` is a counted phrase ("3 requests are"). */
    waiting: "{requests} waiting for your answer",
    unreadable: "Some of your requests could not be read just now. Refresh to try again.",
    summaryLabel: "Waiting for your answer",
    /** `{count}` is a counted phrase ("2 of them are"). */
    closeToLapsing: "{count} close to lapsing. Answer those first.",
    allSpare: "Each one has time to spare. Answering fast is what guests remember.",
    lastHour: "Last hour",
    lastQuarter: "Last quarter",
    timeToSpare: "Time to spare",
    barLabel: "Requests by time left",
    caughtUpTitle: "You are all caught up",
    caughtUpBody: "When a guest asks for a room or a table, it appears here with the time you have to answer.",
    clock: "The clock",
    spareSub: "More than a quarter of the window is left.",
    quarterSub: "Answer soon.",
    hourSub: "A room request lapses 48 hours after it is made and its nights go back on sale. A table request lapses at the table's time.",
    elseLabel: "Everything else",
    roomBookings: "Room bookings",
    roomBookingsSub: "Accepted and past stays",
    reservations: "Reservations",
    reservationsSub: "Tables coming up and past",
    lapses: "Lapses {when}",
    roomLapse: "{lapses}. If nobody answers, the request lapses and the nights go back on sale.",
    /** "Deluxe double at Marina Court Hotel". */
    roomAt: "{room} at {hotel}",
    tableFor: "Table for {party} at {place}",
    talkTo: "Talk to {name}",
  },
  /* The rate calendar's islands (RateCalendar, SelectionPanel, CalendarSync, RatePlanSheet). */
  calendarUi: {
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    /**
     * The selected nights in words (`describeSelection`): "3 Dec to 5 Dec,
     * 12 Dec", at most three runs, then "and N more". `{from}` and `{to}` are
     * dates, `{list}` the runs so far, `{count}` a whole number.
     */
    selection: {
      none: "No nights",
      run: "{from} to {to}",
      more: "{list} and {count} more",
    },
    roomTypes: "Room types",
    notOnShelf: "Not on the shelf yet",
    /** "Room only: ₦45,000 a night unless a night says otherwise". */
    planLine: "{plan}: {rate} a night unless a night says otherwise",
    noRate: "No rate yet. Add one in your application, then price nights here.",
    editRate: "Edit rate",
    whichRate: "Which rate the calendar shows",
    offSaleSuffix: " (off sale)",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    presets: "Select nights quickly",
    weekends: "Fri and Sat nights",
    weekdaysPreset: "Sun to Thu nights",
    everyNight: "Every night",
    cellClosed: "Closed",
    cellOffSale: "Off sale",
    cellFull: "Full",
    /** `{count}` is a number of rooms. */
    cellHeld: "{count} held",
    cellLeft: "{count} left",
    legendLabel: "What the colours mean",
    legendOpen: "On sale at the rate",
    legendOwn: "Your own price",
    legendFull: "Fully booked",
    legendClosed: "Closed",
    legendImported: "Every room booked elsewhere",
    legendElsewhere: "Some rooms held by another site",
    legendNone: "Not on sale",
    fine: "A guest pays what the night shows when they ask. Requests already made keep the price they were made at.",
    sideLabel: "Change the selected nights",
    selectedNights: "Selected nights",
    clearSelection: "Clear selection",
    change: "Change",
    /* A night cell's spoken name: "Fri 9 Oct, ₦60,000, your own price for this night, 2 rooms left". */
    cellNoRate: "no rate",
    cellGone: "gone",
    cellNoRoomLeft: "no room left, {why}",
    cellBookedOn: "booked on {site}",
    cellIsClosed: "closed",
    cellNotOnSale: "not on sale",
    cellFullyBooked: "fully booked",
    cellOwnPrice: ", your own price for this night",
    heldBy: "{count} held by {site}",
    /* SelectionPanel */
    selectTitle: "Select nights to change them",
    selectHow:
      "Tap a night, then tap another to take in the run between. Drag across nights with a mouse, or hold a night for a moment and drag with a finger.",
    clear: "Clear",
    nightNow: "A night now",
    noRateShort: "No rate",
    /** "₦45,000 to ₦60,000". */
    priceRange: "{low} to {high}",
    heldByOthers: "Held by other sites",
    upToANight: "Up to {count} a night",
    alreadyBooked: "Already booked",
    none: "None",
    priceLabel: "Price",
    priceANight: "Price a night",
    /** `{nights}` is a counted phrase ("3 nights"). */
    priceFor: "Price for {nights}",
    setPrice: "Set price",
    pricedDone: "{nights} now {price} on {plan}.",
    backOnRateDone: "{nights} back on the rate, {rate}.",
    backToRate: "Back to the rate, {rate}",
    roomsOnSale: "Rooms on sale",
    roomsEachNight: "Rooms on sale each night",
    oneFewer: "One fewer",
    oneMore: "One more",
    ofTotal: "of {total}",
    noRoomsDone: "No rooms on sale for {nights}.",
    roomsDone: "{units} on sale for {nights}.",
    heldBackDone: " On {nights}, fewer: another site holds a room there.",
    setRooms: "Set rooms",
    atLeast: "At least {floor}, because that many are already booked on one of these nights.",
    openOrClose: "Open or close",
    closeDone: "{nights} closed. Guests cannot ask for them.",
    close: "Close",
    reopenDone: "{nights} open again.",
    reopen: "Reopen",
    closingKeeps: "Closing stops new requests. A stay already asked for or booked is kept.",
    heldStayOff: "Rooms held by another site stay off sale here whatever you set, and come back when that booking leaves its calendar.",
    /* CalendarSync */
    syncTitle: "Sync with Airbnb and Booking.com",
    syncOn: "A booking there takes one room here, and nights taken here show as taken there.",
    syncOff: "Calendar sync is not switched on yet. Until it is, close nights you sell elsewhere by hand.",
    feedTitle: "Your Vallo calendar link",
    copied: "Copied",
    copy: "Copy",
    feedHow: "Paste it into the other site's calendar import. It shows only which nights are taken, never a guest's name.",
    newLink: "Make a new link",
    newLinkWarn: "The old link stops working at once. Use this if the link was shared somewhere it should not be.",
    newLinkDone: "A new link is ready. Paste it into the other site again.",
    replaceLink: "Replace the link",
    linkReady: "Your link is ready to copy.",
    makeLink: "Make a calendar link",
    importsTitle: "Calendars from other sites",
    noneLinked: "None linked yet.",
    linked: "Linked. The first sync runs within half an hour.",
    from: "From",
    icsLabel: "Calendar link (.ics)",
    linkCalendar: "Link this calendar",
    failed: "That did not go through.",
    fromSite: "From {site}",
    needsLook: "Needs a look",
    paused: "Paused",
    syncFrom: "Sync from {site}",
    resumed: "Sync resumed.",
    pausedDone: "Sync paused. Its nights stay as they are.",
    unlink: "Unlink the {site} calendar",
    unlinked: "Unlinked. The nights it closed are open again.",
    anotherSite: "Another site",
    notPulled: "not pulled yet",
    justNow: "synced just now",
    minAgo: "synced {n} min ago",
    hAgo: "synced {n} h ago",
    daysAgo: "synced {n} days ago",
    /* RatePlanSheet */
    rateDone: "{plan} is now {rate} a night.",
    editPlan: "Edit {plan}",
    cancel: "Cancel",
    saveRate: "Save the rate",
    rateLabel: "A night, in naira",
    rateHint: "Nights you priced yourself keep their own price.",
    shortest: "Shortest stay",
    nightsHint: "Nights",
    longest: "Longest stay",
    noLimit: "Leave empty for no limit",
    newRateNote: "New requests are priced from the new rate. A request already made keeps the price it was made at.",
  },
  /* RoomNightsEditor, on /host/rooms. */
  roomNights: {
    /** Under the editor: how far ahead a published room is offered (`INVENTORY_HORIZON_NIGHTS`, a year). */
    horizonNote:
      "Every room you told us about is offered on every night for the next year. Close the nights you are not taking, and open more when you are.",
    closedDone: "Closed for {nights}.",
    onSaleDone: "{units} on sale for {nights}.",
    /** "4 rooms · sleeps 2 · from ₦45,000 a night". */
    sleeps: "sleeps {n}",
    fromANight: "from {rate} a night",
    onShelf: "On the shelf",
    notOnShelf: "Not on the shelf yet",
    noRate:
      "This room has no rate, so it cannot go on the shelf and nothing below will put it there. Add a rate to it in your application.",
    noNights: "No nights are on sale, so a guest searching with dates will not find this room. Open a run of nights below.",
    bookable: "Bookable on {nights} from today.",
    bookableTo: "Bookable on {nights} from today, out to {last}.",
    unitsHint: "None closes those nights. At most {total}, which is how many of these you told us there are.",
    closeThese: "Close these nights",
    putOnSale: "Put these nights on sale",
  },
  /* components/host/StatementView.tsx. The totals' labels are experienceFeatures.workspace.statement's. */
  statementView: {
    /** "Statement, September 2026". */
    title: "Statement, {month}",
    issuedBy: "Issued by {company}",
    otherMonths: "Other months",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    unavailable: "Your statement could not be read just now. Nothing has changed. Refresh to try again.",
    backToEarnings: "Back to earnings",
    incomplete:
      "This month has more lines than we could read at once, so the totals below are not the whole month. Download is paused until it can be read in full.",
    /** After the counted payments: ", 1 reversed by refunds". */
    reversed: ", {count} reversed by refunds",
    colDate: "Date and stay",
    colGuestPaid: "Guest paid",
    colCommission: "Commission",
    colGuarantee: "Guarantee",
    colShare: "Your share",
    colReference: "Paystack reference",
    refundReversal: "Refund reversal",
    none: "None",
    total: "Total",
    downloadCsv: "Download CSV",
    lineGuarantee: "Guarantee contribution",
    lineShare: "Your share",
  },

  /*
   * THE HOST SERVER ACTIONS' REFUSALS (lib/host/*-actions.ts), moved here
   * word for word so a host reads them in their own language. Only what is
   * SAID to the host lives here: a note an action writes into a record (the
   * booking's state events) stays English in the action. `{max}`, `{count}`,
   * `{total}` and `{open}` are whole numbers.
   */
  refusals: {
    /* lib/host/actions.ts: the application, its rooms, photographs and nights. */
    application: {
      serviceDown: "We could not save that just now. Nothing you typed was lost, so try again in a moment.",
      noDraft: "There is no application open on your account yet. Start one and we will keep it as you go.",
      notEditable:
        "This application is with our team, so it cannot be changed right now. We will write to you when it has been read.",
      notYours: "That is not on your account. Open your properties to see the ones that are.",
      nameFirst: "Give your business a name to start.",
      nameField: "Give your business a name.",
      kindFirst: "Say what kind of business this is.",
      kindField: "Pick what this business is.",
      slugTaken: "A business with that web address already exists. Change the name slightly and save again.",
      phoneBad: "That phone number is not one we can ring. Enter it as 0803 123 4567.",
      emailBad: "That email address is not one we can write to.",
      cacBad: "That is not an RC or BN number. It is the one on your CAC certificate, like RC 1234567.",
      uploadNotYoursFile:
        "That upload did not come from your own account, so we did not file it. Please choose the file again.",
      documentNotAttached: "That document did not attach. Choose the file again.",
      alreadyWithTeam: "This application is already with our team. We will write to you when it is read.",
      alreadySent: "This application has already been sent. Refresh to see where it is.",
      propertySlugTaken: "A property with that web address already exists. Change the name slightly.",
      roomTypeNameTaken: "You already have a room type with that name.",
      differentName: "Give this one a different name.",
      ratePlanNameTaken: "That room type already has a rate with that name.",
      policyFromList: "Pick a cancellation policy from the list.",
      policyField: "Pick a cancellation policy.",
      serviceClash: "You already have a service starting at that time on that day.",
      uploadNotYoursPhoto:
        "That upload did not come from your own account, so we did not file it. Please choose the photograph again.",
      venuePhotosFull: "A venue carries up to {max} photographs. Take one down and add this in its place.",
      propertyPhotosFull: "A property carries up to {max} photographs. Take one down and add this in its place.",
      photoRace: "That photograph landed at the same moment as another. Try it again.",
      photoNotAttached: "That photograph did not attach. Choose the file again.",
      roomsOverTotal:
        "You told us there are {total} of these, so {open} cannot be on sale. Change the room type first if you have more.",
      atMost: "At most {total}.",
      lastBeforeFirst: "The last night cannot come before the first. Pick a last night on or after the first.",
      tooManyNights: "That is {count} nights. Set up to {max} at a time so nothing is lost part way.",
      moreRoomsThanType:
        "That is more rooms than this type has. Change how many of this room there are first, then set the nights.",
      moreThanTypeHolds: "More than the room type holds.",
      bookedOverOpen:
        "One of those nights already has more rooms booked than you are leaving open. Open at least as many as are sold, or pick a different run of nights.",
      placeTypeMissing:
        "This database does not know that kind of place yet. The migration that adds it, 20260922190000_imgc_a_shortlet_is_not_a_hotel_room, has not been applied.",
    },
    /*
     * lib/host/schema.ts: what the wizard's fields say when a value is the
     * wrong shape, beside the box (C9, moved word for word). The schemas are
     * built per request from these. `{time}` is an example clock time.
     */
    schema: {
      phoneBad: "That does not look like a Nigerian mobile number. Enter it as 0803 123 4567.",
      emailBad: "Enter an email address we can actually write to.",
      cacBad: "That is not an RC or BN number. It is the one on your CAC certificate, like RC 1234567.",
      tinBad: "A TIN is digits, with or without dashes.",
      applicationUnknown: "That application could not be identified.",
      documentKind: "That is not a document we ask for.",
      uploadUnknown: "That upload could not be identified.",
      propertyName: "Give the property a name.",
      timeLike: "Use a time like {time}.",
      propertyUnknown: "That property could not be identified.",
      roomTypeName: "Name the room type, for example Deluxe Double.",
      roomCategory: "Pick what kind of room this is.",
      roomSleepsOne: "A room sleeps at least one.",
      unitsOne: "You have at least one of this room.",
      rateNegative: "A rate cannot be negative.",
      roomTypeUnknown: "That room type could not be identified.",
      rateName: "Name the rate, for example Standard.",
      policy: "Pick a cancellation policy.",
      coversSay: "Say how many people you can seat.",
      closesAfterOpens: "A service closes after it opens.",
      lastSeatingInside: "The last seating falls inside the service.",
      menuHttps: "A menu link starts with https://",
      venueUnknown: "That venue could not be identified.",
      photoUnknown: "That photograph could not be identified.",
      facilityUnknown: "That is not a facility we can record.",
      facilitiesTooMany: "That is more facilities than there are.",
      notADate: "That is not a date. Use the date picker.",
      wholeRooms: "Rooms come in whole numbers.",
      fewerThanNone: "That cannot be fewer than none.",
      roomsTooMany: "That is more rooms than any one type holds.",
      lastBeforeFirst: "The last night cannot come before the first.",
      placeType: "Pick what kind of place this is.",
      placeName: "Give the place a name.",
      bedOne: "A place has at least one bed.",
      placeSleepsOne: "A place sleeps at least one.",
      sevenDays: "There are seven days in a week.",
      wholeSeats: "Seats come in whole numbers.",
      seatsTooMany: "That is more seats than any one room holds.",
    },
    /* lib/host/review-actions.ts: answering a review, asking Vallo to look at one. */
    reviews: {
      notReady: "Reviews of hotel stays are not open yet. Nothing was saved.",
      serviceDown: "We could not save that just now. Nothing was lost, so try again in a moment.",
      notYours: "That review is not of one of your places. Refresh your reviews and answer one of your own.",
      reviewUnknown: "This review could not be identified.",
      writeFirst: "Write a reply first.",
      replyTooLong: "Keep your reply under {max} characters.",
      pickReason: "Pick the reason that fits.",
      keepItUnder: "Keep it under {max} characters.",
      noteTooLong: "Keep the note under {max} characters.",
      alreadyOpen: "You have already asked us about this review. We will tell you what we decide.",
      rateLimited: "You have asked about a lot of reviews today. Try again tomorrow.",
    },
    /* lib/host/calendar-actions.ts: prices, closures and rooms across nights. */
    calendar: {
      serviceDown: "We could not save that just now. Nothing changed, so try again in a moment.",
      notYours: "That room is not on your account. Open your calendar again to see the ones that are.",
      past: "Pick nights from today onwards. A night that has gone cannot be priced or closed.",
      notADate: "That is not a date.",
      pickOne: "Pick at least one night.",
      tooMany: "Pick up to {max} nights at a time so nothing is lost part way.",
      wholeKobo: "Prices are in whole kobo.",
      atLeast: "A night costs at least \u20a61.",
      tooHigh: "That is more than \u20a650,000,000 a night. Check the number.",
      roomUnknown: "That room could not be identified.",
      rateUnknown: "That rate could not be identified.",
      wholeRooms: "Rooms come in whole numbers.",
      minOneNight: "At least one night.",
      maxNinety: "At most 90 nights.",
      longestShorter: "The longest stay cannot be shorter than the shortest.",
      noRateToClose: "This room has no rate yet, so there is nothing to close. Add a rate in your application first.",
      roomsOverTotal: "You told us there are {total} of these, so {open} cannot be on sale.",
      atMost: "At most {total}.",
      moreRoomsThanType: "That is more rooms than this type has. Change the room type first.",
      bookedOverOpen:
        "One of those nights already has more rooms booked than you are leaving open. Leave at least as many open as are booked.",
      fewerThanBooked: "Fewer than are already booked.",
    },
    /* lib/host/calendar-sync-actions.ts: the feed out and the calendars in. */
    sync: {
      notReady: "Calendar sync is not switched on yet. Nothing about your nights changed; set them by hand until it is.",
      serviceDown: "We could not save that just now. Nothing changed, so try again in a moment.",
      notYours: "That room is not on your account. Refresh the calendar and pick one of your own rooms.",
      roomUnknown: "That room could not be identified.",
      calendarUnknown: "That calendar could not be identified.",
      pickSite: "Pick the site this calendar comes from.",
      pasteLink: "Paste the calendar link.",
      linkExists: "This room already has a link. Refresh to see it.",
      alreadyLinked: "That calendar is already linked to this room.",
      alreadyLinkedField: "Already linked.",
      fiveMax: "A room can have up to five linked calendars. Remove one first.",
      /* Why a pasted calendar link was refused (`checkFeedUrl`, lib/host/ical.ts), by its key. */
      feed: {
        notALink: "That is not a link. Copy the calendar link from the other site and paste it here.",
        notHttps: "The link has to start with https://.",
        unusable: "That link cannot be used. Copy the calendar export link from the other site.",
        address: "Use the calendar link the site gives you, not an address.",
        notASite:
          "We can read calendars from Airbnb, Booking.com, Vrbo, Expedia, Google and Outlook calendars, and the main channel managers. Paste the export link from one of those.",
        tooLong: "That link is too long to be a calendar link.",
      },
    },
    /* lib/host/room-booking-actions.ts: accepting or declining a room request. */
    roomRequests: {
      notYours: "This request is not at one of your hotels. Refresh your requests to see the ones that are.",
      movedOn: "This request has already been answered or has lapsed. Refresh to see where it stands.",
      down: "That did not go through. The request is unchanged. Try again in a moment.",
      requestUnknown: "This request could not be identified.",
      reasonTooLong: "Keep the reason under 500 characters.",
    },
  },
};
