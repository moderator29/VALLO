/**
 * Directory copy (SW11). Moved from `lib/directory/model.ts`.
 */

export const directoryKindPluralEn = {
  agent: "Agents",
  landlord: "Landlords",
  firm: "Firms",
  hotel: "Hotels",
  host: "Hosts",
  shortlet: "Shortlets",
};

export const directoryKindOneEn = {
  agent: "Agent",
  landlord: "Landlord",
  firm: "Firm",
  hotel: "Hotel",
  host: "Host",
  shortlet: "Shortlet operator",
};

export const directoryCopyEn = {
  property: {
    title: "Find an agent",
    lede: "Agents, landlords and firms on Vallo. Approved accounts first.",
    search: "Search by name or area",
    emptyCta: { label: "Become an agent", href: "/profile/setup" },
  },
  stays: {
    title: "Find a host",
    lede: "Hotels, hosts and shortlet operators on Vallo. Approved accounts first.",
    search: "Search by name or area",
    emptyCta: { label: "List your stay", href: "/profile/setup?side=stays" },
  },
};
