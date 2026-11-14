"use client";

import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { State } from "@/components/ui/State";
import { banner } from "@/lib/ui/toast";
import { useComposerClearance } from "@/lib/ui/composer-clearance";
import { composerEnterKeyHint, enterSends } from "@/lib/ui/field-keyboard";
import { isTouchKeyboard, useTouchKeyboard } from "@/lib/ui/use-touch-keyboard";
import { sendMessage } from "@/lib/messages/actions";
import { formatDay, formatWhen } from "@/lib/offers/format";
import type { DealThreadMessage } from "@/lib/offers/thread";

/**
 * THE CONVERSATION, IN THE DEAL ROOM. The same thread as Messages (one
 * conversation per buyer, seller and property, never a second inbox), read
 * and written in place through the existing send door, which keeps its block
 * check, safety pipeline and replay key. Nothing here is a system voice: every
 * bubble is a person's own words.
 */
export function DealMessages({ conversationId, messages, counterpartyName, live }: { conversationId: string; messages: DealThreadMessage[]; counterpartyName: string; live: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const tap = useRef<string>("");
  /* The quick pill sits just above this bar, however tall the typing makes it. */
  const composerRef = useRef<HTMLFormElement | null>(null);
  useComposerClearance(composerRef, live);
  const touchKeyboard = useTouchKeyboard();

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    tap.current ||= crypto.randomUUID();
    try {
      const result = await sendMessage({ conversationId, body, tapKey: tap.current });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      tap.current = "";
      setText("");
      router.refresh();
    } catch {
      banner.error("Could not send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  };

  return (
    <div className="grid gap-md" data-testid="panel-messages">
      {messages.length === 0 ? (
        <State kind="empty" compact icon="chat-duo" title="No messages yet" body={`Say hello to ${counterpartyName}. Messages here are the same conversation as in your Messages.`} />
      ) : (
        <Panel variant="card" className="p-card">
          <ol className="nf-dmsgs" aria-label="Messages about this offer">
            {messages.map((m, i) => {
              const day = formatDay(m.at);
              const sep = i === 0 || formatDay(messages[i - 1]!.at) !== day;
              return (
                <Fragment key={m.id}>
                  {sep ? <li className="nf-dmsgs__day">{day}</li> : null}
                  <li className="nf-dmsg" data-mine={m.mine ? "" : undefined}>
                    {/* Stays `overflow-wrap: anywhere` on purpose: a web address pasted into a bubble must wrap inside it (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
                    <p className="nf-body whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
                    <time className="nf-dmsg__time" dateTime={m.at}>
                      {m.mine ? "You" : counterpartyName} · {formatWhen(m.at)}
                    </time>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </Panel>
      )}
      {live ? (
        /*
         * THE PLATFORM'S INPUT BAR (the founder, 12 November 2026: "it
         * supposed to be fixed for all messages, any message at all").
         *
         * This textarea carried NO class, so it drew the browser's own
         * control: measured in WebKit at 390, a white 206 by 26 box with a
         * black 1px hairline and a 5px corner, on the night app, indented 35
         * pixels with 117 of empty bar beside it, and 26 tall against a 44
         * floor. In the room where an offer is negotiated. It is the chat's
         * bar now, drawn off `.nf-composer__box` by `input-bar.css`, and the
         * Send keeps its word (`--label`) because this room names its
         * actions rather than drawing a bare arrow.
         */
        <form
          ref={composerRef}
          className="nf-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="nf-composer__box">
            <label className="sr-only" htmlFor="deal-message">
              Message
            </label>
            <textarea
              id="deal-message"
              className="nf-composer__field"
              rows={1}
              value={text}
              maxLength={4000}
              placeholder={`Message ${counterpartyName}`}
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint={composerEnterKeyHint(touchKeyboard)}
              onChange={(e) => {
                setText(e.target.value);
                grow(e.target);
              }}
              /* The thread's own rule: Enter sends on a computer, makes a new
                 line on a phone, where the button sends. */
              onKeyDown={(e) => {
                if (enterSends({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }, isTouchKeyboard())) {
                  e.preventDefault();
                  if (text.trim().length > 0 && !busy) void send();
                }
              }}
            />
            <div className="nf-composer__row">
              <Button type="submit" variant="primary" leadingIcon="send" loading={busy} disabled={text.trim().length === 0} className="nf-composer__send nf-composer__send--label" data-testid="deal-message-send">
                Send
              </Button>
            </div>
          </div>
        </form>
      ) : null}
      <p className="nf-body-sm text-[var(--nf-content-muted)]">Keep the talk and the money on Vallo. Be careful if anyone asks you to pay outside the platform. Vallo never asks for a deposit to secure a property.</p>
    </div>
  );
}
