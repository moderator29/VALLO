import Link from "next/link";
import { RequestSelfieWithId } from "./RequestSelfieWithId";
import type { KycDocumentView, KycSubjectView } from "@/lib/admin/kyc-queries";

/**
 * IDENTITY AT A GLANCE (manual verification, 2 November 2026).
 *
 * The one decision a reviewer is really making, laid out before any single
 * document: is the face in the selfie the face on the ID, and is the name on
 * the ID the name on the account and on the bank account they are paid into?
 * So the ID and the selfie sit side by side (streamed from our own origin by
 * `/api/documents/<id>`, behind staff auth, one audit row per view), the names
 * sit under them, and the checklist sits under that. The decisions themselves
 * stay on each document below, where the reasons are written.
 */

function newest(documents: readonly KycDocumentView[], kind: string): KycDocumentView | null {
  return (
    documents
      .filter((doc) => doc.kind === kind)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0] ?? null
  );
}

function Face({
  doc,
  label,
  missing,
  side = "front",
}: {
  doc: KycDocumentView | null;
  label: string;
  missing: string;
  /** Grade 1: the back of a two-sided ID, streamed by the same route. */
  side?: "front" | "back";
}) {
  const media = side === "back" ? doc?.backMedia : doc?.media;
  const src = side === "back" ? `/api/documents/${doc?.id}?side=back` : `/api/documents/${doc?.id}`;
  return (
    <figure className="grid gap-2xs" data-testid={`glance-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-secondary)]">
        {doc && media === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- streamed from our own origin behind staff auth, never optimised or cached
          <img src={src} alt={label} className="absolute inset-0 h-full w-full object-contain" loading="lazy" />
        ) : (
          <p className="absolute inset-0 grid place-items-center p-sm text-center text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            {doc ? "A PDF. Open it below to look at it." : missing}
          </p>
        )}
      </div>
      <figcaption className="text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-secondary)]">{label}</figcaption>
    </figure>
  );
}

function NameRow({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="grid gap-3xs">
      <dt className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{label}</dt>
      <dd className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {value ?? <span className="font-normal text-[var(--nf-content-muted)]">Not given</span>}
        {note ? <span className="block text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-secondary)]">{note}</span> : null}
      </dd>
    </div>
  );
}

export const REVIEW_CHECKLIST: readonly string[] = [
  "The ID is a real passport, driver's licence, NIN slip or card, voter's card, or another country's national ID card: the front and, for a card, the back, each a photo of the document itself, not a screenshot or a photo of a screen, with all four corners in view.",
  "It is not expired, and the photo, the name and the numbers are sharp, readable and not edited.",
  "The selfie is a live photo of a real face, not a photo of a photo, and it is the same person as the photo on the ID.",
  "The name on the ID is the name on the account. A different order or a missing middle name is fine; a different person is not.",
  "The proof of address is dated in the last three months and shows the same name.",
  "If you cannot confirm it, do not guess: ask for a selfie holding their ID (below), reject with a clear reason, or book a video call from Review calls.",
];

export function IdentityAtAGlance({ subject, decidable }: { subject: KycSubjectView; decidable: boolean }) {
  const id = newest(subject.documents, "identity");
  const selfie = newest(subject.documents, "selfie");
  if (!id && !selfie) return null;
  const bank = subject.payoutNameCheck;
  return (
    <section className="mt-sm rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] p-sm" aria-label="Identity at a glance" data-testid="identity-at-a-glance">
      <h4 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">Identity at a glance</h4>
      <div className="mt-xs grid max-w-md grid-cols-2 gap-sm">
        <Face doc={id} label={id?.issuingCountry ? `Their ID (issued in ${id.issuingCountry})` : "Their ID"} missing="No ID filed yet." />
        <Face
          doc={selfie}
          label={selfie?.answersRequest ? "Their selfie holding the ID" : "Their selfie"}
          missing="No selfie. Older sign-ups came without one: approve on the ID only if its photo is clear, or book a video call."
        />
        {id?.backMedia ? <Face doc={id} side="back" label="Back of their ID" missing="No back filed." /> : null}
      </div>

      <dl className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-2">
        <NameRow label="Name given at sign-up" value={subject.namesOnRecord.account} />
        <NameRow label="Name on their application" value={subject.namesOnRecord.application} />
        <NameRow label="Name printed on the ID" value={subject.identityName} note={subject.identityName ? undefined : "Typed by the reviewer who approves the ID."} />
        <NameRow
          label="Bank account they are paid into"
          value={bank?.holder ?? null}
          note={
            bank
              ? `${bank.match ? "Matches" : "Does not match"} ${bank.onRecord}. ${bank.reason}.`
              : "No bank account added yet. The name is checked with the bank when they add one."
          }
        />
      </dl>
      {bank && (
        <p
          className={`mt-2xs inline-block rounded-[var(--nf-radius-sm)] px-xs py-3xs text-[length:var(--nf-text-overline)] font-semibold ${
            bank.match ? "bg-[var(--nf-status-approved-surface)] text-[var(--nf-status-approved)]" : "bg-[var(--nf-status-rejected-surface)] text-[var(--nf-status-rejected)]"
          }`}
          data-testid="glance-bank-match"
        >
          {bank.match ? "Bank name matches" : "Bank name differs: look closer"}
        </p>
      )}

      {/* Not trusted: ask for a selfie holding the ID. Never a step of the flow. */}
      {decidable && subject.userId ? (
        <RequestSelfieWithId
          subjectId={subject.userId}
          open={subject.request?.status === "open" ? { requestedAt: subject.request.requestedAt, message: subject.request.message } : null}
        />
      ) : null}
      {subject.request?.status === "answered" && selfie?.answersRequest ? (
        <p className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]" data-testid="request-answered">
          They sent the selfie holding their ID that was asked for. Compare both faces and the ID in their hand.
        </p>
      ) : null}

      <details className="mt-sm" open={decidable} data-testid="review-checklist">
        <summary className="cursor-pointer text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
          Before you approve
        </summary>
        <ol className="mt-xs list-decimal space-y-2xs pl-lg text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {REVIEW_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <Link href="/admin/kyc/guide" className="mt-xs inline-block text-[length:var(--nf-text-caption)] font-semibold underline">
          Open the reviewer guide
        </Link>
      </details>
    </section>
  );
}
