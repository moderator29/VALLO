"use client";

import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { sendMessage } from "@/lib/messages/actions";
import { shareBody } from "@/components/app/messages/share";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { banner } from "@/lib/ui/toast";

/** The words for the two rows, from the page's `t.passportV2`. */
export type PassportSheet = {
  /** Whether the reader's own passport is on. Off sends them to the page that turns it on. */
  on: boolean;
  words: {
    show: string;
    hint: string;
    offTitle: string;
    offHint: string;
    sent: string;
    failed: string;
    viewTheirs: string;
    viewTheirsHint: string;
  };
};

/**
 * THE TWO PASSPORT ROWS IN A CONVERSATION'S OPTIONS SHEET (the top three
 * dots).
 *
 *   Show my passport    posts the reader's own passport as a card in this chat,
 *                       through the one `sendMessage` every message goes
 *                       through (so a block, a pause and a limit all apply). The
 *                       card is an ordinary message whose body is the share
 *                       grammar `Shared a passport` plus the path; the thread
 *                       turns it into the card, for its sender only.
 *   View their passport the other member's passport, for a signed-in member.
 *                       The page itself decides whether it opens.
 *
 * With the passport off, the first row says so and opens the passport page,
 * where the switch is. Nothing is posted that could not open.
 */
export function PassportThreadRows({
  passport,
  conversationId,
  meId,
  counterpartId,
  counterpartName,
  onDone,
}: {
  passport: PassportSheet;
  conversationId: string;
  /** The reader's account id: the card's owner. Null on a thread with no signed-in reader. */
  meId: string | null;
  counterpartId: string | null;
  counterpartName: string;
  /** Called after a card is posted, so the sheet can close. */
  onDone?: () => void;
}) {
  const [pending, startTransition] = useSafeTransition();
  const words = passport.words;

  function show() {
    if (!meId) return;
    startTransition(async () => {
      try {
        const result = await sendMessage({ conversationId, body: shareBody({ kind: "passport", id: meId }) });
        if (!result.ok) {
          /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
          banner.error(result.error || words.failed, { retry: show });
          return;
        }
        onDone?.();
        banner.success(words.sent);
        /* The thread draws a card from the server's render, and the open
           thread keeps its own list of bubbles, so the new message would show
           as its words and path until the next load. Reload this thread once,
           the way blocking does, and the card is there. */
        window.location.assign(`/messages/${conversationId}`);
      } catch {
        banner.error(words.failed);
      }
    });
  }

  return (
    <div data-testid="thread-passport-rows">
      {passport.on && meId ? (
        <button
          type="button"
          onClick={show}
          disabled={pending}
          className="nf-share-row mt-md w-full text-left"
          data-testid="thread-passport-show"
        >
          <IconPlate size="sm" className="shrink-0">
            <UiIcon name="id-card" size={20} />
          </IconPlate>
          <span className="min-w-0 flex-1">
            <span className="block nf-body font-semibold text-[var(--nf-content-primary)]">{words.show}</span>
            <span className="block nf-caption text-[var(--nf-content-muted)]">{words.hint}</span>
          </span>
          <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
        </button>
      ) : (
        <Link href="/settings/passport" className="nf-share-row mt-md" data-testid="thread-passport-off">
          <IconPlate size="sm" className="shrink-0">
            <UiIcon name="id-card" size={20} />
          </IconPlate>
          <span className="min-w-0 flex-1">
            <span className="block nf-body font-semibold text-[var(--nf-content-primary)]">{words.offTitle}</span>
            <span className="block nf-caption text-[var(--nf-content-muted)]">{words.offHint}</span>
          </span>
          <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
        </Link>
      )}
      {counterpartId ? (
        <Link href={`/passport/${counterpartId}`} className="nf-share-row mt-md" data-testid="thread-passport-view">
          <IconPlate size="sm" className="shrink-0">
            <UiIcon name="user-check" size={20} />
          </IconPlate>
          <span className="min-w-0 flex-1">
            <span className="block nf-body font-semibold text-[var(--nf-content-primary)]">
              {words.viewTheirs.replace("{name}", counterpartName)}
            </span>
            <span className="block nf-caption text-[var(--nf-content-muted)]">{words.viewTheirsHint}</span>
          </span>
          <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
        </Link>
      ) : null}
    </div>
  );
}
