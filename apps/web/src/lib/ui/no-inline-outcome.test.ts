import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { inlineOutcomes, type InlineOutcomeCounts } from "./inline-outcomes";

/**
 * NO OUTCOME IS WRITTEN BESIDE A CONTROL ANY MORE (founder, 7 November 2026,
 * "THE BANNER EVERYWHERE"). Successes, failures, warnings and a field's
 * problem are said by the one top banner (`lib/ui/toast.ts`); a field keeps
 * only its red edge and a visually hidden note (`components/ui/FieldProblem`).
 * The list of moments and what each became is docs/handoff/BANNER_MOMENTS.md.
 *
 * This fails when a page or component gains an inline outcome: an element
 * with `role="alert"`, or a line of words painted in the error ink
 * (`--nf-state-error`), outside the places below. Each place says why it is
 * not an outcome (a page that could not be read, a live call screen, the
 * page's own record, data). It is a ratchet both ways: a file that gains one
 * fails, and a file that loses one fails too until its number here comes
 * down, so the list only ever shrinks. Rows marked TO CONVERT NEXT are
 * outcomes still waiting for the banner.
 */

const SRC = join(__dirname, "..", "..");

const ALLOWED = new Map<string, InlineOutcomeCounts & { why: string }>([
  ["app/(app)/checkout/[bookingId]/HoldCountdown.tsx", { alert: 0, errorText: 1, why: "the hold clock turns red when it has run out: a live state, not an outcome" }],
  ["app/(app)/messages/Inbox.tsx", { alert: 0, errorText: 1, why: "a missed-call badge on a conversation row: data" }],
  ["app/(app)/messages/[id]/ThreadView.tsx", { alert: 0, errorText: 1, why: "a missed-call line in the thread: data" }],
  ["app/(app)/settings/DeleteAccountPanel.tsx", { alert: 0, errorText: 2, why: "the scheduled-deletion record panel and its mark: the page's own record" }],
  ["app/(app)/settings/devices/DeviceList.tsx", { alert: 1, errorText: 0, why: "the device list could not be read: a page state" }],
  ["app/(app)/settings/privacy/PendingAddressMove.tsx", { alert: 1, errorText: 0, why: "a pending address change, with Cancel: the page's own record" }],
  ["app/(app)/settings/privacy/blocked/page.tsx", { alert: 1, errorText: 0, why: "the blocked list could not be read: a page state" }],
  ["app/(site)/delete-account/page.tsx", { alert: 0, errorText: 1, why: "a red bullet in the list of what deletion destroys: content" }],
  ["app/(site)/safe/[token]/SafetySharePanel.tsx", { alert: 0, errorText: 2, why: "the safety page's 'not safe' state, read by a trusted contact: the page's content" }],
  ["app/admin/_components/ActingFor.tsx", { alert: 1, errorText: 2, why: "the acting-for record could not be read, and its refused rows: a page state and data" }],
  ["app/admin/_lanes/ModerationDesk.tsx", { alert: 0, errorText: 1, why: "an overdue KPI label: data" }],
  ["app/admin/_lanes/SafetyHolds.tsx", { alert: 1, errorText: 0, why: "the holds could not be read: a page state" }],
  ["app/admin/compliance/_lanes/BeneficialOwnershipLane.tsx", { alert: 1, errorText: 1, why: "the desk could not be read: a page state" }],
  ["app/admin/compliance/_lanes/PepLane.tsx", { alert: 1, errorText: 0, why: "the lane could not be read: a page state" }],
  ["app/admin/compliance/_lanes/RiskLane.tsx", { alert: 1, errorText: 0, why: "the lane could not be read: a page state" }],
  ["app/admin/compliance/_lanes/SanctionsLane.tsx", { alert: 3, errorText: 0, why: "facts about the loaded list a reviewer must see while working (none loaded, the list shrank)" }],
  ["app/admin/compliance/_lanes/StrLane.tsx", { alert: 3, errorText: 4, why: "the cases, releases and register could not be read: page states" }],
  ["app/admin/compliance/error.tsx", { alert: 1, errorText: 0, why: "the error boundary of the compliance desk" }],
  ["app/admin/examples/RetireExamples.tsx", { alert: 0, errorText: 1, why: "the retire form's danger frame: a border, not words" }],
  ["app/admin/kyc/IdentityChecksPanel.tsx", { alert: 0, errorText: 1, why: "'Sandbox: test data' on a check: data" }],
  ["app/admin/listings/MandateDecision.tsx", { alert: 0, errorText: 1, why: "the decision frame's danger edge on refusing: not an outcome line" }],
  ["app/admin/listings/MandatesPanel.tsx", { alert: 0, errorText: 1, why: "the mandates could not be read: a page state" }],
  ["app/admin/listings/[id]/FeeAcceptancePanel.tsx", { alert: 1, errorText: 0, why: "the fee acceptance could not be read: a page state" }],
  ["app/admin/listings/[id]/ListingReview.tsx", { alert: 0, errorText: 2, why: "a failed check's mark in the listing review: data" }],
  ["app/admin/social/page.tsx", { alert: 0, errorText: 1, why: "a held post's flag on the moderation page: data" }],
  ["app/agent/analytics/page.tsx", { alert: 1, errorText: 0, why: "analytics could not be read: a page state" }],
  ["app/agent/earnings/EarningsWorkspace.tsx", { alert: 1, errorText: 0, why: "earnings could not be read: a page state" }],
  ["app/agent/listings/[listingId]/mandate/page.tsx", { alert: 2, errorText: 2, why: "the mandate's recorded state (renewal refused, rejected with the reason): the page's own record" }],
  ["app/agent/messages/AgentInbox.tsx", { alert: 0, errorText: 1, why: "a missed-call badge: data" }],
  ["app/agent/verification/VerificationLadder.tsx", { alert: 0, errorText: 1, why: "a failed rung on the verification ladder: data" }],
  ["app/error.tsx", { alert: 1, errorText: 0, why: "the root error boundary" }],
  ["app/host/bookings/page.tsx", { alert: 1, errorText: 0, why: "bookings could not be read: a page state" }],
  ["app/host/calendar/page.tsx", { alert: 1, errorText: 0, why: "the calendar could not be read: a page state" }],
  ["components/agent/intel/RangeSwitch.tsx", { alert: 0, errorText: 1, why: "a falling figure in red: data" }],
  ["components/app/ListingCard.tsx", { alert: 0, errorText: 2, why: "kept for callers of the card's note; SaveControl sets it to null since round 1, the banner says it" }],
  ["components/app/PhoneField.tsx", { alert: 0, errorText: 1, why: "TO CONVERT NEXT (BANNER_MOMENTS.md): the phone field's live hint turns red on a bad number" }],
  ["components/app/ResultSheet.tsx", { alert: 1, errorText: 0, why: "a failed payment's result sheet: the sheet is the outcome" }],
  ["components/app/account/SupportChat.tsx", { alert: 0, errorText: 1, why: "TO CONVERT NEXT (BANNER_MOMENTS.md): the support chat's escalation status line" }],
  ["components/app/confirm/ConfirmPanel.tsx", { alert: 1, errorText: 0, why: "a confirm panel's rich (non-text) error node; string errors go to the banner" }],
  ["components/app/inspections/GateHandshake.tsx", { alert: 1, errorText: 0, why: "the gate handshake's live warning while two people stand at a gate" }],
  ["components/app/media/SafeVideo.tsx", { alert: 1, errorText: 0, why: "a video that could not play, in place of the video" }],
  ["components/app/messages/AccountMomentCard.tsx", { alert: 0, errorText: 1, why: "an account card's 'not on record' figure: data" }],
  ["components/app/messages/ShareSheet.tsx", { alert: 1, errorText: 1, why: "the QR code could not be drawn, in place of the QR" }],
  ["components/app/messages/VoiceNote.tsx", { alert: 1, errorText: 0, why: "a voice note that failed, on its own bubble" }],
  ["components/app/payments/AddBankAccountSheet.tsx", { alert: 1, errorText: 1, why: "the bank list could not load, with its own Try again, inside the sheet" }],
  ["components/app/push/PushDevices.tsx", { alert: 1, errorText: 0, why: "the device list could not be read: a page state" }],
  ["components/app/reservations/DepositReturnCheck.tsx", { alert: 0, errorText: 1, why: "the deposit-return record: the page's own record" }],
  ["components/calls/views.tsx", { alert: 2, errorText: 0, why: "the call screen's own live status over the call" }],
  ["components/compliance/PepQuestionPanel.tsx", { alert: 1, errorText: 0, why: "the question could not be read: a page state" }],
  ["components/host/DecideView.tsx", { alert: 1, errorText: 0, why: "the queue could not be read: a page state" }],
  ["components/host/StatementView.tsx", { alert: 2, errorText: 0, why: "the statement could not be read: a page state" }],
  ["components/host/reviews/HostReviewsView.tsx", { alert: 1, errorText: 0, why: "the reviews could not be read: a page state" }],
  ["components/money/WithdrawalMaths.tsx", { alert: 1, errorText: 0, why: "the withdrawal quote could not be read, in the maths card" }],
  ["components/social/feed/Composer.tsx", { alert: 0, errorText: 2, why: "the over-length counter, and the lost-picture recovery panel with its two ways on" }],
  ["components/social/feed/PostEditor.tsx", { alert: 0, errorText: 1, why: "the over-length counter turns red" }],
  ["components/ui/AIResponse.tsx", { alert: 1, errorText: 0, why: "an assistant answer that did not come, in the answer block" }],
  ["components/ui/Field.tsx", { alert: 0, errorText: 1, why: "the required-field asterisk" }],
  ["components/verification/KycFlow.tsx", { alert: 1, errorText: 1, why: "the review step's checklist of what is missing" }],
  ["components/verification/VninPanel.tsx", { alert: 0, errorText: 1, why: "TO CONVERT NEXT (BANNER_MOMENTS.md): the vNIN check's message line" }],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".tsx") && !/\.test\.tsx$/.test(name)) out.push(path);
  }
  return out;
}

/** The developer's own galleries and the style guide draw every state on purpose. */
const NOT_PRODUCT = /^app\/\(dev\)\/|\/gallery\/|styleguide/;

describe("inline outcomes", () => {
  it("recognises role=alert and error-ink words, and leaves comments and other inks alone", () => {
    const sample = [
      'const a = <p role="alert">That did not go through</p>;',
      'const b = <span className="nf-caption text-[var(--nf-state-error)]">{error}</span>;',
      'const c = <p style={{ color: "var(--nf-state-error)" }}>{note}</p>;',
      "const d = <p>{/* role=\"alert\" text-[var(--nf-state-error)] */}</p>;",
      'const e = <p className="text-[var(--nf-content-muted)]" role="status">Saving</p>;',
      'const f = <UiIcon className="text-[var(--nf-state-error)]" />;',
    ].join("\n");
    expect(inlineOutcomes("sample.tsx", sample)).toEqual({ alert: 1, errorText: 2 });
  });

  it("says every outcome through the banner, outside the places allowed with a reason", () => {
    const found = new Map<string, InlineOutcomeCounts>();
    for (const root of ["app", "components"]) {
      for (const path of walk(join(SRC, root))) {
        const file = relative(SRC, path).split("\\").join("/");
        if (NOT_PRODUCT.test(file)) continue;
        const counts = inlineOutcomes(file, readFileSync(path, "utf8"));
        if (counts.alert > 0 || counts.errorText > 0) found.set(file, counts);
      }
    }
    const problems: string[] = [];
    for (const [file, counts] of found) {
      const allowed = ALLOWED.get(file);
      if (!allowed) {
        problems.push(`${file}: ${counts.alert} role="alert", ${counts.errorText} error-ink line(s). Say it with banner (lib/ui/toast.ts) or FieldProblem, or add it to ALLOWED with the reason it is not an outcome.`);
        continue;
      }
      if (counts.alert > allowed.alert || counts.errorText > allowed.errorText) {
        problems.push(`${file}: grew to ${counts.alert} role="alert" and ${counts.errorText} error-ink, allowed ${allowed.alert} and ${allowed.errorText}.`);
      } else if (counts.alert < allowed.alert || counts.errorText < allowed.errorText) {
        problems.push(`${file}: now ${counts.alert} and ${counts.errorText}; lower its row in ALLOWED to match, so the list only shrinks.`);
      }
    }
    for (const file of ALLOWED.keys()) {
      if (!found.has(file)) problems.push(`${file}: has none left (or moved); remove its row from ALLOWED.`);
    }
    expect(problems).toEqual([]);
  });
});
