"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import { ruleArrivalCheck } from "@/lib/stays/arrival-check-actions";
import { banner } from "@/lib/ui/toast";

type Ruling = "upheld" | "declined";

/**
 * V-91, in the console: uphold or decline an arrival report, once. A ruling
 * cannot be undone, so each asks for a confirmation that says what it does to
 * the payout pause; a ruling the database refused ("none") says so.
 *
 * THE CONFIRMATION IS A SLIDE (Session 3, W13; COMPONENT_LIBRARY: "an admin
 * ruling on a dispute"). A ruling holds or releases a host's payout and can
 * never be taken back, which is exactly the friction `DragToConfirm` exists
 * for: a tap on the wrong one of two side-by-side buttons at 2am is the
 * mistake this removes. It is marked `money`, because the ruling decides
 * whether money moves, so the control never springs back to looking
 * unconfirmed once the server has accepted it, and it says "confirmed" only
 * after `ruleArrivalCheck` has resolved. The keyboard path is the handle
 * itself (Enter or Space), so nothing here needs a pointer.
 */
/* What the ruling did, said by the one banner (founder, 7 November 2026). */
const WORDS = { upheld: "Report upheld", declined: "Report declined" };

export function ArrivalRuling({
  bookingId,
  copy,
  slide,
}: {
  bookingId: string;
  copy: Dictionary["arrivalCheck"]["admin"];
  /** The shared slide labels (`experienceUi`). */
  slide: Pick<Dictionary["experienceUi"], "slideToConfirm" | "confirming" | "confirmed" | "pressAgain">;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<Ruling | null>(null);
  const [pending, start] = useTransition();
  /*
   * The ruling is on its way to the server. `pending` alone covered only the
   * refresh AFTER the ruling landed, so Cancel stayed live during the await
   * itself and an operator could tap it, see the confirmation close, and
   * believe they had stopped a ruling that still landed (auditor A5). A sent
   * ruling cannot be called back, so Cancel is disabled from the moment it
   * leaves until the answer is in.
   */
  const [inFlight, setInFlight] = useState(false);
  const busy = pending || inFlight;

  /* Resolves true only when the ruling landed, so the slide claims nothing
     the server did not accept. */
  const rule = async (ruling: Ruling): Promise<boolean> => {
    setInFlight(true);
    try {
      const result = await ruleArrivalCheck({ bookingId, ruling });
      if (!result.ok) {
        banner.error(result.error || copy.ruleFailed);
        return false;
      }
      if (result.data.state === "none") {
        banner.info(copy.ruleNone);
        return false;
      }
      /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
      banner.success(ruling === "upheld" ? WORDS.upheld : WORDS.declined);
      start(() => router.refresh());
      return true;
    } finally {
      setInFlight(false);
    }
  };

  return (
    <div className="mt-md">
      {asking ? (
        <div className="grid gap-sm" data-testid="arrival-ruling-confirm">
          <p className="nf-body-sm">{asking === "upheld" ? copy.confirmUphold : copy.confirmDecline}</p>
          <DragToConfirm
            key={asking}
            money
            armedLabel={slide.pressAgain}
            label={slide.slideToConfirm}
            keyboardLabel={asking === "upheld" ? copy.uphold : copy.decline}
            confirmingLabel={slide.confirming}
            confirmedLabel={slide.confirmed}
            errorLabel={copy.ruleFailed}
            disabled={pending}
            onConfirm={() => rule(asking)}
            data-testid="arrival-ruling-slide"
          />
          <Button
            variant="ghost"
            full
            disabled={busy}
            onClick={() => setAsking(null)}
            data-testid="arrival-ruling-cancel"
          >
            {copy.cancel}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-sm">
          <Button variant="secondary" full disabled={pending} onClick={() => setAsking("upheld")}>
            {copy.uphold}
          </Button>
          <Button variant="secondary" full disabled={pending} onClick={() => setAsking("declined")}>
            {copy.decline}
          </Button>
        </div>
      )}
    </div>
  );
}
