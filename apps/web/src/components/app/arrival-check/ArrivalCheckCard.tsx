"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { answerArrivalCheck } from "@/lib/stays/arrival-check-actions";
import {
  MAX_ARRIVAL_PHOTOS,
  arrivalPhotoPath,
  reportReady,
  type ArrivalReportReason,
} from "@/lib/stays/arrival-check";

/**
 * V-91. The two answers, and the camera-first report behind "No".
 *
 * The photo control opens the phone's camera (`capture="environment"`), and
 * each photo goes straight from the phone to the private `arrival-evidence`
 * bucket under this booking; the storage policy accepts only this guest, and
 * only until they answer. Nothing leaves Vallo: the camera is the device's,
 * the upload is Vallo's, and the report is filed in the same tap as the
 * answer.
 *
 * The storage client is imported when the first photo is chosen, not with
 * the card (Session 3, W13, measured): `@supabase/supabase-js` is 64.7KB
 * gzipped in the built client, and most guests answer "Yes" and never need
 * it, so it stays off the booking page's first load from here.
 */
export function ArrivalCheckCard({
  bookingId,
  copy,
  closesAt,
}: {
  bookingId: string;
  copy: Dictionary["arrivalCheck"];
  closesAt: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"ask" | "report">("ask");
  const [reason, setReason] = useState<ArrivalReportReason | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement | null>(null);

  const send = (answer: "as_listed" | ArrivalReportReason) => {
    setError(null);
    start(async () => {
      try {
        const result = await answerArrivalCheck({
          bookingId,
          answer,
          note: answer === "as_listed" ? undefined : note.trim() || undefined,
          photos: answer === "as_listed" ? [] : photos,
        });
        if (!result.ok) {
          setError(result.error || copy.failed);
          return;
        }
        router.refresh();
      } catch {
        setError(copy.failed);
      }
    });
  };

  const add = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const added: string[] = [];
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const storage = createClient().storage.from("arrival-evidence");
      const room = MAX_ARRIVAL_PHOTOS - photos.length;
      for (const file of Array.from(files).slice(0, Math.max(0, room))) {
        const path = arrivalPhotoPath(bookingId, file.name, crypto.randomUUID());
        const uploaded = await storage.upload(path, file, { contentType: file.type });
        if (uploaded.error) {
          setError(copy.uploadFailed);
          break;
        }
        added.push(path);
      }
    } catch {
      /* The client could not load or the network dropped mid-upload: the
         same honest line as a refused upload, and the photos already sent
         stay counted. */
      setError(copy.uploadFailed);
    } finally {
      setPhotos((now) => [...now, ...added].slice(0, MAX_ARRIVAL_PHOTOS));
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="nf-panel nf-panel--card isolate mt-lg block p-md" data-testid="arrival-check">
      <h2 className="nf-h3">{copy.title}</h2>
      <p className="nf-body-sm mt-xs text-[var(--nf-content-secondary)]">{copy.lede.replace("{time}", closesAt)}</p>

      {mode === "ask" ? (
        <div className="mt-md grid gap-sm">
          <Button variant="primary" full loading={pending} disabled={pending} onClick={() => send("as_listed")}>
            {copy.yes}
          </Button>
          <Button variant="secondary" full disabled={pending} onClick={() => setMode("report")}>
            {copy.no}
          </Button>
        </div>
      ) : (
        <form
          className="mt-md grid gap-md"
          data-testid="arrival-report-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason && reportReady(reason, photos.length)) send(reason);
          }}
        >
          <fieldset className="grid gap-xs">
            <legend className="nf-label">{copy.reasonLabel}</legend>
            {(["no_access", "not_as_listed"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                full
                variant={reason === option ? "primary" : "secondary"}
                aria-pressed={reason === option}
                disabled={pending}
                onClick={() => setReason(option)}
              >
                {copy.reasons[option]}
              </Button>
            ))}
          </fieldset>

          <div className="grid gap-xs">
            <span className="nf-label">{copy.photosLabel}</span>
            <p className="nf-body-sm text-[var(--nf-content-secondary)]">
              {copy.photosHint.replace("{max}", String(MAX_ARRIVAL_PHOTOS))}
            </p>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              id={`arrival-photo-${bookingId}`}
              onChange={(event) => void add(event.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              full
              leadingIcon="picture"
              loading={uploading}
              disabled={pending || uploading || photos.length >= MAX_ARRIVAL_PHOTOS}
              onClick={() => input.current?.click()}
            >
              {copy.takePhoto}
            </Button>
            <p className="nf-body-sm text-[var(--nf-content-secondary)]" aria-live="polite">
              {copy.photoCount.replace("{count}", String(photos.length)).replace("{max}", String(MAX_ARRIVAL_PHOTOS))}
            </p>
          </div>

          <Field label={copy.noteLabel}>
            {(control) => (
              <textarea
                {...control}
                className="nf-field min-h-[5.5rem]"
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-md">
            <Button type="button" variant="ghost" full disabled={pending} onClick={() => setMode("ask")}>
              {copy.back}
            </Button>
            <Button
              type="submit"
              variant="primary"
              full
              loading={pending}
              disabled={pending || uploading || !reportReady(reason, photos.length)}
            >
              {copy.send}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="nf-body-sm mt-sm font-semibold text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </section>
  );
}
