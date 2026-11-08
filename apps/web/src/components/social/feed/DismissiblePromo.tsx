"use client";

import { useEffect, useState, type ReactNode } from "react";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { feedback } from "@/lib/ui/feedback";

import "./dismissible-promo.css";

/**
 * A promo the reader can put away (8 November 2026). Wraps FE-A's shared
 * `PromoBanner` without forking it: a close button over its corner, and the
 * choice remembered on this device under `key`. Until the device has been
 * read the promo is not drawn, so a dismissed one never flashes back.
 * Storage that throws (a private window) simply shows the promo.
 */
export function DismissiblePromo({ storageKey, closeLabel, children }: { storageKey: string; closeLabel: string; children: ReactNode }) {
  const [state, setState] = useState<"unknown" | "shown" | "hidden">("unknown");
  useEffect(() => {
    let hidden = false;
    try {
      hidden = window.localStorage.getItem(storageKey) === "1";
    } catch {
      hidden = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's choice is read after hydration, so server and first client render agree
    setState(hidden ? "hidden" : "shown");
  }, [storageKey]);
  if (state !== "shown") return null;
  return (
    <div className="nf-promo-dismiss">
      {children}
      <button
        type="button"
        className="nf-promo-dismiss__close"
        aria-label={closeLabel}
        onClick={() => {
          feedback("select");
          try {
            window.localStorage.setItem(storageKey, "1");
          } catch {
            /* Not remembered on this device: it just goes for now. */
          }
          setState("hidden");
        }}
      >
        <UiIcon name="close" size={18} />
      </button>
    </div>
  );
}
