/**
 * What brings someone to Vallo (the interests picker), the two parts shared
 * code reads on the client: the market names and their one-line hints.
 * Moved out of en.ts so a client module can read them through
 * `@vallo/i18n/en/interests` without the whole dictionary.
 */
export const interestsMarketsEn = {
  apartment: "Apartments",
  hotel: "Hotels",
  home: "Homes",
  villa: "Villas",
  shortlet: "Shortlets",
  rental: "Rentals",
  shop: "Shops",
  office: "Offices",
  land: "Land",
  restaurant: "Restaurants",
};

export const interestsHintsEn = {
  apartment: "Nightly stays in a flat",
  hotel: "Rooms, booked by the night",
  home: "A whole house for your stay",
  villa: "Larger private places",
  shortlet: "A few nights to a few weeks",
  rental: "Somewhere to live, by the year",
  shop: "Retail space, by the year",
  office: "Workspace, by the year",
  land: "Plots to buy or lease",
  restaurant: "Tables at places to eat",
};
