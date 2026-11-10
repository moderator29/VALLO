import { getDictionary } from "@vallo/i18n";
import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
import { ListingStickyBar } from "@/components/app/listing/ListingStickyBar";
import { PriceBlockView } from "@/components/app/offers/OfferParts";
import { Panel } from "@/components/ui/Panel";
import * as F from "@/lib/offers/fixtures";
import { formatDay } from "@/lib/offers/format";
import { mandateLine, TITLE_NOT_VERIFIED } from "@/lib/offers/words";

/** The listing's sale action area against fixtures: the sticky bar, the honest price block and the mandate plate. */
export default function ListingPreview() {
  const t = getDictionary("en");
  const mandate = mandateLine(true, "2026-09-14", "2027-09-13", formatDay);
  return (
    <main className="nf-shell nf-page nf-md grid gap-lg">
      <h1 className="nf-h2">Four bedroom duplex in Oniru, Lagos</h1>
      <Panel variant="card" className="grid gap-sm p-card">
        <PriceBlockView price={F.FIXTURE_PRICE_PARTIAL} />
        <p className="nf-body-sm text-[var(--nf-content-muted)]">{TITLE_NOT_VERIFIED}</p>
      </Panel>
      <ListingAgentCard verified t={t} messageHref="/messages" name="Tunde Adebayo" mandate={mandate} />
      <ListingStickyBar
        variant="rental"
        priceMinor={85_000_000_00}
        currency="NGN"
        locale="en"
        perLabel="asking price"
        action={{ label: "Make an offer", href: "/listing/lst-oniru-1/offer" }}
        secondary={{ label: "Contact agent", href: "/messages" }}
        inspect={{ label: "Schedule inspection", href: "/listing/lst-oniru-1/visit" }}
        sheen
        fallbackLabel="Four bedroom duplex"
        stackOnPhone
      />
    </main>
  );
}
