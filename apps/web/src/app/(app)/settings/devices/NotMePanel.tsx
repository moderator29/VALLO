"use client";

import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { plural, type Locale } from "@vallo/i18n/core";
import type { Dictionary } from "@vallo/i18n/core";
import { ResultSheet } from "@/components/app/ResultSheet";
import { reportNotMe, type NotMeResult } from "@/lib/security/device-alert-actions";
import { formatHoldUntil } from "@/lib/security/account-hold";
import { notMeConsequence } from "@/lib/security/not-me-copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * "THIS WAS NOT ME". V-19.
 *
 * Used twice: at the foot of the devices screen, and on the alert a new
 * sign-in sends (`/settings/devices/alert`). Tap once to arm, tap again to
 * act, the same tap-again grammar as every other destructive control on the
 * devices screen, because a hold on somebody's money must not fire on a
 * brush of the thumb.
 *
 * What it does is stated before it is done (the panel's body) and after (the
 * ResultSheet), and the two say the same thing: every other device signed
 * out, withdrawals and sends held for 24 hours, and the password is theirs to
 * change now. The one action on the sheet is that change, because it is the
 * step that locks the door the stranger came in by, and the server cannot
 * take it for them.
 *
 * The hold's end is printed in Lagos time with the weekday, because "held
 * until 21:14" read at 23:00 does not say whether that is tonight or
 * tomorrow.
 */

export type NotMeCopy = Dictionary["platform"]["notMe"];

type Outcome =
  | { kind: "held"; result: NotMeResult }
  /* The server's own sentence, from the dictionary: sign in, or try again. */
  | { kind: "failed"; message: string }
  | null;

export function NotMePanel({
  title,
  body,
  button,
  copy,
  locale,
}: {
  title: string;
  body: string;
  button: { idle: string; confirm: string; working: string };
  copy: NotMeCopy;
  locale: Locale;
}) {
  const [armed, setArmed] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pending, startTransition] = useSafeTransition();

  const press = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    startTransition(async () => {
      try {
        const result = await reportNotMe();
        if (result.ok) setOutcome({ kind: "held", result: result.data });
        else
          setOutcome({
            kind: "failed",
            message: result.error || copy.failedConsequence,
          });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const endedLine =
    outcome?.kind === "held"
      ? outcome.result.ended === 0
        ? copy.endedNone
        : plural(outcome.result.ended, copy.ended, locale)
      : "";
  /* A plain hold's end is never printed (no tipping off): see not-me-copy.ts. */
  const until =
    outcome?.kind === "held" && outcome.result.holdUntil && outcome.result.holdReason !== "plain"
      ? formatHoldUntil(outcome.result.holdUntil, locale)
      : "";
  const heldConsequence = (result: NotMeResult): string => notMeConsequence(result, copy);

  return (
    <div className="nf-panel nf-panel--card block p-card" data-testid="not-me-panel">
      <p className="nf-body font-semibold text-content">{title}</p>
      <p className="nf-body-sm mt-row text-content-2">{body}</p>
      <Button
        variant={armed ? "danger" : "dangerQuiet"}
        size="sm"
        full
        onClick={press}
        disabled={pending}
        aria-busy={pending || undefined}
        data-testid="not-me"
        className="mt-group"
      >
        {pending ? button.working : armed ? button.confirm : button.idle}
      </Button>

      {outcome?.kind === "held" && (
        <ResultSheet
          open
          onOpenChange={(open) => {
            if (!open) setOutcome(null);
          }}
          state="confirmed"
          haptic="confirm"
          verdict={outcome.result.holdUntil || outcome.result.holdPlaced ? copy.heldVerdict : copy.signedOutVerdict}
          consequence={heldConsequence(outcome.result).replace("{until}", until).replace("{ended}", endedLine).trim()}
          actions={[
            { label: copy.changePassword, href: "/reset-password", tone: "primary" },
            { label: copy.close, onClick: () => setOutcome(null), tone: "quiet" },
          ]}
        />
      )}

      {outcome?.kind === "failed" && (
        <ResultSheet
          open
          onOpenChange={(open) => {
            if (!open) setOutcome(null);
          }}
          state="failed"
          verdict={copy.failedVerdict}
          consequence={outcome.message}
          actions={[{ label: copy.close, onClick: () => setOutcome(null), tone: "quiet" }]}
        />
      )}
    </div>
  );
}
