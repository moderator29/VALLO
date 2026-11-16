"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { valloLinkOf } from "@/lib/paste/parse";

/**
 * A VALLO ADDRESS PASTED INTO THE SEARCH BOX OPENS THAT THING (founder, 14
 * November 2026, handoff 6.2 part 5).
 *
 * Somebody sent a friend a listing; the friend pastes it into search, where a
 * search for a URL finds nothing. So a pasted address that is Vallo's OWN is
 * followed instead of searched. Only the five things with a page of their
 * own, only on Vallo's host (the host decides, never the path, so a
 * stranger's address shaped like ours is still searched as text), and only
 * on a paste the person made: nothing reads the clipboard by itself.
 *
 * Mounted beside the field rather than owning it, so the field stays a plain
 * GET form that works with no JavaScript at all.
 */
export function PastedListingLink({ inputId }: { inputId: string }) {
  const router = useRouter();

  useEffect(() => {
    const field = document.getElementById(inputId);
    if (!(field instanceof HTMLInputElement)) return;
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
      if (text.length === 0 || /\s/.test(text)) return;
      const href = /^https?:\/\//i.test(text) ? text : /^www\./i.test(text) ? `https://${text}` : null;
      if (!href) return;
      const found = valloLinkOf(href, window.location.origin);
      if (!found) return;
      event.preventDefault();
      const path =
        found.thing === "profile" ? `/u/${found.id}` : `/${found.thing}/${found.id}`;
      router.push(path);
    };
    field.addEventListener("paste", onPaste);
    return () => field.removeEventListener("paste", onPaste);
  }, [inputId, router]);

  return null;
}
