"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startConversationWithMessage } from "@/lib/messages/actions";
import { Chip } from "@/components/ui/Chip";
import { addQuestion, removeQuestion } from "@/lib/enquiry/renter-questions";
import type { QuickReply } from "@/lib/enquiry/quick-replies";
import type { Dictionary } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * UX-P2-03: the first message, written before any thread exists. Sending it
 * opens the conversation and posts the message together; leaving the page
 * writes nothing, so an abandoned "Message" tap no longer puts an empty
 * thread in both inboxes or spends the daily new-conversation allowance.
 */
export function FirstMessage({
  listingId,
  listingTitle,
  suffix = "",
  questions = [],
  questionsTitle = "",
  replyLine = null,
  copy,
}: {
  listingId: string;
  listingTitle: string | null;
  /** V-69: `?showme=1` when "Show me..." sent them, so the thread opens with the ask ready. */
  suffix?: string;
  /**
   * B6: the renter's question chips, already filtered to what the listing
   * does not answer. A tap adds the sentence to the draft (a second tap takes
   * it out); nothing is sent until Send.
   */
  questions?: QuickReply[];
  questionsTitle?: string;
  /** B7: the lister's reply-time line, only when the record supports one. */
  replyLine?: React.ReactNode;
  /** The form's words, `experienceInbox.newMessage`, from the server page. */
  copy: Pick<Dictionary["experienceInbox"]["newMessage"], "firstAbout" | "first" | "placeholder" | "send">;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phoneGate, setPhoneGate] = useState(false);
  const [pending, startTransition] = useSafeTransition();

  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPhoneGate(false);
    startTransition(async () => {
      const result = await startConversationWithMessage({ listingId, body });
      if (result.ok) router.replace(`/messages/${result.data.conversationId}${suffix}`);
      else {
        setError(result.error);
        setPhoneGate(isPhoneGate(result));
      }
    });
  }

  return (
    <form onSubmit={send} className="nf-panel nf-panel--card grid gap-sm p-card" data-testid="first-message">
      <label className="grid gap-3xs">
        <span className="nf-label">
          {listingTitle ? copy.firstAbout.replace("{title}", listingTitle) : copy.first}
        </span>
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={copy.placeholder}
          className="nf-field"
        />
      </label>
      {questions.length > 0 && (
        <div role="group" aria-label={questionsTitle} className="nf-ask-chips" data-testid="renter-questions">
          <p className="nf-section-label">{questionsTitle}</p>
          <div className="nf-ask-chips__row">
            {questions.map((q) => {
              const added = body.includes(q.text);
              return (
                <Chip
                  key={q.key}
                  size="sm"
                  selected={added}
                  onSelectedChange={() => setBody((b) => (added ? removeQuestion(b, q.text) : addQuestion(b, q.text)))}
                  data-testid={`renter-question-${q.key}`}
                >
                  {q.label}
                </Chip>
              );
            })}
          </div>
        </div>
      )}
      {replyLine}
      {error && (
        <p role="alert" className="nf-caption">
          {error}
        </p>
      )}
      <PhoneGateLink show={phoneGate} full />
      <Button type="submit" variant="primary" full disabled={pending || body.trim().length === 0}>
        {copy.send}
      </Button>
    </form>
  );
}
