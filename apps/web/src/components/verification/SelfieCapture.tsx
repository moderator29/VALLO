"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import type { KycSelfie } from "./kyc";
import type { KycCopy } from "./KycFlow";
import { banner } from "@/lib/ui/toast";

/**
 * THE SELFIE STEP (2 November 2026).
 *
 * The way the big platforms do it: a plain, live photo of the face, taken
 * with the front camera inside an oval guide, which a person at Vallo
 * compares with the photo on the ID. Nobody is asked to hold their ID up to
 * the camera (most people do not have it in hand at that moment).
 *
 * TWO WAYS IN, ONE WAY OUT. The live camera (getUserMedia) where the browser
 * allows it; otherwise the phone's own camera through a file input with
 * `capture="user"`, which on a phone opens the front camera directly. Either
 * way the photo goes into the private `agent-documents` bucket under the
 * person's own folder, and the step counts as done only once a real path came
 * back. Nothing is filed for review until the last step's button.
 *
 * The preview is mirrored, as every camera app is; the saved photo is not,
 * so writing on clothing reads the right way round for the reviewer.
 */

const BUCKET = "agent-documents";
const MAX_EDGE = 1280;

type Phase = "idle" | "starting" | "live" | "captured" | "saving" | "saved";

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export function SelfieCapture({
  copy,
  batchId,
  selfie,
  onChange,
  words,
  fileStem = "selfie",
}: {
  copy: KycCopy;
  batchId: string;
  selfie: KycSelfie | null;
  onChange: (selfie: KycSelfie | null) => void;
  /** Other words for the same camera: the photo a reviewer asked for. */
  words?: Partial<KycCopy["selfie"]>;
  /** The stored file's name, before its id: `selfie` or `selfie-with-id`. */
  fileStem?: string;
}) {
  const s = { ...copy.selfie, ...words };
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>(selfie ? "saved" : "idle");
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  useEffect(() => () => stop(), []);
  useEffect(
    () => () => {
      if (shot) URL.revokeObjectURL(shot.url);
    },
    [shot],
  );
  useEffect(
    () => () => {
      if (savedUrl) URL.revokeObjectURL(savedUrl);
    },
    [savedUrl],
  );

  async function start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      banner.error(s.unavailable);
      return;
    }
    setPhase("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      stream.current = media;
      setPhase("live");
      /* The element exists once the phase is live; attach on the next frame. */
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().catch(() => undefined);
        }
      });
    } catch (cause) {
      stop();
      setPhase(selfie ? "saved" : "idle");
      const name = cause && typeof cause === "object" && "name" in cause ? String((cause as { name: unknown }).name) : "";
      banner.error(name === "NotAllowedError" || name === "SecurityError" ? s.denied : s.unavailable);
    }
  }

  function capture() {
    const el = video.current;
    if (!el || el.videoWidth === 0) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(el.videoWidth, el.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(el.videoWidth * scale);
    canvas.height = Math.round(el.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          banner.error(s.failed);
          return;
        }
        stop();
        setShot({ blob, url: URL.createObjectURL(blob) });
        setPhase("captured");
      },
      "image/jpeg",
      0.9,
    );
  }

  async function save(blob: Blob, type: string) {
    setPhase("saving");
    try {
      const supabase = await loadBrowserClient();
      if (!supabase) throw new Error("no client");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        banner.error(copy.signInFirst);
        setPhase(selfie ? "saved" : "idle");
        return;
      }
      const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/heic" ? "heic" : "jpg";
      const path = `${user.id}/kyc-${batchId}/${fileStem}-${randomId()}.${extension}`;
      const upload = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
      if (upload.error) throw new Error("upload failed");
      if (selfie?.path && selfie.path !== path) void supabase.storage.from(BUCKET).remove([selfie.path]);
      setSavedUrl(URL.createObjectURL(blob));
      setShot(null);
      onChange({ path, size: blob.size, type });
      setPhase("saved");
    } catch {
      banner.error(s.failed);
      setPhase(shot ? "captured" : selfie ? "saved" : "idle");
    }
  }

  function fromFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      banner.error(copy.fileType.replace("{formats}", "JPG, PNG or HEIC"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      banner.error(copy.fileSize.replace("{size}", "8MB"));
      return;
    }
    void save(file, file.type);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <section className="nf-panel nf-panel--card block p-md sm:p-lg" data-testid="selfie-step">
      <h2 className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">{s.title}</h2>
      <ul className="mt-xs space-y-2xs">
        {s.tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
            <UiIcon name="check" size="sm" className="mt-3xs shrink-0 text-[var(--nf-content-muted)]" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      {/* The stage: the live camera, the photo just taken, or the saved one. */}
      {(phase === "live" || phase === "starting" || phase === "captured" || phase === "saving" || (phase === "saved" && savedUrl)) && (
        <div
          className="relative mx-auto mt-md aspect-[3/4] w-full max-w-xs overflow-hidden rounded-[var(--nf-radius-card)] bg-[var(--nf-surface-inverse)]"
          data-testid="selfie-stage"
        >
          {(phase === "live" || phase === "starting") && (
            <video
              ref={video}
              aria-label={s.preview}
              className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
              playsInline
              muted
              autoPlay
            />
          )}
          {(phase === "captured" || phase === "saving") && shot && (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL of a photo not yet uploaded
            <img src={shot.url} alt={s.yourPhoto} className="absolute inset-0 h-full w-full object-cover" />
          )}
          {phase === "saved" && savedUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL of the photo just saved
            <img src={savedUrl} alt={s.yourPhoto} className="absolute inset-0 h-full w-full object-cover" />
          )}
          {(phase === "live" || phase === "starting") && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[46%] h-[70%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-[var(--nf-content-on-media)] shadow-[0_0_0_100vmax_var(--nf-media-silhouette)]"
            />
          )}
        </div>
      )}

      {phase === "saved" && !savedUrl && (
        <p role="status" className="mt-md flex items-center gap-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)]">
          <UiIcon name="check" size="sm" />
          {s.saved}
        </p>
      )}
      {phase === "saved" && savedUrl && (
        <p role="status" className="mt-sm text-center text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
          {s.saved}
        </p>
      )}

      <div className="mt-md grid gap-sm">
        {(phase === "idle" || phase === "saved") && (
          <Button variant={phase === "saved" ? "secondary" : "primary"} size="md" full leadingIcon="camera" onClick={() => void start()} data-testid="selfie-start">
            {phase === "saved" ? s.retake : s.start}
          </Button>
        )}
        {phase === "starting" && (
          <Button variant="primary" size="md" full loading disabled>
            {s.starting}
          </Button>
        )}
        {phase === "live" && (
          <Button variant="primary" size="md" full leadingIcon="camera" onClick={capture} data-testid="selfie-capture">
            {s.capture}
          </Button>
        )}
        {(phase === "captured" || phase === "saving") && shot && (
          <>
            <Button variant="primary" size="md" full loading={phase === "saving"} onClick={() => void save(shot.blob, "image/jpeg")} data-testid="selfie-use">
              {phase === "saving" ? s.saving : s.use}
            </Button>
            <Button variant="secondary" size="md" full disabled={phase === "saving"} onClick={() => void start()}>
              {s.retake}
            </Button>
          </>
        )}
        {/* The phone's own camera, always there as the other way in. */}
        {phase !== "live" && phase !== "starting" && phase !== "saving" && (
          <Button variant="ghost" size="sm" full onClick={() => fileInput.current?.click()} data-testid="selfie-from-camera">
            {s.fromCamera}
          </Button>
        )}
        {phase === "saving" && !shot && (
          <Button variant="primary" size="md" full loading disabled>
            {s.saving}
          </Button>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        aria-label={s.fromCamera}
        tabIndex={-1}
        onChange={(event) => fromFile(event.target.files?.[0])}
        data-testid="selfie-file"
      />

      <p className="mt-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{s.privacy}</p>

    </section>
  );
}
