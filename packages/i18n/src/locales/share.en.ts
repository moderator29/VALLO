/**
 * The share composer's words (9 November 2026). The card a member builds to
 * send a profile, a listing, a group or a post. Plain, honest: a stat says
 * only what it counts, never a claim about anyone.
 */
export const shareCardEn = {
  title: "Share",
  background: "Background",
  share: "Share",
  stats: "Stats",
  name: "Name",
  copied: "Link copied",
  makeCard: "Make a share card",
  yours: "Yours",
  presetsTab: "Presets",
  darken: "Darken",
  /* The card-variant tabs: what the card leads with. */
  leads: {
    profile: "Profile",
    stats: "Stats",
    listing: "Listing",
    price: "Price",
    group: "Group",
  },
  /* Preset background labels. */
  presets: { glow: "Brand glow", brand: "Brand", ink: "Night", cover: "Photo" },
  profileStats: { followers: { one: "1 follower", other: "{count} followers" }, posts: { one: "1 post", other: "{count} posts" } },
  listingStats: { perMonth: "a month", roomsFree: { one: "1 room free", other: "{count} rooms free" }, perPerson: "each" },
};

export type ShareCardEn = typeof shareCardEn;
