"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/lib/messages/actions";
import { shareBody, type SharedRef } from "@/components/app/messages/share";
import { ChatCard, type ChatCardData } from "@/components/app/messages/ChatCard";
import { VerifiedAvatar } from "@/components/messages/VerifiedAvatar";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { Button } from "@/components/ui/Button";
import { type BadgeTier } from "@/lib/trust/badge-tier";
import { IconPlate } from "@/components/ui/IconPlate";
import type { Dictionary } from "@vallo/i18n/core";

/** The picker's words, `experienceInbox.share.picker`, from the server page. */
export type ShareCopy = Dictionary["experienceInbox"]["share"]["picker"];

/**
 * The share picker, both ways round.
 *
 * "Send THIS card to one of my conversations" (a listing or a booking is in
 * hand, the reader chooses a thread from their real inbox) and "send one of
 * MY things into THIS conversation" (the thread is in hand, the reader
 * chooses a booking or a listing from what they hold). Both end in the same
 * act: one real `sendMessage` carrying the share body, and the thread opens
 * on the card.
 *
 * The confirm is a step, not a tap on a row. A row that sends on tap is how
 * somebody's booking lands in the wrong stranger's inbox, and a share is not
 * undoable.
 */

/** What the confirm calls the thing being sent. One word per kind, no ternary. */

export type ShareThread = {
  id: string;
  counterpartName: string;
  counterpartVerified: boolean;
  /** The counterpart's published badge, `public.person_badge.tier`. */
  counterpartTier: BadgeTier;
  counterpartKind: "agent" | "member";
  listingTitle: string | null;
};

export type ShareItem = {
  ref: SharedRef;
  title: string;
  /** "Lekki Phase 1, Lagos" or "Fri 14 Aug to Sun 16 Aug". */
  line: string;
  icon: UiIconName;
};

export function ShareToThread({
  card,
  target,
  threads,
  copy,
  thread,
}: {
  card: ChatCardData | null;
  target: SharedRef;
  threads: ShareThread[];
  copy: ShareCopy;
  /** The thread's words, for the card's own lines. */
  thread?: Dictionary["experienceInbox"]["thread"];
}) {
  const [chosen, setChosen] = useState<ShareThread | null>(null);
  return (
    <div className="mx-auto max-w-2xl">
      {card && (
        <div className="mb-block">
          <p className={`mb-inline ${TYPE.label}`}>{copy.sharing}</p>
          <ChatCard card={card} forwardable={false} thread={thread} />
        </div>
      )}
      <p className={`mb-inline ${TYPE.label}`}>{copy.sendTo}</p>
      {threads.length === 0 ? (
        <EmptyState
          icon="chat-duo"
          title={copy.noThreadsTitle}
          body={copy.noThreadsBody}
          action={
            <Link href="/search" className="nf-btn nf-btn--primary nf-btn--md">
              {copy.findPlace}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3xs" role="list">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                className="nf-share-row"
                aria-pressed={chosen?.id === thread.id}
                onClick={() => setChosen(thread)}
                data-testid="share-thread-row"
              >
                <span className="nf-inbox-row__ring">
                  <VerifiedAvatar
                    name={thread.counterpartName}
                    tier={thread.counterpartTier}
                    kind={thread.counterpartKind}
                    size="md"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${TYPE.rowTitle}`}>{thread.counterpartName}</span>
                  {thread.listingTitle && (
                    <span className={`block truncate ${TYPE.rowMeta}`}>{thread.listingTitle}</span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 ${chosen?.id === thread.id ? "text-[var(--nf-brand-secondary)]" : "text-[var(--nf-content-muted)]"}`}
                >
                  <UiIcon name={chosen?.id === thread.id ? "verified" : "chevron-right"} size={20} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen && (
        <ConfirmSend
          conversationId={chosen.id}
          target={target}
          label={copy.sendToName.replace("{name}", chosen.counterpartName)}
          copy={copy}
          onCancel={() => setChosen(null)}
        />
      )}
    </div>
  );
}

export function ShareIntoThread({
  conversationId,
  counterpartName,
  items,
  copy,
}: {
  conversationId: string;
  counterpartName: string;
  items: ShareItem[];
  copy: ShareCopy;
}) {
  const [chosen, setChosen] = useState<ShareItem | null>(null);
  return (
    <div className="mx-auto max-w-2xl">
      <p className={`mb-inline ${TYPE.label}`}>{copy.shareWith.replace("{name}", counterpartName)}</p>
      {items.length === 0 ? (
        <EmptyState
          icon="listing-search"
          title={copy.nothingTitle}
          body={copy.nothingBody}
          action={
            <Link href="/search" className="nf-btn nf-btn--primary nf-btn--md">
              {copy.findPlace}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3xs" role="list">
          {items.map((item) => {
            const key = `${item.ref.kind}:${item.ref.id}`;
            const on = chosen ? `${chosen.ref.kind}:${chosen.ref.id}` === key : false;
            return (
              <li key={key}>
                <button
                  type="button"
                  className="nf-share-row"
                  aria-pressed={on}
                  onClick={() => setChosen(item)}
                  data-testid="share-item-row"
                >
                  <IconPlate size="sm" className="shrink-0">
                    <UiIcon name={item.icon} size={20} />
                  </IconPlate>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${TYPE.rowTitle}`}>{item.title}</span>
                    <span className={`block truncate ${TYPE.rowMeta}`}>{item.line}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`shrink-0 ${on ? "text-[var(--nf-brand-secondary)]" : "text-[var(--nf-content-muted)]"}`}
                  >
                    <UiIcon name={on ? "verified" : "chevron-right"} size={20} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {chosen && (
        <ConfirmSend
          conversationId={conversationId}
          target={chosen.ref}
          label={copy.sendNoun.replace("{noun}", copy.nouns[chosen.ref.kind])}
          copy={copy}
          onCancel={() => setChosen(null)}
        />
      )}
    </div>
  );
}

/** The one write. A real message, then the thread, or the reason it did not go. */
function ConfirmSend({
  conversationId,
  target,
  label,
  onCancel,
  copy,
}: {
  conversationId: string;
  target: SharedRef;
  label: string;
  onCancel: () => void;
  copy: ShareCopy;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    start(async () => {
      const result = await sendMessage({ conversationId, body: shareBody(target) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(`/messages/${conversationId}`);
    });
  };

  return (
    <div className="nf-panel nf-panel--card nf-context-card mt-block flex-col items-stretch" role="group" aria-label={label}>
      <p className={TYPE.body}>{copy.lands}</p>
      {error && (
        <p role="alert" className={`mt-inline-tight ${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </p>
      )}
      <div className="nf-context-card__actions">
        <Button variant="primary" onClick={send} loading={pending} data-testid="share-confirm">
          {label}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {copy.notNow}
        </Button>
      </div>
    </div>
  );
}
