"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { banner, type ToastTone } from "@/lib/ui/toast";

/**
 * AN AUTH SCREEN'S ANSWER, SAID BY THE ONE BANNER (founder, 7 November 2026,
 * "THE BANNER EVERYWHERE"). The sign-in, sign-up, reset and finish-setup
 * forms each drew `state.message` as a red block above their button. This
 * says it at the top instead, once per answer (`useActionState` hands back a
 * new object for each one, and the effect keys on it), with the refusal's
 * one way out (`state.action`, lib/auth/form-state.ts) as the banner's
 * action. A field's own problem is said by its field (`FieldProblem`); when
 * both arrive together, this sentence is said after it, so the form's own
 * summary is the one left on screen.
 */
export function useAuthBanner(
  state: { message?: string; action?: { href: string; label: string } } | null | undefined,
  tone: ToastTone = "error",
): void {
  const router = useRouter();
  useEffect(() => {
    const message = state?.message;
    if (!message) return;
    const way = state?.action;
    queueMicrotask(() => {
      banner(message, {
        tone,
        "data-testid": "banner-auth",
        ...(way ? { action: { label: way.label, run: () => router.push(way.href) } } : {}),
      });
    });
    // The router is stable; the answer's identity is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
