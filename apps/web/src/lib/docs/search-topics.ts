/**
 * The popular topics in the search sheet, and the word marker for results.
 *
 * Chosen from what members ask the support desk (the support topic list in
 * `lib/trust/support-topics.ts` and the help centre's questions): each is a
 * plain link to the page that answers it, so the chips work with no search
 * index and no network.
 */
export const POPULAR_TOPICS: readonly { label: string; href: string }[] = [
  { label: "Cancellation", href: "/docs/refunds-and-cancellations" },
  { label: "Refunds", href: "/docs/refunds-and-cancellations" },
  { label: "What Vallo costs", href: "/docs/what-vallo-costs" },
  { label: "Paying on Vallo", href: "/docs/paying-on-vallo" },
  { label: "Verify my ID", href: "/docs/badges-and-verification" },
  { label: "List my property", href: "/docs/listing-on-vallo" },
  { label: "Make an offer", href: "/docs/making-an-offer" },
  { label: "Viewings", href: "/docs/viewings" },
  { label: "Avoid scams", href: "/safety" },
  { label: "Talk to a person", href: "/contact" },
];

/** Split a snippet into plain and matched parts, matching the query's words case-insensitively. */
export function markWords(text: string, query: string): { text: string; mark: boolean }[] {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return [{ text, mark: false }];
  const pattern = new RegExp(`(${words.join("|")})`, "i");
  /* A split on a capturing group puts every match at an odd index. */
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, mark: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
