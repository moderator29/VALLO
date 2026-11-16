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

  /* A category's name, as the tabs and the explore tiles say it. */
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

  /* The explore grid under the field (round 3): one tile per side of Vallo. */
  explore: {
    title: "Explore Vallo",
    tiles: {
      property: { title: "Properties", sub: "Rent, buy and discover" },
      stay: { title: "Stays", sub: "A few nights, anywhere" },
      restaurant: { title: "Restaurants", sub: "Find a table" },
      roommate: { title: "Roommates", sub: "Find your match" },
      person: { title: "People and Circle", sub: "Agents, landlords, hosts and communities" },
    },
  },

  /* A category's own page, opened from its tile. */
  category: {
    back: "All of Vallo",
    backLabel: "Back to everything on Vallo",
    /* The rotating example in the field while a category is open. */
    examples: {
      property: ["2-bedroom flat in Yaba...", "Duplex for sale in Lekki...", "Furnished apartment in Ikeja..."],
      stay: ["Short let in Lekki this weekend...", "Hotel in Abuja for two...", "Serviced apartment in VI..."],
      restaurant: ["Restaurants in Victoria Island...", "Dinner in Ikeja tonight...", "Brunch in Lekki..."],
      roommate: ["Roommate around Yaba...", "Shared flat near Unilag...", "Room to share in Ikeja..."],
      person: ["Agents in Lekki...", "Landlords in Ibadan...", "Hosts in Abuja..."],
    },
    areas: {
      property: "Areas with homes",
      stay: "Areas with stays",
      restaurant: "Areas with restaurants",
    },
    inArea: {
      property: "Homes in {area}",
      stay: "Stays in {area}",
      restaurant: "Restaurants in {area}",
    },
    latest: {
      property: "Newest homes",
      stay: "Newest stays",
      restaurant: "Newest restaurants",
    },
    property: {
      market: "Looking to",
      rent: "Rent",
      buy: "Buy",
      bedrooms: "Bedrooms",
      budget: "Budget",
      any: "Any",
      under: "Under {price}",
      show: "Show homes",
      queryRent: "Homes to rent",
      queryBuy: "Homes to buy",
    },
    stay: {
      when: "When",
      tonight: "Tonight",
      weekend: "This weekend",
      nextWeekend: "Next weekend",
      guests: "Guests",
      show: "Show stays",
      query: "Stays",
    },
    restaurant: {
      browse: { title: "All restaurants", sub: "Menus, tables and opening hours" },
      tonight: { title: "Dinner tonight", sub: "Search tables for this evening" },
      tonightQuery: "restaurants tonight",
    },
    roommate: {
      find: { title: "Find a roommate", sub: "People looking to share a home" },
      post: { title: "Post a room, or yourself", sub: "Say what you have or what you need" },
      safety: { title: "Before you share", sub: "How to meet, check and agree" },
    },
    person: {
      find: { title: "Find people", sub: "Agents, landlords and hosts on Vallo" },
      circle: { title: "Vallo Circle", sub: "Ask the community about homes and areas" },
    },
    /* When a side has no real places yet: said plainly, with a way forward. */
    waiting: {
      property: {
        title: "The first real homes are on their way",
        body: "Vallo only shows homes that are real and published. Tell listers what you need, and the ones who have it can answer with a place.",
        act: "Post what you need",
        lister: "List your property",
      },
      stay: {
        title: "The first real stays are on their way",
        body: "Vallo only shows stays that are real and published. Hosts are setting up now.",
        act: "Look around Stays",
        lister: "Host on Vallo",
      },
      restaurant: {
        title: "The first real restaurants are on their way",
        body: "Vallo only shows restaurants that are real and published. Kitchens are setting up now.",
        act: "Look around Restaurants",
        lister: "Bring your restaurant",
      },
    },
  },

  /* The member's own trail. */
  continue: {
    title: "Continue where you left off",
    lastSearch: "Pick up your search",
    searchedOn: "You searched this on {date}",
    opened: "Opened on this device",
    openedTitle: "Recently opened",
  },

  /* Recommendations for a member, each with the reason it is there. */
  forYou: {
    title: "For you",
    rails: {
      matches: "Picked from what you saved",
      lastSearch: "More like “{query}”",
      newSince: "New since you last looked",
    },
    reasons: {
      areaBudget: "In {area}, within your saved budget",
      areaSaved: "In {area}, like your saved search",
      nearSaved: "Because you saved a home in {area}",
      budget: "Within your saved search's budget",
      saved: "Matches your saved search",
      kind: "Because you said you want {kind}",
      lastSearch: "Like your search “{query}”",
      newSince: "Listed since your search on {date}",
    },
    kindFallback: "places like this",
  },

  /* Areas with the most new real listings. */
  trending: {
    title: "Trending areas",
    hint: "The most new listings in the last 30 days",
  },

  /* Quick changes under the results, from what the search understood. */
  refine: {
    title: "Refine",
    upTo: "Up to {price}",
    anywhereIn: "Anywhere in {city}",
    thisWeekend: "This weekend",
    newThisWeek: "New this week",
    furnished: "Furnished only",
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
  trySearching: {
    title: "Try searching",
  },
  popular: { title: "Popular on Vallo", hint: "What people search for most" },
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
