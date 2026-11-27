/**
 * Session 3's copy for space, stay and restaurant detail (W3).
 *
 * One module per owner so nine agents can add strings without editing en.ts
 * at the same time. English only: ha, ig and yo fall back to it through
 * `withFallback` until a translator supplies a line, because an invented
 * translation of a new line is worse than none. Money sentences never live
 * here; they come from `lib/money/copy.ts` (Session 2).
 */
export const experienceDetailEn = {
  /* The space detail's sections, for the anchor row and the InnerNav list. */
  sections: {
    navLabel: "Sections of this space",
    toggle: "Open the list of sections",
    overview: "Overview",
    costs: "Costs",
    amenities: "Amenities",
    trust: "Trust",
    location: "Location",
    reviews: "Reviews",
    details: "The details",
    photos: "Photos",
    walkthrough: "Walkthrough",
    agent: "Who lists it",
  },
  /* The itemised breakdown's quiet second layer. The rows and the total are
     never behind it; only the notes on how the figures are read. */
  breakdown: {
    howRead: "How these figures are read",
    howReadHint: "Who keeps what, and the state's published limits",
    /* True Cost as a bill (PREMIUM-STANDARD reference 8): three small
       figures over the lines, and three equal actions under the total. */
    stripLabel: "This bill at a glance",
    stripRent: "Rent",
    stripFees: "Fees",
    stripBack: "Refundable",
    actionsLabel: "What you can do with this breakdown",
    ledger: "Ledger",
    ledgerLabel: "Open the full move-in ledger",
    share: "Share",
    shareLabel: "Share this listing",
    ask: "Ask",
    askLabel: "Ask the lister about a cost",
  },
  /* The Map tab inside a listing (the travel-app set): a still map of the
     area, "getting there" figures only where both ends are known, and the
     Preview and Photo tour tiles. */
  map: {
    tab: "Map",
    title: "Map and getting there",
    areaOnly: "The pin shows the area, not the address. The exact place is shared once a viewing is confirmed.",
    mapOf: "Map of {area}",
    airport: "To {name}",
    airportBasis: "In a straight line from {area}",
    km: "km",
    preview: "Preview",
    previewHint: "Walkthrough video",
    photoTour: "Photo tour",
    photoTourHint: "{count} photographs",
    copyAddress: "Copy address",
    openInMaps: "Open in Maps",
  },
  /* The shelf at the foot of a listing: real listings like this one, from the
     same catalogue search reads. Drawn only when there is at least one. */
  similar: {
    title: "More like this",
    seeAll: "See all",
  },
  /* Power, water and the meter, as rows marked with the real objects. */
  utilities: {
    prepaidMeter: "Prepaid meter",
    prepaidMeterBody: "You buy units rather than settle a shared bill",
    /* Light, water and the gate (ListingUtilities), moved out of the
       component (Round 3 sweep, C3). `{backup}` is a backup phrase, `{hours}`
       a counted number of hours, `{grid}` a grid label, `{runs}` the backup
       line. */
    light: "Light",
    water: "Water",
    gate: "The gate",
    grid: {
      BAND_A: { label: "Band A", detail: "20 hours a day or more from the grid" },
      MOSTLY_ON: { label: "Mostly on", detail: "Light most of the day, with gaps" },
      PATCHY: { label: "Patchy", detail: "On and off through the day" },
      RARELY: { label: "Rarely on", detail: "A few hours at best" },
      NONE: { label: "No grid supply", detail: "Nothing from the distribution company" },
    },
    /* The backup as it belongs inside a sentence, article and all. */
    backup: {
      NONE: "no backup",
      GENERATOR: "a generator",
      INVERTER: "an inverter",
      SOLAR: "solar",
      GENERATOR_INVERTER: "a generator and inverter",
    },
    supply: {
      TREATED_MAINS: { label: "Treated mains", detail: "Running water from the mains" },
      BOREHOLE: { label: "Borehole", detail: "The property's own borehole" },
      PUMPED_STORAGE: { label: "Pumped storage", detail: "Tank filled and pumped through" },
      TANKER: { label: "Tanker delivery", detail: "Water is bought in and stored" },
      NONE: { label: "No running water", detail: "Water is fetched" },
    },
    runs: "{backup}, running {hours} a day",
    gridWith: "{grid}, with {runs}",
    gridNotStated: "Grid supply not stated",
    notAnswered: "The agent has not answered this yet. Ask them before you commit, rather than assuming either way.",
    securityDesk: "Security desk:",
    accessCode: "Access code:",
    gated: "Gated, with the details released on confirmation",
    gatedConfirmed: "Your booking is confirmed. Open it from your bookings to see the gate details.",
    gatedBefore: "The estate name, what to tell security, the desk number and any code arrive here the moment your booking is confirmed. They are never shown publicly, which is what stops a listing being used to case a property.",
  },
  /* "Why trust this space?": dated facts only, never a tick. */
  trust: {
    title: "Why trust this space?",
    lede: "Each check carries the date it happened. A check that has not happened is not listed here.",
    open: "See every check, with its date",
    inspected: "Inspected by Vallo",
    addressChecked: "Address checked",
    none: "No check on this space carries a date yet. Each one appears here, dated, on the day it happens.",
    noneAction: "Ask the lister a question",
    whoLists: "Who lists it",
  },
  /* What a space that takes no requests says, with no label on it (D24). */
  closed: {
    body: "This space is not taking requests on Vallo. Save a search for {area} and we will tell you when a space there opens for one.",
    action: "More spaces in {area}",
    stayBody: "This stay is not taking bookings on Vallo. Other stays nearby are a tap away.",
    stayAction: "More stays",
    rooms: "These rooms are not taking bookings on Vallo.",
    restaurantBody: "This restaurant is not holding tables on Vallo. Other restaurants nearby are a tap away.",
    restaurantAction: "More restaurants",
  },
  /*
   * A restaurant's opening hours on the Lagos clock (lib/stays/hours.ts), on
   * its card and its page (C9, moved word for word). `{time}`, `{opens}` and
   * `{closes}` are 24-hour clock times, "18:00".
   */
  hours: {
    /* No timetable published at all: NOT "Closed today", which would be a claim. */
    unknown: "Hours not published",
    openUntil: "Open until {time}",
    closedToday: "Closed today",
    opensAt: "Opens at {time}",
    closedForToday: "Closed for today",
    /* One weekday's hours: each window, joined. */
    closed: "Closed",
    range: "{opens} to {closes}",
  },
  /* The table window picker on a restaurant. */
  window: {
    closedThatDay: "Not seating on this day. Pick another day.",
    /* Today, after the last seating: the restaurant does seat on this weekday,
       the clock has passed its last time. Said apart from "closed". */
    noTimesLeftToday: "No times left today. Pick another day.",
    withinHours: "Times inside the hours this restaurant publishes",
  },
  /* The stay's lead: the nightly rate, then the total for the dates. */
  stay: {
    forDates: "{total} for {nights}",
    /* The stay's class and kind, and the share card's line (Round 3 sweep,
       C3). `{count}` the stars, `{where}` the area and city. */
    stars: "{count} star",
    kinds: {
      hotel: "Hotel",
      serviced_apartments: "Serviced apartment",
      guest_house: "Guest house",
      resort: "Resort",
      shortlet_operator: "Shortlet",
    },
    host: "Host",
    shareWhere: "A stay in {where}, on Vallo.",
    shareNone: "A stay on Vallo.",
  },
  /**
   * `/restaurant/[id]`: the sentences the route assembles from a venue's own
   * fields when the venue wrote no description, and the share card's line
   * (Round 3 sweep, C3). `{name}` the venue, `{where}` its area and city,
   * `{cuisine}` the first cuisine it lists.
   */
  restaurant: {
    aboutWhereServes: "{name} is in {where} and serves {cuisine}.",
    aboutWhere: "{name} is in {where}.",
    aboutServes: "{name} serves {cuisine}.",
    aboutName: "{name}.",
    shareWhere: "{name}, {where}. Ask for a table on Vallo.",
    shareName: "{name}. Ask for a table on Vallo.",
  },
  /**
   * `/listing/[id]`, the space detail: the page's own words (Round 3 sweep,
   * C3). The sentences about paying are lib/money/copy.ts's. `{title}` the
   * listing, `{kind}` its kind with its article, `{where}` the place,
   * `{bedrooms}` and `{bathrooms}` counted phrases, `{list}` a joined list,
   * `{n}` a number.
   */
  listing: {
    market: {
      tenancy: "For rent",
      sale: "For sale",
      stay: "For stays",
      dining: "Dining",
      experience: "Experience",
    },
    /* The kind as the first sentence names it, article included. */
    kinds: {
      hotel: "a hotel",
      apartment: "an apartment",
      home: "a home",
      shortlet: "a shortlet",
      villa: "a villa",
      restaurant: "a restaurant",
      experience: "an experience",
      rental: "a home to rent",
      shop: "a shop to rent",
      office: "an office to rent",
      land: "a plot of land",
    },
    aboutRooms: "{title} is {kind} with {bedrooms} and {bathrooms} in {where}.",
    aboutBeds: "{title} is {kind} with {bedrooms} in {where}.",
    aboutKind: "{title} is {kind} in {where}.",
    amenities: {
      pool: "a swimming pool",
      wifi: "Wi-Fi",
      kitchen: "a fitted kitchen",
      parking: "parking on site",
    },
    amenitiesInclude: "Amenities include {list}.",
    agentChecked: "A person at Vallo checked the ID of the agent behind this listing.",
    instantBookOn: "Instant Book is available on this listing, so your dates confirm as soon as you reserve.",
    instantBookOff: "The agent confirms each booking request personally, so allow a little time for a response.",
    sleeps: "It sleeps up to {guests}.",
    rated: "Guests have rated it {rating} out of 5 across {count} {reviews}.",
    messageAgent: "Message agent",
    facts: {
      floorArea: "Floor area",
      furnishing: "Furnishing",
      condition: "Condition",
      yearBuilt: "Year built",
      toilets: "Toilets",
      parking: "Parking",
      parkingNone: "None",
      floor: "Floor",
      groundFloor: "Ground floor",
      floorN: "Floor {n}",
      ofN: "of {n}",
      availableFrom: "Available from",
      minimumTenancy: "Minimum tenancy",
    },
    instantBook: "Instant Book",
    negotiable: "Price negotiable",
    buyingTitle: "What you would be buying",
    utilitiesTitle: "Light, water and getting in",
    utilitiesBody: "The three things worth knowing before you commit: what the agent says, and what residents report where enough have answered.",
    detailsTitle: "The details",
    walkthroughTitle: "Walkthrough",
    cancellationTitle: "Cancellation policy",
    cancellationHint: "What you get back, and when",
  },
};
