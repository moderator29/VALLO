"use client";

import "@/app/css/visit.css";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StateMoment } from "@/components/ui/StateMoment";
import { useErrorReport } from "@/lib/observability/use-error-report";
import { escapeTo } from "@/lib/offline/escape";
import { useSignalHold } from "@/lib/offline/use-offline";
import { SignalHold } from "@/components/app/SignalHold";
import { useClientCopy } from "@/lib/i18n/client-copy";

/**
 * THE VISIT SCREENS' WAIT AND FAILURE.
 *
 * The wait is shaped like what arrives (the header, the property card, then
 * the choices or the status), never a spinner, so nothing jumps when the page
 * streams in over it. The failure keeps the way back to the listing the visit
 * belongs to, and says what a failed load can and cannot have undone, in the
 * reader's language (the client copy every screen carries).
 */
export function VisitLoading({ label, status = false }: { label: string; status?: boolean }) {
  return (
    <LoadingShell label={label} className="nf-visit">
      <div className="nf-visit__head">
        <Skeleton width="2.75rem" height="2.75rem" radius="pill" />
        <Skeleton width="60%" height="1.25rem" radius="sm" className="justify-self-center" />
      </div>
      <div className="nf-visit__aside">
        <Skeleton height="7rem" radius="lg" />
      </div>
      <div className="nf-visit__main">
        {status ? (
          <>
            <Skeleton width="5.5rem" height="5.5rem" radius="pill" className="justify-self-center" />
            <Skeleton width="50%" height="1.5rem" radius="sm" className="justify-self-center" />
            <div className="nf-visit-tiles">
              <Skeleton height="5.5rem" radius="lg" />
              <Skeleton height="5.5rem" radius="lg" />
              <Skeleton height="5.5rem" radius="lg" />
            </div>
          </>
        ) : (
          <>
            <div className="nf-visit-modes">
              <Skeleton height="4.75rem" radius="lg" />
              <Skeleton height="4.75rem" radius="lg" />
            </div>
            <div className="nf-visit-days">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} width="3.5rem" height="4.5rem" radius="md" />
              ))}
            </div>
            <div className="nf-visit-times">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} height="2.75rem" radius="md" />
              ))}
            </div>
          </>
        )}
        <Skeleton height="4.5rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}

export function VisitError({ error, reset, retry }: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  const again = retry ?? reset;
  const reference = useErrorReport(error, "client.visit");
  const copy = useClientCopy();
  const state = copy.trustVisible.state;
  const params = useParams<{ id?: string }>();
  const listing = typeof params?.id === "string" ? `/listing/${params.id}` : "/search";
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
            {copy.details.retry}
          </Button>
          <ButtonLink href={listing} onClick={escapeTo(listing, again)} variant="secondary" size="lg" full leadingIcon="arrow-left">
            {copy.common.back}
          </ButtonLink>
        </div>
      }
    />
  );
}
