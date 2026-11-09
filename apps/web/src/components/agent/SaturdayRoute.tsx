"use client";

import { banner } from "@/lib/ui/toast";
import { State } from "@/components/ui/State";
import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { sayRunningLate } from "@/lib/viewings/actions";
import type { RouteLeg } from "@/lib/viewings/route";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-94: THE DAY AS A ROUTE. Booked viewings in time order, a heading each
 * time the area changes, the minutes since the viewing before, and one tap
 * to tell the next renter you are running fifteen minutes late (an ordinary
 * message in their thread). States: no viewings that day, the route, sending,
 * sent, and a failed send in words.
 */

type Copy = Dictionary["frontDoor"]["viewings"];

export function SaturdayRoute({
  dayLabel,
  route,
  next,
  copy,
  locale,
  className = "mt-lg",
}: {
  dayLabel: string;
  route: RouteLeg[];
  /** The stop "running late" is sent to, decided on the server. */
  next: RouteLeg | null;
  copy: Copy;
  locale: Locale;
  /** Spacing from the block above; the calendar's side column sets its own. */
  className?: string;
}) {
  const [said, setSaid] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const time = (iso: string) => formatDate(new Date(iso), locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

  return (
    <section className={`nf-panel nf-panel--card p-card-sm ${className}`} aria-labelledby="route-title" data-testid="viewing-route">
      <h2 id="route-title" className="nf-h4 text-[var(--nf-content-primary)]">
        {copy.routeTitle.replace("{day}", dayLabel)}
      </h2>
      <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{copy.routeNote}</p>
      {route.length === 0 ? (
        <State compact kind="empty" icon="map-route" title={copy.routeEmpty} className="mt-group" />
      ) : (
        <ol className="mt-group flex flex-col gap-row">
          {route.map((leg) => (
            <li key={leg.inspectionId}>
              {leg.newArea && leg.area && <p className="nf-label">{leg.area}</p>}
              <div className="flex items-baseline justify-between gap-sm">
                <span className="nf-body-sm text-[var(--nf-content-primary)]">
                  <span className="nf-numeric font-semibold">{time(leg.slotAt)}</span> {leg.listingTitle ?? ""}
                  {leg.counterpartName ? `, ${leg.counterpartName}` : ""}
                </span>
                {leg.gapMinutes !== null && (
                  <span className="nf-caption text-[var(--nf-content-muted)]">{copy.gap.replace("{minutes}", String(leg.gapMinutes))}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {next && next.conversationId && (
        <Button
          variant="secondary"
          className="mt-group"
          loading={pending}
          /* Once said, said: a second tap sent the renter the same "running
             late" message again. */
          disabled={said !== null}
          onClick={() => {
            start(async () => {
              try {
                const result = await sayRunningLate({ conversationId: next.conversationId, slotAt: next.slotAt });
                if (!result.ok) banner.error(result.error);
                else {
                  const line = copy.lateSent.replace("{name}", next.counterpartName ?? copy.someone);
                  setSaid(line);
                  banner.success(line);
                }
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            });
          }}
        >
          {copy.lateAction}
        </Button>
      )}
    </section>
  );
}
