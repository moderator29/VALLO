"use client";

import { useCallback } from "react";
import { useDoneFlash } from "@/lib/ui/use-done-flash";
import { useClientCopyOptional } from "@/lib/i18n/client-copy";
import type { ClientCopy } from "@/lib/i18n/client-copy-of";
import { feedback } from "@/lib/ui/feedback";
import { toast } from "@/lib/ui/toast";
import { copyText, shareOrCopy, type ShareOutcome, type SharePayload } from "@/lib/ui/clipboard";

/* Destructured rather than read as a property, so the dictionary-slice walk
   (lib/i18n/reachable-namespaces.ts) does not charge these root-layout words
   to every card slice that imports this hook. */
type Details = ClientCopy extends { details: infer D } ? D : never;

function detailsOf(copy: ClientCopy | null): Details | undefined {
  if (!copy) return undefined;
  const { details } = copy;
  return details;
}

export type CopyKind = "text" | "link" | "code";

/**
 * Copy with the one confirmation: a success toast ("Link copied"), a light
 * tick in the hand, or an error toast that says what to do instead.
 */
export function useCopy() {
  const words = detailsOf(useClientCopyOptional())?.copy;
  return useCallback(
    async (text: string, kind: CopyKind = "text"): Promise<boolean> => {
      const done = await copyText(text);
      if (done) {
        feedback("select");
        if (words) toast(kind === "link" ? words.linkCopied : kind === "code" ? words.codeCopied : words.copied, { tone: "success" });
      } else if (words) {
        toast(words.failed, { tone: "error" });
      }
      return done;
    },
    [words],
  );
}

/**
 * Copy for a control that confirms in place ("Copy" becomes "Copied" with a
 * check): `copied` is true for a beat after the clipboard took it, and a
 * light tick is felt. No toast on success, because the button already said
 * it; a failure is still a toast that says what to do instead.
 */
export function useCopyFlash(ms = 2000) {
  const words = detailsOf(useClientCopyOptional())?.copy;
  const [copied, flash] = useDoneFlash(ms);
  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const done = await copyText(text);
      if (done) {
        feedback("select");
        flash();
      } else if (words) {
        toast(words.failed, { tone: "error" });
      }
      return done;
    },
    [flash, words],
  );
  return [copied, copy] as const;
}

/**
 * The two words on a copy control that confirms in place ("Copy", then
 * "Copied"), or null outside the client copy provider, where a caller draws
 * no control rather than one with no name.
 */
export function useCopyLabels(): { copy: string; copied: string } | null {
  const words = detailsOf(useClientCopyOptional())?.copy;
  return words ? { copy: words.action, copied: words.copied } : null;
}

/**
 * Share through the phone's own sheet, or copy the link where there is none,
 * and say which happened. A cancelled sheet says nothing.
 */
export function useShare() {
  const words = detailsOf(useClientCopyOptional())?.share;
  return useCallback(
    async (payload: SharePayload): Promise<ShareOutcome> => {
      const outcome = await shareOrCopy(payload);
      if (outcome === "copied") {
        feedback("select");
        if (words) toast(words.linkCopied, { tone: "success" });
      } else if (outcome === "failed" && words) {
        toast(words.failed, { tone: "error" });
      }
      return outcome;
    },
    [words],
  );
}
