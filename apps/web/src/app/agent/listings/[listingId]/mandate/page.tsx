import type { Metadata } from "next";
import { formatDate, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getAgentContext, agentProfileFrom } from "@/lib/agent/listings-queries";
import { readMyListingMandate } from "@/lib/compliance/beneficial-ownership-queries";
import { MANDATE_GRACE_ENDS } from "@/lib/compliance/beneficial-ownership";
import { AgentShell } from "@/components/agent/AgentShell";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/app/Screen";
import { ListingPitch } from "../../../list/ListingPitch";
import { MandateForm } from "./MandateForm";
import { requestNow } from "@/lib/format/when";

export const metadata: Metadata = { title: "Owner's mandate", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

/**
 * `/agent/listings/<id>/mandate`: WHO YOU ARE LETTING FOR (SCUML item 17).
 *
 * An agent or firm listing goes live only once we have confirmed the owner
 * who instructed the lister. The agent adds the owner's name, number and how
 * they stand to the property; staff ring the owner and approve. The page
 * frames it as what it is to the agent: the check that makes their listing
 * worth trusting. It never names the regulation to them.
 *
 * States: the pitch (not a lister), not theirs, owner-listed, an example, a
 * failed read, the form with the mandate's own state above it, and the
 * renewal: from 30 days before the current mandate ends, a replacement may be
 * filed beside it (20260924171100).
 */
export default async function ListingMandatePage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.complianceBeneficialOwnership.lister;
  const context = await getAgentContext();
  if (context.state !== "agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }
  const profile = agentProfileFrom(context.agent);
  const read = await readMyListingMandate(listingId);
  const day = (iso: string) =>
    formatDate(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso), locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Lagos",
    });

  const stop =
    read.state === "failed"
      ? copy.failed
      : read.state === "not_yours"
        ? copy.notYours
        : read.isDemo
          ? copy.example
          : read.role === "owner"
            ? copy.owner
            : null;

  if (stop !== null || read.state !== "ok") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={profile}>
        <EmptyState
          icon="home-search"
          title={copy.title}
          body={stop ?? copy.failed}
          action={
            <ButtonLink href="/agent/listings" variant="primary">
              {copy.back}
            </ButtonLink>
          }
        />
      </AgentShell>
    );
  }

  const m = read.mandate;
  const cur = read.current;
  const pending = m && m.status === "pending" ? m : null;
  const graceOpen = requestNow() < Date.parse(`${MANDATE_GRACE_ENDS}T00:00:00+01:00`);
  return (
    <AgentShell t={t} locale={locale} active="/agent/listings" profile={profile}>
      <div className="mx-auto flex max-w-md flex-col gap-group py-lg" data-testid="listing-mandate-page">
        <div>
          <h1 className="nf-h2">{copy.title}</h1>
          <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{copy.lede}</p>
          <p className="mt-inline nf-body-sm">{copy.whyLive}</p>
        </div>
        {read.needsMandateSince ? (
          <p className="nf-body-sm" role="status" data-testid="mandate-taken-down">
            {copy.takenDown}
          </p>
        ) : read.listingStatus === "PUBLISHED" && graceOpen && !cur ? (
          <p className="nf-body-sm" role="status">
            {copy.grace.replace("{date}", day(MANDATE_GRACE_ENDS))}
          </p>
        ) : null}
        {cur && read.renewalOpen ? (
          /* Renewal (SCUML item 17): the current mandate is running out or has
             ended. A renewal waits beside it and takes over once confirmed. */
          <>
            <p className="nf-body-sm" role="status" data-testid="mandate-renewal-due">
              {(read.currentExpired ? copy.renewEnded : copy.renewDue)
                .replace("{name}", cur.principalName)
                .replace("{date}", cur.expiresOn ? day(cur.expiresOn) : "")}
            </p>
            {pending && (
              <p className="nf-body-sm" role="status" data-testid="mandate-renewal-waiting">
                {(read.currentExpired ? copy.renewWaitingEnded : copy.renewWaiting).replace("{name}", pending.principalName)}
              </p>
            )}
            {!pending && read.lastRefusal?.reason && (
              <p className="nf-body-sm" role="alert" style={{ color: "var(--nf-state-error)" }} data-testid="mandate-renewal-refused">
                {copy.rejected.replace("{reason}", read.lastRefusal.reason)}
              </p>
            )}
            <MandateForm listingId={listingId} copy={copy} initial={pending} template={cur} renewing today={read.today} />
          </>
        ) : m?.status === "approved" ? (
          <p className="nf-body-sm" role="status" data-testid="mandate-approved">
            {copy.approved.replace("{name}", m.principalName).replace("{date}", m.reviewedAt ? day(m.reviewedAt) : "")}
          </p>
        ) : (
          <>
            {m?.status === "pending" && (
              <p className="nf-body-sm" role="status" data-testid="mandate-waiting">
                {copy.waiting.replace("{name}", m.principalName)}
              </p>
            )}
            {m?.status === "rejected" && (
              <p className="nf-body-sm" role="alert" style={{ color: "var(--nf-state-error)" }} data-testid="mandate-rejected">
                {copy.rejected.replace("{reason}", m.rejectionReason ?? "")}
              </p>
            )}
            <MandateForm listingId={listingId} copy={copy} initial={m && m.status === "pending" ? m : null} today={read.today} />
          </>
        )}
      </div>
    </AgentShell>
  );
}
