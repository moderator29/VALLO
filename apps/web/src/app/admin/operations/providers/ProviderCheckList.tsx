import { UiIcon } from "@/design-system/icons/UiIcon";
import type { CheckOutcome } from "@/lib/admin/provider-checks";
import { PageHead } from "../../_components/panels";

/* Said in words, never by colour alone. */
const SENDER_STATUS_WORD = {
  approved: "Approved",
  pending: "Pending approval",
  blocked: "Blocked or rejected",
  unknown: "Status not recognised",
} as const;

/**
 * The provider checks as a page body: one row per provider, and under the
 * Termii sender ID row the sender IDs the account holds with their status. A
 * plain component so the dev preview draws the very same markup from fixtures.
 */
export function ProviderCheckList({ checks }: { checks: readonly CheckOutcome[] }) {
  return (
    <div className="nf-console">
      <PageHead
        title="Provider checks"
        lede="Read-only. Nothing is charged or sent and no member sees anything. Refresh to run again."
      />
      <ul className="nf-queue-list">
        {checks.map((check) => (
          <li key={check.name} className="nf-panel nf-panel--card nf-admin-card mb-sm flex gap-sm p-md" data-testid="provider-check">
            <UiIcon
              name={check.ok ? "check" : "close"}
              size={20}
              aria-label={check.ok ? "Passed" : "Failed"}
              className={check.ok ? "shrink-0 text-[var(--nf-state-success)]" : "shrink-0 text-[var(--nf-state-error)]"}
            />
            <span>
              <span className="block font-semibold">{check.name}</span>
              <span className="block text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{check.detail}</span>
              {check.senders && check.senders.length > 0 ? (
                <ul className="mt-xs grid gap-2xs" data-testid="termii-sender-ids" aria-label="Sender IDs on the Termii account">
                  {check.senders.map((sender) => (
                    <li key={sender.senderId} className="flex flex-wrap items-baseline gap-x-sm text-[length:var(--nf-text-body-sm)]">
                      <span className="font-semibold">{sender.senderId}</span>
                      <span data-status={sender.status} className="text-[var(--nf-content-secondary)]">
                        {SENDER_STATUS_WORD[sender.status]}
                        {sender.status === "unknown" && sender.rawStatus ? ` (${sender.rawStatus})` : ""}
                      </span>
                      {sender.company ? <span className="text-[var(--nf-content-secondary)]">{sender.company}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
