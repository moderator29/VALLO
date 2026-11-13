"use client";

import { useErrorReport } from "@/lib/observability/use-error-report";
import { escapeTo } from "@/lib/offline/escape";
import { ResultScreen } from "@/components/app/ResultSheet";

/**
 * The console's error boundary.
 *
 * `admin/layout.tsx` performs the admin check before this segment renders, so
 * anyone who reaches this screen is already staff and the rail and header are
 * still on screen around it. That matters for what the boundary is allowed to
 * say: an operator can be told plainly that a queue read failed, because they
 * are the person who would escalate it.
 *
 * It still does not print `error.message`. On a console the temptation is
 * strongest - the reader is technical - but the boundary cannot know whether the
 * string contains a row, an email address or a connection URL, and the digest
 * finds the real log with none of that risk.
 *
 * The secondary action returns to the console overview rather than the guest
 * home: an operator whose queue failed wants the other queues, not the product.
 */
export default function AdminError({
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
  const reference = useErrorReport(error, "client.admin_boundary", "[vallo] admin route error");

  return (
    /* Rose and a warning triangle, for the same reason as the app boundary:
       the cyan it carried is the pending colour, and the padlock said the
       operator was locked out. */
    <ResultScreen
      state="failed"
      mark="alert-triangle"
      verdict="This queue did not load"
      consequence="The console could not finish reading it. Nothing has been decided or changed by this failure: the queue is intact and will come back as it was."
      actions={[
        { label: "Retry this queue", onClick: again, tone: "primary" },
        { label: "Back to the console", href: "/admin", onClick: escapeTo("/admin", again), tone: "quiet" },
      ]}
      footnote={
        <span>
          Reference <span className="nf-numeric select-all">{reference}</span>. Paste it into the console lookup
          (Ctrl K) or quote it to engineering.
        </span>
      }
    />
  );
}
