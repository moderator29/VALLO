"use client";

import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { State } from "@/components/ui/State";
import { banner } from "@/lib/ui/toast";
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

  let lastDay = "";
  return (
    <div className="grid gap-md" data-testid="panel-messages">
      {messages.length === 0 ? (
        <State kind="empty" compact icon="chat-duo" title="No messages yet" body={`Say hello to ${counterpartyName}. Messages here are the same conversation as in your Messages.`} />
      ) : (
        <Panel variant="card" className="p-card">
          <ol className="nf-msgs" aria-label="Messages about this offer">
            {messages.map((m) => {
              const day = formatDay(m.at);
              const sep = day !== lastDay;
              lastDay = day;
              return (
                <Fragment key={m.id}>
                  {sep ? <li className="nf-msgs__day">{day}</li> : null}
                  <li className="nf-msg" data-mine={m.mine ? "" : undefined}>
                    <p className="nf-body whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
                    <time className="nf-msg__time" dateTime={m.at}>
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
        <form
          className="nf-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="deal-message">
            Message
          </label>
          <textarea
            id="deal-message"
            rows={1}
            value={text}
            maxLength={4000}
            placeholder={`Message ${counterpartyName}`}
            enterKeyHint="send"
            onChange={(e) => {
              setText(e.target.value);
              grow(e.target);
            }}
          />
          <Button type="submit" variant="primary" leadingIcon="send" loading={busy} disabled={text.trim().length === 0} data-testid="deal-message-send">
            Send
          </Button>
        </form>
      ) : null}
      <p className="nf-body-sm text-[var(--nf-content-muted)]">Keep the talk and the money on Vallo. Be careful if anyone asks you to pay outside the platform. Vallo never asks for a deposit to secure a property.</p>
    </div>
  );
}
