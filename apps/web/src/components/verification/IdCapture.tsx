"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { uploadToStorage } from "@/lib/media/upload";
import { ACCEPTED_LABEL, ACCEPTED_MIME, MAX_FILE_LABEL, documentExtension, rejectFileIssue } from "./kyc";

/**
 * ONE SIDE OF AN ID, PHOTOGRAPHED PROPERLY (Platform Grade 1, P0.3; references
 * R37 and R39). Three moments, one task each:
 *
 *   1. capture   a live rear camera with a card-shaped guide ("keep all four
 *                corners inside"), a rotate control for a vertical card, a
 *                shutter; or "Upload instead" for a file or PDF already on
 *                the phone (and the only way where the camera is refused);
 *   2. check     "Check your capture": the picture large, Zoom in (a full
 *                screen view to read the small print), Retake, Use photo;
 *   3. saved     a thumbnail with a "Captured" badge and Retake.
 *
 * "Use photo" uploads to the private `agent-documents` bucket under the
 * person's own folder (the database refuses any other path, including for the
 * back: migration 20261107143359), exactly as the file uploader always has.
 * Nothing is filed until the review step's Send. The picture shown back is a
 * local object URL on this device, never fetched from the bucket.
 */

const BUCKET = "agent-documents";
/* A document has small print; keep it readable, but never send a 12MP frame. */
const MAX_EDGE = 2400;

export type CapturedSide = { path: string; previewUrl: string | null; name: string; size: number; type: string };

export type IdCaptureWords = {
  front: string;
  back: string;
  guide: string;
  rotate: string;
  takePhoto: string;
  uploadInstead: string;
  shutter: string;
  checkTitle: string;
  checkHint: string;
  zoom: string;
  zoomClose: string;
  retake: string;
  usePhoto: string;
  saving: string;
  captured: string;
  denied: string;
  unavailable: string;
  failed: string;
  signInFirst: string;
  fileType: string;
  fileSize: string;
};

type Phase = "idle" | "starting" | "live" | "check" | "saving" | "saved";

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export function IdCapture({
  side,
  batchId,
  value,
  onChange,
  words,
}: {
  side: "front" | "back";
  batchId: string;
  value: CapturedSide | null;
  onChange: (value: CapturedSide | null) => void;
  words: IdCaptureWords;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const actions = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>(value ? "saved" : "idle");
  const [vertical, setVertical] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string | null; name: string } | null>(null);
  const [zoom, setZoom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = side === "front" ? words.front : words.back;

  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  useEffect(() => () => stop(), []);
  /* A photo to check brings Retake and Use photo into view. */
  useEffect(() => {
    if (phase !== "check") return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    actions.current?.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [phase]);

  async function start() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(words.unavailable);
      return;
    }
    setPhase("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      stream.current = media;
      setPhase("live");
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().catch(() => undefined);
        }
      });
    } catch (cause) {
      stop();
      setPhase(value ? "saved" : "idle");
      const name = cause && typeof cause === "object" && "name" in cause ? String((cause as { name: unknown }).name) : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? words.denied : words.unavailable);
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
          setError(words.failed);
          return;
        }
        stop();
        setShot({ blob, url: URL.createObjectURL(blob), name: `${side}.jpg` });
        setPhase("check");
      },
      "image/jpeg",
      0.92,
    );
  }

  function picked(file: File | undefined) {
    if (!file) return;
    const issue = rejectFileIssue(file);
    if (issue) {
      setError((issue === "type" ? words.fileType : words.fileSize).replace("{formats}", ACCEPTED_LABEL).replace("{size}", MAX_FILE_LABEL));
      return;
    }
    setError(null);
    stop();
    setShot({ blob: file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null, name: file.name });
    setPhase("check");
  }

  async function use() {
    if (!shot) return;
    setError(null);
    setPhase("saving");
    try {
      const supabase = await loadBrowserClient();
      if (!supabase) throw new Error("no client");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(words.signInFirst);
        setPhase("check");
        return;
      }
      const type = shot.blob.type || "image/jpeg";
      const path = `${user.id}/kyc-${batchId}/identity-${side}-${randomId()}.${documentExtension(type)}`;
      const upload = await uploadToStorage({ supabase, bucket: BUCKET, path, body: shot.blob, contentType: type });
      if (!upload.ok) throw new Error("upload failed");
      if (value?.path && value.path !== path) void supabase.storage.from(BUCKET).remove([value.path]);
      onChange({ path, previewUrl: shot.url, name: shot.name, size: shot.blob.size, type });
      setShot(null);
      setPhase("saved");
    } catch {
      setError(words.failed);
      setPhase("check");
    }
  }

  function retake() {
    setShot(null);
    setZoom(false);
    void start();
  }

  const seen = phase === "check" ? shot?.url ?? null : phase === "saved" ? value?.previewUrl ?? null : null;

  return (
    <section className="nf-g1-capture" data-testid={`id-capture-${side}`} aria-label={label}>
      <div className="nf-g1-capture__head">
        <p className="nf-g1-capture__side">{label}</p>
        {seen && (phase === "check" || phase === "saved") ? (
          <button type="button" className="nf-g1-capture__zoom" onClick={() => setZoom(true)}>
            <UiIcon name="search" size={16} />
            {words.zoom}
          </button>
        ) : null}
      </div>

      {phase === "live" || phase === "starting" ? (
        <div className="nf-g1-capture__stage" data-vertical={vertical || undefined}>
          <video ref={video} className="nf-g1-capture__video" playsInline muted autoPlay aria-hidden="true" />
          <span className="nf-g1-capture__guide" aria-hidden="true" />
          <p className="nf-g1-capture__tip">{words.guide}</p>
        </div>
      ) : seen ? (
        <div className="nf-g1-capture__shot">
          {/* A local object URL of the person's own photo: next/image has nothing to optimise. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={seen} alt={label} />
        </div>
      ) : phase === "check" || phase === "saved" ? (
        <div className="nf-g1-capture__file">
          <UiIcon name="file-text" size={28} />
          <span>{shot?.name ?? value?.name}</span>
        </div>
      ) : (
        <div className="nf-g1-capture__empty" aria-hidden="true">
          <span className="nf-g1-capture__frame" />
        </div>
      )}

      {phase === "check" ? (
        <div className="nf-g1-capture__check">
          <p className="nf-g1-capture__check-title">{words.checkTitle}</p>
          <p className="nf-g1-capture__check-hint">{words.checkHint}</p>
        </div>
      ) : null}

      {phase === "saved" ? (
        <p className="nf-g1-capture__badge" role="status">
          <UiIcon name="circle-check" size={16} />
          {words.captured}
        </p>
      ) : null}

      <div className="nf-g1-capture__actions" ref={actions}>
        {phase === "idle" ? (
          <>
            <Button variant="primary" size="lg" full leadingIcon="camera" onClick={() => void start()} data-testid={`id-capture-${side}-start`}>
              {words.takePhoto}
            </Button>
            <Button variant="quiet" size="md" full onClick={() => fileInput.current?.click()}>
              {words.uploadInstead}
            </Button>
          </>
        ) : null}
        {phase === "starting" || phase === "live" ? (
          <>
            <button
              type="button"
              className="nf-g1-capture__shutter"
              aria-label={words.shutter}
              disabled={phase !== "live"}
              onClick={capture}
              data-testid={`id-capture-${side}-shutter`}
            />
            <div className="nf-g1-capture__row">
              <Button variant="quiet" size="sm" leadingIcon="switch-profile" onClick={() => setVertical((v) => !v)}>
                {words.rotate}
              </Button>
              <Button variant="quiet" size="sm" onClick={() => fileInput.current?.click()}>
                {words.uploadInstead}
              </Button>
            </div>
          </>
        ) : null}
        {phase === "check" || phase === "saving" ? (
          <div className="nf-g1-capture__pair">
            <Button variant="secondary" size="lg" full onClick={retake} disabled={phase === "saving"}>
              {words.retake}
            </Button>
            <Button variant="primary" size="lg" full loading={phase === "saving"} onClick={() => void use()} data-testid={`id-capture-${side}-use`}>
              {phase === "saving" ? words.saving : words.usePhoto}
            </Button>
          </div>
        ) : null}
        {phase === "saved" ? (
          <Button variant="secondary" size="md" full leadingIcon="camera" onClick={retake} data-testid={`id-capture-${side}-retake`}>
            {words.retake}
          </Button>
        ) : null}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="sr-only"
        aria-label={`${words.uploadInstead}: ${label}`}
        data-testid={`id-capture-${side}-file`}
        onChange={(event) => {
          picked(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {error ? (
        <p role="alert" className="nf-g1-capture__error">
          {error}
        </p>
      ) : null}

      <Sheet open={zoom} onOpenChange={setZoom} title={label} closeLabel={words.zoomClose} fullPage>
        {seen ? (
          <div className="nf-g1-capture__zoomed">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={seen} alt={label} />
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
