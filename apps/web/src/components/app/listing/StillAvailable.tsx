"use client";

import { banner } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { askStillAvailable } from "@/lib/availability/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-14: "STILL AVAILABLE?", the first button on a rental page.
 *
 * One tap opens (or reopens) the thread with the lister, records the question
 * and sends "Is this still available?" in the renter's name, then lands them in
 * the chat where the answer will arrive. A second tap on a question that is
 * still open changes nothing and simply opens the chat. The refusals (asked
 * already today, an example or unpublished listing, signed out) are sentences
 * under the button, never a silent nothing.
 */
export function StillAvailable({
  listingId,
  copy,
  recentlyLet = null,
  locale = "en",
}: {
  listingId: string;
  copy: Dictionary["frontDoor"]["available"];
  /** When the lister last said "let", within a week and not since contradicted. */
  recentlyLet?: string | null;
  locale?: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();

  if (recentlyLet) {
    const date = formatDate(new Date(recentlyLet), locale, { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
    return (
      <div className="nf-panel nf-panel--card p-card-sm" data-testid="still-available-let">
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.recentlyLet.replace("{date}", date)}</p>
      </div>
    );
  }

  return (
    <div className="nf-panel nf-panel--card p-card-sm" data-testid="still-available">
      <Button
        variant="primary"
        full
        loading={pending}
        leadingIcon="chat-bubble"
        onClick={() => {
          start(async () => {
            try {
              const result = await askStillAvailable({ listingId });
              if (!result.ok) {
                /* Said by the one banner at the top of the screen (Grade 1). */
                banner.error(result.error);
                return;
              }
              router.push(`/messages/${result.data.conversationId}`);
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          });
        }}
      >
        {pending ? copy.asking : copy.ask}
      </Button>
      <p className="mt-inline nf-caption text-[var(--nf-content-muted)]">{copy.askNote}</p>
    </div>
  );
}
