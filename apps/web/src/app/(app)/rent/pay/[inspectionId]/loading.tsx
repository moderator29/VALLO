import { getDictionary } from "@vallo/i18n";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonWait, Line, MoneyWait } from "@/components/app/money-history/MoneyWait";
import { ActionBar } from "@/components/ui/ActionBar";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { NO_CUSTODY_SENTENCE, RAIL_COPY } from "@/lib/money/copy";
import { LIVE_RAIL } from "@/lib/money/rails";
import { getLocale } from "@/lib/locale";

/**
 * The rent payment, before the inspection and its figures are read (W2,
 * round 5): the page itself, inert (`MoneyWait`). Its order is the page's:
 * the summary island (the place, the move-in total, its lines, the total to
 * pay), then how to pay (the first option in the page's own words), the two
 * notes under it, and the pinned bar with the move-in total and the action.
 * The figures, the place and the lines are slabs one line of their own
 * element tall; the button is a slab of the button's height, because a Pay
 * button that cannot be pressed is a promise the wait cannot keep.
 *
 * The usual case is drawn: the lister has accepted, the agreement is
 * approved, and the total is above the card limit. Any other answer (signed out, waiting
 * on the lister, already paid) replaces the wait with its own result screen.
 */
export default async function LoadingRentPay() {
  const dict = getDictionary(await getLocale());
  const c = dict.checkout;
  const pay = dict.afterTheGate.pay;
  /* The note names the total, which the read returns: the page's sentence
     with a slab where the amount goes. */
  const [before = "", after = ""] = pay.largeNote.split("{amount}");
  return (
    <MoneyWait label={dict.experienceMoney.waits.rentPay} className="mx-auto max-w-xl">
      {/* The subtitle is the place, which the read returns: its line is held. */}
      <PageFrame title={c.rentTitle} subtitle={" "} fallback="/bookings?kind=inspection&from=property" width="narrow">
      <div>

      <section className="nf-island p-card">
        <h2 className="nf-h3">
          <Line width="70%" />
        </h2>
        <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
          <Line width="45%" />
        </p>
        <p className="nf-caption mt-block text-[var(--nf-content-muted)]">
          <Line width="60%" />
        </p>
        {/* The total is set at the display size on this body line. */}
        <p className="mt-inline-tight">
          <Line width="10rem" bar="1.25rem" />
        </p>
        <dl className="mt-block grid gap-inline">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-baseline justify-between gap-group">
              <dt className="nf-body-sm text-[var(--nf-content-secondary)]">
                <Line width="8rem" />
              </dt>
              <dd className="nf-body-sm">
                <Line width="5rem" />
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-group border-t border-[var(--nf-line)] pt-inline">
            <dt className="nf-body font-semibold text-[var(--nf-content-primary)]">{c.totalToPay}</dt>
            <dd className="nf-body">
              <Line width="6rem" />
            </dd>
          </div>
        </dl>
        <p className="nf-body-sm mt-block leading-relaxed text-[var(--nf-content-secondary)]">
          <Line width="100%" />
          <Line width="55%" />
        </p>
        <p className="nf-caption mt-inline leading-relaxed text-[var(--nf-content-muted)]">
          <Line width="80%" />
        </p>
      </section>

      <div className="mt-lg">
        <section>
          <h2 className="nf-h3">{c.howToPay}</h2>
          <ul className="mt-block grid gap-row">
            <li className="nf-panel nf-panel--card flex-row items-start gap-group p-card">
              <span aria-hidden="true" className="block h-12 w-12 shrink-0 rounded-[var(--nf-radius-md)] nf-skeleton nf-skeleton--text" />
              <div className="min-w-0 flex-1">
                {/* A move-in total is nearly always above the card limit
                    (LARGE_PAYMENT_KOBO, N500,000), so the option is drawn as the
                    page draws it then: bank transfer first, with its note. */}
                <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{pay.largeLead}</p>
                <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-secondary)]">{pay.largeBody}</p>
                <p className="nf-body-sm mt-inline leading-relaxed text-[var(--nf-content-muted)]">
                  {before}
                  <Line width="7.5em" inline />
                  {after}
                </p>
                <div className="mt-row">
                  <ButtonWait />
                </div>
              </div>
            </li>
          </ul>
          <p className="nf-caption mt-block leading-relaxed text-[var(--nf-content-muted)]">
            {NO_CUSTODY_SENTENCE} {RAIL_COPY[LIVE_RAIL].standing}
          </p>
          <p className="nf-caption mt-block flex items-start gap-inline leading-relaxed text-[var(--nf-content-muted)]">
            <UiIcon name="info" size="xs" className="mt-3xs shrink-0" />
            <span>{c.onPlatformRent}</span>
          </p>
          <div aria-hidden="true" style={{ height: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }} />
          <ActionBar>
            <p className="flex min-w-0 flex-1 flex-col">
              <span className="nf-caption text-[var(--nf-content-muted)]">{c.moveInTotal}</span>
              <span className="min-w-0 text-[length:var(--nf-text-body-lg)] font-bold leading-none">
                <Line width="6.5em" />
              </span>
            </p>
            <ButtonWait width="13rem" className="shrink-0" />
          </ActionBar>
        </section>
      </div>
      </div>
    </PageFrame>
    </MoneyWait>
  );
}
