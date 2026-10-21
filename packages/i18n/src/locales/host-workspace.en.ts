/**
 * THE HOST WORKSPACE'S OWN WORDS, MOVED OUT OF THE PAGES (C11, 30 September
 * 2026).
 *
 * These were English literals passed straight into `title=`, `body=`,
 * `label=` and `aria-label=` in `app/host` and `components/host`, where no
 * dictionary and no completeness measure could see them: a Hausa-speaking
 * host in Kano met English across their whole workspace. The words are the
 * pages' own, moved here unchanged; `host-copy.test.ts` keeps them out of the
 * pages.
 */
export const hostWorkspaceEn = {
  loading: "Loading",
  home: {
    signedOutTitle: "Host on Vallo",
    signedOutBody:
      "List a hotel, a guest house, serviced apartments or a restaurant. Sign in and the application saves to your account as you go.",
    startTitle: "Become a host",
    startBody:
      "Ten short steps at most, saved as you go. A person on our team reads it, and the badge only ever means a human was checked.",
  },
  apply: {
    signedOutTitle: "Sign in to become a host",
    signedOutBody:
      "Your application is saved to your account as you go, so it needs one. You will come straight back here.",
    failedTitle: "We could not open your application",
    failedBody:
      "Nothing has been changed and your saved details are still there; we just could not load them this time. Try again in a moment.",
  },
  photos: {
    signedOutTitle: "Photographs of your venue",
    signedOutBody: "Sign in to put your own photographs on your venue's page.",
    noVenueTitle: "No venue yet",
    noVenueBody:
      "Photographs hang on a venue, so there is one thing to do first. An application takes ten short steps at most and saves as you go.",
    venuesLabel: "Your venues",
    saveFirstTitle: "Save the property first",
    saveFirstBody:
      "Photographs hang on the property itself, so the application asks for its name and pin first. Save the property there, and the photographs go up on the same step.",
  },
  reservations: {
    signedOutTitle: "Your tables",
    signedOutBody: "Sign in to see the tables guests have asked for at your venue, and to accept or decline them.",
    failedTitle: "We could not load your tables",
    failedBody:
      "This is on our side, not yours, and nothing has been lost. Try again in a few minutes. Any request a guest has made is still waiting for you.",
    emptyTitle: "No tables yet",
    emptyBody:
      "When somebody asks for a table at your venue it appears here, with their name, party and time on the Lagos clock. It costs nobody anything, and nothing is held until you accept.",
  },
  rooms: {
    signedOutTitle: "Your rooms and your nights",
    signedOutBody: "Sign in to see how many rooms you have on sale and how far ahead guests can book them.",
    noPropertyTitle: "No property yet",
    noPropertyBody:
      "Rooms hang on a property, so there is one thing to do first. An application takes ten short steps at most and saves as you go.",
    saveFirstTitle: "Save the property first",
    saveFirstBody:
      "Rooms and their nights hang on the property itself, so the application asks for its name and pin first. Save the property there, and the rooms follow on the next step.",
    propertiesLabel: "Your properties",
    noRoomTypesTitle: "No room types yet",
    noRoomTypesBody:
      "A room type is a kind of room a guest books, such as a deluxe double. Add at least one, with how many there are and what a night costs, and the property can go on the shelf.",
  },
  settings: {
    signedOutTitle: "Host settings",
    signedOutBody: "Sign in to change what reaches you about your stays and your restaurant.",
    businessesTitle: "Your businesses",
  },
  transfer: {
    signedOutTitle: "Hand over a business",
    signedOutBody: "Sign in to move a business to somebody else, or to answer an offer somebody has made you.",
    offeredTitle: "Offered to you",
    businessesTitle: "Your businesses",
    nothingTitle: "Nothing to hand over",
    nothingBody: "There is no business on this account, so nothing here is standing between you and anything.",
  },
  facilitiesLabel: "What the property offers",
  wizard: {
    hostKindLabel: "What kind of host are you?",
    businessKindLabel: "Kind of business",
    businessName: "Registered business name",
    rcNumber: "RC or BN number",
    tin: "TIN",
    fullName: "Your full name",
    phone: "Your phone",
    bank: "Bank",
    accountNumber: "Account number",
    permissionsLabel: "Permissions",
    /* The wizard's own lines, moved out of `HostWizard` in the language audit (17 October 2026). */
    unsavedTitle: "You have unsaved changes",
    unsavedBody: "What you changed here is not saved yet. Save it before you go, or discard it.",
    saveAndGoBack: "Save and go back",
    saveAndGo: "Save and go",
    discard: "Discard",
    stay: "Stay",
    failed: "That did not go through. Check your connection and try again.",
    resubmitRejected:
      "You can change this application and send it again. It goes back to our team as a resubmission, with the note above beside it.",
    resubmitMore: "Change what they asked for, then send it again from the last step.",
    continue: "Continue",
    savedAsYouGo: "Saved to your application as you go.",
    keptOnDevice: "Kept on this device until the business step saves.",
    exactKind: "What is it, exactly?",
    kinds: {
      agency: "Agency",
      hotel: "Hotel",
      serviced_apartments: "Serviced apartments",
      guest_house: "Guest house",
      resort: "Resort",
      shortlet_operator: "Shortlet operator",
      restaurant: "Restaurant",
    },
    agreed: "You agreed to the Terms of service, the Privacy policy and the Host Agreement.",
    /** `{terms}`, `{privacy}` and `{agreement}` are drawn as links with the words below. */
    agreeText:
      "I agree to the {terms}, the {privacy} and the {agreement}. In short: I only charge guests what is listed on Vallo, with a reason for every charge.",
    termsLink: "Terms of service",
    privacyLink: "Privacy policy",
    agreementLink: "Host Agreement",
    cacTitle: "As the CAC holds it",
    rcHint: "The one on your certificate, like RC 1234567.",
    ifYouHaveOne: "(if you have one)",
    youTitle: "You",
    nameHint: "As it appears on the ID you upload.",
    hygieneTitle: "Health permit",
    hygieneBody: "This venue holds a current Local Government health permit and its food handlers hold current medical certificates.",
    hygieneDone: "Attested and dated on your application.",
    checkFirst: "Check the account with the bank first, then save it.",
    accountSaved: "The account is saved, in the name the bank gave.",
    payoutsTitle: "Where payouts go",
    accountOnRecord: "An account is on record. Add another only if payouts should go somewhere else.",
    confirmFirst: "We confirm the account with the bank before it is saved, and show you the name it holds.",
    loadingBanks: "Loading banks",
    chooseBank: "Choose a bank",
    isThisYou: "Is this you, or your business?",
    checkWithBank: "Check with the bank",
    saveAccount: "Yes, save this account",
    hostTerms: "Host terms",
    privacyPolicy: "Privacy policy",
    yourBusiness: "Your business",
    hostTypeMissing: "Host type not chosen",
    bankOnRecord: "Bank account on record",
    everythingHere: "Everything is here",
    /** `{count}` is a number. */
    stillMissing: "Still missing ({count})",
    teamReads: "A person on our team reads it next. We write to you when it has been read.",
    sendAgain: "Send it again",
    sendForReview: "Send for review",
    notGiven: "Not given",
    edit: "Edit",
    yourApplication: "Your application",
    /** `{name}` is the business, or "Your application". */
    sentTitle: "{name} is with our team",
    sentBody: "A person reads it next. You will hear from us when it has been read, and you can see where it stands on your host page.",
    hostPage: "Your host page",
    review: {
      contact: "Contact",
      address: "Address",
      registration: "Registration",
      representative: "Representative",
      property: "Property",
      service: "Service",
      payouts: "Payouts",
    },
  },
  nights: {
    firstNight: "First night",
    lastNight: "Last night",
    roomsOnSale: "Rooms on sale each night",
  },
  steps: {
    pinLabel: "The pin on the map",
    hotelName: "Hotel name",
    rcNumber: "RC number",
    address: "Address",
    changeAddress: "Change the address",
    starRating: "Star rating",
    roomCount: "Number of rooms",
    roomsUnit: "rooms",
    cancellationPolicy: "Cancellation policy",
    shortletKind: "What kind of shortlet are you listing?",
    placeName: "What you call it",
    bedrooms: "Bedrooms",
    beds: "Beds",
    maxGuests: "Maximum guests",
    nightlyPrice: "Nightly price",
    cancellation: "Cancellation",
    freeCancellation: "Free cancellation",
    mealPlan: "What the night includes",
    restaurantName: "Restaurant name",
    cuisine: "Cuisine",
    priceBand: "Price band",
    roomTypeName: "Name",
    roomTypePlaceholder: "Deluxe double",
    roomKind: "What kind of room",
    roomsOfKind: "rooms of this kind",
    guestsUnit: "guests",
    openingHours: "Opening hours",
    tableInventory: "Table inventory",
    sittingDuration: "Sitting duration",
  },
  /* The doors into the application and the calendar, moved out of the
     pages with the rest (C11 follow-up, 30 September 2026). */
  doors: {
    start: "Start",
    startApplication: "Start an application",
    continueApplication: "Continue the application",
    openApplication: "Open the application",
    checkCalendar: "Check the calendar",
  },
  nothingYet: {
    home: "Nothing listed yet. One application, saved as you go.",
    settings: "Nothing listed yet. Your businesses appear here once you apply.",
  },
  calendar: {
    noPropertyTitle: "No property yet",
    saveFirstTitle: "Save the property first",
    emptyBody: "A calendar hangs on a property and its rooms. Start or finish your application, and the calendar opens here.",
  },
  /**
   * A cancellation policy in plain words (`lib/host/cancellation-presets.ts`),
   * the same lines the host reads in the wizard and the guest reads on the
   * stay page. `{notice}`, `{shorter}` and `{longer}` are counted phrases
   * ("24 hours", "5 days"); `{outcome}` is one of the three refund phrases.
   */
  cancellation: {
    firstTier: "Cancel at least {notice} before check-in: {outcome}.",
    anyTime: "Cancel any time before check-in: {outcome}.",
    between: "Cancel between {shorter} and {longer} before check-in: {outcome}.",
    lessThan: "Cancel less than {notice} before check-in: {outcome}.",
    fullRefund: "a full refund",
    noRefund: "no refund",
    /** `{percent}` is a number ("50"). */
    partRefund: "{percent}% back",
    /** `{time}` is the property's check-in time, as the locale writes it ("14:00"). */
    footAtTime: "Deadlines are counted in Lagos time from check-in at {time}.",
    footNoTime: "Deadlines are counted in Lagos time from the property's check-in time.",
    /* "through our payment provider" came off: a payment held in escrow is
       refunded by the partner holding it, so the line names neither. */
    footRefund: "Refunds are paid in naira to the card or account you paid with.",
    footCaution: "A caution deposit is always returned under the rules listed with it, whatever the policy.",
    noPolicies:
      "This estate publishes no cancellation policies yet, so there is nothing to choose from. A rate cannot be sold without one.",
    pickOne: "Pick one. Guests see its refund rules on your page and before they pay, and a rate cannot be sold without one.",
    /** A restaurant's table rules, as the guest reads them. */
    tableFree: "Asking for a table is free. The restaurant confirms it when a table is free, and you pay the bill at the restaurant.",
    tableCancelNotice: "Please cancel at least {notice} ahead if you cannot come.",
    /** `{minutes}` is a counted phrase ("15 minutes"). */
    tableHeld: "A table is held for {minutes} after the booked time.",
    /** `{duration}` is "2 hours" or "1 hour 30 minutes". */
    tableSitting: "A table is yours for about {duration}.",
    /** Two counted phrases joined, for a sitting that is not whole hours. */
    hoursAndMinutes: "{hours} {minutes}",
  },
  /**
   * The drawn stays screens' own lines (`components/host/stays`), moved out of
   * the steps in the language audit (17 October 2026). `{amount}` is money,
   * `{count}` a number, `{days}`, `{seats}`, `{minutes}`, `{notice}` and
   * `{rooms}` counted phrases.
   */
  stays: {
    common: {
      continue: "Continue",
      openProperty: "Open the property",
      cancel: "Cancel",
      notGivenBusiness: "Not given yet. Open the business step to add it.",
      storedPerNight: "Stored as {amount} a night.",
    },
    stepper: {
      fewer: "One fewer {what}",
      more: "One more {what}",
    },
    extra: {
      saveFirst: "Save the property first: the charges at the door belong to it.",
      note: "A guest sees these before they book, and nothing else may be asked for at the door. A charge you leave out cannot be collected on arrival.",
    },
    facilities: {
      noLocation: "This device will not give a location. Type it instead.",
      refused: "The location was refused. Type it instead.",
      badPin: "Those are not two coordinates, so the pin cannot be saved.",
      pinSaved: "The pin is saved.",
      saveFirst: "Save the property first and the facilities and photographs hang on it.",
      pinOnRecord: "A pin is on record. Setting it again replaces it.",
      pinRequired:
        "Required before the property can go on the shelf. Stand at the property and use your location, or type the two numbers.",
      latitude: "Latitude",
      longitude: "Longitude",
      useLocation: "Use my location",
      savePin: "Save the pin",
      badPinHelp:
        "Those are not two coordinates. Latitude is a number from -90 to 90 and longitude from -180 to 180, like 6.4281 and 3.4219 for Victoria Island.",
      note: "The first photograph is the cover, and it is the one a guest sees on the shelf. Nothing here is published until a person on our team has read the application.",
    },
    hotel: {
      saved: "Your hotel is saved.",
      starsNone: "No star rating claimed. Leave it that way unless a body has actually rated the hotel.",
      starsClaimed: "A claimed rating. It renders as a claim and not as a badge until it is checked.",
      roomsTotal: "This is the total across the room types you have saved. Change it by changing a room type on the next screen.",
      roomsExpected:
        "The total you expect. The next screen is where the rooms actually go on sale, and what you enter there is what guests can book.",
      note: "Nothing here is on sale yet. A hotel goes on the shelf when a person on our team has read the application, and you can come back to this screen until then.",
    },
    rules: {
      saved: "Your rules and cancellation are saved.",
      checkInTime: "Check in time",
      checkOutTime: "Check out time",
      note: "The rules you switch on are written onto the property word for word, and a guest reads them before they book. Anything you typed yourself stays where it is.",
    },
    place: {
      incomplete: "Pick what kind of place it is, name it and give a nightly price to save it.",
      saved: "Your place is saved.",
      nameNote: "The name guests see. It is also the name of the property this place is listed under.",
      priceNote: "What one night costs. This is what a guest pays, and this platform adds nothing to it.",
      note: "Nothing is on sale yet. The next screen is your house rules and how a guest may cancel, and a person on our team reads the whole application before anything appears on the shelf.",
    },
    rates: {
      nothingYet: "There is nothing to price yet. Add a room type on the previous screen and its rates appear here.",
      addRoomType: "Add a room type",
      sleeps: "{rooms}, sleeps {count}",
      perNight: "/ night",
      noRate: "No rate yet. This room cannot be booked until it has one.",
      policySaved: "The cancellation policy is saved on every rate.",
      policyNote:
        "The policy is the property’s and applies to every room in it. Every price here is what a guest pays for the night, and this platform adds nothing to it.",
      choosePolicy: "Choose a cancellation policy before going on. A rate cannot be sold without one.",
      incomplete: "Enter what a night costs, and choose the cancellation policy, to save this rate.",
      /** `{plan}` is the meal plan's name. */
      priced: "{plan} is priced.",
      allPriced: "Every meal plan on this room already has a price.",
      addRate: "Add a rate",
      nightlyPrice: "Nightly price",
      enterPrice: "Enter what a night costs.",
      saveRate: "Save this rate",
    },
    restaurant: {
      holdLabel: "Holding a late table",
      noticeLabel: "Asking guests to cancel",
      saved: "Your restaurant is saved.",
      savedRulesNotKept:
        "Your restaurant is saved. The table hold and cancellation notice are not kept yet; they will be once this estate is updated.",
      title: "Your restaurant",
      hint: "Tell us about your restaurant.",
      cuisinesNone: "Pick every one that describes the food. It is how a guest finds you.",
      cuisinesChosen: "{count} chosen.",
      bandNone: "Pick one to go on. Four bands, cheapest to dearest. A band is not a price and none is printed anywhere.",
      minShort: "{count} min",
      hoursShort: "{count} h",
      oneDay: "1 day",
      holdNote: "A confirmed table is kept for {minutes} after the booked time, then you may give it away.",
      noticeNote:
        "Guests are asked to cancel at least {notice} ahead. A table is free to book and is never paid for in advance: the guest pays the bill at your restaurant, and you mark each table seated or a no-show after its time.",
      note: "Nothing here puts a table on sale. The next screen is your opening hours and how many people you seat, and a person on our team reads the application before the venue goes on the shelf.",
    },
    roomTypes: {
      incomplete: "Give the room type a name and a nightly price to save it.",
      /** `{name}` is the room type. */
      saved: "{name} is saved. Price it on the next screen.",
      noRate: "No rate yet",
      perNight: "{amount} a night",
      nameNote: "What a guest sees when they pick a room.",
      howMany: "How many of this room",
      sleeps: "Guests it sleeps",
      storedNote: "Stored as {amount} a night. The next screen is where the meal plans are priced.",
      priceNote: "What one night in this room costs.",
      save: "Save this room type",
      needOne: "At least one room type is needed before the hotel can go on the shelf, and it needs a rate before a guest can book it.",
      pictureNote: "The picture on each room is the property's cover. This database holds no photograph of a single room type.",
    },
    tables: {
      incomplete: "Open at least one day, count the tables, and close each day after it opens, to save the week.",
      saved: "{days} saved, seating {seats}.",
      sittingNotKept: "The sitting length is not kept yet; it will be once this estate is updated.",
      /** `{day}` is a weekday. */
      openOn: "Open on {day}",
      opens: "Opens",
      closes: "Closes",
      hoursNote:
        "Tap a day’s hours to change them. A day that is off is a day nobody can book. A service stays inside one day, so a kitchen that runs to midnight closes at 11:59 PM.",
      /** `{days}` is a list of weekdays. */
      backwards: "{days}: the closing time is not after the opening time. Set it later, or switch the day off.",
      seatsNow: "That is {seats}, and {count} is the number saved against every day you are open.",
      seatsOnRecord: "{seats} are on record. Count the tables again to change it.",
      seatsHint: "Count the tables and the seats add up. The total is what a reservation is checked against; the breakdown is not kept.",
      sittingNote: "How long a table is the party’s. Guests see it before they ask for a table, and it is saved with your week.",
      needDay: "A restaurant needs at least one open day before the application can be sent.",
      savingWrites: "Saving writes {days} and replaces whatever week was on record.",
    },
  },
  /** What each host screen's loading state says to a screen reader while it waits (D-10). */
  loadingScreens: {
    calendar: "Loading your calendar",
    decide: "Loading the requests waiting for you",
    reviews: "Loading your reviews",
    earnings: "Loading your earnings",
    tables: "Loading your tables",
    rooms: "Loading your rooms",
  },
};
