"use client";

import { useId, useRef, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { ICON_PLATE_GLYPH, IconPlate } from "@/components/ui/IconPlate";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import {
  ACCEPTED_LABEL,
  ACCEPTED_MIME,
  DOCUMENT_SUBTYPES,
  MAX_FILE_LABEL,
  addressDateIssue,
  documentExtension,
  lagosToday,
  rejectFileIssue,
  type DocumentKind,
  type KycDocument,
} from "./kyc";
import type { KycCopy } from "./KycFlow";
import { uploadToStorage } from "@/lib/media/upload";

/**
 * The private bucket identity documents live in, under `<auth uid>/…`, which
 * its storage policies restrict to the person's own folder. The same bucket
 * and path shape as the agent application (`components/supply/UploadCard`),
 * so the review desk finds every identity document in one place.
 */
const DOCUMENT_BUCKET = "agent-documents";

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

/**
 * One document, asked for properly.
 *
 * Four things are printed on this control BEFORE anything is chosen, and every
 * one of them is a thing that otherwise becomes an error message after a failed
 * upload on a metered connection:
 *
 *   1. WHICH DOCUMENTS QUALIFY, by name. Not "government issued ID" - a
 *      passport, a driver's licence, a NIN slip, a voter's card. Somebody
 *      holding a NIN slip and reading "government issued ID" does not know
 *      whether they have one.
 *   2. THE ACCEPTED FILE TYPES.
 *   3. THE SIZE LIMIT, as a number with a unit.
 *   4. THE ONE THING PEOPLE GET WRONG. For an address document that is the
 *      three-month rule, which is the single most common rejection reason in
 *      every KYC flow that has one and is almost never stated up front.
 *
 * The file is checked in the browser the moment it is chosen and refused with a
 * sentence that says what to do instead, so a person who picks the wrong file
 * has spent no data finding out. A file that passes goes straight into the
 * private document store under the person's own folder, and the slot counts
 * as filled only once a real path came back: nobody reaches the review step
 * believing a document went up when it did not. Nothing is FILED for review
 * until the last step's button is pressed.
 */
export function DocumentUploader({
  kind,
  file,
  onChange,
  batchId,
  copy,
}: {
  /** The flow's words (`experienceAccount.kyc`), handed down by KycFlow. */
  copy: KycCopy;
  kind: DocumentKind;
  file: KycDocument | null;
  onChange: (file: KycDocument | null) => void;
  /** One folder per visit to the flow, so retries do not scatter objects. */
  batchId: string;
}) {
  const spec = copy.documents[kind];
  const DATE_WORDS = { missing: copy.dateMissing, future: copy.dateFuture, old: copy.dateOld } as const;
  const inputId = useId();
  const titleId = `${inputId}-title`;
  const hintId = `${inputId}-hint`;
  const input = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(chosen: File | undefined) {
    if (!chosen || uploading) return;
    const refusal = rejectFileIssue(chosen);
    if (refusal) {
      setError(
        (refusal === "type" ? copy.fileType : copy.fileSize)
          .replace("{formats}", ACCEPTED_LABEL)
          .replace("{size}", MAX_FILE_LABEL),
      );
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = await loadBrowserClient();
      if (!supabase) {
        setError(copy.uploadFailed);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(copy.signInFirst);
        return;
      }
      /* A new object for every file chosen, never an overwrite: a filed
         document is fixed, so choosing again is a new path. */
      const path = `${user.id}/kyc-${batchId}/${kind}-${randomId()}.${documentExtension(chosen.type)}`;
      const upload = await uploadToStorage({ supabase, bucket: DOCUMENT_BUCKET, path, body: chosen, contentType: chosen.type });
      if (!upload.ok) {
        setError(copy.uploadFailed);
        return;
      }
      if (file?.path && file.path !== path) {
        /* Best effort: the replaced object has not been filed, so the
           storage policy still lets its owner remove it. */
        void supabase.storage.from(DOCUMENT_BUCKET).remove([file.path]);
      }
      onChange({
        name: chosen.name,
        size: chosen.size,
        type: chosen.type,
        path,
        subtype: file?.subtype ?? null,
        issuedOn: file?.issuedOn ?? null,
      });
    } catch {
      setError(copy.uploadFailed);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  const dateIssue = kind === "address" && file?.issuedOn ? addressDateIssue(file.issuedOn, lagosToday()) : null;
  const dateProblem = dateIssue ? DATE_WORDS[dateIssue] : null;

  return (
    <section className="nf-panel nf-panel--card block p-md sm:p-lg">
      {/* DOC-20: an h2 under the step's h1 (it was an h3, which skipped a
          level), and the name the file input below is labelled by. */}
      <h2 id={titleId} className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">{spec.title}</h2>

      <p id={hintId} className="mt-2xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {spec.qualifies}
      </p>

      {/* The rule that gets people refused, said before they upload. */}
      <p className="mt-xs flex items-start gap-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
        <UiIcon name="verified" size="sm" className="mt-3xs shrink-0" />
        <span>{spec.caution}</span>
      </p>

      <input
        ref={input}
        id={inputId}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="sr-only"
        /* DOC-20: the control had no accessible name, so a screen reader
           announced an unnamed file picker on the step that gates trust. */
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onChange={(event) => void pick(event.target.files?.[0])}
      />

      {file ? (
        <div className="nf-panel nf-panel--card mt-md flex-row items-center gap-sm px-md py-sm">
          <IconPlate size="md">
            <UiIcon name="document" size={ICON_PLATE_GLYPH.md} />
          </IconPlate>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
              {file.name}
            </span>
            <span className="nf-numeric block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {copy.kb.replace("{n}", String(Math.max(1, Math.round(file.size / 1024))))}
            </span>
          </span>
          {/* Replace, not just remove. The person is here to supply a document,
              so the useful control is the one that gets them to a better
              photograph rather than back to an empty box. */}
          <Button
            variant="secondary"
            size="sm"
            aria-describedby={titleId}
            loading={uploading}
            onClick={() => input.current?.click()}
          >
            {copy.replace}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="md"
          full
          className="mt-md"
          leadingIcon="plus"
          aria-describedby={titleId}
          loading={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? copy.uploading : copy.choose}
        </Button>
      )}

      {/* The two answers a reviewer needs about the document, asked once it
          is up: which document it is, and for an address, its date. */}
      {file && (
        <div className="mt-md space-y-sm">
          <SelectField
            label={kind === "identity" ? copy.whichId : copy.whichAddress}
            required
            value={file.subtype ?? ""}
            onChange={(event) => onChange({ ...file, subtype: event.target.value || null })}
          >
            <option value="">{copy.pickOne}</option>
            {DOCUMENT_SUBTYPES[kind].map((option) => (
              <option key={option.value} value={option.value}>
                {(copy.subtypes as Record<string, string>)[option.value] ?? option.label}
              </option>
            ))}
          </SelectField>
          {kind === "address" && (
            <TextField
              label={copy.issuedOn}
              hint={copy.issuedOnHint}
              type="date"
              required
              max={lagosToday()}
              value={file.issuedOn ?? ""}
              error={dateProblem ?? undefined}
              onChange={(event) => onChange({ ...file, issuedOn: event.target.value || null })}
            />
          )}
        </div>
      )}

      {/* The limits, always visible, never only inside an error. */}
      <p className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
        {copy.limit.replace("{formats}", ACCEPTED_LABEL).replace("{size}", MAX_FILE_LABEL)}
      </p>

      {error && (
        <p role="alert" className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </section>
  );
}

