"use client";

import { useState } from "react";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { decideClaim, markClaimPaid } from "@/lib/admin/agreements-actions";
import type { ClaimRow } from "@/lib/admin/reads/agreements";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import type { RulingWords } from "../_components/rulings";
import { banner } from "@/lib/ui/toast";

/**
 * GUARANTEE CLAIMS, DECIDED BY A PERSON.
 *
 * A claim is never paid automatically. The reviewer approves an amount (the
 * database refuses anything above what the claim asked, what the booking
 * still has to claim against, or what the reserve actually holds), or rejects
 * with a reason the claimant reads. An approved claim is paid from the
 * reserve's own bank account by transfer and marked paid here with the bank
 * reference, so the reserve's ledger and the bank statement agree line for
 * line.
 */

const ITEM_LABEL: Record<string, string> = {
  exterior: "Exterior",
  interior: "Interior",
  kitchen: "Kitchen",
  bathrooms: "Bathrooms",
  utilities: "Utilities",
  appliances: "Appliances",
  safety: "Safety",
  overall: "Overall condition",
};

function ClaimItem({ claim, locale, words }: { claim: ClaimRow; locale: Locale; words: RulingWords }) {
  const [amount, setAmount] = useState(String(claim.requestedMinor / 100));
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  /* A ruling is a slide, and a slide is only confirmed once the server has
     said so: this returns what the server said, so the track never claims a
     decision that was refused. */
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string): Promise<boolean> => {
    const result = await fn();
    /* The outcome goes to the banner. No retry on a refusal: a ruling moves
       money, so trying again means sliding again. */
    if (result.ok) banner.success(done);
    else banner.error(result.error ?? "That did not go through.");
    return result.ok;
  };

  return (
    <li className="nf-admin-queue-row" data-testid="claim-row" data-status={claim.status}>
      <div className="nf-admin-queue-row__main">
        <p className="font-semibold">
          {claim.listingTitle} · {claim.claimantName}
          <span className="ml-inline nf-admin-badge nf-admin-badge--info">{claim.status}</span>
        </p>
        <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
          Asked {formatMoney(claim.requestedMinor, locale)}
          {claim.approvedMinor ? ` · approved ${formatMoney(claim.approvedMinor, locale)}` : ""}
          {claim.items.length ? ` · cites ${claim.items.map((i) => ITEM_LABEL[i] ?? i).join(", ")}` : ""}
          {claim.evidenceCount ? ` · ${claim.evidenceCount} new evidence files` : ""}
          {claim.paidReference ? ` · paid, ref ${claim.paidReference}` : ""}
        </p>
        <p className="mt-2xs text-[length:var(--nf-text-caption)]">{claim.description}</p>
        {claim.decisionReason ? (
          <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
            Reason: {claim.decisionReason}
          </p>
        ) : null}
      </div>
      <div className="nf-admin-queue-row__actions">
        {claim.status === "submitted" ? (
          <div className="grid gap-inline">
            <label className="text-[length:var(--nf-text-caption)]">
              Pay from the Guarantee (₦)
              <input className="nf-field mt-3xs" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="text-[length:var(--nf-text-caption)]">
              Reason (required to reject)
              <input className="nf-field mt-3xs" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
            </label>
            {/* Approving commits the reserve to pay the claimant, so it is a money
                slide that never resets; rejecting is a ruling and a slide too. */}
            <div className="grid gap-inline">
              <DragToConfirm
                money
                armedLabel={words.armed}
                label={words.slideApprove}
                confirmingLabel={words.confirming}
                confirmedLabel={words.confirmed}
                errorLabel={words.error}
                onConfirm={() =>
                  run(
                    () => decideClaim({ claimId: claim.id, decision: "approve", amountNaira: amount, reason }),
                    "Approved. The claimant was told; pay it from the reserve account and mark it paid.",
                  )
                }
                data-testid="claim-approve"
              />
              <DragToConfirm
                label={words.slideReject}
                confirmingLabel={words.confirming}
                confirmedLabel={words.confirmed}
                errorLabel={words.error}
                disabled={reason.trim().length < 10}
                onConfirm={() =>
                  run(() => decideClaim({ claimId: claim.id, decision: "reject", reason }), "Rejected. The claimant was told why.")
                }
                data-testid="claim-reject"
              />
            </div>
          </div>
        ) : claim.status === "approved" ? (
          <div className="grid gap-inline">
            <label className="text-[length:var(--nf-text-caption)]">
              Bank transfer reference
              <input className="nf-field mt-3xs" value={reference} onChange={(e) => setReference(e.target.value)} />
            </label>
            <DragToConfirm
              money
              armedLabel={words.armed}
              label={words.slidePaid}
              confirmingLabel={words.confirming}
              confirmedLabel={words.confirmed}
              errorLabel={words.error}
              disabled={reference.trim().length < 4}
              onConfirm={() => run(() => markClaimPaid({ claimId: claim.id, reference }), "Marked paid. The claimant was told.")}
              data-testid="claim-paid"
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function GuaranteeClaims({ claims, locale, words }: { claims: ClaimRow[]; locale: Locale; words: RulingWords }) {
  if (claims.length === 0) {
    return <p className="nf-body text-[var(--nf-content-secondary)]">No claims have been made on the Guarantee.</p>;
  }
  return (
    <ul className="nf-admin-queue" data-testid="guarantee-claims">
      {claims.map((claim) => (
        <ClaimItem key={claim.id} claim={claim} locale={locale} words={words} />
      ))}
    </ul>
  );
}
