"use client";

import { Button } from "@/components/ui/Button";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * A SCREEN WAITING ON A WEAK SIGNAL (13 November 2026, the founder, inside the
 * app on a connection that was there but slow: "This screen did not load" with
 * a reference to quote. "On a slow network a page should load lazily, never
 * show that.").
 *
 * What an error boundary draws while it tries the screen again by itself
 * (`useSignalHold`): the page's shape, the same skeleton the route's own
 * loading screen draws, so nothing jumps when the content lands. From the
 * second try it adds one calm line and a Try again that does not wait for the
 * next timed try. No reference, no "tell support": nothing is wrong with the
 * app.
 */
export function SignalHold({ tries, onRetry }: { tries: number; onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl" data-testid="signal-hold">
      <LoadingShell label="Loading on a weak connection">
        <PageHeaderSkeleton subtitle />
        <CardRowsSkeleton rows={3} />
      </LoadingShell>
      {tries >= 1 ? (
        <div className="mt-md grid justify-items-center gap-xs text-center" role="status" data-testid="signal-hold-note">
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">Still loading on a weak connection.</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
