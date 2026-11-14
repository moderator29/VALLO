import { copyText } from "@/lib/ui/clipboard";
import { feedback } from "@/lib/ui/feedback";
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
 * Copy and say so ("Link copied", "Code copied", "Copied" or the caller's own
 * line) in the quick pill at the bottom of the screen (founder, 14 November
 * 2026); a copy that failed stays on the top banner, where an error belongs. The whole action of `CopyButton`, apart
 * from its glyph, so it can be tested without a DOM.
 */
export async function copyAndSay(text: string, kind: CopyKind = "text", message?: string): Promise<boolean> {
  const done = await copyText(text);
  if (done) {
    feedback("select");
    banner.quick(message ?? COPY_WORDS[kind]);
  } else {
    banner.error(COPY_WORDS.failed);
  }
  return done;
}
