"use client";

import { useErrorReport } from "@/lib/observability/use-error-report";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { useSignalHold } from "@/lib/offline/use-offline";
import { escapeTo } from "@/lib/offline/escape";
import { SignalHold } from "@/components/app/SignalHold";
import { ResultScreen } from "@/components/app/ResultSheet";

/**
 * Agent Mode's error boundary.
 *
 * Agent Mode has no `layout.tsx` - every page renders `AgentShell` itself - so
 * unlike Personal Mode and the console, this boundary genuinely does replace the
 * whole screen including the rail. It is therefore written as a standalone
 * surface rather than as a panel inside chrome that is not there.
 *
 * The consequence shapes the actions: an agent who lands here has lost their
 * navigation, so the secondary action returns them to the dashboard, which is
 * the one route that rebuilds the shell. Sending them to the guest home instead
 * would drop them out of Agent Mode entirely.
 *
 * The copy is written for someone whose livelihood is on the other side of this
 * screen: it says what did not happen, states plainly that nothing was lost, and
 * never shows them a stack trace.
 */
export default function AgentError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16.3+: re-fetches the failed segment and re-renders it. `reset()` only redraws from what the client already holds, so a server failure stayed failed and Try again did nothing. */
  retry?: () => void;
}) {
  const again = retry ?? reset;
  const reference = useErrorReport(error, "client.agent_boundary", "[vallo] agent route error");

  const copy = useClientCopy();
  /* No signal is not a fault: the same calm words as the app's boundary, and
     the segment loads itself again when the signal returns. */
  const hold = useSignalHold(error, again);
  const offline = hold.view;
  /* A weak signal: the page's shape stays, and the screen is tried again by
     itself with growing gaps (lib/offline/use-offline.ts, 13 November 2026). */
  if (offline === "retrying") return <SignalHold tries={hold.tries} onRetry={again} />;
  if (offline) {
    return (
      <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-gutter py-section">
        <ResultScreen
          state="pending"
          verdict={copy.fixesV2[offline === "weak" ? "weakSignal" : "offline"].title}
          consequence={copy.fixesV2[offline === "weak" ? "weakSignal" : "offline"].body}
          actions={[
            { label: copy.authFlow.tryAgain, onClick: again, tone: "primary" },
            { label: "Back to dashboard", href: "/agent/dashboard", onClick: escapeTo("/agent/dashboard", again), tone: "quiet" },
          ]}
        />
      </main>
    );
  }

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-gutter py-section"
    >
      {/* Rose and a warning triangle. `variant="warning"` resolved to
          `--nf-state-warning`, which is the same token `--nf-status-pending` is
          defined as, so a crash was drawn in the colour that means "still going
          through"; and a padlock shield on "We could not open that workspace"
          tells an agent their account is locked, which is not what happened.
          The third of three identical boundaries. */}
      <ResultScreen
        state="failed"
        mark="alert-triangle"
        verdict="We could not open that workspace"
        consequence="A read on our side did not complete. Your listings, bookings and earnings are untouched: this is the page failing to load them, not the records themselves."
        actions={[
          { label: "Try again", onClick: again, tone: "primary" },
          { label: "Back to dashboard", href: "/agent/dashboard", onClick: escapeTo("/agent/dashboard", again), tone: "quiet" },
        ]}
        footnote={
          <span>
            Reference <span className="nf-numeric select-all">{reference}</span>. Quote this to support.
          </span>
        }
      />
    </main>
  );
}
