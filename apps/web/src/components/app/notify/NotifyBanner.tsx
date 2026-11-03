"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { glyphSrc } from "@/design-system/icons/glyphs";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useNotificationsRealtime, type LiveNotificationRow } from "@/lib/messages/useRealtime";
import { feedback } from "@/lib/ui/feedback";
import { BANNER_MS, bannerGlyph, enqueue, shouldShowBanner, type BannerItem } from "./banner-model";
import "./notify-banner.css";

/**
 * A NEW NOTIFICATION DROPS DOWN FROM THE TOP, the way X shows "New post from"
 * over whatever you are doing: the object's glyph, the line in bold, the
 * first line of the body, and a tap that opens it. It slides away on its own
 * after five seconds, on a swipe up, or on Escape; a finger resting on it
 * holds it. One at a time; a burst waits its turn (the latest three).
 *
 * The row comes from Realtime on the member's own `notifications` rows (row
 * level security scopes the channel), so nothing here can show another
 * person's notification. It never shows on the notifications screen, or for
 * the thing already open.
 */
export function NotifyBanner() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [queue, setQueue] = useState<BannerItem[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = queue[0] ?? null;

  /* Who is signed in on this device; nobody, no banner. */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let live = true;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (live) setUserId(data.session?.user.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useNotificationsRealtime(userId, (row: LiveNotificationRow) => {
    const item: BannerItem = {
      id: row.id,
      kind: String(row.kind),
      title: row.title,
      body: row.body,
      href: row.href,
    };
    if (!shouldShowBanner(item, window.location.pathname)) return;
    setQueue((q) => enqueue(q, item));
  });

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(false);
      setDrag(0);
    }, 220);
  }, []);

  /* A gentle tap when one arrives, and the clock that sends it away. */
  useEffect(() => {
    if (!current) return;
    feedback("select");
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!current || held) return;
    timer.current = setTimeout(dismiss, BANNER_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, held, dismiss]);

  /* Moving to the screen it points at clears it. */
  useEffect(() => {
    if (current?.href && current.href.split(/[?#]/)[0] === pathname) dismiss();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, dismiss]);

  if (!current) return null;

  const open = () => {
    if (!current.href) return dismiss();
    router.push(current.href);
    dismiss();
  };

  const onDown = (e: ReactPointerEvent) => {
    start.current = e.clientY;
    setHeld(true);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.min(0, e.clientY - start.current));
  };
  const onUp = () => {
    const pulled = drag;
    start.current = null;
    setHeld(false);
    if (pulled < -28) dismiss();
    else setDrag(0);
  };

  return (
    <div className="nf-notify" role="status" aria-live="polite" data-leaving={leaving || undefined}>
      <button
        type="button"
        className="nf-notify__card"
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        onClick={() => {
          if (drag > -6) open();
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        data-testid="notify-banner"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a transparent glyph at 36px */}
        <img src={glyphSrc(bannerGlyph(current))} alt="" width={36} height={36} className="nf-notify__glyph" aria-hidden="true" />
        <span className="nf-notify__text">
          <span className="nf-notify__title">{current.title}</span>
          {current.body ? <span className="nf-notify__body">{current.body}</span> : null}
        </span>
      </button>
    </div>
  );
}
