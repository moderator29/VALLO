import { OverviewStrip } from "@/app/admin/offers/OverviewStrip";
import { OffersTable } from "@/app/admin/offers/OffersTable";
import { AdminDealView } from "@/app/admin/offers/DealView";
import { ADMIN_DEAL, ADMIN_OVERVIEW, ADMIN_ROWS } from "@/app/admin/offers/fixtures";
import { PageHead, Panel } from "@/app/admin/_components/panels";
import { FIXTURE_NOW_MS } from "@/lib/offers/fixtures";

/** The admin Offers and deals desk against fixtures, without the console shell. `?view=desk|deal`. */
export default async function AdminPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const q = await searchParams;
  if (q.view === "deal") return <AdminDealView deal={ADMIN_DEAL} />;
  return (
    <div className="nf-console">
      <PageHead title="Offers and deals" lede="Offers on properties for sale, from first offer to the end of the deal. Vallo records them and takes none of the money." />
      <Panel title="Last 30 days" id="overview">
        <OverviewStrip overview={ADMIN_OVERVIEW} />
      </Panel>
      <Panel title="Deals" id="deals" flush>
        <OffersTable rows={ADMIN_ROWS} nowMs={FIXTURE_NOW_MS} />
      </Panel>
    </div>
  );
}
