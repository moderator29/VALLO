"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { releaseTicket, takeTicket } from "@/lib/admin/support-desk-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Who has this ticket, and the one button that changes it: Take it when it is
 * free, Hand it back when it is yours. A ticket somebody else holds shows
 * their name and no button; their claim lapses after thirty minutes without
 * a touch, which the database decides.
 */
export function TicketClaim({
  ticketId,
  holder,
}: {
  ticketId: string;
  holder: { name: string | null; mine: boolean } | null;
}) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (verb: "take" | "release") =>
    start(async () => {
      try {
        setError(null);
        const r = verb === "take" ? await takeTicket({ ticketId }) : await releaseTicket({ ticketId });
        if (r.ok) router.refresh();
        else setError(r.error);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <div className="mt-sm flex flex-wrap items-center gap-xs" data-testid="ticket-claim">
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">
        {!holder ? "Nobody is working on this ticket." : holder.mine ? "You are working on this ticket." : `${holder.name ?? "A colleague"} is working on this ticket.`}
      </p>
      {!holder && (
        <Button type="button" variant="primary" size="sm" loading={pending} onClick={() => run("take")} data-support-take="">
          Take it
        </Button>
      )}
      {holder?.mine && (
        <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => run("release")}>
          Hand it back
        </Button>
      )}
      {error && (
        <p role="alert" className="basis-full text-[length:var(--nf-text-caption)]" style={{ color: "var(--nf-state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
