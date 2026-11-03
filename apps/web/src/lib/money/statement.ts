import type { HistoryEntry } from "./history-model";

/**
 * THE MEMBER'S OWN STATEMENT, AS A CSV (1 November 2026).
 *
 * Built from the rows `my_payments_history` hands the member under their own
 * session, nothing else: the date, what it was for, who it went to by ROLE (the
 * lister, or back to you), the amount, the status and the receipt reference the
 * member already sees on Receipts. No provider id beyond that reference, and no
 * other member's name. Pure, so the shape is tested without a database.
 */

const HEADER = ["Date (Lagos)", "What", "To whom", "Amount (NGN)", "Status", "Reference"] as const;

/** A spreadsheet reads a cell starting with = + - @ (or a tab or return) as a formula; it is made plain text. */
export function csvCell(value: string): string {
  const plain = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(plain) ? `"${plain.replace(/"/g, '""')}"` : plain;
}

const ROLE: Record<HistoryEntry["kind"], string> = {
  payment: "The lister or host",
  refund: "Back to you",
  earning: "You",
  reversal: "Back to the payer",
};

const lagosDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function naira(minor: number, direction: HistoryEntry["direction"]): string {
  const value = (minor / 100).toFixed(2);
  return direction === "out" ? `-${value}` : value;
}

export function statementCsv(entries: readonly HistoryEntry[]): string {
  const lines = [HEADER.join(",")];
  for (const e of entries) {
    const at = Date.parse(e.occurredAt);
    lines.push(
      [
        Number.isFinite(at) ? lagosDate.format(new Date(at)) : e.occurredAt,
        e.title ?? (e.kind === "refund" ? "Refund" : "Payment"),
        ROLE[e.kind],
        naira(e.amountMinor, e.direction),
        e.status.toLowerCase(),
        e.reference ?? "",
      ]
        .map((c) => csvCell(String(c)))
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
