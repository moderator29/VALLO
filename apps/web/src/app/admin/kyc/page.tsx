import type { Metadata } from "next";
import { countOf, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getKycQueue, type KycSubjectView } from "@/lib/admin/kyc-queries";
import { getSupplyRoles, getVerificationSummary } from "@/lib/admin/reads/verification";
import { getBadgeTiers } from "@/lib/admin/reads/listings";
import { Constants } from "@/lib/supabase/database.types";
import { adminUi, type AdminUi } from "../_components/ui";
import { QueueFilters, readQueueQuery, type QueueStatusOption } from "../_components/QueueFilters";
import { Panel } from "../_review/parts";
import { ageShort } from "../_review/metrics";
import { LiveRefresh } from "@/app/admin/_components/LiveRefresh";
import { KIND_LABEL, SUBTYPE_LABEL, SubjectCard } from "./SubjectCard";
import { InternalNotes } from "../_components/InternalNotes";
import { notesOf, readMemberNotesFor } from "@/lib/admin/notes";
import { VerificationDesk, type RecentDecision, type VerificationRow } from "./VerificationDesk";
import { getIdentityChecks } from "@/lib/admin/identity-checks";
import { IdentityChecksPanel } from "./IdentityChecksPanel";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { kycContext } from "@/lib/admin/copilot/contexts/kyc";
import "../_review/review.css";

export const metadata: Metadata = {
  title: "Verification",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Verification, 8E9602E2 panel 2.
 *
 * The queue is grouped by PERSON, as it always was, because a reviewer's unit
 * of work is a person and not a file: approving somebody's passport while their
 * proof of address sits forty rows away is how one person ends up half
 * verified for a week. Each row opens that person's whole file (the ladder with
 * its pending rungs, business details, every document in the in-app
 * DocumentViewer, and DocumentDecision on each pending one, which calls
 * `reviewKycDocument` and through it `review_kyc_document`, which writes the
 * audit row and notifies the person).
 *
 * Status and date narrow the read; there is still NO SEARCH BOX, for the reason
 * `getKycQueue` gives: the subject's name is not on the document row.
 *
 * THE FIGURES are `getVerificationSummary` (lib/admin/reads/verification):
 * exact counts, never `getKycQueue`'s `pendingCount`, which is counted over a
 * 300-document cap. The Role column is each person's supply role
 * (`getSupplyRoles`), owner, agent or firm, as they registered.
 */
function statusFilters(ui: AdminUi): readonly QueueStatusOption[] {
  return Constants.public.Enums.document_review_status.map((value) => ({
    value,
    label: ui.columnLabel("kycReview", value),
  }));
}

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  const query = readQueueQuery(await searchParams);
  /* Not `queueNarrowed`, which counts `q`: there is no search box here, so a
     hand-typed `?q=` must not light up the no-match state. */
  const narrowed = Boolean(query.status || query.from || query.to);
  const [read, summary, selfie] = await Promise.all([
    getKycQueue({
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    }),
    getVerificationSummary(),
    getIdentityChecks(),
  ]);
  const selfieChecks =
    selfie.state === "ok" ? <IdentityChecksPanel waiting={selfie.waiting} decided={selfie.decided} /> : null;
  const summaryData = summary.state === "ok" ? summary.data : null;
  const copilot = (
    <DeskCopilot
      scope="kyc_review"
      deskName="KYC review"
      context={kycContext(
        summaryData
          ? {
              awaiting: summaryData.awaiting,
              awaitingLastWeek: summaryData.awaitingLastWeek,
              passedToday: summaryData.passedToday,
              failedToday: summaryData.failedToday,
              decisionsThisWeek: summaryData.decisionsThisWeek,
              medianDecisionMinutesThisWeek: summaryData.medianDecisionMinutes.thisWeek,
              selfieChecksWaiting: selfie.state === "ok" ? selfie.waiting.length : null,
            }
          : null,
      )}
    />
  );

  const filters = (
    <QueueFilters
      base="/admin/kyc"
      query={query}
      common={common}
      searchable={false}
      statuses={statusFilters(ui)}
    />
  );

  if (read.state !== "ok") {
    return (
      <>
        <VerificationDesk
          filters={filters}
          rows={[]}
          empty={{ title: "Nothing to show", body: "" }}
          summary={summaryData}
          recent={null}
          selfieChecks={selfieChecks}
          unavailable
        />
        {copilot}
      </>
    );
  }

  const { waiting, decided } = read.data;
  const now = nowMs();
  const waitingIds = waiting.map((subject) => subject.userId).filter((id): id is string => Boolean(id));
  /* Every waiting person's internal notes in one read, not one per row. */
  const [roles, badges, notes] = await Promise.all([
    getSupplyRoles(waitingIds),
    getBadgeTiers(waitingIds),
    readMemberNotesFor(waitingIds),
  ]);
  const ROLE_WORD = { owner: "Owner", agent: "Agent", firm: "Firm" } as const;
  const toRow = (subject: KycSubjectView, decidable: boolean): VerificationRow => {
    const latest = subject.documents.reduce<string | null>(
      (at, doc) => (at === null || doc.uploadedAt > at ? doc.uploadedAt : at),
      null,
    );
    return {
      id: subject.userId ?? subject.documents[0]?.id ?? "orphan",
      name: subject.displayName,
      badge: subject.userId ? (badges.get(subject.userId) ?? null) : null,
      role: (() => {
        const role =
          roles.state === "ok" && subject.userId ? roles.data.get(subject.userId) : undefined;
        return role ? ROLE_WORD[role] : subject.business ? "Business" : "Not recorded";
      })(),
      tier: subject.tier,
      rungsPassed: subject.rungs.filter((rung) => rung.status === "passed").length,
      submitted: latest ? ui.when(latest) : common.notRecorded,
      pending: subject.documents.filter((doc) => doc.reviewStatus === "pending").length,
      body: (
        <>
          <SubjectCard subject={subject} ui={ui} decidable={decidable} />
          {decidable && subject.userId ? (
            <InternalNotes subjectId={subject.userId} path="/admin/kyc" preloaded={notesOf(notes, subject.userId)} />
          ) : null}
        </>
      ),
    };
  };

  const recent: RecentDecision[] | null = summaryData
    ? summaryData.recent.map((doc) => ({
        id: doc.documentId,
        name: doc.name,
        what: `${KIND_LABEL[doc.kind] ?? doc.kind}${doc.subtype ? `, ${SUBTYPE_LABEL[doc.subtype] ?? doc.subtype}` : ""}`,
        approved: doc.approved,
        age: ageShort(doc.decidedAt, now) ?? "",
      }))
    : null;

  return (
    <>
      <LiveRefresh seconds={30} />
      <VerificationDesk
        filters={filters}
        rows={waiting.map((subject) => toRow(subject, true))}
        empty={
          narrowed
            ? { title: common.noMatchTitle, body: common.noMatchBody }
            : decided.length > 0
              ? {
                  title: "Nothing is waiting",
                  body: "Every document that has been uploaded has been decided. Somebody uploading one now appears here immediately.",
                  cause: "Documents arrive when an owner, an agent or a firm registers and proves who they are.",
                  link: { href: "/admin/agents", label: "Open the applications desk" },
                }
              : {
                  title: "No one has asked to be verified yet",
                  body: "Sellers, landlords and agents verify here; renters and buyers are never asked. The first identity, address or business document uploaded appears in this queue immediately.",
                  cause: "Documents arrive when an owner, an agent or a firm registers and proves who they are.",
                  link: { href: "/admin/agents", label: "Open the applications desk" },
                }
        }
        summary={summaryData}
        recent={recent}
        selfieChecks={selfieChecks}
        decided={
          decided.length > 0 ? (
            <Panel title="Recently decided" labelledBy="rv-kyc-decided">
              <div className="nf-rv-rows">
                {decided.map((subject) => (
                  <details key={subject.userId ?? subject.documents[0]?.id} className="nf-rv-rows__row">
                    <summary style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                      <span className="nf-rv-rows__cell">{subject.displayName ?? "No display name"}</span>
                      <span className="nf-rv-rows__cell nf-rv-table__muted">
                        {countOf(subject.documents.length, "documents")}
                      </span>
                    </summary>
                    <div className="nf-rv-detail__body">
                      <SubjectCard subject={subject} ui={ui} />
                    </div>
                  </details>
                ))}
              </div>
            </Panel>
          ) : null
        }
      />
      {copilot}
    </>
  );
}

/** Wall-clock time, read once per request. */
function nowMs(): number {
  return Date.now();
}
