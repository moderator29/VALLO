"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { requestSelfieWithId } from "@/lib/admin/kyc-actions";

/**
 * "ASK FOR A SELFIE HOLDING THEIR ID" (2 November 2026).
 *
 * Only for a person the reviewer cannot confirm: never a step of the flow.
 * The reviewer writes why (a starting sentence is filled in to edit), the
 * person is notified with those words, and answers with one photo from
 * /verification. While a request is open the card says so instead of
 * offering a second one.
 */

export const DEFAULT_REQUEST =
  "We could not confirm your identity from the photos you sent. Please take a selfie holding the same ID next to your face, with the photo side towards the camera, so we can see both clearly.";

export function RequestSelfieWithId({
  subjectId,
  open,
}: {
  subjectId: string;
  /** The open request's date and words, or null when none is open. */
  open: { requestedAt: string; message: string } | null;
}) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState(DEFAULT_REQUEST);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (open) {
    return (
      <p className="mt-sm rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] p-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]" data-testid="request-open">
        <span className="font-semibold text-[var(--nf-content-primary)]">Asked for a selfie holding their ID</span> on{" "}
        {new Date(open.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}. Waiting for them to send it.
        <span className="mt-3xs block text-[var(--nf-content-muted)]">They were sent: {open.message}</span>
      </p>
    );
  }

  function send() {
    setError(null);
    start(async () => {
      const result = await requestSelfieWithId({ subjectId, message });
      if (!result.ok) {
        setError(result.fieldErrors?.["message"] ?? result.error);
        return;
      }
      setWriting(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-sm" data-testid="request-selfie-with-id">
      {writing ? (
        <div className="grid gap-xs">
          <label className="block">
            <span className="nf-label">Why you need it (they are sent this, word for word)</span>
            <textarea
              className="nf-field min-h-[88px] resize-y"
              value={message}
              maxLength={600}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="request-message-input"
            />
          </label>
          <div className="flex flex-wrap gap-inline">
            <Button type="button" size="sm" disabled={pending || message.trim().length < 12} onClick={send} data-testid="request-send-button">
              {pending ? "Sending" : "Send the request"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setWriting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setWriting(true)} data-testid="request-start">
          Ask for a selfie holding their ID
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-xs text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
