"use client";

import { useEffect } from "react";
import { banner } from "@/lib/ui/toast";

/**
 * A FORM ACTION'S OUTCOME, SAID BY THE ONE BANNER (Grade 1, SW1).
 *
 * The `useActionState` desks each drew their own result line ("Done.", or the
 * refusal) beside the button, in a different size and colour on every desk.
 * This says it in the one place instead: the success sentence the caller
 * names (specific, never a bare "Done"), or the server's own refusal, with an
 * optional Try again. A field's own error stays under that field; this hook
 * never touches `fieldErrors`.
 *
 * It fires once per answer: `useActionState` hands back a new object for
 * every submission, and the effect keys on that identity.
 */
export function useActionBanner(
  state: { ok: boolean; error?: string } | null | undefined,
  words: { ok?: string; retry?: () => void } = {},
): void {
  const { ok, retry } = words;
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      /* The tone as an option: a dictionary slice test counts any `.success` read. */
      if (ok) banner(ok, { tone: "success" });
      return;
    }
    banner.error(state.error ?? "That did not go through. Try again.", retry ? { retry } : undefined);
    // `ok` and `retry` are words and a handler, not a reason to say it twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
