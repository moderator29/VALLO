import { getDictionary } from "@vallo/i18n";
import type { Locale } from "@vallo/i18n/core";
import type { HistoryEntry, PaymentsSummary } from "@/lib/money/history-model";
import type { PartnerRead } from "@/lib/money/partner-reads";
import type { Balances } from "@/lib/money/vallo";
import {
  HISTORY_NOT_A_BALANCE,
  PARTNERS_SHORT,
  PAYMENTS_DOOR,
  PAYMENTS_DOORS_LABEL,
  PAYMENTS_EMPTY_BODY,
  PAYMENTS_EMPTY_TITLE,
  PAYMENTS_REFUNDED_LABEL,
  PAYMENTS_TOTAL_LABEL,
  RECEIPTS_FILTER,
  REFUND_ROUTE,
} from "@/lib/money/copy";
import { TYPE } from "@/components/app/Screen";
import { HistoryHero } from "@/components/app/money-history/HistoryHero";
import { HistoryList } from "@/components/app/money-history/HistoryList";
import { HistoryEmpty } from "@/components/app/money-history/HistoryStates";
import { Chip } from "@/components/ui/Chip";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { MoneyCentre } from "./MoneyCentre";
import { Amount } from "@/components/ui/Amount";
import { StagePill } from "./protected/kit";
import type { ProtectedPaymentSummary } from "./protected/types";
import { PROTECTED_PAYMENTS_HEADING } from "@/lib/money/copy";

/* The records a payer reaches from here, each its own screen (one job each). */
const DOORS: { href: string; icon: UiIconName; key: keyof typeof PAYMENTS_DOOR }[] = [
  { href: "/receipts", icon: "receipt", key: "receipts" },
  { href: "/refunds", icon: "hand-coins", key: "refunds" },
  { href: "/settings/payments", icon: "credit-card", key: "methods" },
  { href: "/agreements", icon: "file-check", key: "agreements" },
];

/**
 * /payments once the read answered, as one component the route draws with
 * the real read and the preview harness (`/preview/p5/payments`) with
 * fixture rows. Server-safe; it reads nothing itself.
 */
export function PaymentsView({
  summary,
  entries,
  nextBefore,
  before,
  balances,
  locale,
  show = null,
  protectedPayments = [],
}: {
  summary: PaymentsSummary;
  entries: HistoryEntry[];
  nextBefore: string | null;
  before: string | null;
  balances: PartnerRead<Balances>;
  locale: Locale;
  /** The filter chip chosen, from `?show=`: payments or refunds; anything else is all. */
  show?: string | null;
  /**
   * BUILD 7.5: the viewer's protected payments (`readMyProtectedPayments`),
   * each with its state in words and an icon. Empty while the rail is off,
   * which is today, so nothing is drawn.
   */
  protectedPayments?: readonly ProtectedPaymentSummary[];
}) {
  const words = getDictionary(locale).experienceMoney.payments;
  /* Reference 4's filter chips. The filter runs over the rows this page
     read, and a chip carries a count only when this page is the whole record
     (no older page, not paged back), so a count is never a part passed off
     as the whole. */
  const filter: "all" | "payment" | "refund" = show === "payment" || show === "refund" ? show : "all";
  const complete = nextBefore === null && before === null;
  const counts = {
    all: entries.length,
    payment: entries.filter((e) => e.kind === "payment").length,
    refund: entries.filter((e) => e.kind === "refund").length,
  };
  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);
  return (
    <div className="mt-inline space-y-block">
      {/* The money centre appears only when the partner read answers,
          which needs the protected rail live (D50 condition 3). Until
          then nothing is drawn here: no zero, no "coming" card. */}
      {balances.state === "ok" ? <MoneyCentre balances={balances.data} locale={locale} /> : null}
      {protectedPayments.length > 0 ? (
        <ListGroup label={PROTECTED_PAYMENTS_HEADING} labelAs="h2" data-testid="payments-protected">
          {protectedPayments.map((p) => (
            <ListRow
              key={p.reference}
              href={p.href}
              chevron
              title={p.title}
              sub={p.reference}
              value={<Amount minorUnits={p.amountMinor} locale={locale} showFraction />}
              status={<StagePill stage={p.stage} />}
              data-testid="payments-protected-row"
            />
          ))}
        </ListGroup>
      ) : null}
      <HistoryHero
        id="nf-payments-total"
        label={PAYMENTS_TOTAL_LABEL}
        totalMinor={summary.paidMinor}
        locale={locale}
        note={HISTORY_NOT_A_BALANCE}
        facts={summary.refundedMinor > 0 ? [{ label: PAYMENTS_REFUNDED_LABEL, minor: summary.refundedMinor }] : []}
      />
      {entries.length === 0 && !before ? (
        <HistoryEmpty title={PAYMENTS_EMPTY_TITLE} body={PAYMENTS_EMPTY_BODY} next={{ href: "/agreements", label: words.seeAgreements }} />
      ) : (
        <>
          {counts.refund > 0 || filter !== "all" ? (
            <div className="nf-mfilters" role="group" aria-label={words.listHeading} data-testid="payments-filters">
              {(["all", "payment", "refund"] as const).map((k) => (
                <Chip
                  key={k}
                  behaviour="link"
                  href={k === "all" ? "/payments" : `/payments?show=${k}`}
                  selected={filter === k}
                  count={complete ? counts[k] : undefined}
                  data-testid={`payments-filter-${k}`}
                >
                  {RECEIPTS_FILTER[k]}
                </Chip>
              ))}
            </div>
          ) : null}
          {shown.length === 0 ? (
            <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status" data-testid="payments-filter-none">
              None on this page.
            </p>
          ) : null}
        </>
      )}
      {entries.length === 0 && !before ? null : (
        <HistoryList
          entries={shown}
          nextBefore={nextBefore}
          basePath="/payments"
          paged={before !== null}
          locale={locale}
          heading={words.listHeading}
          /* Each row opens its booking, where the stay or tenancy and
             its receipt live. A row with no booking stays a plain row. */
          linkToBooking
        />
      )}
      <ListGroup label={PAYMENTS_DOORS_LABEL} labelAs="h2">
        {DOORS.map((door) => (
          <ListRow
            key={door.href}
            href={door.href}
            chevron
            leading={
              <IconPlate size="sm">
                <UiIcon name={door.icon} size={ICON_PLATE_GLYPH.sm} />
              </IconPlate>
            }
            title={PAYMENTS_DOOR[door.key].title}
            sub={PAYMENTS_DOOR[door.key].sub}
          />
        ))}
      </ListGroup>
      <p className={TYPE.rowMeta}>
        {REFUND_ROUTE} {PARTNERS_SHORT}
      </p>
    </div>
  );
}
