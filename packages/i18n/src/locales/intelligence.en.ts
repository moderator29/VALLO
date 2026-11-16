/**
 * The words of VALLO Intelligence (16 November 2026): the one search and
 * discovery screen across homes, stays, restaurants, roommates, people and
 * the rest of Vallo. English only; the other three locales fall back.
 *
 * Plain short sentences. No invented numbers: a count is always a real
 * record's, through the counted phrases below. `{query}` and `{place}` are
 * filled by the screen.
 */
export const intelligenceEn = {
  name: "VALLO Intelligence",
  description: "Search across homes, stays, restaurants, roommates and people on Vallo.",
  wordmark: "Vallo",
  title: "What are you looking for?",
  lede: "Search across everything VALLO.",
  /* The small mark over the title. */
  mark: "VALLO Intelligence",
  /* Over the title for a member with a first name, by the Lagos daypart. */
  greeting: {
    morning: "Good morning, {name}.",
    afternoon: "Good afternoon, {name}.",
    evening: "Good evening, {name}.",
    night: "Good evening, {name}.",
  },

  /* Speaking a search, where the browser can turn speech into words. */
  voice: {
    start: "Search by voice",
    stop: "Stop listening",
    listening: "Listening...",
    blocked: "Allow the microphone to search by voice.",
    note: "Your browser turns your voice into words. On some browsers, Chrome among them, the sound goes to the browser's maker to do it. Nothing is searched until you press search.",
  },

  /* The model step, shown only while Vallo AI is reading a long search. */
  thinking: {
    reading: "Reading your words",
    readBy: "Read with Vallo AI",
  },

  /* Moods: each is a search the engine reads into real filters. */
  moods: {
    title: "Start with a mood",
    items: {
      work: { label: "Work from home", query: "homes with wifi and a workspace" },
      family: { label: "Room for family", query: "3 bedroom homes" },
      weekend: { label: "A weekend away", query: "shortlets this weekend" },
      pool: { label: "Pool days", query: "homes with a pool" },
      power: { label: "Light all day", query: "homes with a generator" },
    },
  },

  /* City postcards: only cities the newest listings are in. */
  cities: {
    title: "Where the new places are",
    open: "Explore {city}",
    explore: "Explore",
  },

  /* The pill over the tab bar on a phone. */
  askPill: "Ask VALLO Intelligence",

  /* The field. */
  fieldLabel: "Search VALLO",
  /* Rotating examples in the empty field. Examples, not promises. */
  examples: [
    "2-bedroom apartment in Lekki...",
    "Hotels in Abuja this weekend...",
    "Find a roommate around Yaba...",
    "Restaurants in Victoria Island...",
    "Agents in Ibadan...",
  ],
  go: "Search",
  close: "Close",
  clear: "Clear the search",
  shortcutMac: "Cmd K",
  shortcutOther: "Ctrl K",
  shortcutLabel: "Keyboard shortcut",

  /* The category chips under the field. */
  categoriesLabel: "Search in",
  categories: {
    property: "Properties",
    stay: "Stays",
    restaurant: "Restaurants",
    roommate: "Roommates",
    person: "People",
  },

  /* The tabs on the results. */
  tabsLabel: "Result types",
  tabs: {
    all: "All",
    property: "Properties",
    stay: "Stays",
    restaurant: "Restaurants",
    roommate: "Roommates",
    person: "People",
    community: "Communities",
    guide: "Guides",
    personal: "Yours",
  },
  /* A group's heading on the All tab, by kind. */
  kinds: {
    place: "Places",
    property: "Properties",
    stay: "Stays",
    restaurant: "Restaurants",
    roommate: "Roommates",
    person: "People",
    community: "Communities",
    post: "Posts",
    screen: "Go to",
    guide: "Guides",
    personal: "Yours",
  },
  /* The marketplace's listing kinds, as a "Search understood" chip says them. */
  listingKinds: {
    hotel: "Hotels",
    shortlet: "Short lets",
    apartment: "Apartments",
    home: "Homes",
    villa: "Villas",
    rental: "Rentals",
    land: "Land",
    shop: "Shops",
    office: "Offices",
    restaurant: "Restaurants",
  } as Record<string, string>,
  seeAll: "See all",
  seeAllLabel: "See all {kind}",
  seeAllProperties: "See all properties on Search",

  /* The typed-ahead list. */
  suggest: {
    label: "Suggestions",
    groups: {
      query: "Searches",
      recent: "Recent",
      place: "Places",
      listing: "Listings",
      person: "People",
      screen: "Go to",
      other: "More",
    },
    searchFor: "Search for “{query}”",
    didYouMean: "Did you mean {query}?",
  },

  /* The empty screen. */
  recent: {
    title: "Recent searches",
    clear: "Clear all",
    clearLabel: "Clear all recent searches",
    remove: "Remove {query} from recent searches",
    cleared: "Recent searches cleared.",
    removeFailed: "That did not work. Try again.",
  },
  suggested: {
    title: "Suggested for you",
    exploreAll: "Explore all",
    showFewer: "Show fewer",
    rows: {
      rent: { title: "Homes to rent", sub: "Flats, duplexes and rooms across Nigeria" },
      weekend: { title: "Stays this weekend", sub: "Short lets and hotels for a few nights" },
      roommate: { title: "Find a roommate", sub: "Share a home and split the costs" },
      restaurants: { title: "Restaurants", sub: "Places to eat, by area" },
      circle: { title: "Vallo Circle", sub: "Ask the community about homes and areas" },
      people: { title: "Find people", sub: "Agents, landlords and hosts on Vallo" },
    },
    weekendQuery: "stays this weekend",
  },
  trySearching: {
    title: "Try searching",
    examples: ["2-bed in Lekki", "Hotels this weekend", "Restaurants near me"],
  },
  popular: { title: "Popular searches" },
  fresh: { title: "Fresh on Vallo", hint: "The newest listings, stays and restaurants" },
  people: {
    title: "People to follow",
    you: "You",
    open: "Open {name}",
    roles: {
      agent: "Agent",
      landlord: "Landlord",
      host: "Host",
      hotel: "Hotel",
      restaurant: "Restaurant",
      member: "Member",
      firm: "Agency",
      owner: "Owner",
    },
  },

  /* The results. */
  understood: {
    title: "Search understood",
    remove: "Remove {filter}",
    edit: "Edit filters",
    clear: "Clear",
    clearLabel: "Clear all filters",
    rent: "To rent",
    buy: "To buy",
    stay: "Stays",
    bedrooms: { one: "{count} bedroom", other: "{count} bedrooms" },
    guests: { one: "{count} guest", other: "{count} guests" },
    under: "Under {price}",
    over: "Over {price}",
    between: "{min} to {max}",
    furnished: "Furnished",
    unfurnished: "Unfurnished",
    dates: "{from} to {to}",
    from: "From {date}",
    since: "Added since {date}",
    words: "“{words}”",
  },
  didYouMean: {
    question: "Searching for {query}?",
    accept: "Search {query}",
    keep: "Keep {query}",
  },
  /* The engine searched its spelling fix because the words as typed found nothing. */
  showing: {
    line: "Showing results for {query}.",
    instead: "Search instead for {query}",
  },
  clarifyLabel: "A quick question",
  partial: "Some results could not load. Showing the rest.",
  showMore: "Show more",
  loadingMore: "Loading more",
  yours: "Yours",
  goTo: "Go to",
  guide: "Guide",
  verified: "Verified",
  whyLabel: "Why it matches",
  per: { month: "a month", year: "a year", night: "a night", once: "one-off" },
  counted: {
    follower: { one: "{count} follower", other: "{count} followers" },
    member: { one: "{count} member", other: "{count} members" },
    listing: { one: "{count} listing", other: "{count} listings" },
    post: { one: "{count} post", other: "{count} posts" },
    review: { one: "{count} review", other: "{count} reviews" },
  },
  results: { one: "{count} result", other: "{count} results" },

  /* Honest states. */
  loading: "Searching",
  loadingDiscover: "Loading suggestions",
  errorTitle: "Search did not load",
  errorBody: "Something went wrong on our side. Your search is still here.",
  retry: "Try again",
  offlineTitle: "You are offline",
  offlineBody: "Search needs a connection. It will work again once you are back online.",
  emptyTitle: "No results for “{query}”",
  emptyWarm: "Every door opens somewhere. Let us try another way in.",
  emptyBody: "Try a broader search, or one of these.",
  emptyNoAlternatives: "Try fewer words, a nearby area or a higher budget.",
  browsePopular: "Browse popular",
  discoverEmpty: "Start typing to search homes, stays, restaurants, roommates and people.",

  /* The filters drawer. */
  filters: {
    title: "Filters",
    open: "Filters",
    apply: "Show results",
    reset: "Reset",
    place: "Area or city",
    placeHint: "For example Lekki, Lagos",
    intent: "Looking to",
    intentAny: "Any",
    intentRent: "Rent",
    intentBuy: "Buy",
    bedrooms: "Bedrooms",
    bedroomsAny: "Any",
    minPrice: "Lowest price (₦)",
    maxPrice: "Highest price (₦)",
    furnished: "Furnished only",
    checkIn: "Check in",
    checkOut: "Check out",
    guests: "Guests",
  },

  /* The compact assistant panel. */
  assist: {
    open: "Intelligence",
    openLabel: "Open the Intelligence panel",
    title: "Intelligence",
    lede: "Quick help with this search. Each one opens Vallo AI with your search filled in.",
    ledeEmpty: "Ask Vallo AI where to find something on Vallo, or search first for help with results.",
    suggestFilters: "Suggest filters",
    suggestFiltersSub: "Narrow this search down",
    suggestFiltersAsk: "Help me narrow down my Vallo search for “{query}”. Which filters should I add?",
    explain: "Explain these filters",
    explainSub: "What each one does",
    explainAsk: "Explain these Vallo search filters in plain words: {filters}.",
    compare: "Compare two results",
    compareSub: "{first} and {second}",
    compareAsk: "Compare these two on Vallo for me: “{first}” and “{second}”.",
    places: "Alternative places",
    placesSub: "Nearby areas worth a look",
    placesAsk: "Which areas near {place} should I also look at for “{query}”?",
    placesAskNoPlace: "Which areas should I look at for “{query}”?",
    whereFind: "Where do I find...",
    whereFindSub: "Any screen or setting on Vallo",
    whereFindAsk: "Where do I find this on Vallo: ",
    tryInstead: "Try instead",
    note: "Vallo AI reads only what you send it.",
  },

  /* The launcher on Home. */
  launcher: {
    label: "Open VALLO Intelligence",
    hint: "Search everything VALLO",
  },

  /* The entries elsewhere in the app. */
  entry: {
    nav: "VALLO Intelligence",
    createDock: "VALLO Intelligence",
    createDockSub: "Search and discover across Vallo",
  },
};
