import type { Locale } from "@vallo/i18n/core";
import { formatKoboExact } from "@/components/app/money/money";
import type { ReceiptModel } from "@/components/app/money/receipt-model";
import type { MovementView } from "@/lib/money/member-wallet";
import { formatMoneyDate } from "@/lib/money/dates";
import { HELD_BY, movementTitle } from "@/lib/money/balance-copy";

/**
 * A completed movement as the one receipt model (`ReceiptModel`), so it can
 * be saved as an image or a PDF and shared like every other receipt. Only
 * what the record holds: the amount, the day, the processor's fee when the
 * record carries one, the partner's confirmation when it gave one, the
 * reference. No total is worked out here.
 */
export function movementReceipt(m: MovementView, locale: Locale): ReceiptModel {
  const { whole, kobo } = formatKoboExact(m.amountMinor, locale);
  const fee = m.providerFeeMinor && m.providerFeeMinor > 0 ? formatKoboExact(m.providerFeeMinor, locale) : null;
  const cp = m.counterparty;
  const place =
    m.kind === "withdrawal"
      ? [cp.bank, cp.last4 ? `•••• ${cp.last4}` : ""].filter(Boolean).join(" ")
      : m.kind === "transfer_out"
        ? `To ${cp.name || "a Vallo member"}`
        : m.kind === "transfer_in"
          ? "From a Vallo member"
          : "From your bank or card";
  return {
    kind: "Receipt",
    title: movementTitle(m.kind),
    place,
    figureLabel: m.kind === "deposit" || m.kind === "transfer_in" ? "Received" : "Amount",
    figure: `${whole}${kobo}`,
    facts: [{ label: "Date", value: formatMoneyDate(m.createdAt, locale, { withTime: true }) ?? "" }],
    lines: fee ? [{ label: "Processing fee", value: `${fee.whole}${fee.kobo}` }] : [],
    total: { label: "Amount", value: `${whole}${kobo}` },
    confirmations: m.confirmedByProvider ? [{ label: "Payments partner", state: "Confirmed" }] : [],
    reference: { label: "Reference", value: m.reference },
    note: HELD_BY,
  };
}

