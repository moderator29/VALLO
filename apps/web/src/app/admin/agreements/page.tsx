import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { rulingWords } from "../_components/rulings";
import { requireAdmin } from "@/lib/admin/guard";
import { readAgreementQueue, readGuaranteeDesk, readWatchList } from "@/lib/admin/reads/agreements";
import { GuaranteeClaims } from "../money/GuaranteeDesk";
import { PageHead, Panel } from "../_components/panels";
import { AgreementQueue } from "./AgreementQueue";
import { WatchList } from "./WatchList";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { agreementsContext } from "@/lib/admin/copilot/contexts/agreements";
import "./agreements.css";

export const metadata: Metadata = {
  title: "Agreements",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * THE GATE BETWEEN INSPECTION AND PAYMENT (Track A, 25 September 2026).
 *
 * An agreement reaches this queue only when the renter's inspection report
 * was submitted with its photos (for a rental) or the host accepted the stay,
 * and both parties confirmed the same version of the terms. Payment is not
 * available to anybody until a reviewer here approves it. Every decision is
 * written to `deal_agreement_events` and `audit_log` by the database, and both
 * parties hear about it by notification and by email.
 */
export default async function AgreementsDeskPage() {
  const locale = await getLocale();
  /* Track K: the agreement queue and the Guarantee claims are two scopes. An
     admin holds both; a staff member sees only what was granted. */
  const [access, claimsAccess] = await Promise.all([requireAdmin("agreements"), requireAdmin("guarantee")]);
  if (access.state !== "admin" && claimsAccess.state !== "admin") {
    return (
      <div className="nf-console">
        <PageHead title="Agreements" lede="Your account cannot open this desk." />
      </div>
    );
  }
  const now = requestTime();
  const claimsDesk =
    claimsAccess.state === "admin" && claimsAccess.isStaff
      ? await readGuaranteeDesk(claimsAccess.supabase, claimsAccess.userClient)
      : null;
  const claimsPanel = claimsDesk ? (
    <Panel title="Guarantee claims (made before it retired)" id="claims">
      {claimsDesk.state !== "ok" ? (
        <p className="nf-body">The claims could not be read just now. Refresh to try again.</p>
      ) : (
        <GuaranteeClaims claims={claimsDesk.claims} locale={locale} words={rulingWords(getDictionary(locale))} />
      )}
    </Panel>
  ) : null;
  if (access.state !== "admin") {
    return (
      <div className="nf-console">
        <PageHead title="Guarantee claims" lede="The Vallo Guarantee was retired on 9 November 2026. Decide each claim made before then against the inspection report and the agreement. The claimant reads your reason." />
        {claimsPanel}
      </div>
    );
  }
  const [queue, watch] = await Promise.all([readAgreementQueue(access.supabase), readWatchList(access.userClient)]);
  return (
    <div className="nf-console">
      <PageHead
        title="Agreements"
        lede="The rail decides the gate (D68d). A protected payment opens as soon as both parties agree, and you watch it while the provider holds it, with the power to pause a release. A direct payment waits here only when a risk signal fires. Both parties read a rejection's reason."
      />
      <p className="nf-risk-settings__back">
        <Link href="/admin/agreements/settings">Risk settings: threshold, signals and the incident switch</Link>
      </p>
      {queue.state !== "ok" ? (
        <Panel title="Waiting for review">
          <p className="nf-body">The queue could not be read just now. Nothing was changed. Refresh to try again.</p>
        </Panel>
      ) : (
        <>
          <Panel title="Watch list, riskiest first" id="watch">
            {watch === null ? (
              <p className="nf-body text-[var(--nf-content-secondary)]">The watch list opens once migration d68d is applied.</p>
            ) : (
              <WatchList rows={watch} locale={locale} />
            )}
          </Panel>
          <Panel title={`Waiting for review (${queue.waiting.length})`} id="waiting">
            <AgreementQueue rows={queue.waiting} locale={locale} now={now} />
          </Panel>
          <Panel title="Recently decided" id="decided">
            {queue.decided.length === 0 ? (
              <p className="nf-body text-[var(--nf-content-secondary)]">No decisions yet.</p>
            ) : (
              <ul className="nf-admin-queue">
                {queue.decided.map((row) => (
                  <li key={row.id} className="nf-admin-queue-row nf-admin-queue-row--done">
                    <span className="font-semibold">{row.listingTitle}</span>
                    <span className="text-[var(--nf-content-secondary)]">
                      {" "}
                      · {row.renterName} ← {row.ownerName} · {formatMoney(row.amountMinor, locale)} ·{" "}
                      {row.status === "rejected" ? `Sent back: ${row.decisionReason ?? ""}` : (DECIDED_WORDS[row.status] ?? row.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
      {claimsPanel}
      <DeskCopilot
        scope="agreements"
        deskName="Agreements"
        context={agreementsContext(
          queue.state === "ok"
            ? {
                waitingSubmittedAt: queue.waiting.map((row) => row.submittedAt),
                decidedRecently: queue.decided.length,
                watching: watch === null ? null : watch.length,
              }
            : null,
          now,
        )}
      />
    </div>
  );
}

/* The decided list printed the database's status ("approved", "paid") at the operator. */
const DECIDED_WORDS: Record<string, string> = { approved: "Approved", paid: "Paid" };

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
