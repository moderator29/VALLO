"use client";

import { useState, useSyncExternalStore } from "react";

const KEY = "vallo.console.desktop-note";

function dismissedOnThisDevice(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    /* No storage: the note simply shows. */
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * BEST ON A COMPUTER. The console works on a phone, and its tables and
 * reviews are easier on a wider screen. One quiet line says so on a narrow
 * screen (the stylesheet hides it from 768px), and stays put away once
 * dismissed on this device.
 */
export function DesktopNote() {
  const dismissed = useSyncExternalStore(subscribe, dismissedOnThisDevice, () => false);
  const [closed, setClosed] = useState(false);

  if (dismissed || closed) return null;
  return (
    <p className="nf-desktop-note" role="note" data-testid="desktop-note">
      <span>The console works on a phone. For the best experience, open it on a computer.</span>
      <button
        type="button"
        className="nf-btn nf-btn--quiet nf-btn--sm"
        onClick={() => {
          setClosed(true);
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            /* Dismissed for this visit only. */
          }
        }}
      >
        Got it
      </button>
    </p>
  );
}
