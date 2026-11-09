"use client";

import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import { Checkbox } from "@/components/ui/Check";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * THE TWO TICKS BEFORE A WORKSPACE APPLICATION OR SETUP IS SENT (founder
 * ruling 6, 13 October 2026):
 *
 *   I have read and accept the Terms of Service and the Privacy Policy
 *   Every payment for a deal I make on Vallo happens inside Vallo.
 *
 * Both documents open in a new tab, so the form behind them is not lost. The
 * form refuses to send until both are ticked; the server action refuses
 * again and records the acceptance with each version and the moment
 * (`lib/legal/workspace-acceptance.ts`), and the database refuses a
 * submission without it (pending migration pov08).
 *
 * `showTerms` is false where the form already asks for the Terms and the
 * Privacy Policy in its own words (the host wizard's Host Agreement tick):
 * then only the second tick is drawn.
 */
export function WorkspaceAcceptance({
  copy,
  terms,
  pay,
  onTerms,
  onPay,
  showError = false,
  showTerms = true,
  className,
}: {
  copy: Pick<Dictionary["payChoice"], "accept">;
  terms: boolean;
  pay: boolean;
  onTerms: (next: boolean) => void;
  onPay: (next: boolean) => void;
  /** True once a send was refused for want of a tick. */
  showError?: boolean;
  showTerms?: boolean;
  className?: string;
}) {
  const a = copy.accept;
  const missing = showError && ((showTerms && !terms) || !pay);
  return (
    <section
      className={["nf-panel nf-panel--card block p-sm", className ?? ""].filter(Boolean).join(" ")}
      aria-label={a.title}
      data-testid="workspace-acceptance"
    >
      <p className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">{a.title}</p>
      <div className="mt-xs grid gap-2xs">
        {showTerms ? (
          <Checkbox
            name="acceptTerms"
            checked={terms}
            onChange={(event) => onTerms(event.target.checked)}
            data-testid="accept-terms"
            aria-invalid={showError && !terms ? true : undefined}
          >
            {a.termsLead}{" "}
            <Link href="/terms" target="_blank" rel="noopener" className="text-[var(--nf-content-link)] underline">
              {a.termsLink}
              <span className="sr-only"> ({a.newTab})</span>
            </Link>{" "}
            {a.and}{" "}
            <Link href="/privacy" target="_blank" rel="noopener" className="text-[var(--nf-content-link)] underline">
              {a.privacyLink}
              <span className="sr-only"> ({a.newTab})</span>
            </Link>
          </Checkbox>
        ) : null}
        <Checkbox
          name="acceptPayOnVallo"
          checked={pay}
          onChange={(event) => onPay(event.target.checked)}
          data-testid="accept-pay-on-vallo"
          aria-invalid={showError && !pay ? true : undefined}
        >
          {a.payInside}
        </Checkbox>
      </div>
      {/* The boxes keep their red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id="workspace-acceptance-problem" message={missing ? a.required : null} />
    </section>
  );
}
