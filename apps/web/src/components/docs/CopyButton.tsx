"use client";

import { useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { copyText } from "@/lib/ui/clipboard";
import { banner } from "@/lib/ui/toast";
import "@/app/css/docs-kit.css";

/**
 * THE COPY CONTROL (DOCS_AND_PRESENCE_UPGRADE.md 4.6): one small button beside
 * anything a member may need to quote to support, a payment reference, the
 * support address, the link to an answer. A press copies the exact text and
 * the banner says so; the glyph turns to a tick for a moment so the place
 * pressed answers too. If the browser refuses the clipboard, the banner says
 * that instead of pretending.
 *
 * `text` is what is copied; `label` names it for a screen reader and the
 * banner ("Link copied"). A path starting with "/" is copied as a full
 * address on this site, so a pasted link opens.
 */
export function CopyButton({
  text,
  label,
  icon = "stack",
  className = "",
}: {
  text: string;
  label: string;
  /** `link` for an address, `stack` (two sheets) for text to quote. */
  icon?: "stack" | "link";
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    const value = text.startsWith("/") ? `${window.location.origin}${text}` : text;
    const ok = await copyText(value);
    if (ok) {
      setDone(true);
      banner.quick(`${label} copied`);
      window.setTimeout(() => setDone(false), 1600);
    } else {
      banner(`${label} could not be copied. Select it and copy it yourself.`, { tone: "warning" });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`nf-doc-copy nf-tap ${className}`.trim()}
      aria-label={`Copy ${label.toLowerCase()}`}
      data-done={done ? "true" : undefined}
    >
      <UiIcon name={done ? "check" : icon} size={16} />
    </button>
  );
}
