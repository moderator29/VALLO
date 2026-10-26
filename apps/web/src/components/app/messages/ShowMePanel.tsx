"use client";

import { uploadToStorage, withTimeout } from "@/lib/media/upload";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useDataSaver } from "@/lib/ui/data-saver";
import { answerShowMe, requestShowMe } from "@/lib/messages/show-me-actions";
import {
  SHOW_ME_ITEMS,
  SHOW_ME_MAX_SECONDS,
  clipPath,
  elapsedText,
  playLabel,
  showMeState,
  type ShowMeItem,
  type ShowMeRequest,
  type ShowMeResult,
} from "@/lib/messages/show-me";
import "@/app/css/catalogue.css";

/** The clip's length, read by the browser from the file's own metadata. */
function durationOf(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

/**
 * "Show me" in a listing thread (V-69). The renter asks for one thing from a
 * short list; the lister answers each open ask with a clip uploaded from their
 * phone. An answered clip plays in place with the Lagos time it was sent and
 * how long after the ask, worded for whoever is reading; an ask left 48 hours
 * says it ran out. There is no in-app camera, so nothing here claims the clip
 * was captured in Vallo.
 */
export function ShowMePanel({
  conversationId,
  role,
  requests,
  copy,
  locale,
  now,
  openOnArrival = false,
  canAsk = true,
}: {
  conversationId: string;
  role: "guest" | "host";
  requests: ShowMeRequest[];
  copy: Dictionary["shape"]["showMe"];
  locale: Locale;
  /** The server's clock at render, so the server and the browser agree. */
  now: string;
  /** Arrived from the listing's "Show me..." link: the choices start open. */
  openOnArrival?: boolean;
  /** False when the listing is gone: earlier asks stay readable, no new one (review). */
  canAsk?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(openOnArrival && role === "guest" && canAsk);
  /* V-79's data saver: clips wait for a tap. */
  const saver = useDataSaver();
  const [played, setPlayed] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [result, setResult] = useState<ShowMeResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileFor = useRef<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const at = new Date(now);
  const time = (iso: string) =>
    formatDate(new Date(iso), locale, {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      timeZone: "Africa/Lagos",
    });

  const ask = (item: ShowMeItem) =>
    startTransition(async () => {
      try {
        const outcome = await requestShowMe(conversationId, item, item === "other" ? other : undefined);
        setResult(outcome);
        if (outcome === "ok") {
          setOpen(false);
          setOther("");
          router.refresh();
        }
      } catch {
        setResult("failed");
      }
    });

  const answer = (requestId: string, file: File) =>
    startTransition(async () => {
      try {
        const seconds = await durationOf(file);
        if (seconds === null || seconds > SHOW_ME_MAX_SECONDS) {
          setResult("too-long");
          return;
        }
        const path = clipPath(requestId, crypto.randomUUID(), file.name);
        const uploaded = await uploadToStorage({
          supabase: createClient(),
          bucket: "show-me-clips",
          path,
          body: file,
          contentType: file.type || "video/mp4",
        });
        if (!uploaded.ok) {
          setResult("failed");
          return;
        }
        const outcome = await withTimeout(answerShowMe(conversationId, requestId, path, seconds), 30_000);
        setResult(outcome);
        if (outcome === "ok") router.refresh();
      } catch {
        setResult("failed");
      }
    });

  if (role === "host" && requests.length === 0) return null;

  return (
    <section className="nf-panel nf-panel--card mx-md my-sm block p-md" data-testid="show-me">
      <div className="flex items-center justify-between gap-sm">
        <h2 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">{copy.title}</h2>
        {role === "guest" && canAsk && (
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            data-testid="show-me-open"
          >
            {copy.ask}
          </Button>
        )}
      </div>
      <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">
        {!canAsk ? copy.readOnly : role === "guest" ? copy.guestLede : copy.hostLede}
      </p>

      {open && role === "guest" && canAsk && (
        <div className="mt-sm flex flex-wrap gap-xs" role="group" aria-label={copy.ask}>
          {SHOW_ME_ITEMS.filter((item) => item !== "other").map((item) => (
            <button
              key={item}
              type="button"
              disabled={pending}
              className="nf-filters__tile min-h-11"
              data-testid={`show-me-${item}`}
              onClick={() => ask(item)}
            >
              {copy.items[item]}
            </button>
          ))}
          <div className="flex w-full gap-xs">
            <input
              className="nf-field min-w-0 flex-1"
              value={other}
              maxLength={120}
              placeholder={copy.otherPlaceholder}
              aria-label={copy.items.other}
              onChange={(event) => setOther(event.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={pending || other.trim().length < 3}
              onClick={() => ask("other")}
            >
              {copy.send}
            </Button>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <ul className="mt-sm flex flex-col gap-sm">
          {requests.map((request) => {
            const state = showMeState(request, at);
            const what = request.item === "other" ? (request.note ?? copy.items.other) : copy.items[request.item];
            return (
              <li key={request.id} className="border-t border-[var(--nf-panel-hair)] pt-sm" data-testid="show-me-request">
                <p className="nf-body-sm break-words text-[var(--nf-content-primary)]">
                  <strong>{what}</strong>
                  <span className="text-[var(--nf-content-muted)]"> · {copy.askedAt.replace("{time}", time(request.createdAt))}</span>
                </p>
                {/* Only a clip that can be played gets a "Sent" line (review). */}
                {state === "answered" && request.answeredAt && request.clipUrl && (
                  <>
                    {/* With the data saver on, nothing loads until a tap, and the
                        tap says what it costs. A clip the renter asked for; it
                        has no captions to offer. */}
                    {saver && !played.includes(request.id) ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-xs"
                        onClick={() => setPlayed((ids) => [...ids, request.id])}
                        data-testid="show-me-play"
                      >
                        {playLabel(request.clipBytes, copy, locale)}
                      </Button>
                    ) : (
                      <video
                        className="mt-xs w-full rounded-[var(--nf-radius-md)]"
                        controls
                        /* The tap that loaded it also plays it (review). */
                        autoPlay={saver}
                        playsInline
                        preload={saver ? "auto" : "none"}
                        src={request.clipUrl}
                      />
                    )}
                    <p className="nf-caption mt-2xs text-[var(--nf-content-secondary)]">
                      {(role === "host" ? copy.sentAtHost : copy.sentAt)
                        .replace("{time}", time(request.answeredAt))
                        .replace("{after}", elapsedText(request.createdAt, request.answeredAt, copy.elapsed, locale))}
                    </p>
                  </>
                )}
                {state === "open" && role === "guest" && (
                  <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">{copy.waiting.replace("{time}", time(request.expiresAt))}</p>
                )}
                {state === "open" && role === "host" && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={pending}
                    className="mt-xs"
                    onClick={() => {
                      fileFor.current = request.id;
                      input.current?.click();
                    }}
                    data-testid="show-me-answer"
                  >
                    {copy.answer}
                  </Button>
                )}
                {state === "expired" && <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">{copy.expired}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {role === "host" && (
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const id = fileFor.current;
            event.target.value = "";
            if (file && id) answer(id, file);
          }}
        />
      )}

      {result && result !== "ok" && (
        <p role="status" className="nf-body-sm mt-sm text-[var(--nf-content-secondary)]">
          {copy.results[result]}
        </p>
      )}
    </section>
  );
}
