"use client";

import { useCallback, useEffect, useRef, useState, type VideoHTMLAttributes } from "react";
import { refreshMediaUrl } from "@/lib/media/refresh-url";

/**
 * A `<video>` THAT NEVER LEAVES A BLACK BOX (29 October 2026, the founder:
 * "all videos and stuff to work").
 *
 * The bare element fails in five quiet ways, and each had a place in the app:
 *
 *   1. A transient network error leaves it black for good. The first error
 *      reloads the source once; only a second error says it cannot play.
 *   2. A clip the device cannot decode (an iPhone's HEVC `.mov` on a browser
 *      with no HEVC) draws nothing. The failure is said in a sentence, with a
 *      link that opens the file in its own tab, where the browser's own
 *      player or save is one tap away.
 *   3. iOS draws no first frame for `preload="none"` or `"metadata"` without
 *      a poster. Without one, the source gets the `#t=0.001` media fragment,
 *      which makes Safari paint frame one.
 *   4. A browser that refuses sound-on autoplay rejects `play()` silently.
 *      The video is started muted instead, and its controls unmute it.
 *   5. A source with no readable URL (null) is the failure sentence at once,
 *      not an empty box.
 *
 * English words by default; a caller with its own dictionary passes them.
 */

export type SafeVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "onError"> & {
  src: string | null | undefined;
  /** Said when the clip cannot play here. */
  failedText?: string;
  /** The link that opens the file by itself. */
  openText?: string;
};

/** The URL with the first-frame fragment, unless it already carries one or a poster stands in. */
export function withFirstFrame(src: string, poster: string | undefined, preload: string | undefined): string {
  if (poster || preload === "auto" || src.includes("#") || src.startsWith("blob:")) return src;
  return `${src}#t=0.001`;
}

export function SafeVideo({
  src,
  poster,
  preload,
  autoPlay,
  failedText = "This video could not be played here.",
  openText = "Open the video",
  className,
  ...rest
}: SafeVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const retried = useRef(false);
  const refreshed = useRef(false);
  const [failed, setFailed] = useState(!src);
  /* The link in use: the one given, or a fresh one signed after it expired. */
  const [live, setLive] = useState<string | null | undefined>(src);

  /* A new source is a fresh start. */
  useEffect(() => {
    retried.current = false;
    refreshed.current = false;
    setLive(src);
    setFailed(!src);
  }, [src]);

  /* Sound-on autoplay refused: start it muted rather than not at all. */
  useEffect(() => {
    const el = ref.current;
    if (!el || !autoPlay || failed) return;
    const attempt = el.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          el.muted = true;
          void el.play().catch(() => undefined);
        }
      });
    }
  }, [autoPlay, failed, live]);

  const onError = useCallback(() => {
    const el = ref.current;
    if (!retried.current && el) {
      retried.current = true;
      /* One more go: a dropped connection mid-load is not a bad clip. */
      window.setTimeout(() => el.load(), 800);
      return;
    }
    /* Still failing, and the link is a signed one (they last an hour): ask for
       a fresh link once. A page left open, or one the service worker kept,
       holds a link that has run out for a clip that is fine. */
    if (!refreshed.current && live && live.includes("/object/sign/")) {
      refreshed.current = true;
      void refreshMediaUrl({ url: live.split("#")[0]! })
        .then((answer) => {
          if (answer.ok) {
            retried.current = false;
            setLive(answer.data.url);
          } else {
            setFailed(true);
          }
        })
        .catch(() => setFailed(true));
      return;
    }
    setFailed(true);
  }, [live]);

  if (failed || !live) {
    return (
      <div
        role="alert"
        className={className}
        data-testid="video-failed"
        style={{ display: "grid", placeItems: "center", gap: "var(--nf-space-xs)", padding: "var(--nf-space-md)", textAlign: "center" }}
      >
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">{failedText}</p>
        {live ? (
          <a className="nf-body-sm font-semibold text-[var(--nf-brand-quiet)] underline" href={live} target="_blank" rel="noopener noreferrer">
            {openText}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <video
      ref={ref}
      src={withFirstFrame(live, poster, preload)}
      poster={poster}
      preload={preload}
      autoPlay={autoPlay}
      className={className}
      onError={onError}
      {...rest}
    />
  );
}
