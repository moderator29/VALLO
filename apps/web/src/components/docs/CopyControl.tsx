"use client";

import { useEffect, useRef, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "./docs-kit.css";

/**
 * COPY CONTROL: for anything a member may need to quote to support (a
 * reference, a page address). Writes to the clipboard and confirms itself in
 * place for two seconds; where the clipboard is blocked it selects the text so
 * the reader can copy it by hand, and says so rather than claiming success.
 */
export function CopyControl({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      const el = codeRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setState("manual");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button type="button" className="nf-dk-copy" onClick={copy} data-copied={state === "copied" || undefined}>
      <code ref={codeRef}>{value}</code>
      <UiIcon name={state === "copied" ? "check" : "link"} size={16} />
      <span aria-live="polite">
        {state === "copied" ? "Copied" : state === "manual" ? "Selected. Copy it by hand." : label}
      </span>
    </button>
  );
}
