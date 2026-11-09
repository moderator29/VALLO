import { getDictionary } from "@vallo/i18n";
import { PageFrame } from "@/components/app/PageFrame";
import { Line, MoneyWait } from "@/components/app/money-history/MoneyWait";
import { Panel } from "@/components/ui/Panel";
import { activeProvider } from "@/lib/crypto/providers";
import { getLocale } from "@/lib/locale";

/**
 * A crypto payment, before its row is read (W2, round 5): the page itself,
 * inert (`MoneyWait`). The header, the progress card and the custody note
 * are drawn where the page draws them; the state and its sentence (three
 * lines, the length of the waiting and confirming sentences at phone width),
 * and the four steps' words, are slabs. The steps are not named in the wait on
 * purpose: four numbered steps with none lit would read as nothing done,
 * and a step is only ever shown as done when it is (MOTION_SYSTEM, money).
 * The provider's name is a server fact, so the note under it is the page's
 * own sentence.
 */
export default async function LoadingCryptoPayment() {
  const t = getDictionary(await getLocale()).cryptoPay;
  const provider = activeProvider()?.displayName ?? "the provider";
  return (
    <MoneyWait label="Loading this payment" className="mx-auto max-w-xl px-md">
      <PageFrame title={t.pageTitle} fallback="/bookings" width="narrow">
      <div>
      <div className="grid gap-block">
        <div>
          <p className="nf-h3">
            <Line width="45%" />
          </p>
          <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-secondary)]">
            <Line width="100%" />
            <Line width="100%" />
            <Line width="40%" />
          </p>
        </div>
        <Panel variant="card">
          <ol className="grid gap-sm">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-sm">
                <span className="flex h-6 w-6 shrink-0 rounded-full border border-[var(--nf-border-default)]" />
                <span className="nf-body-sm min-w-0 flex-1">
                  <Line width={["58%", "62%", "48%", "20%"][i]!} />
                </span>
              </li>
            ))}
          </ol>
        </Panel>
        <p className="nf-caption leading-relaxed text-[var(--nf-content-muted)]">{t.noCustody.replace("{provider}", provider)}</p>
      </div>
      {/* The way back to the charge: the page's own words, without the link
          (its address is read with the payment, and a wait links nowhere). */}
      <p className="mt-lg text-center">
        <span className="nf-body-sm font-semibold text-[var(--nf-brand-primary)] underline">{t.backToCharge}</span>
      </p>
      </div>
    </PageFrame>
    </MoneyWait>
  );
}
