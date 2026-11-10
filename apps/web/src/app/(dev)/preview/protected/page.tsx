/* Preview harness for the PROTECTED PAYMENT SCREENS (EscrowPay, built
   switched off; PROTECTED_PAYMENTS_SPECS spec two). The real components,
   drawn from recorded states, one per link. Nothing is called and nothing is
   charged. Closed outside development by the preview layout.

     /preview/protected?screen=choose          screen 1, choose how to pay
     ?screen=choose&offer=absent               no approved category: card only
     ?screen=choose&offer=fee_failed           the fee could not be worked out
     ?screen=review                            screen 2, review the agreement
     ?screen=funding                           screen 3, transfer details and clock
     ?screen=funding-no-expiry                 screen 3 with no provider expiry
     ?screen=waiting                           screen 4, the bank is confirming
     ?screen=expired                           the transfer details expired
     ?screen=protected                         screens 5 and 6, a stay
     ?screen=protected-rent                    screens 5 and 6, keys for a rental
     ?screen=releasing  released  dispute  refunding  refunded  review-state  failed
     ?screen=lister                            screen 10, the lister's side */
import { getLocale } from "@/lib/locale";
import { ListerProtectedView } from "@/components/money/protected/ListerProtectedView";
import { PREVIEW_DEALS, PREVIEW_NOW } from "./fixtures";
import { PreviewProtected } from "./PreviewProtected";

const SCREENS = [
  "choose",
  "review",
  "funding",
  "funding-no-expiry",
  "waiting",
  "expired",
  "protected",
  "protected-rent",
  "releasing",
  "released",
  "dispute",
  "refunding",
  "refunded",
  "review-state",
  "failed",
  "lister",
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ screen?: string; offer?: string }> }) {
  const { screen = "choose", offer } = await searchParams;
  const locale = await getLocale();
  const key = screen === "review-state" ? "review" : screen;
  const deal = PREVIEW_DEALS[key] ?? PREVIEW_DEALS.funding!;
  return (
    <div className="mx-auto max-w-xl px-md py-lg">
      <nav className="mb-lg flex flex-wrap gap-xs text-[length:var(--nf-text-caption)]" aria-label="Fixture screens">
        {SCREENS.map((s) => (
          <a key={s} href={`/preview/protected?screen=${s}`} aria-current={s === screen ? "page" : undefined} className="underline">
            {s}
          </a>
        ))}
      </nav>
      {screen === "lister" ? (
        <ListerProtectedView deal={PREVIEW_DEALS.protected!} now={PREVIEW_NOW} locale={locale} />
      ) : (
        <PreviewProtected
          screen={screen === "choose" ? "choose" : screen === "review" ? "review" : "journey"}
          deal={screen === "choose" || screen === "review" ? PREVIEW_DEALS.funding! : deal}
          now={PREVIEW_NOW}
          locale={locale}
          {...(offer === "absent" || offer === "fee_failed" || offer === "service_down" || offer === "agreement_invalid" ? { offer } : {})}
        />
      )}
    </div>
  );
}
