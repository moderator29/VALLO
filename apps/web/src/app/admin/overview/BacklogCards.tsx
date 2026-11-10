import Link from "next/link";
import type { BacklogCard, CooBacklog } from "@/lib/admin/overview/reads";

const CARDS: { key: keyof CooBacklog; title: string; viewAll: string }[] = [
  { key: "listings", title: "Listings awaiting review", viewAll: "/admin/listings" },
  { key: "moderation", title: "Moderation, open reports and held content", viewAll: "/admin/queue" },
  { key: "support", title: "Support, open tickets", viewAll: "/admin/support" },
  { key: "agreements", title: "Agreements waiting on review", viewAll: "/admin/agreements" },
  { key: "operations", title: "Operations alerts", viewAll: "/admin/alerts" },
];

function dateLabel(iso: string): string {
  if (!iso) return "no date";
  try {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

function Card({ title, viewAll, card }: { title: string; viewAll: string; card: BacklogCard }) {
  return (
    <div className="nf-admin-panel block p-card" data-testid="backlog-card">
      <h3 className="nf-admin-panel__title">{title}</h3>
      {card.state !== "ok" ? (
        <p className="nf-body text-[var(--nf-content-secondary)]">Could not be read just now.</p>
      ) : (
        <>
          <p className="nf-body">
            {card.count} waiting{card.capped ? " (the oldest we can read; there may be more)" : ""}.
          </p>
          {card.items.length > 0 ? (
            <ul className="grid gap-2xs nf-caption mt-row">
              {card.items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="font-semibold text-[var(--nf-content-link)] hover:underline">
                    {item.title}
                  </Link>{" "}
                  · waiting since {dateLabel(item.createdAt)}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <p className="nf-caption mt-row">
        <Link href={viewAll} className="text-[var(--nf-content-link)] hover:underline">
          Open the desk
        </Link>
      </p>
    </div>
  );
}

/** The real oldest few waiting items on each desk, not only a total,
 * reusing each desk's own read exactly as it already reads for itself. */
export function BacklogCards({ backlog }: { backlog: CooBacklog }) {
  return (
    <div className="grid gap-sm sm:grid-cols-2" data-testid="backlog-cards">
      {CARDS.map(({ key, title, viewAll }) => (
        <Card key={key} title={title} viewAll={viewAll} card={backlog[key]} />
      ))}
    </div>
  );
}
