"use client";

import { banner } from "@/lib/ui/toast";
import { useEffect, useState, type ClipboardEvent as ReactClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { OfflineNote, useOnline } from "@/components/support/OfflineNote";
import { PhotoField } from "@/components/support/PhotoField";
import { uploadTicketPhoto, preparePhoto, type PreparedPhoto } from "@/components/support/photo";
import { PasteChip } from "@/components/app/messages/PasteChip";
import { PASTE_WORDS } from "@/lib/paste/words";
import { overBy, readPaste } from "@/lib/paste/parse";
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
  /* A paste too big for the field, held as a chip above it (founder, 14
     November 2026). The ticket's own 4,000 character limit is what the chip
     measures against. */
  const [pasted, setPasted] = useState<
    | { kind: "text"; text: string }
    | { kind: "link"; href: string; host: string; path: string; vallo: "listing" | "stay" | "restaurant" | "profile" | "post" | null }
    | null
  >(null);

  /**
   * A PASTE IN THE SUPPORT REPLY. A pasted picture goes through
   * `preparePhoto`, the SAME door the photo field uses, so the checks and
   * the refusals are the ones a picked file meets; a ticket carries one
   * photo, so the first is held. A file that is neither picture nor video is
   * refused with words. A wall of words or one address becomes a chip.
   *
   * Vallo is never told which app a paste came from; iOS draws that banner.
   */
  const onPaste = async (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const data = event.clipboardData;
    if (!data) return;
    const paste = readPaste(data, window.location.origin);
    if (paste.kind === "files") {
      event.preventDefault();
      const first = paste.files.find((file) => file.type.startsWith("image/"));
      if (first) {
        const prepared = await preparePhoto(first);
        if ("error" in prepared) setError(prepared.error);
        else setPhoto(prepared);
      }
      if (paste.refused > 0) {
        setError(
          paste.refused === 1
            ? PASTE_WORDS.refusedFile
            : PASTE_WORDS.refusedFiles.replace("{n}", String(paste.refused)),
        );
      }
      return;
    }
    if (paste.kind === "long-text") {
      event.preventDefault();
      setPasted({ kind: "text", text: paste.text });
      return;
    }
    if (paste.kind === "link") {
      event.preventDefault();
      setPasted({ kind: "link", href: paste.href, host: paste.host, path: paste.path, vallo: paste.vallo?.thing ?? null });
    }
  };

  /** Tap the chip: the held text moves into the field to read and edit. */
  const openPasted = () => {
    if (!pasted || pasted.kind !== "text") return;
    keep(body ? `${body}\n${pasted.text}` : pasted.text);
    setPasted(null);
  };
  /* The box's own error (empty, offline) sits under the box; what a send did
     is said by the one banner at the top of the screen (Grade 1). */
  const [error, setError] = useState<string | undefined>();
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
    const held = pasted ? (pasted.kind === "text" ? pasted.text : pasted.href) : "";
    if (!body.trim() && !held && !photo) {
      setError(copy.empty);
      return;
    }
    if (!online) {
      setError(copy.offline);
      return;
    }
    setError(undefined);
    start(async () => {
      try {
        /* The chip's words travel with the reply, typed words first. */
        const typed = body.trim();
        const whole = [typed, held].filter(Boolean).join(typed && held ? "\n" : "");
        const result = await replyToMyTicket({ ticketId, body: whole, withPhoto: Boolean(photo) });
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
        setPasted(null);
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
        rows={3}
        maxLength={4000}
        error={error}
        placeholder={copy.placeholder}
        onPaste={(event) => void onPaste(event)}
      />
      {pasted && (
        <PasteChip
          kind={pasted.kind === "text" ? "text" : "link"}
          {...(pasted.kind === "text"
            ? { text: pasted.text, overBy: overBy(pasted.text, 4000), onOpen: openPasted }
            : { host: pasted.host, path: pasted.path, vallo: pasted.vallo })}
          onRemove={() => setPasted(null)}
          words={{
            ...PASTE_WORDS,
            remove: pasted.kind === "text" ? PASTE_WORDS.remove : PASTE_WORDS.removeLink,
          }}
        />
      )}
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
