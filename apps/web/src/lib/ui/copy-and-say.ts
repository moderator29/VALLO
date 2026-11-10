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
 * Copy and say so in the one top banner ("Link copied", "Code copied",
 * "Copied" or the caller's own line). The whole action of `CopyButton`, apart
 * from its glyph, so it can be tested without a DOM.
 */
export async function copyAndSay(text: string, kind: CopyKind = "text", message?: string): Promise<boolean> {
  const done = await copyText(text);
  if (done) {
    feedback("select");
    banner.success(message ?? COPY_WORDS[kind]);
  } else {
    banner.error(COPY_WORDS.failed);
  }
  return done;
}
