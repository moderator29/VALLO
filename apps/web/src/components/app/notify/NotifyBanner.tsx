"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { glyphSrc } from "@/design-system/icons/glyphs";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  useNotificationsRealtime,
  type LiveNotificationRow,
} from "@/lib/messages/useRealtime";
import { feedback } from "@/lib/ui/feedback";
import {
  BANNER_MS,
  bannerGlyph,
  bannerHeader,
  enqueue,
  faceLookup,
  shouldShowBanner,
  type BannerItem,
} from "./banner-model";
import { playInAppChime } from "@/lib/platform/chime";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { bannerExitMs as exitMs } from "@/lib/ui/toast";
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
  /* The sender's face, when the link names a person (FEATURE_BACKLOG A9):
     read through the member's own session, so RLS decides what is seen. */
  const [face, setFace] = useState<{ id: string; url: string } | null>(null);

  /* Who is signed in on this device; nobody, no banner. The Supabase client
     is fetched after first paint (performance audit, 7 November 2026), so the
     member layout's first load carries none of it. */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let live = true;
    void loadBrowserClient()
      .then((supabase) => supabase?.auth.getSession())
      .then((res) => {
        if (live && res) setUserId(res.data.session?.user.id ?? null);
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

  /* The exit runs on the contract's exit token (`exitMs`, the same clock the
     feedback banner leaves on), so reduced motion and the Motion setting
     shorten it here too; it was a 220ms of its own. */
  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(false);
      setDrag(0);
    }, exitMs());
  }, []);

  /* A gentle tap when one arrives, and the clock that sends it away. */
  useEffect(() => {
    if (!current) return;
    feedback("select");
    /* The soft in-app chime: silent mode, the member's switch and the 3 s gap
       are its own rules (`lib/platform/chime.ts`). */
    playInAppChime();
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const look = current ? faceLookup(current.href) : null;
    if (!current || !look || !userId || !isSupabaseConfigured()) return;
    let live = true;
    const id = current.id;
    void (async () => {
      try {
        const db = await loadBrowserClient();
        if (!db) return;
        let person: string | null = null;
        let handle: string | null = null;
        if (look.by === "thread") {
          const { data } = await db
            .from("conversations")
            .select("guest_id, agent_id")
            .eq("id", look.id)
            .maybeSingle();
          if (data)
            person = data.guest_id === userId ? data.agent_id : data.guest_id;
        } else if (look.by === "user") person = look.id;
        else handle = look.handle;
        if (!person && !handle) return;
        const query = db.from("social_profiles").select("avatar_path");
        const { data: profile } = await (person
          ? query.eq("user_id", person)
          : query.eq("handle", handle as string)
        ).maybeSingle();
        if (live && profile?.avatar_path)
          setFace({ id, url: profile.avatar_path });
      } catch {
        /* No face is fine: the family glyph stays. */
      }
    })();
    return () => {
      live = false;
    };
  }, [current, userId]);

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
    <div
      className="nf-notify"
      role="status"
      aria-live="polite"
      data-leaving={leaving || undefined}
    >
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
        {face && face.id === current.id ? (
          <span className="nf-notify__face" aria-hidden="true">
            <RemoteImage
              src={face.url}
              alt=""
              width={80}
              height={80}
              sizes="40px"
            />
          </span>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- a transparent glyph at 36px */
          <img
            src={glyphSrc(bannerGlyph(current))}
            alt=""
            width={36}
            height={36}
            className="nf-notify__glyph"
            aria-hidden="true"
          />
        )}
        <span className="nf-notify__text">
          <span className="nf-notify__header">{bannerHeader(current)}</span>
          <span className="nf-notify__title">{current.title}</span>
          {current.body ? (
            <span className="nf-notify__body">{current.body}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
