/**
 * Session 3's copy for home, search, stays, restaurants, price, areas and saved (W2).
 *
 * One module per owner so nine agents can add strings without editing en.ts
 * at the same time. English only: ha, ig and yo fall back to it through
 * `withFallback` until a translator supplies a line, because an invented
 * translation of a new line is worse than none. Money sentences never live
 * here; they come from `lib/money/copy.ts` (Session 2).
 *
 * One sub-object per surface, so the agents working each surface add lines
 * inside their own block and never edit the same line twice.
 */
export const experienceDiscoverEn = {
  /** The discovery empty state: the object, the honest reason, the demand capture. */
  empty: {
    /* The one capture every empty shelf shares: a brief that listers answer
       with a real listing. The words are the brief's own (frontDoor.briefs). */
    captureLead: "Tell us what you need and listers who have it answer with a listing.",
  },
  home: {
    /* The lead figure: the account's own saved spaces, never a zero. */
    savedCaption: "On your shortlist",
    savedUnitOne: "space saved",
    savedUnitMany: "spaces saved",
    savedOpen: "Open your shortlist",
    savedCompare: "Compare two side by side",
    /* The space types row, ordered by what the person said they came for. */
    typesTitle: "Browse by space",
    typesForYou: "Spaces for you",
    typesLabel: "Space types",
    typesMine: "You said",
    typesEdit: "Change",
    types: {
      rental: "Rentals",
      apartment: "Apartments",
      home: "Houses",
      villa: "Villas",
      land: "Land",
      shop: "Shops",
      office: "Offices",
    },
    featuredForYou: "The kinds you said you came for come first. Search or filter and the order is everybody's.",
    /* The greeting for somebody signed out, and the city row under it
       (HomeScreen, CityRow), moved out of the components (Round 3 sweep, C3).
       `{city}` is the place. */
    welcome: "Welcome to Vallo",
    /* The greeting over a name, by the Lagos daypart (`daypartFor`), and the
       name when a signed-in account has no first name (C9, moved word for
       word from lib/app/home-queries.ts and the two home screens). */
    greeting: {
      morning: "Good morning,",
      afternoon: "Good afternoon,",
      evening: "Good evening,",
      night: "Good evening,",
    },
    there: "there",
    signIn: "Sign in",
    signInRest: "and this screen becomes yours: your city, your places, your name.",
    chooseCity: "Choose your city",
    setYours: "Set yours to see what is happening around you",
    yourCityAria: "Your city is {city}. Change it.",
    chooseCityAria: "Choose the city you explore from.",
  },
  search: {
    /* The page's one heading, read by assistive tech (Round 3 sweep, C3).
       `{q}` is what was typed, `{kind}` the kind's plural noun. */
    headingQuery: "Results for {q}",
    headingKind: "Explore {kind}",
    headingAll: "Explore properties",
    noMatchTitle: "No spaces matched",
    noMatchBody: "Your filters are narrower than what is listed right now. Widen them and the results come straight back.",
    noWordsTitle: "Nothing matches those words",
    noWordsBody: "Nothing listed matches what you typed yet. Try a neighbourhood, a city or a state.",
    emptyTitle: "Nothing listed here yet",
    emptyBody: "Owners and agents are still listing. A space appears here the minute it goes live, with nothing to wait for on your side.",
    clearFilters: "Clear filters",
    clearSearch: "Clear this search",
    listYourPlace: "List your place",
    howItWorks: "How Vallo works",
    waiting: "{count} {noun} waiting without them",
    /* The empty shelf's one next change (round 5, components/app/search/
       next-change.ts): the single filter whose removal brings the most places
       back, named as the action. `{area}` is the area as the chips print it. */
    next: {
      price: "Drop the price range",
      beds: "Drop the bedroom minimum",
      baths: "Drop the bathroom minimum",
      market: "Search to rent and to buy",
      kind: "Search every property type",
      verified: "Include places not yet verified",
      amenities: "Drop the amenities",
      utilities: "Drop the light and water filters",
      lister: "Drop who is listing",
      compound: "Drop the compound filters",
      service: "Drop serviced and gated",
      upfront: "Drop the upfront limit",
      shape: "Drop the home shape",
      flood: "Drop “no flooding reported”",
      commute: "Drop the commute limit",
      area: "Look beyond {area}",
    },
    intentNote: "{kinds} first, because that is what you said you came for. Search or filter and this stops.",
  },
  stays: {
    /* The area figure hero, drawn only once its read exists (W2-R3). */
    areaCaption: "Listed in {place}",
    staysOne: "stay",
    staysMany: "stays",
    fromNight: "From",
  },
  price: {
    /* The area figure and chart (`AreaAskingChart`): every figure is the read's own. */
    chart: {
      segmentsLabel: "Property type",
      middleCaption: "Middle asking price, {what}",
      middleWhat: "{bedrooms} bedroom {type}",
      studioWhat: "studio {type}",
      range: "The middle half ask between {low} and {high}.",
      basis: "From {count} listings.",
      basisOne: "From {count} listing.",
      chartLabel: "Middle asking price by size, {type}",
      chartSummary: "One bar per size; a hatched bar is a size with too few listings to publish a range.",
      periodHead: "Size",
      valueHead: "Middle asking price",
      thinCell: "Too few to say",
      thinNote: "A hatched bar is a size we hold too few listings of to publish a range. We do not guess.",
      studioTick: "Studio",
      bedTick: "{bedrooms} bed",
    },
  },
  map: {
    /* The listing with no pin, and the empty viewport (B-27). */
    noPinOne: "{count} place has no pin yet",
    noPinMany: "{count} places have no pin yet",
    noPinList: "See them in the list",
    emptyTitle: "No places here",
    emptyArea: "No place sits inside this part of the map. Zoom out or show every place.",
    emptySearch: "This search matched no place we can put on the map.",
    emptyAction: "Show every place",
    /* The line under the map (MapCanvas), moved out of the component (Round
       3 sweep, C3): the tiles that did not load, the joiner between two
       credits, and the pins that mark an area. */
    imageryOffline: "Map imagery could not load. Every place is still placed by its area.",
    creditJoin: " and ",
    approximate: " · Pins show the area, not the address.",
  },
  /* The search field as a command palette (command-search-palette.jpg):
     the rows a typed query offers. `{q}` is what was typed. */
  palette: {
    label: "Search suggestions",
    searchFor: "Search for “{q}”",
    rentIn: "Homes to rent in {q}",
    buyIn: "Homes to buy in {q}",
    enter: "Enter",
  },
  /* Featured listings on home as a card stack (the travel-app set). `{at}`
     and `{count}` are numbers; `{title}` a listing's name; `{area}` a place. */
  stack: {
    label: "Featured listings, one card at a time",
    position: "{at} of {count}",
    previous: "Previous listing",
    next: "Next listing",
    open: "Open {title}",
    reviews: "reviews",
    mapOf: "Map of {area}. The pin shows the area, not the address.",
  },
  /* Saved as shelves (before-after-collection-shelves.jpg). */
  shelf: {
    verified: "Verified",
  },
  saved: {
    /* The head-to-head of north star 15.3: two of your own saved spaces. */
    pickTwo: "Choose two of your saved spaces to set side by side.",
    pickSwap: "Two at a time. The first one you chose made way.",
    lower: "Lower",
    emptyTitle: "Nothing saved yet",
    emptyBody: "Tap the heart on any card and it waits for you here, ready to compare side by side.",
    hydratingTitle: "Bringing your saves together",
    hydratingBody: "Places you hearted on this device are being matched to your account. This takes a moment.",
    emptyAction: "Find a place",
    captureLead: "Keep a search instead, and we tell you when something new fits it.",
    capture: "Your saved searches",
    /* The header link to /saved/searches, and the page title (Round 3 sweep, C3). */
    searchesLink: "Saved searches",
    /* The quiet action under each saved card and the undo chip that takes
       its place (SavedBoard); they were English literals in the component. */
    remove: "Remove",
    removeLabel: "Remove from saved",
    removed: "Removed from saved",
    restoring: "Putting it back",
    undo: "Undo",
    searchesRetry: "Try again",
    /* One saved search on the board (SavedSearchBoard), moved out of the
       component (Round 3 sweep, C3). `{date}` is when it was saved. */
    board: {
      savedOn: "Saved {date}",
      namedFromFilters: ". Named from its filters.",
      alertsOn: "We will tell you when a new place matches this.",
      alertsOff: "Alerts off. The search is still saved.",
      nameNeeded: "Give this search a name.",
      renamed: "Renamed",
      nameLabel: "Name this search",
      saveName: "Save name",
      cancel: "Cancel",
      alertLabel: "Tell me about new matches",
      rename: "Rename",
      removeConfirm: "Remove it",
      keep: "Keep",
      remove: "Remove",
    },
    /* Saved searches, whose empty face is its most-seen face. */
    searchesSignedOutTitle: "Sign in to keep a search",
    searchesSignedOutBody: "A saved search belongs to an account, so it follows you between your phone and your laptop and nobody else can see what you are looking for.",
    searchesSignIn: "Sign in",
    searchesBrowse: "Browse without an account",
    searchesEmptyTitle: "Keep a search and we will watch it",
    searchesEmptyBody: "Filter the results down to the place you want, then save that search. It waits here under the name you give it, and we tell you when something new fits it.",
    searchesStart: "Start a search",
    searchesPlaces: "Your saved places",
  },
};
