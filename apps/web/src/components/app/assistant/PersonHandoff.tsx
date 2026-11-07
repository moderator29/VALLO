"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { banner } from "@/lib/ui/toast";
import { feedback } from "@/lib/ui/feedback";
import { fileSupportTicket } from "@/lib/support/actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { HANDOFF_KEY, clearHandoff, readHandoff } from "@/lib/assistant/handoff";

/* The hand-over is read from this tab's storage as the page draws (nothing on the server). */
const noSubscribe = () => () => undefined;
function storedHandoff(): string | null {
  try {
    return window.sessionStorage.getItem(HANDOFF_KEY);
  } catch {
    return null;
  }
}

/**
 * TALK TO A PERSON: THE INNER PAGE (Platform Grade 1, P1.4; reference R70).
 *
 * Reached from "Talk to a person" in the assistant. It hands the member to
 * the Vallo support team through the support flow that already exists:
 * `fileSupportTicket` files a ticket with what they were asking as its body
 * and the whole assistant exchange as its first message, and the reply comes
 * back in their support conversation (`/support/messages/[id]`), which this
 * page opens the moment the ticket is real. A conversation with support that
 * is still open is offered first, so a second ticket is never the only way.
 *
 * Signed out, the same API takes a name and an email to reply to. The
 * question is the member's to edit before it goes; nothing is sent until
 * they press Send, and the banner says what happened either way.
 */

const WORDS = {
  intro: "A person from the Vallo support team reads this and replies here in your support messages, usually within a day.",
  context: "From your chat with Vallo AI",
  contextNone: "Tell the team what you need, in your own words.",
  question: "What do you need help with?",
  questionHint: "Your chat with Vallo AI goes with it, so you do not have to repeat yourself.",
  name: "Your name",
  email: "Email to reply to",
  send: "Send to the support team",
  sending: "Sending",
  sent: "Sent to the support team. A person will reply here.",
  sentRef: "Sent to the support team. Your reference is {reference}.",
  empty: "Tell us what you need help with.",
  open: "Your open conversations with support",
  continue: "Continue",
  unread: "New reply",
  back: "Back to Vallo AI",
};

export type OpenTicket = { id: string; reference: string; topic: string | null; unread: boolean };

export function PersonHandoff({ signedIn, openTickets }: { signedIn: boolean; openTickets: OpenTicket[] }) {
  const router = useRouter();
  /* What the member was asking, from the assistant. */
  const raw = useSyncExternalStore(noSubscribe, storedHandoff, () => null);
  const handoff = useMemo(() => (raw ? readHandoff() : null), [raw]);
  const [edited, setQuestion] = useState<string | null>(null);
  const question = edited ?? handoff?.question ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ question?: string; name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);
  const [filed, setFiled] = useState<string | null>(null);

  const submit = async () => {
    const body = question.trim();
    if (!body) {
      setErrors({ question: WORDS.empty });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await fileSupportTicket({
        ...(signedIn ? {} : { name: name.trim(), email: email.trim() }),
        topic: "other",
        kind: "question",
        body,
        ...(handoff?.transcript ? { summary: handoff.transcript } : {}),
      });
      if (!result.ok) {
        setErrors({
          ...(result.fieldErrors?.name ? { name: result.fieldErrors.name } : {}),
          ...(result.fieldErrors?.email ? { email: result.fieldErrors.email } : {}),
        });
        feedback("error");
        banner.error(result.error, { retry: () => void submit() });
        return;
      }
      clearHandoff();
      feedback("confirm");
      if (result.data.id) {
        banner.success(WORDS.sent);
        router.push(`/support/messages/${result.data.id}`);
      } else {
        banner.success(WORDS.sentRef.replace("{reference}", result.data.reference));
        setFiled(result.data.reference);
      }
    } catch (error) {
      if (!tapFailedOffline(error)) throw error;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nf-person grid gap-block" data-testid="person-handoff">
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{WORDS.intro}</p>

      {openTickets.length > 0 ? (
        <section aria-label={WORDS.open} className="grid gap-row">
          <h2 className="nf-caption font-semibold text-[var(--nf-content-secondary)]">{WORDS.open}</h2>
          <ul className="grid gap-row">
            {openTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link href={`/support/messages/${ticket.id}`} className="nf-person__ticket" data-testid="person-open-ticket">
                  <span className="nf-person__tile" aria-hidden="true">
                    <UiIcon name="headset" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate nf-body-sm font-semibold">{ticket.topic ?? ticket.reference}</span>
                    <span className="block nf-caption nf-numeric text-[var(--nf-content-muted)]">
                      {ticket.unread ? `${WORDS.unread} · ${ticket.reference}` : ticket.reference}
                    </span>
                  </span>
                  <span className="nf-caption font-semibold text-[var(--nf-brand-primary)]">{WORDS.continue}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {filed ? (
        <div className="nf-person__filed" role="status" data-testid="person-filed">
          <UiIcon name="circle-check" size={20} />
          <p className="nf-body-sm">{WORDS.sentRef.replace("{reference}", filed)}</p>
        </div>
      ) : (
        <form
          className="grid gap-group"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {handoff?.question ? (
            <p className="nf-person__context nf-caption" data-testid="person-context">
              <UiIcon name="bot" size={16} />
              {WORDS.context}
            </p>
          ) : (
            <p className="nf-caption text-[var(--nf-content-muted)]">{WORDS.contextNone}</p>
          )}
          <TextArea
            label={WORDS.question}
            hint={handoff ? WORDS.questionHint : undefined}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={4000}
            rows={5}
            error={errors.question}
            data-testid="person-question"
          />
          {!signedIn ? (
            <>
              <TextField
                label={WORDS.name}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={120}
                error={errors.name}
              />
              <TextField
                label={WORDS.email}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                maxLength={200}
                error={errors.email}
              />
            </>
          ) : null}
          <Button type="submit" variant="primary" size="lg" full loading={busy} data-testid="person-send">
            {busy ? WORDS.sending : WORDS.send}
          </Button>
        </form>
      )}

      <Link href="/assistant" className="nf-person__back nf-body-sm" data-testid="person-back">
        <UiIcon name="arrow-left" size={16} />
        {WORDS.back}
      </Link>
    </div>
  );
}
