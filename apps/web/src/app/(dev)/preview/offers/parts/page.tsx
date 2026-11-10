import { Panel } from "@/components/ui/Panel";
import { EligibilityCard, OfferFigures, PriceBlockView } from "@/components/app/offers/OfferParts";
import * as F from "@/lib/offers/fixtures";

/** The building blocks: price block variants, requirements, the offer against asking. */
export default function PartsPreview() {
  return (
    <main className="nf-shell nf-page nf-md grid gap-lg">
      <h1 className="nf-h2">Parts</h1>
      <Panel variant="card" className="p-card"><PriceBlockView price={F.FIXTURE_PRICE_BARE} title="No itemised costs" /></Panel>
      <Panel variant="card" className="p-card"><PriceBlockView price={F.FIXTURE_PRICE_PARTIAL} title="Some costs known" /></Panel>
      <Panel variant="card" className="p-card"><PriceBlockView price={F.FIXTURE_PRICE_COMPLETE} title="Complete" /></Panel>
      <Panel variant="card" className="p-card"><EligibilityCard eligibility={F.FIXTURE_BLOCKED} /></Panel>
      <Panel variant="card" className="p-card"><EligibilityCard eligibility={F.FIXTURE_REVIEW} /></Panel>
      <Panel variant="card" className="p-card"><OfferFigures amountMinor={87_000_000_00} askingMinor={85_000_000_00} /></Panel>
      <Panel variant="card" className="p-card"><OfferFigures amountMinor={80_000_000_00} askingMinor={85_000_000_00} /></Panel>
      <Panel variant="card" className="p-card"><OfferFigures amountMinor={85_000_000_00} askingMinor={85_000_000_00} atAskingPrice /></Panel>
    </main>
  );
}
