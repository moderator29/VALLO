import { OfferFlow } from "@/components/app/offers/OfferFlow";
import { FIXTURE_BLOCKED, FIXTURE_ELIGIBLE, FIXTURE_MANDATE, FIXTURE_PRICE_PARTIAL, FIXTURE_PRICE_COMPLETE } from "@/lib/offers/fixtures";

type Q = { step?: string; gate?: string; pref?: string; price?: string };

/** The offer flow, against fixtures. `?step=1|2|3&gate=blocked&pref=mortgage&price=complete`. */
export default async function FlowPreview({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const step = q.step === "3" ? 3 : q.step === "2" ? 2 : 1;
  const blocked = q.gate === "blocked";
  const pref = q.pref === "mortgage" || q.pref === "instalment" ? q.pref : "cash";
  return (
    <OfferFlow
      listingId="lst-oniru-1"
      listingTitle="Four bedroom duplex in Oniru, Lagos"
      price={q.price === "complete" ? FIXTURE_PRICE_COMPLETE : FIXTURE_PRICE_PARTIAL}
      eligibility={blocked ? FIXTURE_BLOCKED : FIXTURE_ELIGIBLE}
      mandate={FIXTURE_MANDATE}
      canOffer={!blocked}
      reason={blocked ? "Finish the requirements to send an offer." : null}
      initialStep={step}
      initialDraft={{ amount: step === 1 ? "" : "80000000", pref, deposit: pref === "cash" ? "" : "20000000", closing: step === 3 ? "2026-12-15" : "", note: step === 3 ? "I have viewed it twice." : "", noteOpen: step === 3, months: "12", step }}
    />
  );
}
