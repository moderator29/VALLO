"use client";

import { useEffect } from "react";
import { shouldReload } from "@/lib/deploy/watch";

/* The deploy this page was built into, recorded at build time (next.config.ts). */
const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const TRIED_KEY = "vallo-deploy-reload";

function readTried(): { id: string; at: number } | null {
  try {
    const raw = window.sessionStorage.getItem(TRIED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; at?: unknown };
    return typeof parsed.id === "string" && typeof parsed.at === "number" ? { id: parsed.id, at: parsed.at } : null;
  } catch {
    return null;
  }
}

function writeTried(id: string): void {
  try {
    window.sessionStorage.setItem(TRIED_KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    /* Without storage the half hour guard is lost; the reload still happens once per open. */
  }
}

/* Somebody is in the middle of typing: a reload would throw their words away. */
function isEditing(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return active.isContentEditable || active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
}

/**
 * Draws nothing. Asks the server which deploy is live shortly after the page
 * opens, and again every time the app comes back to the front or the signal
 * returns. When it is not the deploy this page is running, the page reloads
 * itself once, which takes the network's copy instead of the phone's saved one.
 */
export function DeployWatch() {
  useEffect(() => {
    if (!MINE) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch("/api/build", { cache: "no-store", credentials: "omit" });
        if (!response.ok) return;
        const body = (await response.json()) as { id?: unknown };
        const live = typeof body.id === "string" ? body.id : "";
        if (!shouldReload({ mine: MINE, live, editing: isEditing(), tried: readTried(), now: Date.now() })) return;
        writeTried(live);
        window.location.reload();
      } catch {
        /* No signal, or the server is busy: the next return to the front asks again. */
      } finally {
        busy = false;
      }
    };
    const first = window.setTimeout(() => void check(), 4000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);
  return null;
}
