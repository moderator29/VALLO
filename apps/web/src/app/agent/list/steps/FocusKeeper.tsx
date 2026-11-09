"use client";

import { useEffect, useRef } from "react";

/**
 * KEEPS THE FIELD BEING TYPED IN FOCUSED, around a StepFrame defect.
 *
 * `StepFrame` hands `useOverlay` a new `onClose` arrow on every render, so
 * the overlay's effect tears down and sets up again on EVERY render, and its
 * teardown puts focus back on whatever was focused when it last set up. In a
 * flow whose fields are controlled (this wizard), the first keystroke in a
 * field re-renders the frame and focus jumps from the field to the frame: the
 * second letter is lost. (`components/ui/StepFrame.tsx` is not this file's to
 * change; the fix there is to keep `onClose` in a ref. Reported in the
 * hand-off.)
 *
 * Mounted INSIDE the frame, so its effect runs after the frame's teardown
 * and before the frame's set-up (React runs every teardown first, then the
 * set-ups, children before parents): when focus has just been taken to the
 * frame itself, it goes back to the field that had it, and the frame's
 * set-up then records that field, so it is not taken again.
 */
export function FocusKeeper({ frameTestId }: { frameTestId: string }) {
  const last = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.dataset.testid === frameTestId) return;
      last.current = target;
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [frameTestId]);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const field = last.current;
    if (!active || active.dataset.testid !== frameTestId || !field || !field.isConnected || !active.contains(field)) return;
    if (!field.matches("input, textarea, select, [contenteditable]")) return;
    field.focus({ preventScroll: true });
  });
  return null;
}
