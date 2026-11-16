import { HostShell } from "@/components/host/HostShell";
import { HostReviewsView } from "@/components/host/reviews/HostReviewsView";
import { REVIEWS } from "../fixtures";

/** C4 on fixtures. `?state=not-ready` draws the page before the migration. */
export default async function PreviewHostReviews({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const many = p.many === "1";
  const reviews = many ? [...REVIEWS, ...REVIEWS.map((r, i) => ({ ...r, id: `${r.id.slice(0, -2)}9${i}` }))] : REVIEWS;
  return (
    <HostShell fallback="/preview/host-c" wide chromeBack={false} nav>
      <HostReviewsView
        read={p.state === "not-ready" ? { state: "not-ready" } : { state: "ok", reviews, places: [] }}
        locale="en"
      />
    </HostShell>
  );
}
