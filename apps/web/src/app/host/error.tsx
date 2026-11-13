"use client";

import { ResultScreen } from "@/components/app/ResultSheet";
import { useErrorReport } from "@/lib/observability/use-error-report";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { useSignalHold } from "@/lib/offline/use-offline";
import { SignalHold } from "@/components/app/SignalHold";

/**
 * The host workspace's error boundary. There was none, so a failed host read
 * fell through to the root boundary and lost the workspace entirely.
 *
 * Like the agent boundary it replaces the screen, so the way on is the host
 * home, which rebuilds the frame. The raw error never reaches the screen; the
 * short reference does, and the scrubbed report carries the same one (C13).
 */
export default function HostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = useErrorReport(error, "client.host_boundary", "[vallo] host route error");

  const copy = useClientCopy();
  /* No signal is not a fault: the same calm words as the app's boundary, and
     the segment loads itself again when the signal returns. */
  const hold = useSignalHold(error, reset);
  const offline = hold.view;
  /* A weak signal: the page's shape stays, and the screen is tried again by
     itself with growing gaps (lib/offline/use-offline.ts, 13 November 2026). */
  if (offline === "retrying") return <SignalHold tries={hold.tries} onRetry={reset} />;
  if (offline) {
    return (
      <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-gutter py-section">
        <ResultScreen
          state="pending"
          verdict={copy.fixesV2[offline === "weak" ? "weakSignal" : "offline"].title}
          consequence={copy.fixesV2[offline === "weak" ? "weakSignal" : "offline"].body}
          actions={[
            { label: copy.authFlow.tryAgain, onClick: reset, tone: "primary" },
            { label: "Back to your workspace", href: "/host", tone: "quiet" },
          ]}
        />
      </main>
    );
  }

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-gutter py-section">
      <ResultScreen
        state="failed"
        mark="alert-triangle"
        verdict="We could not open that screen"
        consequence="A read on our side did not complete. Your rooms, bookings and earnings are untouched: this is the page failing to load them, not the records themselves."
        actions={[
          { label: "Try again", onClick: reset, tone: "primary" },
          { label: "Back to your workspace", href: "/host", tone: "quiet" },
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
