import { copyText } from "@/lib/ui/clipboard";
import { banner } from "@/lib/ui/toast";

export type CopyKind = "text" | "link" | "code";

export const COPY_WORDS = {
  text: "Copied",
  link: "Link copied",
  code: "Code copied",
  failed: "Could not copy. Select it and copy by hand.",
  action: "Copy",
} as const;

/**
 * Copy and say so in the QUICK PILL (founder, 14 November 2026, after
 * WhatsApp's "Message copied": "built clean sharp and goes back by itself").
 * "Link copied", "Code copied", "Copied" or the caller's own line, near the
 * bottom where the hand acted, gone by itself; the pill carries the light
 * haptic tick, so this no longer fires its own. A FAILURE stays on the top
 * banner: it needs reading time and the pill never carries an error. The
 * whole action of `CopyButton`, apart from its glyph, so it can be tested
 * without a DOM.
 */
export async function copyAndSay(text: string, kind: CopyKind = "text", message?: string): Promise<boolean> {
  const done = await copyText(text);
  if (done) {
    banner.quick(message ?? COPY_WORDS[kind]);
  } else {
    banner.error(COPY_WORDS.failed);
  }
  return done;
}
