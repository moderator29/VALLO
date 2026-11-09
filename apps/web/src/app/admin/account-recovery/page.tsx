import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { RecoveryDesk, type RecoveryRow } from "./RecoveryDesk";

export const metadata: Metadata = {
  title: "Account recovery",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * SEC-15: the desk for moving an account to a new address when its owner has
 * lost the mailbox. The gates are the database's (NIN on file, 72 hours, a
 * super admin who is not the account's owner, an audit row per step); this
 * page shows the requests and offers only the next step each one allows.
 */
export default async function AccountRecoveryPage() {
  const access = await requireAdmin();
  if (access.state !== "admin") return null;
  const locale = await getLocale();
  const ui = adminUi(getDictionary(locale), locale);

  const { data, error } = await access.supabase
    .from("email_recovery_requests" as never)
    .select(
      "id, user_id, old_email, new_email, status, evidence_ref, opened_at, eligible_at, completed_at, cancelled_at, cancel_reason, last_error, opened_notice_at, completed_notice_at",
    )
    .order("opened_at", { ascending: false })
    .limit(50);

  return (
    <div className="nf-console nf-admin-stack">
      {/*
        THE RULES AS STEPS, NOT A PARAGRAPH. The header's sub-line carried all
        eleven sentences of the procedure, a wall above the form at 390 (C1
        sweep). The sub-line now says what the desk is for; the procedure, the
        same facts in the same words, is a numbered list in a Card beside the
        form it governs.
      */}
      <PageHead
        title="Account recovery"
        lede="For a person who has lost the mailbox on their account. Every step is in the audit log."
      />
      <section className="nf-panel nf-panel--card nf-admin-card p-card" aria-labelledby="recovery-steps">
        <h2 id="recovery-steps" className="nf-h4">
          How a recovery runs
        </h2>
        <ol className="nf-body-sm mt-sm grid list-decimal gap-xs pl-lg text-[var(--nf-content-secondary)]">
          <li>A super admin opens a request with the NIN the person gives, which must match an approved identity on file, and the old address is told at once.</li>
          <li>The 72 hours count from that notice; if it did not go, send it again.</li>
          <li>After them, a different super admin from the one who opened it completes the move, which signs the account out everywhere.</li>
          <li>For 7 days after the move nobody can add or change a bank account or payout account on it, so whoever now holds the mailbox cannot redirect where a lister&apos;s share of a payment settles. Card payments are not held. The owner sees the end date in their settings.</li>
          <li>Any admin, or the owner, can cancel a request before it completes.</li>
        </ol>
      </section>
      {error ? (
        <p className="mt-md text-[length:var(--nf-text-body-sm)]">The requests could not be read just now. Refresh the page in a moment.</p>
      ) : (
        <RecoveryDesk
          rows={(data ?? []) as unknown as RecoveryRow[]}
          isSuperAdmin={access.isSuperAdmin}
          empty={
            <ui.QueueEmpty
              title="No recovery request is open"
              body="When somebody has lost the mailbox on their account, a super admin opens a request above with the NIN they give."
              everHadRows={false}
            />
          }
        />
      )}
    </div>
  );
}
