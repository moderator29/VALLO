import { ADDRESS_PROOF_MAX_AGE_DAYS, type KycSubjectView } from "@/lib/admin/kyc-queries";
import type { AdminUi } from "../_components/ui";
import {
  KYC_DOCUMENT_KIND_WORDS,
  KYC_DOCUMENT_SUBTYPE_WORDS,
} from "@/components/app/untranslated";
import type { StatusTone } from "@/components/ui/StatusPill";
import { DocumentDecision } from "../_components/MoneyDecisions";
import { DocumentViewer } from "../_components/DocumentViewer";
import { CredentialForm } from "./CredentialForm";
import { IdentityAtAGlance } from "./IdentityAtAGlance";
import { getDictionary } from "@vallo/i18n";
import { consentReceipt } from "@/lib/admin/member-file-rules";

/* V-49 and V-87 copy on this card. The desk reads English. */
const DESK = getDictionary("en").trustVisible.desk;

/* The document vocabulary, staged in `components/app/untranslated.ts` with the
   rest of this owner's untranslated copy. These are NOT the F2-060 fault: that
   finding is about surfaces printing a raw column value at an operator, and
   these are written words somebody chose. They still belong in the dictionary,
   at `t.admin.kyc.documentKind` and `t.admin.kyc.documentSubtype`. */
export const KIND_LABEL = KYC_DOCUMENT_KIND_WORDS;
export const SUBTYPE_LABEL = KYC_DOCUMENT_SUBTYPE_WORDS;

/**
 * One mapping for both a document's review status and a ladder rung's, because
 * they use the same three words for the same three meanings and two tables that
 * agreed today would drift.
 */
export function toneForReview(status: string): StatusTone {
  if (status === "approved" || status === "passed") return "success";
  if (status === "rejected" || status === "failed") return "danger";
  return "warning";
}

export const RUNG_LABEL: Record<string, string> = {
  identity: "Identity",
  address: "Address",
  payout: "Payout account",
  in_person: "Met in person",
};


/**
 * One person's verification, everything the desk held about them: the ladder
 * with its pending rungs, the business details, and every document, opened in
 * place in the DocumentViewer and decided with DocumentDecision. Moved here
 * unchanged from the page so the queue table can open it under a row.
 */
export function SubjectCard({
  subject,
  ui,
  decidable = false,
}: {
  subject: KycSubjectView;
  ui: AdminUi;
  decidable?: boolean;
}) {
  return (
    <article>
      <div className="flex flex-wrap items-baseline gap-sm">
        <h3 className="text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
          {subject.displayName ?? "No display name"}
        </h3>
        <span className="nf-badge nf-badge--brand nf-numeric">Tier {subject.tier}</span>
        {subject.applicationReference ? (
          <span className="font-mono text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {subject.applicationReference}
          </span>
        ) : (
          /* Filed from /verification with no application behind it: the
             document row carries its uploader and nothing else. */
          <span className="nf-badge">From Get verified</span>
        )}
      </div>

      {subject.rungs.length > 0 && (
        <ul className="mt-xs flex flex-wrap gap-xs">
          {subject.rungs.map((rung) => (
            <li
              key={rung.kind}
              className="rounded-[var(--nf-radius-sm)] border border-[var(--nf-border-subtle)] px-xs py-2xs"
            >
              <span className="text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-primary)]">
                {RUNG_LABEL[rung.kind] ?? rung.kind}
              </span>{" "}
              {/* THE FIFTH RAW COLUMN VALUE, AND IT SURVIVED THE OTHER FOUR.
                  `label={rung.status}` printed `passed`, `failed` and
                  `pending` in lower case at a reviewer, three rows above a
                  document chip that had already been fixed. Its own vocabulary
                  rather than the document's: a rung's `pending` means an
                  automated check produced something a person has to look at,
                  and `kycReview`'s `pending` means nobody has opened it yet.
                  Borrowing the document words here would have told a reviewer a
                  rung was untouched when it was waiting on them. F2-060. */}
              <ui.StatusChip
                label={ui.columnLabel("kycRung", rung.status)}
                tone={toneForReview(rung.status)}
              />
              {rung.note && (
                <span className="mt-3xs block max-w-[52ch] text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
                  {rung.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Manual verification: the ID beside the selfie, the names to compare,
          the bank account name, and the checklist, before any document. */}
      <IdentityAtAGlance subject={subject} decidable={decidable} />

      {/* V-49: the Nigerian-name matcher's suggestion for the payout rung,
          both names side by side, marked as a suggestion. A person decides. */}
      {subject.payoutNameCheck && (
        <p
          className="mt-xs max-w-[60ch] text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]"
          data-testid="payout-name-suggestion"
        >
          <span className="font-semibold text-[var(--nf-content-primary)]">
            {DESK.payoutLabel}{" "}
            {subject.payoutNameCheck.match ? DESK.payoutMatch : DESK.payoutDiffer}
          </span>
          .{" "}
          {DESK.payoutNames
            .replace("{holder}", subject.payoutNameCheck.holder)
            .replace("{onRecord}", subject.payoutNameCheck.onRecord)}{" "}
          {subject.payoutNameCheck.reason}.
        </p>
      )}

      <ConsentReceipt subject={subject} ui={ui} />

      {/* V-87: dated credentials, recorded by the desk, never required. */}
      {decidable && subject.userId && <CredentialForm subjectId={subject.userId} desk={DESK} />}

      {subject.business && (
        <div className="mt-sm">
          <ui.DetailRow label="Business" value={subject.business.name} />
          <ui.DetailRow label="RC number" value={subject.business.registrationNumber} />
          <ui.DetailRow label="Tax id" value={subject.business.taxId} />
          <ui.DetailRow label="Business email" value={subject.business.email} />
          <ui.DetailRow label="Business phone" value={subject.business.phone} />
          <ui.DetailRow label="Established" value={ui.day(subject.business.establishedOn)} />
          <ui.DetailRow label="Business address" value={subject.business.address} />
        </div>
      )}

      <ul className="mt-sm space-y-sm">
        {subject.documents.map((doc) => (
          <li
            key={doc.id}
            className="rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] p-sm"
          >
            <div className="flex flex-wrap items-center gap-xs">
              <span className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                {KIND_LABEL[doc.kind] ?? doc.kind}
              </span>
              {doc.subtype && (
                <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-secondary)]">
                  {SUBTYPE_LABEL[doc.subtype] ?? doc.subtype}
                </span>
              )}
              {/* NOT `label={doc.reviewStatus}`, which printed raw lower-case
                  `pending`, `approved`, `rejected` at an operator. Not the
                  shared `statusLabel` either: its lower-case `pending` reads
                  "Awaiting reply", which is a support ticket's word and says
                  the wrong thing about a document nobody has looked at yet. */}
              <ui.StatusChip
                label={ui.columnLabel("kycReview", doc.reviewStatus)}
                tone={toneForReview(doc.reviewStatus)}
              />
              {doc.isResubmission && (
                <span className="nf-badge">Sent again after a rejection</span>
              )}
              {doc.tooOld && (
                <span className="nf-badge nf-badge--warning">
                  Older than {ADDRESS_PROOF_MAX_AGE_DAYS} days, or undated
                </span>
              )}
              <span className="ml-auto text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                {ui.when(doc.uploadedAt)}
              </span>
            </div>

            <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              Issued {ui.day(doc.issuedOn)}
              {doc.reviewedAt
                ? ` · decided ${ui.when(doc.reviewedAt)}${doc.reviewedByName ? ` by ${doc.reviewedByName}` : ""}`
                : ""}
            </p>

            {doc.nameOnDocument && (
              <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-secondary)]">
                Name on the ID: <span className="font-semibold text-[var(--nf-content-primary)]">{doc.nameOnDocument}</span>
              </p>
            )}

            {doc.rejectionReason && (
              <p className="mt-2xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-secondary)]">
                Sent back: {doc.rejectionReason}
              </p>
            )}

            {/* Opened in place. This was an anchor carrying a signed
                Supabase URL with `target="_blank"`, so a reviewer read
                somebody's NIN on `supabase.co`, in a tab that was not ours.
                Nobody leaves Vallo. */}
            <DocumentViewer
              documentId={doc.id}
              media={doc.media}
              label="Open the document"
              title={`${KIND_LABEL[doc.kind] ?? doc.kind}${
                doc.subtype ? `, ${SUBTYPE_LABEL[doc.subtype] ?? doc.subtype}` : ""
              }`}
              className="mt-xs inline-block text-[length:var(--nf-text-caption)] font-semibold underline"
            />

            {decidable && doc.reviewStatus === "pending" && (
              <DocumentDecision documentId={doc.id} kind={doc.kind} />
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * What this person agreed to when they sent the documents: the three
 * agreements `/verification` records in `kyc_consents`, worded as the form
 * worded them, with when. A missing one is named, because a reviewer should
 * not approve a check somebody did not consent to.
 */
function ConsentReceipt({ subject, ui }: { subject: KycSubjectView; ui: AdminUi }) {
  if (!subject.consentsRead) {
    return (
      <p className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-status-rejected)]">
        The consent receipt could not be read just now.
      </p>
    );
  }
  const receipt = consentReceipt(subject.consents);
  return (
    <div className="mt-xs" data-testid="kyc-consent-receipt">
      <p className="text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-primary)]">Consent receipt</p>
      {receipt.given.length === 0 ? (
        <p className="mt-3xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          No consent recorded. Documents sent from Get verified record three agreements; these came by an older path.
        </p>
      ) : (
        <ul className="mt-3xs space-y-3xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-secondary)]">
          {receipt.given.map((c) => (
            <li key={c.consent}>
              {c.words} · {ui.when(c.at)}
            </li>
          ))}
          {receipt.missing.length > 0 && (
            <li className="text-[var(--nf-status-rejected)]">Not given: {receipt.missing.join(", ")}</li>
          )}
        </ul>
      )}
    </div>
  );
}
