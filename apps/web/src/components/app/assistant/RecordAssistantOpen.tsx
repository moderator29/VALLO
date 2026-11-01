"use client";

import { useEffect } from "react";
import { recordAssistantOpen } from "@/lib/assistant/activity-actions";

/**
 * Tells the assistant a member opened this listing, once per listing per tab
 * session. The server records it only when the member has the assistant on and
 * Saved preferences granted; otherwise it does nothing. Draws nothing.
 */
export function RecordAssistantOpen({ listingId }: { listingId: string }) {
  useEffect(() => {
    const mark = `nf_ai_open:${listingId}`;
    try {
      if (window.sessionStorage.getItem(mark)) return;
      window.sessionStorage.setItem(mark, "1");
    } catch {
      /* Storage blocked: the server still dedupes within six hours. */
    }
    void recordAssistantOpen({ listingId }).catch(() => undefined);
  }, [listingId]);
  return null;
}
