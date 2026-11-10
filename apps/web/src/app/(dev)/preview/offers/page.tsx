import Link from "next/link";

/** Index of the offers and Deal Room fixture pages. Every figure on them is a fixture. */
const LINKS: [string, string][] = [
  ["/preview/offers/flow?step=1", "Offer flow, step 1, eligible"],
  ["/preview/offers/flow?step=1&gate=blocked", "Offer flow, step 1, requirements not met"],
  ["/preview/offers/flow?step=2&pref=mortgage", "Offer flow, step 2, mortgage"],
  ["/preview/offers/flow?step=2&pref=instalment", "Offer flow, step 2, instalment"],
  ["/preview/offers/flow?step=3", "Offer flow, summary"],
  ["/preview/offers/flow?step=3&gate=blocked", "Offer flow, summary, blocked"],
  ["/preview/offers/list?tab=made", "My offers, Made"],
  ["/preview/offers/list?tab=received", "My offers, Received"],
  ["/preview/offers/list?tab=made&empty=1", "My offers, empty"],
  ["/preview/offers/room?room=buyer_waiting", "Deal Room, buyer waiting"],
  ["/preview/offers/room?room=buyer_counter", "Deal Room, counteroffer waiting on buyer"],
  ["/preview/offers/room?room=seller_respond", "Deal Room, seller to respond"],
  ["/preview/offers/room?room=agreed_buyer&tab=documents", "Deal Room, agreed, documents"],
  ["/preview/offers/room?room=agreed_buyer&tab=negotiation", "Deal Room, agreed, negotiation"],
  ["/preview/offers/room?room=declined", "Deal Room, declined"],
  ["/preview/offers/room?room=buyer_waiting&sent=1", "Confirmation"],
  ["/preview/offers/parts", "Price block, requirements, figures"],
  ["/preview/offers/admin?view=desk", "Admin desk"],
  ["/preview/offers/admin?view=deal", "Admin deal"],
];

export default function OffersPreviewIndex() {
  return (
    <main className="nf-shell nf-page nf-md">
      <h1 className="nf-h2">Offers fixtures</h1>
      <ul className="grid gap-sm">
        {LINKS.map(([href, label]) => (
          <li key={href}>
            <Link href={href}>{label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
