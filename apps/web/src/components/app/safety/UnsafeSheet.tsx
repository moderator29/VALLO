"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { feelUnsafe } from "@/lib/safety/unsafe-actions";
import { responseTimeFor } from "@/lib/trust/standards";
import { IconPlate } from "@/components/ui/IconPlate";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * "I FEEL UNSAFE" (V-63): one control in every thread and on every
 * inspection, for the moment somebody does not want to choose a report
 * category. One sheet, the actions in the order a frightened person needs
 * them:
 *
 *   Call 112          a `tel:` link, the one exit the product allows for danger.
 *   Leave and block   blocks and tells Vallo.
 *   Tell Vallo        tells Vallo on the four-hour clock and changes nothing
 *                     else.
 *
 * Either one pauses the other person's OWN new inspection requests to this
 * person when this person has written to them in the thread. The sheet says
 * so only to a lister (the only side a pause means anything to) and only when
 * it happened. A held request is refused in the same words as any listing not
 * taking requests, and the sheet promises nothing beyond that.
 *
 * "Tell someone" (the trusted-contact check-in, V-62) is not drawn: it does
 * not exist on this branch, and a row that does nothing is worse than none.
 *
 * The promise is read from `lib/trust/standards.ts`, the same number the
 * standards page prints and the moderation desk counts down, so the sheet
 * cannot promise a time nobody is keeping.
 *
 * Session 3 (W13): the two actions are the one Button primitive (they were
 * raw buttons carrying its classes by hand), and only the one pressed says
 * it is working. It stays the plain Sheet rather than the illustrated one:
 * a clay object over "Call 112" would put decoration between a frightened
 * person and the exit, which is the one place in the product the
 * illustrated sheet is the wrong register. Nothing here animates beyond the
 * Sheet's own rise; the error is immediate.
 */
export function UnsafeSheet({
  copy,
  conversationId,
  inspectionId,
  trigger,
  onOpen,
  afterLeave,
  filerIsLister = false,
}: {
  copy: Dictionary["trustVisible"]["unsafe"];
  conversationId?: string;
  inspectionId?: string;
  /** "row" inside a sheet that is already open; "button" on an inspection card. */
  trigger: "row" | "button";
  onOpen?: () => void;
  /** Where to go once they have left and blocked, e.g. the inbox. */
  afterLeave?: string;
  /**
   * True when the person filing is the lister here. Only then can a hold pause
   * anything they would notice (the other person's requests to them), so only
   * then does the sheet say so.
   */
  filerIsLister?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useSafeTransition();
  /* Which of the two was pressed, so only that one says it is working: a
     frightened person must see the thing they chose answer, not both. */
  const [choice, setChoice] = useState<"leave" | "tell" | null>(null);
  const clock = responseTimeFor("unsafe").phrase;
  const tellHint = copy.tellHint.replace("{clock}", clock);

  function file(block: boolean) {
    setNote(null);
    setChoice(block ? "leave" : "tell");
    startTransition(async () => {
      try {
        const result = await feelUnsafe({
          ...(conversationId ? { conversationId } : { inspectionId }),
          block,
        });
        if (!result.ok) {
          setNote({ ok: false, text: result.error });
          return;
        }
        const said = (block ? copy.left : copy.told).replace("{clock}", clock);
        setNote({ ok: true, text: result.data.held && filerIsLister ? `${said} ${copy.heldNote}` : said });
        if (block && afterLeave) window.setTimeout(() => window.location.assign(afterLeave), 2500);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  const opener =
    trigger === "row" ? (
      <button
        type="button"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        data-testid="unsafe-opener"
        className="nf-share-row mt-md w-full text-left"
      >
        <IconPlate size="sm" className="shrink-0">
          <UiIcon name="shield-lock" size={20} />
        </IconPlate>
        <span className="min-w-0 flex-1">
          <span className="block nf-body font-semibold text-[var(--nf-content-primary)]">{copy.opener}</span>
          <span className="block nf-caption text-[var(--nf-content-muted)]">{copy.openerHint}</span>
        </span>
        <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
      </button>
    ) : (
      <Button
        variant="quiet"
        size="sm"
        leadingIcon="shield-stop"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        data-testid="unsafe-opener"
        className="min-h-[44px]"
      >
        {copy.opener}
      </Button>
    );

  return (
    <>
      {opener}
      <Sheet open={open} onOpenChange={setOpen} title={copy.title} closeLabel={copy.close}>
        <div className="grid gap-sm pb-lg" data-testid="unsafe-sheet">
          <p className="nf-body text-[var(--nf-content-secondary)]">{copy.lede}</p>

          <a href="tel:112" className="nf-btn nf-btn--danger w-full min-h-[44px]" data-testid="unsafe-call">
            <UiIcon name="phone" size={20} className="shrink-0" />
            {copy.call}
          </a>
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.callHint}</p>

          {note?.ok ? (
            <p role="status" className="nf-panel nf-panel--card p-card nf-body text-[var(--nf-content-primary)]" data-testid="unsafe-done">
              {note.text}
            </p>
          ) : (
            <>
              <Button
                variant="secondary"
                full
                disabled={pending}
                onClick={() => file(true)}
                data-testid="unsafe-leave"
              >
                {pending && choice === "leave" ? copy.working : copy.leave}
              </Button>
              <p className="nf-caption text-[var(--nf-content-muted)]">{filerIsLister ? `${copy.leaveHint} ${copy.pauseHint}` : copy.leaveHint}</p>

              <Button
                variant="secondary"
                full
                disabled={pending}
                onClick={() => file(false)}
                data-testid="unsafe-tell"
              >
                {pending && choice === "tell" ? copy.working : copy.tell}
              </Button>
              <p className="nf-caption text-[var(--nf-content-muted)]">{filerIsLister ? `${tellHint} ${copy.pauseHint}` : tellHint}</p>
            </>
          )}

          {note && !note.ok && (
            <p role="alert" className="nf-body-sm text-[var(--nf-state-error)]">
              {note.text}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
