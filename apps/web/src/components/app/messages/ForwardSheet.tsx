"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/Field";
import { VerifiedAvatar } from "@/components/messages/VerifiedAvatar";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import { forwardMessage } from "@/lib/messages/message-actions";
import { readForwardTargets } from "@/lib/messages/forward-targets";
import { asSentence, matchTargets, type ForwardTarget } from "./forward";

/**
 * THE FORWARD CHOOSER (founder, 11 October 2026): a bottom sheet over the
 * thread, opened from Forward in the message menu.
 *
 * It lists the reader's conversations whose other side they follow (asked for
 * when it opens, see `lib/messages/forward-targets.ts`), with a search field.
 * A tap on a conversation forwards: `forwardMessage` with the message's id and
 * that conversation's id. On success the thread says so in one short line and
 * the sheet closes; on a refusal the sheet stays open and shows the database's
 * own sentence, so the reader can pick somebody else.
 *
 * One tap rather than pick-then-confirm, as the founder asked: every row is
 * somebody the reader follows and the words are already theirs to send, and
 * while one forward is in flight every row is held, so a second tap cannot
 * send it twice.
 */

/** The founder's own words for a reader who follows nobody they chat with. */

export function ForwardSheet({
  words,
  open,
  messageId,
  fromConversationId,
  onClose,
  onForwarded,
}: {
  /** The chooser's words (`experienceInbox.thread.forward`). */
  words: Dictionary["experienceInbox"]["thread"]["forward"];
  open: boolean;
  /** The message being forwarded. Null draws nothing to send. */
  messageId: string | null;
  /** The conversation it came from, which is never offered back. */
  fromConversationId: string;
  onClose: () => void;
  /** Called once the database has taken it, with where it went. */
  onForwarded: (target: ForwardTarget) => void;
}) {
  /* Null while the list is on its way. */
  const [targets, setTargets] = useState<ForwardTarget[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  /* Each opening starts clean: a render-time reset on the prop, the idiom
     `Sheet` uses, so a reopen never flashes the last search or refusal. */
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setTargets(null);
      setUnreachable(false);
      setQuery("");
      setSendingTo(null);
      setRefusal(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    readForwardTargets({ fromConversationId })
      .then((rows) => {
        if (cancelled) return;
        if (rows) setTargets(rows);
        else {
          setUnreachable(true);
          setTargets([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setUnreachable(true);
        setTargets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fromConversationId]);

  const shown = useMemo(() => matchTargets(targets ?? [], query), [targets, query]);

  const choose = async (target: ForwardTarget) => {
    if (!messageId || sendingTo) return;
    setSendingTo(target.id);
    setRefusal(null);
    const result = await forwardMessage({ messageId, conversationId: target.id }).catch(() => ({
      ok: false as const,
      error: words.failed,
    }));
    setSendingTo(null);
    if (result.ok) onForwarded(target);
    else setRefusal(asSentence(result.error || words.failed));
  };

  const hasTargets = (targets?.length ?? 0) > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={words.title}
      closeLabel={words.close}
      detents={[0.75]}
      testId="forward-sheet"
    >
      {hasTargets ? (
        <TextField
          label={words.search}
          hideLabel
          type="search"
          leadingIcon="search"
          clearable={words.clear}
          onClear={() => setQuery("")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={words.placeholder}
          data-testid="forward-search"
        />
      ) : null}

      {refusal ? (
        <p role="alert" className="mt-sm nf-body-sm text-[var(--nf-state-error)]" data-testid="forward-refusal">
          {refusal}
        </p>
      ) : null}

      {targets === null ? (
        <p role="status" className="mt-md nf-body-sm text-[var(--nf-content-muted)]" data-testid="forward-loading">
          {words.loading}
        </p>
      ) : unreachable ? (
        <p role="status" className="mt-md nf-body-sm text-[var(--nf-content-secondary)]" data-testid="forward-unreachable">
          {words.unreachable}
        </p>
      ) : !hasTargets ? (
        <div className="mt-md flex flex-col items-center gap-sm py-lg text-center" data-testid="forward-empty">
          <UiIcon name="chat-bubble" size={28} className="text-[var(--nf-content-muted)]" />
          <p role="status" className="nf-body text-[var(--nf-content-secondary)]">
            {words.empty}
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p role="status" className="mt-md nf-body-sm text-[var(--nf-content-muted)]" data-testid="forward-no-match">
          {words.noMatch}
        </p>
      ) : (
        <ul className="mt-sm flex flex-col gap-3xs" aria-label={words.listLabel}>
          {shown.map((target) => (
            <li key={target.id}>
              <button
                type="button"
                className="nf-share-row"
                onClick={() => void choose(target)}
                disabled={sendingTo !== null}
                aria-busy={sendingTo === target.id || undefined}
                data-testid="forward-row"
              >
                <span className="nf-inbox-row__ring">
                  <VerifiedAvatar
                    name={target.name}
                    tier={target.tier}
                    kind={target.kind}
                    photoUrl={target.avatarUrl ?? undefined}
                    size="md"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${TYPE.rowTitle}`}>{target.name}</span>
                  {target.title ? <span className={`block truncate ${TYPE.rowMeta}`}>{target.title}</span> : null}
                </span>
                <span aria-hidden="true" className="shrink-0 text-[var(--nf-content-muted)]">
                  {sendingTo === target.id ? (
                    <span className="nf-caption">{words.sending}</span>
                  ) : (
                    <UiIcon name="arrow-right" size={20} />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
