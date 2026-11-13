"use client";

import { useParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StateMoment } from "@/components/ui/StateMoment";
import { useErrorReport } from "@/lib/observability/use-error-report";
import { escapeTo } from "@/lib/offline/escape";
import { useSignalHold } from "@/lib/offline/use-offline";
import { SignalHold } from "@/components/app/SignalHold";
import { useClientCopy } from "@/lib/i18n/client-copy";

/**
 * The trust page's own error (D25: an inner page carries its own empty,
 * loading and error states).
 *
 * Inside the content area only, so the header and the way back stay put. The
 * recovery is `reset()` first, because a dropped read is the common case, and
 * the second door is the SPACE this page belongs to rather than Home: a reader
 * who came to weigh one listing's checks wants that listing back, not the
 * start of the app. The raw error never reaches the screen; the digest does,
 * as the app boundary's does.
 */
export default function SpaceTrustError({
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
  const reference = useErrorReport(error, "client.space_trust", "[vallo] space trust error");
  const copy = useClientCopy();
  const state = copy.trustVisible.state;
  const params = useParams<{ id?: string }>();
  const space = typeof params?.id === "string" ? `/listing/${params.id}` : "/search";
  /* Tried again quietly first (13 November 2026), like the app's boundary: the
     words below say "Vallo tried a few times", so the tries must have run. */
  const hold = useSignalHold(error, again);
  if (hold.view === "retrying") return <SignalHold tries={hold.tries} onRetry={again} />;

  return (
    <StateMoment
      kind="error"
      calm
      inset
      overline={state.screenErrorOverline}
      title={state.screenErrorTitle}
      body={state.screenErrorBody}
      detail={<p className="nf-system__ref select-all">{state.screenErrorRef.replace("{digest}", reference)}</p>}
      actions={
        <div className="nf-system__actions">
          <Button variant="primary" size="lg" full onClick={again}>
            {copy.authFlow.tryAgain}
          </Button>
          <ButtonLink href={space} onClick={escapeTo(space, again)} variant="secondary" size="lg" full leadingIcon="arrow-left">
            {copy.common.back}
          </ButtonLink>
        </div>
      }
    />
  );
}
