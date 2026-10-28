"use client";

import { useId, useRef, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { uploadHostDocumentPath } from "@/lib/host/actions";
import {
  ACCEPTED_LABEL,
  ACCEPTED_MIME,
  DOCUMENT_SPECS,
  MAX_FILE_LABEL,
  rejectFile,
  type HostDocumentKind,
} from "@/lib/host/onboarding";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { uploadToStorage } from "@/lib/media/upload";

/**
 * One host document, asked for properly and filed the moment it is chosen.
 *
 * The four things the agent uploader prints before a file is chosen are
 * printed here too (what qualifies, the types, the size, the one thing
 * people get wrong), and the file is refused in the browser before a byte
 * leaves the device. What differs from the agent flow is WHEN it uploads:
 * the host application is a database row from step two, so a document goes
 * straight into the private `host-documents` bucket under the person's own
 * uid prefix and is recorded against the application at once. A person who
 * closes the tab keeps the document; nothing typed or chosen is lost.
 */
export function HostDocumentUploader({
  kind,
  businessId,
  userId,
  present,
  onFiled,
}: {
  kind: HostDocumentKind;
  /** The application row. Null until step two has saved, when uploading waits. */
  businessId: string | null;
  userId: string;
  /** True when at least one file of this kind is already on record. */
  present: boolean;
  onFiled: (kind: HostDocumentKind) => void;
}) {
  const spec = DOCUMENT_SPECS[kind];
  const inputId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filedName, setFiledName] = useState<string | null>(null);

  async function pick(chosen: File | undefined) {
    if (!chosen) return;
    const refusal = rejectFile(chosen);
    if (refusal) {
      setError(refusal);
      return;
    }
    if (!businessId) {
      setError("Save the business step first, so there is an application to file this against.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const ext = chosen.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${userId}/${crypto.randomUUID()}/${kind}.${ext}`;
      const supabase = await loadBrowserClient();
      if (!supabase) {
        setError("The upload did not finish. Check your connection and choose the file again.");
        return;
      }
      const uploaded = await uploadToStorage({ supabase, bucket: "host-documents", path, body: chosen, contentType: chosen.type });
      if (!uploaded.ok) {
        setError("The upload did not finish. Check your connection and choose the file again.");
        return;
      }
      const result = await uploadHostDocumentPath({ businessId, kind, storagePath: path });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFiledName(chosen.name);
      onFiled(kind);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const done = present || filedName !== null;

  return (
    <section className="nf-panel nf-panel--card block nf-host-group">
      <h3 className="nf-host-group__title">{spec.title}</h3>
      <p className="nf-host-group__note">{spec.qualifies}</p>
      <p className="mt-2xs flex items-start gap-2xs nf-caption">
        <UiIcon name="verified" size={16} className="mt-3xs shrink-0 text-[var(--nf-brand-secondary)]" />
        <span>{spec.caution}</span>
      </p>

      <input
        ref={input}
        id={inputId}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="sr-only"
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      <label htmlFor={inputId} className={`nf-panel nf-panel--card nf-host-drop mt-sm${done ? " nf-host-drop--done" : ""}`}>
        <UiIcon name={done ? "verified" : "picture"} size={20} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block nf-body-sm font-semibold">
            {busy ? "Uploading" : done ? (filedName ?? "On record") : "Choose a file"}
          </span>
          <span className="block nf-caption">
            {ACCEPTED_LABEL}, up to {MAX_FILE_LABEL}. {done ? "Choose again to replace it." : ""}
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-xs nf-caption text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </section>
  );
}
