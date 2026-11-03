"use client";

import { State } from "@/components/ui/State";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { closeBrief } from "@/lib/briefs/actions";
import { briefLine } from "@/lib/briefs/brief";
import type { MyBrief } from "@/lib/briefs/queries";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-95: THE RENTER'S BRIEFS AND THEIR ANSWERS. Each answer is a published
 * listing, in publication order, with the way to open it and to message its
 * lister (the renter opens the thread; a lister never can from a brief).
 * States: could not be read, none, the list, closing, closed.
 */

type Copy = Dictionary["frontDoor"]["briefs"];

export function MyBriefs({
  briefs,
  titles,
  copy,
  locale,
}: {
  briefs: MyBrief[] | null;
  /** Listing titles for the answers, read on the server. */
  titles: Record<string, string>;
  copy: Copy;
  locale: Locale;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  if (briefs === null) return <p className="nf-body-sm text-[var(--nf-content-muted)]">{copy.unreachable}</p>;
  if (briefs.length === 0) return <State compact kind="empty" icon="home-search" title={copy.empty} className="" />;

  return (
    <ul className="flex flex-col gap-row" data-testid="my-briefs">
      {briefs.map((brief) => {
        const open = !brief.closedAt;
        return (
          <li key={brief.id} className="nf-panel nf-panel--card p-card-sm">
            <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{briefLine(brief, copy, locale)}</p>
            <p className="mt-3xs nf-caption text-[var(--nf-content-muted)]">
              {brief.closedAt
                ? copy.closed
                : copy.expires.replace("{date}", formatDate(new Date(brief.expiresAt), locale, { day: "numeric", month: "short", timeZone: "Africa/Lagos" }))}
              {" · "}
              {brief.answers.length === 0
                ? copy.noAnswers
                : brief.answers.length === 1
                  ? copy.answersOne
                  : copy.answers.replace("{count}", String(brief.answers.length))}
            </p>
            {brief.answers.length > 0 && (
              <ul className="mt-row flex flex-col gap-xs">
                {brief.answers.map((answer) => (
                  <li key={answer.listingId} className="flex flex-wrap items-center justify-between gap-sm">
                    <span className="nf-body-sm text-[var(--nf-content-primary)]">{titles[answer.listingId] ?? ""}</span>
                    <span className="flex gap-sm">
                      <Link href={`/listing/${answer.listingId}`} className="nf-link-quiet nf-body-sm inline-flex min-h-[44px] items-center text-[var(--nf-content-link)]">
                        {copy.open}
                      </Link>
                      <Link
                        href={answer.conversationId ? `/messages/${answer.conversationId}` : `/messages/new?listing=${answer.listingId}`}
                        className="nf-link-quiet nf-body-sm inline-flex min-h-[44px] items-center text-[var(--nf-content-link)]"
                      >
                        {copy.message}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {open && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-row"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      const result = await closeBrief({ id: brief.id });
                      if (!result.ok) setError(result.error);
                      else router.refresh();
                    } catch (error) {
                      if (!tapFailedOffline(error)) throw error;
                    }
                  })
                }
              >
                {copy.close}
              </Button>
            )}
          </li>
        );
      })}
      {error && (
        <li className="nf-body-sm font-semibold text-[var(--nf-state-error)]" role="alert">
          {error}
        </li>
      )}
    </ul>
  );
}
