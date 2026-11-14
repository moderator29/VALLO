import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ArrangementRecord } from "@/app/admin/arrangements/ArrangementRecord";
import { toOpsRow } from "@/app/admin/arrangements/read";
import { eventNotes, type ArrangementRecordRead } from "@/app/admin/arrangements/read-one";
import { ConsoleFrame } from "../../bd/ConsoleFrame";

/**
 * Money > Protected payments > one payment (the dispute desk), on the
 * console frame, from recorded rows. The page is `ArrangementRecord`
 * itself, fed what `readArrangementRecord` would return. `?status=protected`
 * draws a payment that is simply held (a refund only); `?status=released`
 * one with no decision to make. The decision's button calls the real
 * action, which the finance door refuses here.
 */
export const dynamic = "force-dynamic";

const STATUSES = ["disputed", "protected", "released"] as const;

export default async function PreviewArrangementRecord({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: asked } = await searchParams;
  const status = (STATUSES as readonly string[]).includes(asked ?? "") ? (asked as string) : "disputed";
  const locale = await getLocale();
  const row = toOpsRow({
    id: "44444444-4444-4444-8444-444444444444",
    reference: "vallo-pp-7f3a91c2d4e84b06",
    provider: "escrowpay",
    status,
    status_source: status === "disputed" ? "vallo" : "provider_webhook",
    status_observed_at: "2026-11-14T10:00:00Z",
    provider_state: "transaction.funded",
    provider_arrangement_id: "TXN_example0000000000000000000000",
    amount_minor: 180_000_00,
    category: "residential_rent",
    environment: "sandbox",
    created_at: "2026-11-14T09:00:00Z",
  })!;
  const read: ArrangementRecordRead = {
    state: "ok",
    row,
    agreementId: null,
    payerName: "Example Payer",
    listerName: "Example Lister",
    events: [
      { id: "1", at: "2026-11-14T09:00:00Z", from: null, to: "preparing", source: "vallo", refused: false, providerState: null, notes: [] },
      { id: "2", at: "2026-11-14T09:02:00Z", from: "preparing", to: "awaiting_payment", source: "provider_response", refused: false, providerState: "pending_funding", notes: [] },
      { id: "3", at: "2026-11-14T09:20:00Z", from: "awaiting_payment", to: "awaiting_payment", source: "vallo", refused: false, providerState: null, notes: eventNotes({ payer_reported_transfer: true }) },
      { id: "4", at: "2026-11-14T09:31:00Z", from: "awaiting_payment", to: "protected", source: "provider_webhook", refused: false, providerState: "transaction.funded", notes: [] },
      ...(status === "disputed"
        ? [{ id: "5", at: "2026-11-14T10:00:00Z", from: "protected", to: "disputed", source: "vallo", refused: false, providerState: null, notes: eventNotes({ opened_by: "payer", statement: "The keys or access were not provided: I arrived on the agreed day and nobody came to hand over the keys." }) }]
        : []),
    ],
  };
  return (
    <ConsoleFrame t={getDictionary(locale)}>
      <ArrangementRecord read={read} locale={locale} />
    </ConsoleFrame>
  );
}
