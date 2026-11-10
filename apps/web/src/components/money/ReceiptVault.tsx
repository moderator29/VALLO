import type { Locale } from "@vallo/i18n/core";
import { Amount } from "@/components/ui/Amount";
import { Chip } from "@/components/ui/Chip";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { StatusWord } from "./kit";
import { ButtonLink } from "@/components/ui/Button";
import {
  RECEIPTS_FILTER,
  RECEIPTS_NO_MATCH,
  RECEIPTS_SEARCH_HINT,
  RECEIPTS_SEARCH_LABEL,
  RECEIPT_PRIVACY_ACTION,
  RECEIPT_PRIVACY_BODY,
  RECEIPT_PRIVACY_TITLE,
  receiptsSearchScope,
} from "@/lib/money/copy";
import { formatMoneyDate } from "@/lib/money/dates";
import { KIND_LABEL, statusFor, type HistoryEntry } from "@/lib/money/history-model";
import { referenceLabel } from "@/lib/money/references";
import type { VaultKind } from "@/lib/money/vault";
import { PROTECTED_PAYMENTS_HEADING } from "@/lib/money/copy";
import { StagePill } from "./protected/kit";
import type { ProtectedPaymentSummary } from "./protected/types";

/**
 * THE RECEIPT VAULT (R3-05; FL section 4.4): search, filter, open (to print or
 * save), and the privacy-safe way to share.
 *
 * A plain GET form, so search works without script and the address is the
 * state. Every row is money that moved (`vaultEntries`): its space, its day,
 * its Vallo transaction reference labelled as one, and its amount. A row opens
 * the booking, where the full receipt is drawn on the document sheet with its
 * print action. The search is honest about its reach: it runs over the
 * records this page read, and says so. Server-safe.
 */
export function ReceiptVault({
  entries,
  scanned,
  kind,
  query,
  basePath,
  locale,
  counts,
  protectedReceipts = [],
}: {
  /** Already filtered. */
  entries: readonly HistoryEntry[];
  /** How many records the filter ran over. */
  scanned: number;
  kind: VaultKind;
  query: string;
  basePath: string;
  locale: Locale;
  /**
   * Per kind, how many receipts match the search: passed only when this page
   * is the whole record, so a chip never shows a part as the whole.
   */
  counts?: Record<VaultKind, number>;
  /**
   * BUILD 7.4: the viewer's protected payments whose outcome the bank
   * confirmed (released or refunded). Each opens its payment, where the
   * receipt names the custodian in the provider's words, the partner's
   * reference and the release or refund history. Empty while the rail is off.
   */
  protectedReceipts?: readonly ProtectedPaymentSummary[];
}) {
  const finalReceipts = protectedReceipts.filter((p) => p.stage === "released" || p.stage === "refunded");
  const href = (k: VaultKind) => {
    const p = new URLSearchParams();
    if (k !== "all") p.set("kind", k);
    if (query) p.set("q", query);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div className="space-y-block" data-testid="receipt-vault">
      <form action={basePath} method="get" role="search" className="grid gap-inline">
        <label htmlFor="nf-vault-q" className="nf-body-sm font-semibold text-[var(--nf-content-secondary)]">
          {RECEIPTS_SEARCH_LABEL}
        </label>
        <input
          id="nf-vault-q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={RECEIPTS_SEARCH_HINT}
          className="nf-field"
          enterKeyHint="search"
          autoComplete="off"
        />
        {kind !== "all" ? <input type="hidden" name="kind" value={kind} /> : null}
      </form>
      <div className="flex flex-wrap gap-inline" aria-label={RECEIPTS_SEARCH_LABEL}>
        {(["all", "payment", "refund"] as const).map((k) => (
          <Chip key={k} behaviour="link" href={href(k)} selected={kind === k} count={counts?.[k]} data-testid={`vault-kind-${k}`}>
            {RECEIPTS_FILTER[k]}
          </Chip>
        ))}
      </div>
      {query ? <p className="nf-caption text-[var(--nf-content-muted)]">{receiptsSearchScope(scanned)}</p> : null}

      {finalReceipts.length > 0 ? (
        <ListGroup label={PROTECTED_PAYMENTS_HEADING} labelAs="h2" data-testid="vault-protected">
          {finalReceipts.map((p) => (
            <ListRow
              key={p.reference}
              data-testid="vault-protected-row"
              title={p.title}
              sub={[formatMoneyDate(p.at, locale), `${referenceLabel({ kind: "transaction", value: p.reference })} ${p.reference}`].filter(Boolean).join(" · ")}
              value={<Amount minorUnits={p.amountMinor} locale={locale} showFraction />}
              status={<StagePill stage={p.stage} />}
              href={`/agreements/${encodeURIComponent(p.agreementId)}/held#receipt`}
              chevron
            />
          ))}
        </ListGroup>
      ) : null}

      {entries.length === 0 ? (
        <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status" data-testid="vault-no-match">
          {RECEIPTS_NO_MATCH}
        </p>
      ) : (
        <ListGroup label={RECEIPTS_FILTER[kind]} labelAs="h2">
          {entries.map((entry) => {
            const status = statusFor(entry.kind, entry.status);
            const day = formatMoneyDate(entry.occurredAt, locale) ?? "";
            const ref = entry.reference ? `${referenceLabel({ kind: "transaction", value: entry.reference })} ${entry.reference}` : null;
            return (
              <ListRow
                key={entry.id}
                data-testid="vault-row"
                title={entry.title ?? KIND_LABEL[entry.kind]}
                sub={[day, KIND_LABEL[entry.kind], ref].filter(Boolean).join(" · ")}
                value={<Amount minorUnits={entry.amountMinor} locale={locale} showFraction />}
                status={<StatusWord tone={status.tone}>{status.label}</StatusWord>}
                href={entry.bookingId ? `/bookings/${encodeURIComponent(entry.bookingId)}` : undefined}
                chevron={Boolean(entry.bookingId)}
              />
            );
          })}
        </ListGroup>
      )}

      <section className="nf-panel nf-panel--card" aria-labelledby="nf-vault-privacy">
        <h2 id="nf-vault-privacy" className="nf-body font-semibold text-[var(--nf-content-primary)]">
          {RECEIPT_PRIVACY_TITLE}
        </h2>
        <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{RECEIPT_PRIVACY_BODY}</p>
        <div className="mt-row">
          <ButtonLink href="/r" variant="secondary" size="md">
            {RECEIPT_PRIVACY_ACTION}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
