import type { ListingReviewView } from "@/lib/admin/queries";
import type { ListingReviewExtras } from "../../_review/contracts";
import type { SectionLink } from "../../_review/parts";
import { placeLine } from "../rows";
import type { ListingSection } from "./review-data";

type Raw = Record<string, string | string[] | undefined>;

/** The query the desk carries (queue filter and place), kept across every page of one review. */
function carry(raw: Raw, tab?: ListingSection): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (key !== "tab" && typeof value === "string" && value) q.set(key, value);
  }
  if (tab) q.set("tab", tab);
  const text = q.toString();
  return text ? `?${text}` : "";
}

export const listingHubHref = (id: string, raw: Raw) => `/admin/listings/${id}${carry(raw)}`;
/** One review, one page: the parts are tabs on it, carried in `?tab=`. */
export const listingSectionHref = (id: string, section: ListingSection, raw: Raw) =>
  `/admin/listings/${id}${carry(raw, section)}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function listingSectionLinks({
  listing,
  extra,
  provenance,
  feeAcceptance,
  raw,
}: {
  listing: ListingReviewView;
  extra: ListingReviewExtras | null;
  provenance: unknown;
  feeAcceptance: unknown;
  raw: Raw;
}): SectionLink[] {
  void provenance;
  void feeAcceptance;
  const href = (section: ListingSection) => listingSectionHref(listing.id, section, raw);
  const failing = listing.checks.filter((check) => !check.pass).length;
  const media = [
    listing.photos.length ? plural(listing.photos.length, "photo", "photos") : null,
    listing.videos.length ? plural(listing.videos.length, "video", "videos") : null,
  ].filter(Boolean);
  const links: SectionLink[] = [
    { key: "photos", href: href("photos"), title: "Photos", icon: "picture", summary: media.length ? media.join(", ") : "None uploaded" },
    { key: "details", href: href("details"), title: "Property details", icon: "house", summary: "Rooms, size, condition, power, water, amenities, description" },
    { key: "location", href: href("location"), title: "Location", icon: "location", summary: placeLine(listing) || "No place given" },
    { key: "costs", href: href("costs"), title: listing.intent === "sale" ? "Purchase costs" : "Move-in costs", icon: "coins", summary: "What the renter or buyer pays, and to whom" },
    { key: "lister", href: href("lister"), title: "Lister", icon: "verified", summary: listing.agentName ?? "Lister" },
    {
      key: "checklist",
      href: href("checklist"),
      title: "Checklist",
      icon: "clipboard-list",
      summary: `${listing.checks.length - failing} of ${listing.checks.length} pass`,
      flag: failing > 0 ? `${failing} need a look` : null,
    },
    { key: "fees", href: href("fees"), title: "Fee terms", icon: "file-text", summary: "The terms on record for this listing" },
  ];
  if (!extra?.isDemo) {
    links.push({ key: "matches", href: href("matches"), title: "Same property", icon: "building-apartment", summary: "Listings that may be this same flat" });
  }
  links.push({ key: "notes", href: href("notes"), title: "Notes", icon: "pencil", summary: "Staff only; the member never sees them" });
  return links;
}
