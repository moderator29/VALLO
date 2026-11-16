"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nextUnclaimed, SHORTCUTS, shortcutFor, stepTicket, type SupportLane } from "@/lib/admin/support-workspace";
import { Button } from "@/components/ui/Button";

/**
 * THE DESK'S KEYS. j and k walk the queue on screen, n jumps to the next
 * ticket nobody holds, c takes the open ticket, r puts the cursor in the
 * reply, m in the saved replies, e opens the hand-off to another desk, and
 * ? shows the list. Never while typing, never with a modifier (the rules are
 * `shortcutFor`, tested). Every key only moves focus, follows a link or
 * presses a button already on the page, so a key can do nothing a click
 * could not.
 */
export function SupportKeys({
  rows,
  current,
  hrefFor,
}: {
  rows: readonly { id: string; claimed: boolean; lane: SupportLane }[];
  current: string | null;
  /** The address of a ticket in this tab and search, keyed by id. */
  hrefFor: Record<string, string>;
}) {
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (id: string | null) => {
      const href = id && id !== current ? hrefFor[id] : undefined;
      if (href) router.push(href, { scroll: false });
    },
    [current, hrefFor, router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const action = shortcutFor({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        targetTag: target?.tagName ?? null,
        targetEditable: target?.isContentEditable ?? false,
      });
      if (!action) return;
      const ids = rows.map((r) => r.id);
      const focus = (selector: string) => {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) return false;
        el.focus();
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        return true;
      };
      switch (action) {
        case "next":
          go(stepTicket(ids, current, 1));
          break;
        case "prev":
          go(stepTicket(ids, current, -1));
          break;
        case "next_unclaimed":
          go(nextUnclaimed(rows, current));
          break;
        case "claim":
          document.querySelector<HTMLButtonElement>("[data-support-take]")?.click();
          break;
        case "reply":
          if (!focus("#support-reply")) return;
          break;
        case "macros":
          if (!focus("[data-support-macro]")) return;
          break;
        case "escalate": {
          const details = document.querySelector<HTMLDetailsElement>("#support-escalate");
          if (!details) return;
          details.open = true;
          focus("#support-escalate summary");
          break;
        }
        case "help":
          setHelp((v) => !v);
          break;
        case "close":
          if (!help) return;
          setHelp(false);
          break;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, current, go, help]);

  useEffect(() => {
    if (help) dialog.current?.focus();
  }, [help]);

  return (
    <>
      <button
        type="button"
        className="nf-admin-seg__item nf-admin-keyhint"
        aria-haspopup="dialog"
        aria-expanded={help}
        onClick={() => setHelp((v) => !v)}
        data-testid="support-keys-button"
      >
        <kbd className="nf-numeric font-semibold">?</kbd>
        <span>Keys</span>
      </button>
      {help ? (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="false"
          aria-label="Keyboard shortcuts"
          tabIndex={-1}
          className="nf-panel nf-panel--card fixed inset-x-md bottom-md z-50 p-md sm:left-auto sm:right-lg sm:w-96"
          data-testid="support-keys-help"
        >
          <div className="flex items-center justify-between gap-xs">
            <p className="nf-admin-panel__title">Keyboard shortcuts</p>
            <Button type="button" variant="quiet" size="sm" onClick={() => setHelp(false)}>
              Close
            </Button>
          </div>
          <dl className="mt-xs grid grid-cols-[auto_1fr] items-center gap-x-md gap-y-2xs">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="contents">
                <dt>
                  <kbd className="nf-badge nf-badge--neutral nf-numeric px-xs py-3xs">{s.key === "Escape" ? "Esc" : s.key}</kbd>
                </dt>
                <dd className="nf-body-sm text-[var(--nf-content-secondary)]">{s.words}</dd>
              </div>
            ))}
            <div className="contents">
              <dt>
                <kbd className="nf-badge nf-badge--neutral nf-numeric px-xs py-3xs">Ctrl Enter</kbd>
              </dt>
              <dd className="nf-body-sm text-[var(--nf-content-secondary)]">Send the reply you are writing</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </>
  );
}
