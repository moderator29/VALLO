"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@vallo/i18n/core";
import { lockPasscodeAction } from "@/lib/passcode/actions";
import { idleExpired, type PasscodeLength } from "@/lib/passcode/rules";
import { idleLimitMs, readLongIdle } from "@/lib/passcode/idle-setting";
import { markTabUnlocked, tabWasUnlocked } from "@/lib/passcode/tab";
import { servedFromKeptCopy } from "@/lib/offline/page-cache";
import { PasscodeLock, type PasscodeCopy } from "./PasscodeLock";
import { LOCK_AGAIN_EVENT } from "@/lib/passcode/server-catch-up";

/**
 * THE INACTIVITY TIMER, AROUND AN UNLOCKED PAGE. docs/PASSCODE.md.
 *
 * Mounted by the (app) layout only when the server has already decided the
 * session is unlocked. It locks again, on this side at once and on the
 * server through `lockPasscodeAction`, when:
 *
 *   - the tab is new (no mark in sessionStorage), unless the member signed in
 *     moments ago, in which case the unlock is minted instead;
 *   - nothing has been touched, typed or scrolled for five minutes;
 *   - the page was hidden (another app, another tab, the phone locked) for
 *     five minutes or more.
 *
 * While the member is active it posts `/api/passcode/touch` at most once a
 * minute, which slides the server's fifteen-minute unlock; an answer of
 * `locked` (the cookie lapsed, or another tab locked) locks this tab too.
 *
 * The lock is drawn here first, over inert children, so nothing is readable
 * while the network answers. The server is the boundary: the lock action
 * clears the cookie, Next re-renders the route (a cookie written by a server
 * action does that), the layout then draws its own lock screen in place of
 * the page, and every money action refuses until a right code.
 *
 * A COPY THE PHONE KEPT (13 October 2026). The service worker now opens the
 * last screen at once from the phone (`public/sw.js`), and that copy was
 * rendered while this session was unlocked. So: the wrapper is marked
 * `data-passcode-guarded`, and `app/css/passcode.css` keeps it out of sight
 * on a kept copy until this guard has decided (`data-guard-ready` on the
 * root), and while it is locked; and a kept copy's `mint` is never honoured,
 * because it describes the sign-in that copy was rendered after, not this
 * one. A new tab therefore still meets the lock, as it always did.
 */
const TOUCH_EVERY_MS = 60 * 1000;
const CHECK_EVERY_MS = 15 * 1000;
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/* The root's "the guard has decided" mark, which the kept-copy rule in
   `app/css/passcode.css` waits for. */
function markGuardReady(): void {
  try {
    document.documentElement.setAttribute("data-guard-ready", "");
  } catch {
    /* No document to mark. */
  }
}

export function PasscodeGuard({
  copy,
  locale,
  length,
  mint,
  name,
  avatarUrl,
  passkey = false,
  userId,
  children,
}: {
  copy: PasscodeCopy;
  locale: Locale;
  length: PasscodeLength;
  /** The server saw a fresh sign-in and no unlock cookie: ask for one now. */
  mint: boolean;
  name: string;
  avatarUrl?: string | null;
  /** C14: the member has a platform key (the lock offers it; the longer idle setting can apply). */
  passkey?: boolean;
  /** The signed-in member, for the phone's own check of the code when Vallo cannot be reached. */
  userId?: string;
  children: ReactNode;
}) {
  const [locked, setLocked] = useState(false);
  const lastActivity = useRef(0);
  const lastTouch = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const lockedRef = useRef(false);

  const lock = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    void lockPasscodeAction().catch(() => {
      /* Offline: this tab is locked, and the server's unlock lapses on its own. */
    });
  }, []);

  const touch = useCallback(async () => {
    lastTouch.current = Date.now();
    try {
      const response = await fetch("/api/passcode/touch", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { state?: string };
      if (body.state === "locked") lock();
    } catch {
      /* A missed heartbeat only shortens the unlock; the next one tries again. */
    }
  }, [lock]);

  useEffect(() => {
    lastActivity.current = Date.now();
    if (mint && !servedFromKeptCopy()) {
      markTabUnlocked();
      void touch();
      markGuardReady();
    } else if (!tabWasUnlocked()) {
      lock();
    } else {
      markGuardReady();
    }
  }, [lock, mint, touch]);

  /* Locked: the mark goes on only once the lock is committed, so a kept copy
     never shows its page for a frame between the decision and the lock. */
  useLayoutEffect(() => {
    if (locked) markGuardReady();
  }, [locked]);

  useEffect(() => {
    /* Five minutes, or fifteen on a device with a key and the setting on (C14). */
    const limit = idleLimitMs(passkey, readLongIdle());
    const onActivity = () => {
      if (lockedRef.current) return;
      lastActivity.current = Date.now();
      if (Date.now() - lastTouch.current >= TOUCH_EVERY_MS) void touch();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const since = hiddenAt.current;
      hiddenAt.current = null;
      if (since !== null && Date.now() - since >= limit) lock();
    };
    for (const name of ACTIVITY) window.addEventListener(name, onActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (!lockedRef.current && idleExpired(lastActivity.current, Date.now(), limit)) lock();
    }, CHECK_EVERY_MS);
    return () => {
      for (const name of ACTIVITY) window.removeEventListener(name, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [lock, touch, passkey]);

  /* A code accepted on the phone that the server later refused (it was
     changed on another device): lock again (`server-catch-up.ts`). */
  useEffect(() => {
    const again = () => {
      lockedRef.current = false;
      lock();
    };
    window.addEventListener(LOCK_AGAIN_EVENT, again);
    return () => window.removeEventListener(LOCK_AGAIN_EVENT, again);
  }, [lock]);

  const unlocked = useCallback(() => {
    lockedRef.current = false;
    lastActivity.current = Date.now();
    lastTouch.current = Date.now();
    setLocked(false);
  }, []);

  return (
    <>
      <div className="contents" data-passcode-guarded="" inert={locked} aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked ? (
        <PasscodeLock
          copy={copy}
          locale={locale}
          mode="code"
          length={length}
          name={name}
          avatarUrl={avatarUrl}
          onUnlocked={unlocked}
          passkey={passkey}
          userId={userId}
        />
      ) : null}
    </>
  );
}
