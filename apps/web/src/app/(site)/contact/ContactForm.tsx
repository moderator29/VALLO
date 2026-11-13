"use client";

import { useActionState, useEffect } from "react";
import { banner } from "@/lib/ui/toast";
import Link from "next/link";
import { submitContactForm } from "@/lib/support/actions";
import { TicketFiledSheet } from "@/components/app/account/TicketFiledSheet";
import type { ActionResult } from "@/lib/actions/envelope";
import { Button } from "@/components/ui/Button";
import { SUPPORT_EMAIL, SUPPORT_MAILBOX } from "@/lib/support-email";
import {
  CONTACT_TOPICS,
  CONTACT_TOPIC_LABEL,
  DEFAULT_CONTACT_TOPIC,
  type ContactTopic,
} from "./topics";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";

/**
 * The public contact form.
 *
 * This used to set a local flag and tell you, honestly, that nothing had been
 * sent. The honesty was real and the note said so before you typed a word, but
 * the write path it apologised for already existed: `fileSupportTicket` has
 * filed anonymous tickets through the service role since support shipped.
 *
 * So it files a real ticket now. The visitor gets a VAL-SUP reference on the
 * screen and the same reference by email, and support gets a row in the queue
 * they already work from. Every failure still names the support address, so a
 * paused queue, a missing key or a rate limit leaves a person with somewhere
 * to go rather than a dead form.
 */
export function ContactForm({
  defaultTopic = DEFAULT_CONTACT_TOPIC,
}: {
  defaultTopic?: ContactTopic;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ reference: string; id?: string }> | null,
    FormData
  >(submitContactForm, null);

  useEffect(() => {
    if (!state || state.ok) return;
    banner.error(
      SUPPORT_MAILBOX ? `${state.error} Nothing you typed has been cleared.` : `${state.error} Nothing you typed has been cleared, so try again in a moment.`,
      SUPPORT_MAILBOX
        ? { action: { label: "Email us", run: () => window.location.assign(`mailto:${SUPPORT_EMAIL}`) } }
        : undefined,
    );
  }, [state]);

  const fieldError = (key: string): string | undefined =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  // ------------------------------------------------------------ filed
  if (state?.ok) {
    return (
      <div className="nf-panel nf-panel--card block p-card text-center" data-testid="contact-filed">
        {/* The success sheet, once, over the panel that keeps the reference. */}
        <TicketFiledSheet reference={state.data.reference} signedIn={Boolean(state.data.id)} />
        <IconPlate size="md" className="mx-auto grid place-items-center">
          <UiIcon name="headset" size={20} />
        </IconPlate>
        <p className="mt-row text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
          Your message is with support
        </p>
        <p className="mx-auto mt-inline max-w-[44ch] text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
          We reply within one business day, Monday to Saturday. Your reference is
          below, and it is in the confirmation email we have just sent you.
        </p>
        <p className="nf-numeric mt-group inline-block nf-panel nf-panel--card px-group py-inline text-[length:var(--nf-text-body-lg)] font-bold tracking-wide text-[var(--nf-content-primary)]">
          {state.data.reference}
        </p>
        {/* Filed while signed in: the ticket is on the account, so the reply
            lands in the in-app thread as well as by email. */}
        {state.data.id && (
          <p className="mt-group">
            <Link
              href={`/support/messages/${state.data.id}`}
              className="nf-link-quiet inline-flex min-h-11 items-center font-semibold text-[var(--nf-content-link)]"
              data-testid="contact-open-thread"
            >
              Open the conversation
            </Link>
          </p>
        )}
        <p className="mt-group text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          {SUPPORT_MAILBOX ? (
            <>
              Need to add something? Reply to that email, or write to{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-[var(--nf-content-link)] hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              quoting the reference.
            </>
          ) : (
            <>Need to add something? Reply to that email, quoting the reference.</>
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-group" aria-describedby="contact-form-note">
      <div className="grid gap-heading sm:grid-cols-2">
        <label className="block">
          <span className="nf-overline mb-inline block">Your name</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            className="nf-field"
            placeholder="Amaka Obi"
            aria-invalid={fieldError("name") ? true : undefined}
          />
          {fieldError("name") && (
            <span className="mt-inline block text-[length:var(--nf-text-overline)] text-[var(--nf-state-warning)]">
              {fieldError("name")}
            </span>
          )}
        </label>
        <label className="block">
          <span className="nf-overline mb-inline block">Email</span>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            name="email"
            autoComplete="email"
            className="nf-field"
            placeholder="you@example.com"
            aria-invalid={fieldError("email") ? true : undefined}
          />
          {fieldError("email") && (
            <span className="mt-inline block text-[length:var(--nf-text-overline)] text-[var(--nf-state-warning)]">
              {fieldError("email")}
            </span>
          )}
        </label>
      </div>

      <label className="block">
        <span className="nf-overline mb-inline block">Topic</span>
        {/*
          The safety topic is first and it is worded as the thing that actually
          happens, not as a category name. The admin support queue reads this
          value back and puts the four-hour clock on the ticket, so choosing it
          changes how fast a person sees it rather than only how it is filed.
        */}
        <select name="topic" className="nf-field" defaultValue={defaultTopic}>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {CONTACT_TOPIC_LABEL[topic]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="nf-overline mb-inline block">Message</span>
        <textarea
          name="message"
          rows={5}
          className="nf-field resize-y"
          placeholder="Tell us what happened, including any booking reference."
          aria-invalid={fieldError("message") ? true : undefined}
        />
        {fieldError("message") && (
          <span className="mt-inline block text-[length:var(--nf-text-overline)] text-[var(--nf-state-warning)]">
            {fieldError("message")}
          </span>
        )}
      </label>

      {/* The primitive owns the disabled + spinner state; the copy is main's. */}
      <Button type="submit" variant="primary" loading={pending}>
        {pending ? "Sending your message..." : "Send message"}
      </Button>

      {/* A refusal is said by the one banner at the top of the screen, with
          "Email us" when there is a mailbox, and nothing typed is cleared
          (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */}
      <p id="contact-form-note" className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
        {/* No "or write to us at" line without a mailbox to write to. This
            form opens a real support_tickets row that an admin works in the
            console, so it is the channel, not the fallback. */}
        This opens a support ticket and emails you the reference.
        {SUPPORT_MAILBOX ? (
          <>
            {" "}If you would rather write to us yourself, the address is{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-semibold text-[var(--nf-content-link)] hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </>
        ) : null}
      </p>

    </form>
  );
}
