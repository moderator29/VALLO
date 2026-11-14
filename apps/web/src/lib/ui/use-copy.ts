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
 * Copy with the one confirmation: the quick pill at the bottom ("Link
 * copied", the founder's ruling of 14 November 2026), a light tick in the
 * hand, or an error banner at the top that says what to do instead.
 */
export function useCopy() {
  const words = detailsOf(useClientCopyOptional())?.copy;
  return useCallback(
    async (text: string, kind: CopyKind = "text"): Promise<boolean> => {
      const done = await copyText(text);
      if (done) {
        feedback("select");
        if (words) toast.quick(kind === "link" ? words.linkCopied : kind === "code" ? words.codeCopied : words.copied);
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
 * light tick is felt. The quick pill says it too ("Link copied", "Code
 * copied"): the founder's ruling of 7 November 2026 ("THE BANNER
 * EVERYWHERE") has every outcome said by the one system, and his ruling of
 * 14 November gives a copy its small pill at the bottom. The button's own
 * tick stays as the control's state. A failure is a banner at the top that
 * says what to do instead.
 */
export function useCopyFlash(ms = 2000) {
  const words = detailsOf(useClientCopyOptional())?.copy;
  const [copied, flash] = useDoneFlash(ms);
  const copy = useCallback(
    async (text: string, kind: CopyKind = "text"): Promise<boolean> => {
      const done = await copyText(text);
      if (done) {
        feedback("select");
        flash();
        if (words) toast.quick(kind === "link" ? words.linkCopied : kind === "code" ? words.codeCopied : words.copied);
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
        if (words) toast.quick(words.linkCopied);
      } else if (outcome === "failed" && words) {
        toast(words.failed, { tone: "error" });
      }
      return outcome;
    },
    [words],
  );
}
