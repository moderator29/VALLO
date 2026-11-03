"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { OfflineNote, useOnline } from "@/components/support/OfflineNote";
import { PhotoField } from "@/components/support/PhotoField";
import { uploadTicketPhoto, type PreparedPhoto } from "@/components/support/photo";
import { replyToMyTicket } from "@/lib/support/ticket-reply";
import type { Dictionary } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

const draftKey = (ticketId: string) => `nf_support_reply_${ticketId}`;

/**
 * The member's reply on their own ticket, with an optional photo.
 *
 * The draft stays in the box, and on this device, until the server says the
 * message is written, so a failed send, a dropped connection or a reload never
 * costs the person what they typed. The textarea is the shared `TextArea`,
 * which renders at 16px on a touch screen so iOS does not zoom on focus.
 */
export function ReplyBox({ ticketId, copy }: { ticketId: string; copy: Dictionary["experienceInbox"]["support"]["reply"] }) {
  const router = useRouter();
  const online = useOnline();
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftKey(ticketId));
      if (stored) setBody(stored.slice(0, 4000));
    } catch {
      // No stored draft.
    }
  }, [ticketId]);

  const keep = (value: string) => {
    setBody(value);
    try {
      if (value) window.localStorage.setItem(draftKey(ticketId), value);
      else window.localStorage.removeItem(draftKey(ticketId));
    } catch {
      // Storage blocked: the draft stays in the box.
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() && !photo) {
      setError(copy.empty);
      return;
    }
    if (!online) {
      setError(copy.offline);
      return;
    }
    setError(undefined);
    setNote("");
    start(async () => {
      try {
        const result = await replyToMyTicket({ ticketId, body, withPhoto: Boolean(photo) });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (photo) {
          const uploaded = await uploadTicketPhoto(ticketId, photo, result.data.messageId);
          if (!uploaded.ok) setNote(uploaded.error);
          URL.revokeObjectURL(photo.previewUrl);
          setPhoto(null);
        }
        keep("");
        if (!photo) setNote(copy.sent);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <form onSubmit={submit} className="nf-panel nf-panel--card block space-y-row p-card-sm" data-testid="support-reply-form">
      <TextArea
        label={copy.label}
        value={body}
        onChange={(e) => {
          keep(e.target.value);
          if (note) setNote("");
        }}
        rows={3}
        maxLength={4000}
        error={error}
        placeholder={copy.placeholder}
      />
      {photo && <PhotoField value={photo} onChange={setPhoto} disabled={pending} />}
      <OfflineNote what={copy.offlineWhat} />
      <div className="flex flex-wrap items-center justify-between gap-row">
        <div className="flex min-w-0 flex-1 items-center gap-row">
          {!photo && <PhotoField value={null} onChange={setPhoto} disabled={pending} compact />}
          <p className="nf-caption min-w-0 text-[var(--nf-content-muted)]" role="status">
            {note}
          </p>
        </div>
        <Button type="submit" variant="primary" loading={pending} disabled={pending} data-testid="support-reply-send">
          {copy.send}
        </Button>
      </div>
    </form>
  );
}
