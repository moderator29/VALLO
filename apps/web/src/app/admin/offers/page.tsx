import type { Metadata } from "next";
import { State } from "@/components/ui/State";
import { requireAdmin } from "@/lib/admin/guard";
import { requestNow } from "@/lib/format/when";
import { PageHead, Panel } from "../_components/panels";
import { OffersTable } from "./OffersTable";
import { OverviewStrip } from "./OverviewStrip";
import { readOffersDesk } from "./reads";
import "@/components/app/offers/offers.css";

export const metadata: Metadata = { title: "Offers and deals", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE OFFERS AND DEALS DESK. Inside the console, behind the same door as the
 * agreements desk (same staff scope, same step-up key). Real counts only, each
 * with a stated definition. Deals open in their own page; disputes go through
 * the cases desk. Nothing here shows the value of agreed offers as revenue.
 */
export default async function OffersDeskPage() {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") {
    return (
      <div className="nf-console">
        <PageHead title="Offers and deals" lede="Your account cannot open this desk." />
      </div>
    );
  }
  const desk = await readOffersDesk(access.supabase);
  return (
    <div className="nf-console">
      <PageHead title="Offers and deals" lede="Offers on properties for sale, from first offer to the end of the deal. Vallo records them and takes none of the money." />
      {desk === null ? (
        <Panel title="Offers">
          <State kind="error" compact title="The desk could not be read just now" body="Nothing was changed. Refresh to try again." />
        </Panel>
      ) : (
        <>
          <Panel title={`Last ${desk.overview.windowDays} days`} id="overview">
            <OverviewStrip overview={desk.overview} />
          </Panel>
          <Panel title="Deals" id="deals" flush>
            <OffersTable rows={desk.rows} nowMs={requestNow()} />
          </Panel>
        </>
      )}
    </div>
  );
}
