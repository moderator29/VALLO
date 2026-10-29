"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { markMyTicketRead, rateMyTicket, reopenMyTicket, resolveMyTicket } from "@/lib/support/ticket-reply";
import type { Dictionary } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Copy = Dictionary["experienceInbox"]["support"]["actions"];

/**
 * Stamp the thread read once it is on screen.
 *
 * A client effect rather than a write during the server render, so a link
 * prefetch never clears the unread badge for a reply nobody has seen.
 */
export function MarkRead({ ticketId, unread }: { ticketId: string; unread: boolean }) {
  useEffect(() => {
    /* The action revalidates the inbox and the support home, so their badge
       is gone the next time they render; this screen needs no refresh. */
    if (unread) void markMyTicketRead(ticketId);
  }, [ticketId, unread]);
  return null;
}

/** "Sorted? Mark it resolved", the quiet exit under the reply box. */
export function ResolveButton({ ticketId, copy }: { ticketId: string; copy: Copy }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-center">
      <p className="nf-caption text-[var(--nf-content-muted)]">{copy.sorted}</p>
      <Button
        variant="ghost"
        loading={pending}
        disabled={pending}
        data-testid="support-resolve"
        onClick={() =>
          start(async () => {
            const result = await resolveMyTicket(ticketId);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {copy.resolve}
      </Button>
      {error && (
        <p role="alert" className="nf-caption text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Rate the resolution, one to five, with an optional comment.
 *
 * The stars are a radio group of real buttons at 44px each, and the chosen
 * one is also said in words, so the rating is never colour or shape alone.
 */
export function RateResolution({
  ticketId,
  rating,
  comment,
  copy,
}: {
  ticketId: string;
  rating: number | null;
  comment: string | null;
  copy: Copy;
}) {
  const starWords = copy.starWords;
  const router = useRouter();
  const [editing, setEditing] = useState(rating === null);
  const [stars, setStars] = useState(rating ?? 0);
  const [text, setText] = useState(comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  if (!editing && rating) {
    return (
      <div className="nf-panel nf-panel--card block p-card-sm" data-testid="support-rated">
        <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">
          {copy.rated.replace("{rating}", String(rating))}
        </p>
        {comment && <p className="nf-caption mt-row break-words text-[var(--nf-content-secondary)]">“{comment}”</p>}
        <Button variant="quiet" size="sm" onClick={() => setEditing(true)} className="mt-row">
          {copy.changeRating}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="nf-panel nf-panel--card block space-y-row p-card-sm"
      data-testid="support-rate"
      onSubmit={(event) => {
        event.preventDefault();
        if (stars < 1) {
          setError(copy.chooseStars);
          return;
        }
        setError(null);
        start(async () => {
          const result = await rateMyTicket(ticketId, { rating: stars, comment: text });
          if (!result.ok) setError(result.error);
          else {
            setEditing(false);
            router.refresh();
          }
        });
      }}
    >
      <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]" id="support-rate-label">
        {copy.howDid}
      </p>
      <div role="radiogroup" aria-labelledby="support-rate-label" className="flex items-center gap-3xs">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={copy.starLabel.replace("{n}", String(n)).replace("{word}", (starWords[n - 1] ?? "").toLowerCase())}
            onClick={() => setStars(n)}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--nf-radius-control)]"
            data-testid={`support-star-${n}`}
          >
            <UiIcon
              name="star"
              size={28}
              className={n <= stars ? "text-[var(--nf-brand-primary)] [&_*]:fill-current" : "text-[var(--nf-content-muted)]"}
            />
          </button>
        ))}
        <span className="nf-caption ms-xs text-[var(--nf-content-secondary)]" aria-live="polite">
          {stars > 0 ? starWords[stars - 1] : null}
        </span>
      </div>
      <TextArea
        label={copy.addLabel}
        optionalText={copy.optional}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={copy.addPlaceholder}
      />
      {error && (
        <p role="alert" className="nf-caption text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" full loading={pending} disabled={pending} data-testid="support-rate-send">
        {copy.sendRating}
      </Button>
    </form>
  );
}

/** Not sorted after all: reopen inside the window, with the date it closes. */
export function ReopenTicket({ ticketId, until, copy }: { ticketId: string; until: string; copy: Copy }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="nf-panel nf-panel--card block p-card-sm" data-testid="support-reopen">
      <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{copy.notSorted}</p>
      <p className="nf-caption mt-row text-[var(--nf-content-secondary)]">
        {copy.reopenBody.replace("{until}", until)}
      </p>
      <Button
        variant="secondary"
        full
        className="mt-group"
        loading={pending}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await reopenMyTicket(ticketId);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {copy.reopen}
      </Button>
      {error && (
        <p role="alert" className="nf-caption mt-row text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
