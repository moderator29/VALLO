import Link from "next/link";
import { PAYMENT_GATE_SENTENCE } from "@/lib/money/copy";
import { StepPath, type PathState } from "@/components/money/StepPath";

/**
 * What a pay screen shows before payment is available.
 *
 * TRACK A. Payment opens only when the agreement is approved. Until then a pay
 * screen does not draw a button that the database would refuse: it says which
 * step the agreement is at and takes the person to it.
 *
 * D72: the same sentence and the same link, drawn as reference 2's path
 * (agree, review, pay) so a member sees where the deal is at a glance. The
 * path only shows the status it is given; it never decides when payment
 * opens, which stays the agreement's approval and nothing else.
 */

const STEP: Record<string, string> = {
  awaiting_parties: "The agreement is waiting for both of you to confirm the terms.",
  in_review: "Both of you have confirmed. Vallo is reviewing the agreement now; you will get an email and a notification when it is decided.",
  rejected: "Vallo sent the agreement back. Read the reason, change the terms and confirm again.",
  cancelled: "This agreement was cancelled, so there is nothing to pay.",
  paid: "This is already paid.",
};

/** Where each agreement status stands on agree, review, pay. */
function trackFor(status: string | null): [PathState, PathState, PathState] {
  switch (status) {
    case "in_review":
      return ["done", "waiting", "upcoming"];
    case "rejected":
      return ["current", "problem", "upcoming"];
    case "paid":
      return ["done", "done", "done"];
    case "cancelled":
      return ["upcoming", "upcoming", "upcoming"];
    case "awaiting_parties":
    default:
      return ["current", "upcoming", "upcoming"];
  }
}

export function PaymentGate({
  agreement,
}: {
  agreement: { id: string; status: string; reason: string | null } | null;
}) {
  const line = agreement ? (STEP[agreement.status] ?? PAYMENT_GATE_SENTENCE) : PAYMENT_GATE_SENTENCE;
  const [agree, review, pay] = trackFor(agreement?.status ?? null);
  return (
    <section
      aria-labelledby="nf-payment-gate"
      className="nf-card nf-gate p-card"
      data-testid="payment-gate"
      data-agreement-status={agreement?.status ?? "none"}
    >
      <h2 id="nf-payment-gate" className="nf-h3">
        Payment is not open yet
      </h2>
      <p className="nf-body mt-inline text-[var(--nf-content-secondary)]">{line}</p>
      <div className="mt-block">
        <StepPath
          compact
          label="Where the agreement is"
          testId="payment-gate-track"
          steps={[
            { key: "agree", title: "Agree", sub: "Both of you confirm the terms.", state: agree },
            {
              key: "review",
              title: "Review",
              sub:
                agreement?.status === "rejected"
                  ? "Sent back. Change the terms and confirm again."
                  : /* Usually the system approves at once (D83); a person looks only when a risk signal fires. */
                    "Approved at once, unless something needs a second look.",
              state: review,
            },
            { key: "pay", title: "Pay", sub: "Payment opens once it is approved.", state: pay },
          ]}
        />
      </div>
      {agreement?.status === "rejected" && agreement.reason ? (
        <p className="nf-body nf-gate__reason mt-block">
          <strong>Reason: </strong>
          {agreement.reason}
        </p>
      ) : null}
      <p className="nf-caption mt-block text-[var(--nf-content-muted)]">{PAYMENT_GATE_SENTENCE}</p>
      {agreement ? (
        <Link href={`/agreements/${agreement.id}`} className="nf-btn nf-btn--primary mt-block inline-flex">
          Open the agreement
        </Link>
      ) : null}
    </section>
  );
}
