/**
 * LISTING STATS: the quiet row under a listing's description ("12 days on
 * Vallo | 340 views | 18 saves"), the same figures on the lister's own rows,
 * and the Listings desk under Analytics (founder, 13 November 2026).
 *
 * English only, read straight from this module (`@vallo/i18n/en/listing-stats`)
 * like the share words. Counted phrases are plural forms; the count arrives
 * already formatted (compact above a thousand: "1.2k"), so `{count}` is text.
 */
export const listingStatsEn = {
  /* The row on the listing page, and its group name for a screen reader. */
  rowLabel: "How this listing is doing on Vallo",
  listedToday: "Listed today",
  days: { one: "{count} day on Vallo", other: "{count} days on Vallo" },
  months: { one: "{count} month on Vallo", other: "{count} months on Vallo" },
  years: { one: "{count} year on Vallo", other: "{count} years on Vallo" },
  views: { one: "{count} view", other: "{count} views" },
  saves: { one: "{count} save", other: "{count} saves" },

  /* The lister's own rows on /agent/listings. */
  agentLabel: "Views, saves and time live for this listing",
  agentLive: { one: "{count} day live", other: "{count} days live" },
  agentLiveToday: "Live today",
  agentNoViews: "No views yet",

  /* The Listings desk under Analytics. Staff copy. */
  desk: {
    title: "Listing analytics",
    lede: "Views, saves, enquiries and viewing requests on real listings, by day, by listing, by area and by lister. Examples and staff are left out.",
    navLabel: "Listings",
    range7: "Last 7 days",
    range30: "Last 30 days",
    range90: "Last 90 days",
    rangeShort7: "7 days",
    rangeShort30: "30 days",
    rangeShort90: "90 days",
    rangeLabel: "Range",
    vsPrevious: "vs the period before",
    views: "Views",
    saves: "Saves",
    enquiries: "Enquiries",
    viewings: "Viewing requests",
    viewToSave: "View to save",
    viewToEnquiry: "View to enquiry",
    viewToViewing: "View to viewing request",
    conversionTitle: "From a view to the next step",
    conversionNote: "Each step as a share of views in the same range. A view is one person opening a listing on one day.",
    viewsPerDay: "Views per day",
    viewsPerWeek: "Views per week",
    actionsPerDay: "Saves, enquiries and viewing requests per day",
    actionsPerWeek: "Saves, enquiries and viewing requests per week",
    topByViews: "Top listings by views",
    topBySaves: "Top listings by saves",
    byArea: "By area",
    byLister: "By lister",
    listing: "Listing",
    area: "Area",
    lister: "Lister",
    listings: "Listings",
    open: "Open",
    nothingTitle: "Nothing counted in this range yet",
    nothingFills: "Views fill this when people open real listings; saves, enquiries and viewing requests fill it as they happen.",
    nothingCreates: "A view is counted once per person per listing per day, after the page has been on screen for a second.",
    notInstalledTitle: "Listing stats are not switched on yet",
    notInstalledFills: "The figures start when the pending listing stats migration is applied.",
    notInstalledCreates: "Until then nothing is counted and no listing shows a stats row.",
    detailTitle: "Listing analytics: {title}",
    detailLede: "This listing's views, saves, enquiries and viewing requests by day.",
    lifetimeViews: "Views since counting began",
    currentSaves: "Saves now",
    daysOnVallo: "Time on Vallo",
    notLive: "Unpublished",
    example: "Example listing: never counted",
    back: "All listings",
    since: "Views are counted for members since 28 September 2026 and for everyone since the listing stats migration.",
  },
} as const;

export type ListingStatsWords = typeof listingStatsEn;
