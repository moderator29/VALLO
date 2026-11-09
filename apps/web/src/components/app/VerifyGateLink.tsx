"use client";

import { ButtonLink } from "@/components/ui/Button";
import { VERIFY_ACTION } from "@/lib/identity/listing-verification-rule";

/**
 * THE BUTTON BESIDE THE IDENTITY GATE'S REFUSAL (Platform Grade 1, P0.3).
 * The twin of `PhoneGateLink`: a deal refused with `gate: "verification"`
 * draws this under its sentence, one button straight into /verification,
 * where the draft is waiting when they come back (drafts are kept on the
 * account and the device). Renders nothing unless `show`.
 */
export function VerifyGateLink({ show, full = false, className }: { show: boolean; full?: boolean; className?: string }) {
  if (!show) return null;
  return (
    <ButtonLink
      href="/verification"
      variant="primary"
      size="md"
      full={full}
      leadingIcon="shield-check"
      className={className}
      data-testid="verify-gate-link"
    >
      {VERIFY_ACTION}
    </ButtonLink>
  );
}
