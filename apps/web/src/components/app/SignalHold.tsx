"use client";

import { Button } from "@/components/ui/Button";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { useClientCopyOptional } from "@/lib/i18n/client-copy";

/**
 * A SCREEN THAT IS STILL LOADING (13 November 2026, the founder, inside the
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
 *
 * The cause may be a weak signal OR a slow answer from the server (the hold
 * covers both since 13 November 2026), so the words name neither: the page is
 * still loading and is being tried again (`trustVisible.state.holdNote`,
 * spoken as `screenErrorOverline`, the same "Still loading"). The
 * English fallback is for a mount outside the root layout's copy provider
 * (`global-error.tsx`, a component test).
 */
export function SignalHold({ tries, onRetry }: { tries: number; onRetry: () => void }) {
  const copy = useClientCopyOptional();
  const words = copy?.trustVisible.state;
  return (
    <div className="mx-auto w-full max-w-2xl" data-testid="signal-hold">
      <LoadingShell label={words?.screenErrorOverline ?? "Still loading"}>
        <PageHeaderSkeleton subtitle />
        <CardRowsSkeleton rows={3} />
      </LoadingShell>
      {tries >= 1 ? (
        <div className="mt-md grid justify-items-center gap-xs text-center" role="status" data-testid="signal-hold-note">
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">{words?.holdNote ?? "Still loading. Trying again."}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {copy?.authFlow.tryAgain ?? "Try again"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
