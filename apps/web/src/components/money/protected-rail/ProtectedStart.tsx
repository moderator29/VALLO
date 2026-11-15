"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { startProtected } from "@/lib/money/protected-actions";
import { PROTECTED_IDENTITY_DONE, PROTECTED_START_PENDING } from "@/lib/money/copy";
import type { ProtectedStartRead } from "@/lib/money/protected-start";
import { IdentityCheck } from "./IdentityCheck";
import { ReviewProtection } from "./ReviewProtection";

/**
 * THE START OF A PROTECTED PAYMENT on the agreement's funding page: the
 * review (spec screen 2), then, for a payer the holder of the money has not
 * checked yet, the one identity check, then the open. The screen only ASKS;
 * the server opens the payment on the exact agreement version shown, and the
 * page reads the recorded state again and draws the transfer details from it.
 */
export function ProtectedStart({ start, locale }: { start: ProtectedStartRead; locale: Locale }) {
  const router = useRouter();
  const [step, setStep] = useState<"review" | "identity">("review");
  const [pending, run] = useTransition();

  const open = () => {
    if (pending) return;
    run(async () => {
      try {
        const out = await startProtected({ agreementId: start.agreementId, acceptedVersion: start.agreementVersion });
        if (!out.ok) {
          banner.error(out.error);
          return;
        }
        if (out.data.state === "identity") {
          setStep("identity");
          return;
        }
        if (out.data.state === "pending") banner.info(PROTECTED_START_PENDING);
        router.refresh();
      } catch (error) {
        /* A lost signal is said in the banner; a real fault still reaches the error boundary. */
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  if (step === "identity") {
    return (
      <IdentityCheck
        onVerified={() => {
          banner.success(PROTECTED_IDENTITY_DONE);
          setStep("review");
          open();
        }}
      />
    );
  }

  return (
    <ReviewProtection
      deal={start.deal}
      quote={start.quote}
      agreementVersion={start.agreementVersion}
      locale={locale}
      pending={pending}
      onAgree={() => {
        /* A payer known to need the check goes straight to it; the server decides either way. */
        if (start.identity === "needed" && start.payerIsViewer) setStep("identity");
        else open();
      }}
    />
  );
}
