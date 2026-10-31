"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { announceVisit } from "@/lib/offline/page-cache";
import { isDataSaver } from "@/lib/ui/data-saver";

/**
 * Registers the service worker that keeps Vallo working with a weak signal or
 * none, and tells it which pages were opened.
 *
 * Four deliberate constraints on the registration:
 *
 *   - Production only. A worker in development caches build output that
 *     changes on every keystroke and produces phantom stale bugs.
 *   - After the window load event, so registration never competes with first
 *     paint on a mid-range Android. The shell precache is a background errand,
 *     not part of getting the page up.
 *   - Feature detected. No serviceWorker in navigator (older Android
 *     browsers, or any private-mode restriction) means simply no worker, with
 *     nothing else different about the app.
 *   - Silent on failure. A worker is an enhancement. If registration is
 *     refused, the site must behave exactly as it did before it existed, so
 *     nothing is thrown and nothing is shown to the user.
 *
 * THE VISITS (8 October 2026). A tap inside the app is a data fetch, not a
 * page load, so the worker never sees the page it opened and could not keep
 * it for offline. So every page this component sees opened is announced to
 * the worker a moment after it lands (`lib/offline/page-cache.ts`), once the
 * navigation's own requests are done; the worker decides whether to keep it.
 * The first page is announced again when the worker takes control, because
 * on a first visit it loaded before there was a worker to see it.
 *
 * NOT WHILE SAVING DATA. Keeping a page opened inside the app costs one more
 * download of it, so nothing is announced when the person turned data saving
 * on in Settings, or their phone says Save-Data or 2g (`isDataSaver`). The
 * worker checks the phone's own signal again. Pages opened by a full load
 * are kept either way, because that costs nothing extra.
 *
 * Renders nothing.
 */

/** How long after a page lands before it is announced: its own fetches go first. */
const ANNOUNCE_AFTER_MS = 1200;

function currentPath(): string {
  return window.location.pathname + window.location.search;
}

/** Announce the page on screen, unless the person is saving data. */
function announceHere(): void {
  if (isDataSaver()) return;
  announceVisit(currentPath());
}

/**
 * ASK THE BROWSER NOT TO EVICT WHAT THE PHONE KEPT (fast-start plan item 11).
 * Kept pages and saved screens are what make the next open instant and the
 * offline open possible; a browser under storage pressure may delete a
 * site's storage whole unless the site is "persistent". The request is
 * silent (no prompt) and answered by the browser from how much the person
 * uses the site; a refusal changes nothing. Never throws, never waits.
 */
async function keepStorage(): Promise<void> {
  try {
    const storage = navigator.storage;
    if (!storage || typeof storage.persist !== "function") return;
    if (typeof storage.persisted === "function" && (await storage.persisted())) return;
    await storage.persist();
  } catch {
    /* Not supported here, or refused: the copies stay evictable, as before. */
  }
}

export function ServiceWorkerRegistrar() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* An enhancement that did not land. The app is unaffected. */
      });
      void keepStorage();
    };

    /* The page that loaded before the worker could see it. */
    const onControl = () => announceHere();
    navigator.serviceWorker.addEventListener("controllerchange", onControl);

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControl);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const timer = window.setTimeout(announceHere, ANNOUNCE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
