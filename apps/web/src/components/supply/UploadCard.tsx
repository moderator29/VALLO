"use client";

import { useId, useRef, useState } from "react";
import type { UploadCopy } from "./supply-copy";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { IconPlate } from "@/components/ui/IconPlate";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import {
  MAX_FILE_LABEL,
  documentExtension,
  rejectFileIssue,
} from "@/components/verification/kyc";
import { uploadToStorage } from "@/lib/media/upload";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * ONE OF THE BIG UPLOAD CARDS ON `GOVERNING-04` SCREEN TWO AND `GOVERNING-05`
 * SCREEN TWO.
 *
 * A glass object on the left, a title, one supporting line, and a state that
 * changes as the file goes up. It is the door's anatomy at a taller height,
 * for the same reason the choice rows are the door's anatomy at a shorter one:
 * one object, one set of rules about how it is drawn.
 *
 * THE UPLOAD IS REAL AND IT GOES STRAIGHT FROM THE BROWSER INTO THE PRIVATE
 * BUCKET, under `<auth uid>/<batch>/<slot>.<ext>`, which storage RLS restricts
 * to this user's own folder. The slot counts as filled only once the object
 * exists and a real path came back, so nobody submits believing a document
 * went through when it did not. That rule and this path shape are
 * `ApplyWizard`'s, unchanged, because a second upload convention would be a
 * second set of objects a reviewer has to know how to find.
 *
 * THE PATH IS NEVER PRINTED AND NEVER LOGGED. The card says which FILE it is
 * holding, by the name the person's own device gave it, and nothing else.
 */

/*
 * THE LIMITS ARE THE BUCKET'S, READ FROM ONE PLACE. `agent-documents` refuses
 * anything over 8MB and anything outside its type allowlist
 * (20260809051809), and `kyc.ts` states exactly that. This card used to allow
 * 10MB, so a 9MB photo passed here, was refused by storage, and the card said
 * "try again" about a file that could never go through. The size and the type
 * are now checked here first, against the same rule the bucket applies.
 */
const DOCUMENT_BUCKET = "agent-documents";

/** A stable folder per form session, so retries do not scatter objects. */
export function newBatchId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `b-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export type UploadState = {
  path: string;
  fileName: string;
};

export function UploadCard({
  t,
  object,
  title,
  body,
  slot,
  batchId,
  value,
  onChange,
  accept = "image/png,image/jpeg,application/pdf",
  error,
}: {
  t: UploadCopy;
  object: BrandIconName;
  title: string;
  body: string;
  /** The slot's name, which becomes the object's file name in the bucket. */
  slot: string;
  batchId: string;
  value: UploadState | null;
  onChange(next: UploadState | null): void;
  accept?: string;
  error?: string | undefined;
}) {
  const copy = t.supply.register;
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function take(file: File | undefined) {
    if (!file) return;
    setFailure(null);

    const refusal = rejectFileIssue(file);
    if (refusal) {
      setFailure(refusal === "size" ? copy.fileTooBig : copy.fileType);
      return;
    }

    setBusy(true);
    try {
      const supabase = await loadBrowserClient();
      if (!supabase) {
        setFailure(copy.fileFailed);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFailure(copy.signInFirst);
        return;
      }
      /* A new path for every file chosen, never an overwrite (SEC-12): a filed
         document is fixed, so re-choosing is a new object and the submit files
         whichever path is current. */
      const path = `${user.id}/${batchId}/${slot}-${crypto.randomUUID()}.${documentExtension(file.type)}`;
      const upload = await uploadToStorage({ supabase, bucket: DOCUMENT_BUCKET, path, body: file, contentType: file.type });
      if (!upload.ok) {
        setFailure(copy.fileFailed);
        return;
      }
      if (value?.path && value.path !== path) {
        /* Best effort: remove the slot's previous upload. The storage policy
           allows it only while that object has not been filed. */
        void supabase.storage.from(DOCUMENT_BUCKET).remove([value.path]);
      }
      onChange({ path, fileName: file.name });
    } catch {
      setFailure(copy.fileFailed);
    } finally {
      setBusy(false);
    }
  }

  const state = busy ? copy.uploading : value ? copy.fileReady : null;
  /* What the slot takes, said before anything is chosen rather than only in
     the refusal after a failed upload on metered data. */
  const limit = (accept.includes("application/pdf") ? copy.fileLimit : copy.photoLimit).replace(
    "{size}",
    MAX_FILE_LABEL,
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="nf-door"
        data-on={value ? true : undefined}
        aria-describedby={`${inputId}-state`}
      >
        <IconPlate size="md" tone={value ? "success" : "neutral"} className="nf-door__mark">
          <UiIcon name={lineGlyphFor(object)} size={20} />
        </IconPlate>
        <span className="min-w-0 flex-1 text-left">
          <span id={`${inputId}-title`} className={`block ${TYPE.rowTitle}`}>{title}</span>
          <span className={`mt-inline-tight block ${TYPE.rowMeta}`}>{body}</span>
        </span>
        <UiIcon
          name={value ? "verified-badge" : "chevron-right"}
          size={value ? "md" : "sm"}
          className={
            value
              ? "shrink-0 text-[var(--nf-brand-primary)]"
              : "shrink-0 text-[var(--nf-content-muted)]"
          }
        />
      </button>

      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        /* Named by the card's own title, as DocumentUploader's input is
           (DOC-20): unnamed, a screen reader announced an unlabelled file
           picker on the step that proves who somebody is. */
        aria-labelledby={`${inputId}-title`}
        aria-describedby={`${inputId}-state`}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          /* Cleared at once. A file input fires no change event when the same
             file is chosen again, so after a failed upload the only retry this
             card offers, choosing the file again, did nothing at all. */
          event.target.value = "";
          void take(chosen);
        }}
      />

      {/*
        THE STATE IN WORDS, ALWAYS, AND THE FILE NAME BESIDE IT.
        A tick on the card is not enough: "ready to send" and the name of the
        file are what tell somebody they chose the right one, and a person who
        cannot see the tick gets exactly the same news.
      */}
      <p id={`${inputId}-state`} className={`mt-xs ${TYPE.rowMeta}`} aria-live="polite">
        {state ? `${state}${value ? `: ${value.fileName}` : ""}` : `${copy.addFile}. ${limit}`}
      </p>

      {/* The card keeps its words for a screen reader; the banner says them (founder, 7 November 2026). */}
      <FieldProblem id={`${inputId}-problem`} message={failure ?? error} />
    </div>
  );
}
