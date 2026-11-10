"use client";

import { useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import { banner } from "@/lib/ui/toast";
import { ChooseHowToPay, type ProtectedOffer } from "@/components/money/protected-rail/ChooseHowToPay";
import { ReviewProtection } from "@/components/money/protected-rail/ReviewProtection";
import { ProtectedPayment } from "@/components/money/protected-rail/ProtectedPayment";
import { protectedQuote } from "@/lib/money/protected-fees";
import type { ProtectedDeal } from "@/components/money/protected-rail/types";
import { ProblemSheet } from "@/components/money/protected-rail/ProtectedPaymentLive";

/** The real screens with recorded answers: every action says, in the banner, that the preview called nothing. */
export function PreviewProtected({
  screen,
  deal,
  now,
  locale,
  offer,
}: {
  screen: "choose" | "review" | "journey" | "problem";
  deal: ProtectedDeal;
  now: number;
  locale: Locale;
  offer?: ProtectedOffer["state"];
}) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState(screen === "problem");
  const quote = protectedQuote(deal.amountMinor);
  const said = (what: string) => () => {
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      banner.success(`Preview: ${what}. Nothing was called.`);
    }, 500);
  };
  if (screen === "choose") {
    const state: ProtectedOffer = offer && offer !== "offered" ? ({ state: offer } as ProtectedOffer) : quote ? { state: "offered", quote } : { state: "fee_failed" };
    return <ChooseHowToPay deal={deal} offer={state} cardAllowed locale={locale} onContinue={(rail) => said(`continue with ${rail}`)()} />;
  }
  if (screen === "problem") {
    return (
      <>
        <ProtectedPayment
          deal={deal}
          now={now}
          locale={locale}
          actions={{ refresh: said("status read again"), reportTransfer: said("transfer reported"), confirmMilestone: said("milestone confirmed"), raiseProblem: () => setProblem(true), newDetails: said("new details") }}
        />
        <ProblemSheet open={problem} onOpenChange={setProblem} arrangementId="preview" pending={pending} onSubmit={(_r, _s, sent) => { sent(); said("problem reported")(); }} />
      </>
    );
  }
  if (screen === "review" && quote) {
    return <ReviewProtection deal={deal} quote={quote} agreementVersion={3} locale={locale} pending={pending} onAgree={(v) => said(`agreed to version ${v}`)()} />;
  }
  return (
    <ProtectedPayment
      deal={deal}
      now={now}
      locale={locale}
      pending={pending}
      actions={{
        refresh: said("status read again"),
        reportTransfer: said("transfer reported, status read again"),
        confirmMilestone: said("milestone confirmed"),
        raiseProblem: said("problem raised"),
        newDetails: said("new transfer details asked for"),
      }}
    />
  );
}
