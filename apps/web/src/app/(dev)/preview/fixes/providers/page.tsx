import { ProviderCheckList } from "@/app/admin/operations/providers/ProviderCheckList";
import type { CheckOutcome } from "@/lib/admin/provider-checks";
import { senderIdVerdict, type SenderIdRow } from "@/lib/admin/termii-sender-ids";

/**
 * The provider checks page from fixture outcomes, so the Termii sender ID rows
 * can be screenshotted without an admin session or a Termii key. Every name
 * here is invented; nothing is fetched.
 *
 *   /preview/fixes/providers
 */
export const dynamic = "force-dynamic";

const SENDERS: SenderIdRow[] = [
  { senderId: "Vallo", status: "approved", rawStatus: "unblock", company: "Vallo Spaces Ltd", createdAt: "2026-09-02" },
  { senderId: "ValloNG", status: "pending", rawStatus: "pending", company: "Vallo Spaces Ltd", createdAt: "2026-10-05" },
  { senderId: "VALLOSMS", status: "blocked", rawStatus: "blocked", company: "Vallo Spaces Ltd", createdAt: "2026-09-12" },
];

const CHECKS: CheckOutcome[] = [
  { name: "Payluk, live key", ok: true, detail: "Connected to live. Balance read (NGN)." },
  { name: "Termii (SMS codes)", ok: true, detail: "Key accepted and balance read. Sender ID set." },
  { name: "Termii sender IDs", ok: senderIdVerdict("Vallo", SENDERS).ok, detail: senderIdVerdict("Vallo", SENDERS).line, senders: SENDERS },
  { name: "OpenFreeMap (maps)", ok: true, detail: "The map style answered. No key is needed." },
];

export default function PreviewProviders() {
  return (
    <main className="mx-auto max-w-2xl px-gutter py-md">
      <ProviderCheckList checks={CHECKS} />
    </main>
  );
}
