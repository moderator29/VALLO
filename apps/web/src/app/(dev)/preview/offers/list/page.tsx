import { PageFrame } from "@/components/app/PageFrame";
import { OffersWorkspace } from "@/components/app/offers/OffersWorkspace";
import { BUYER_ROWS, FIXTURE_NOW_MS, SELLER_ROWS, countsFor } from "@/lib/offers/fixtures";

type Q = { tab?: string; empty?: string };

/** My offers, against fixtures. `?tab=made|received&empty=1`. */
export default async function ListPreview({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const empty = q.empty === "1";
  const none = { rows: [], counts: countsFor([], "buyer") };
  return (
    <main className="nf-shell nf-page nf-md">
      <PageFrame title="Offers" subtitle="Offers you made and offers you received" fallback="/home" width="wide">
        <OffersWorkspace
          made={empty ? none : { rows: BUYER_ROWS, counts: countsFor(BUYER_ROWS, "buyer") }}
          received={empty ? none : { rows: SELLER_ROWS, counts: countsFor(SELLER_ROWS, "seller") }}
          initialTab={q.tab === "received" ? "received" : "made"}
          nowMs={FIXTURE_NOW_MS}
        />
      </PageFrame>
    </main>
  );
}
