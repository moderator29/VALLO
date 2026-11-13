"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { useErrorReport } from "@/lib/observability/use-error-report";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { StateMoment } from "@/components/ui/StateMoment";
import { useSignalHold } from "@/lib/offline/use-offline";
import { SignalHold } from "@/components/app/SignalHold";

/**
 * Personal Mode's error boundary: the brand moment, inside the chrome.
 *
 * This boundary sits inside the `(app)` layout, so the header and the dock
 * stay put and only the content area is replaced: a wallet read that timed
 * out must not look identical to the entire product falling over, and the
 * reader keeps every way onward. Inside that area the moment is the same
 * object as the root boundary's, the plate, the glass card with its lit rim,
 * the podium, with the tile alone for the brand because the header above
 * already carries the wordmark.
 *
 * The recovery is `reset()`, which re-runs the failed segment in place. For
 * a dropped connection, the common case here, that is genuinely all it
 * takes.
 *
 * The raw error never reaches the screen. `error.message` on a server
 * component failure is either a stack-shaped string that means nothing to
 * a guest or a detail about the database that should not be published. The
 * digest is shown instead: it is the id that finds the matching server log,
 * which is the entire reason Next generates one.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* The full error object goes to the console and nowhere near the rendered
     output; the scrubbed report carries the same short reference the screen
     shows (C13). */
  const reference = useErrorReport(error, "client.app_boundary", "[vallo] app route error");

  /* The words come from the root layout (`lib/i18n/client-copy.tsx`), so
     the screen speaks the reader's language; it was English for everyone,
     read from the whole dictionary, which every in-app route shipped for it. */
  const clientCopy = useClientCopy();
  const COPY = clientCopy.trustVisible.state;
  const [refBefore = "", refAfter = ""] = COPY.screenErrorRef.split("{digest}");

  /* NO SIGNAL IS NOT A FAULT (13 October 2026). A segment that could not load
     because the phone is offline says so in one calm line, with no reference
     to quote and no "tell support", and loads itself again when the signal
     returns. The same words in the agent and host boundaries. */
  const hold = useSignalHold(error, reset);
  const offline = hold.view;
  /* A weak signal: the page's shape stays, and the screen is tried again by
     itself with growing gaps (lib/offline/use-offline.ts, 13 November 2026). */
  if (offline === "retrying") return <SignalHold tries={hold.tries} onRetry={reset} />;
  if (offline) {
    return (
      <StateMoment
        kind="offline"
        home="/home"
        homeLabel={clientCopy.a11y.logoHome}
        inset
        overline={COPY.offlineOverline}
        title={clientCopy.fixesV2[offline === "weak" ? "weakSignal" : "offline"].title}
        body={clientCopy.fixesV2[offline === "weak" ? "weakSignal" : "offline"].body}
        actions={
          <div className="nf-system__actions">
            <Button variant="primary" size="lg" full onClick={reset}>
              {clientCopy.authFlow.tryAgain}
            </Button>
            <ButtonLink href="/home" variant="secondary" size="lg" full>
              {clientCopy.a11y.logoHome}
            </ButtonLink>
          </div>
        }
      />
    );
  }

  /* V-97: the state kit's full-screen form, in the voice's words. */
  return (
    <StateMoment
      kind="error"
      home="/home"
      homeLabel={clientCopy.a11y.logoHome}
      inset
      overline={COPY.screenErrorOverline}
      title={COPY.screenErrorTitle}
      body={COPY.screenErrorBody}
      detail={
        /* Only the code selects as one (support needs the code, not the sentence). */
        <p className="nf-system__ref">
          {refBefore}
          <span className="nf-numeric select-all">{reference}</span>
          {refAfter}
        </p>
      }
      actions={
        <div className="nf-system__actions">
          <Button variant="primary" size="lg" full onClick={reset}>
            Try again
          </Button>
          <ButtonLink href="/home" variant="secondary" size="lg" full>
            Back to home
          </ButtonLink>
        </div>
      }
    />
  );
}
