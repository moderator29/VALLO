"use client";

import { banner } from "@/lib/ui/toast";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { OfflineNote, useOnline } from "@/components/support/OfflineNote";
import { PhotoField } from "@/components/support/PhotoField";
import { preparePhoto, uploadTicketPhoto, type PreparedPhoto } from "@/components/support/photo";
import { PasteTray } from "@/components/app/messages/PasteTray";
import { usePaste } from "@/components/app/messages/use-paste";
import { PASTE_WORDS, fillCount } from "@/components/app/messages/paste-words";
import { replyToMyTicket } from "@/lib/support/ticket-reply";
import type { Dictionary } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

const draftKey = (ticketId: string) => `nf_support_reply_${ticketId}`;
/** The longest reply the ticket takes, typed and pasted together. */
const REPLY_LIMIT = 4000;

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
  /* The box's own error (empty, offline) sits under the box; what a send did
     is said by the one banner at the top of the screen (Grade 1). */
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftKey(ticketId));
      if (stored) setBody(stored.slice(0, REPLY_LIMIT));
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

  /* PASTE (14 November 2026). A pasted screenshot goes through
     `preparePhoto`, the door a picked one uses (same type and size checks, the
     same re-encode); a long pasted text or a lone link is held as a chip and
     is part of the reply's text, inside the reply's own 4,000 characters. */
  const paste = usePaste({
    limit: REPLY_LIMIT,
    imageRoom: photo ? 0 : 1,
    onImages: (files) => {
      const file = files[0];
      if (!file) return;
      void preparePhoto(file).then((prepared) => {
        if ("error" in prepared) banner.error(prepared.error);
        else setPhoto(prepared);
      });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const composed = paste.split(body);
    if (!composed.body.trim() && !photo) {
      setError(copy.empty);
      return;
    }
    if (composed.over > 0) {
      setError(fillCount(PASTE_WORDS.tooLong, composed.over));
      return;
    }
    if (!online) {
      setError(copy.offline);
      return;
    }
    setError(undefined);
    start(async () => {
      try {
        const result = await replyToMyTicket({ ticketId, body: composed.body, withPhoto: Boolean(photo) });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        let photoFailed = false;
        if (photo) {
          const uploaded = await uploadTicketPhoto(ticketId, photo, result.data.messageId);
          if (!uploaded.ok) {
            photoFailed = true;
            banner.error(uploaded.error);
          }
          URL.revokeObjectURL(photo.previewUrl);
          setPhoto(null);
        }
        keep("");
        paste.clear();
        if (!photoFailed) banner.success(copy.sent);
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
        onChange={(e) => keep(e.target.value)}
        onPaste={paste.onPaste}
        rows={3}
        maxLength={REPLY_LIMIT}
        error={error}
        placeholder={copy.placeholder}
      />
      <PasteTray paste={paste} over={paste.held ? paste.split(body).over : 0} />
      {photo && <PhotoField value={photo} onChange={setPhoto} disabled={pending} />}
      <OfflineNote what={copy.offlineWhat} />
      <div className="flex flex-wrap items-center justify-between gap-row">
        <div className="flex min-w-0 flex-1 items-center gap-row">
          {!photo && <PhotoField value={null} onChange={setPhoto} disabled={pending} compact />}
        </div>
        <Button type="submit" variant="primary" loading={pending} disabled={pending} data-testid="support-reply-send">
          {copy.send}
        </Button>
      </div>
    </form>
  );
}
