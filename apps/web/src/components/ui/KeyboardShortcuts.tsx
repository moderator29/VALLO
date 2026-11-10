"use client";

import { WALLET_OPEN } from "@/lib/money/wallet-open";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { screenName } from "@/lib/nav/route-labels";

/**
 * Keyboard shortcut overlay, shown on "?" and hidden on Escape.
 *
 * Desktop only: on a phone there is no physical keyboard, so the overlay
 * never opens. Shortcuts navigate without a round trip by calling
 * router.push, so the page transition is the same as tapping the nav.
 *
 * Mounted once in DetailsHost, renders nothing until opened.
 */

type Shortcut = { keys: string; label: string; href?: string; action?: string };

const MONEY_SCREEN = "/wallet";

const SHORTCUTS: { section: string; items: Shortcut[] }[] = [
  {
    section: "Navigation",
    items: [
      { keys: "g h", label: "Go to Home", href: "/home" },
      { keys: "g s", label: "Go to Search", href: "/search" },
      { keys: "g m", label: "Go to Messages", href: "/messages" },
      { keys: "g n", label: "Go to Notifications", href: "/notifications" },
      { keys: "g b", label: "Go to Plans", href: "/bookings" },
      { keys: "g v", label: "Go to Saved", href: "/saved" },
      /* The money screen by its own route label (D78), never a hand-typed name. */
      ...(WALLET_OPEN ? [{ keys: "g w", label: ["Go to", screenName(MONEY_SCREEN) ?? ""].join(" ").trim(), href: MONEY_SCREEN }] : []),
      { keys: "g t", label: "Go to Settings", href: "/settings" },
    ],
  },
  {
    section: "General",
    items: [
      { keys: "/", label: "Focus search", action: "focus-search" },
      { keys: "?", label: "Show keyboard shortcuts", action: "toggle" },
      { keys: "Esc", label: "Close overlay", action: "close" },
    ],
  },
];

function isTyping(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;

      if (isTyping(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((prev) => !prev);
        pendingRef.current = null;
        return;
      }

      if (e.key === "/" && !open) {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[name="q"], input[data-search]'
        );
        if (search) search.focus();
        return;
      }

      if (e.key === "g" && !open) {
        pendingRef.current = "g";
        setTimeout(() => {
          pendingRef.current = null;
        }, 800);
        return;
      }

      if (pendingRef.current === "g") {
        pendingRef.current = null;
        const key = e.key.toLowerCase();
        const map: Record<string, string> = {
          h: "/home",
          s: "/search",
          m: "/messages",
          n: "/notifications",
          b: "/bookings",
          v: "/saved",
          ...(WALLET_OPEN ? { w: "/wallet" } : {}),
          t: "/settings",
        };
        const href = map[key];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, router]);

  /* UI-18: the overlay rides the shared `Sheet` (card variant) rather than
     drawing its own backdrop and surface, so focus trap, scroll lock, Escape
     and the scrim all come from the one implementation. */
  return (
    <Sheet open={open} onOpenChange={setOpen} title="Keyboard shortcuts" card closeLabel="Close">
      <div className="space-y-block">
        <div className="space-y-block">
          {SHORTCUTS.map((group) => (
            <div key={group.section}>
              <p className="nf-body-sm mb-inline font-semibold text-[var(--nf-content-muted)]">
                {group.section}
              </p>
              <ul className="divide-y divide-[var(--nf-panel-hair)]">
                {group.items.map((shortcut) => (
                  <li
                    key={shortcut.keys}
                    className="flex items-center justify-between py-inline"
                  >
                    <span className="nf-body text-[var(--nf-content-secondary)]">
                      {shortcut.label}
                    </span>
                    <span className="flex gap-inline-tight">
                      {shortcut.keys.split(" ").map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex min-w-[1.75rem] items-center justify-center rounded-sm border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-raised)] px-inline-tight py-3xs nf-caption font-semibold text-[var(--nf-content-primary)]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-row nf-caption text-center text-[var(--nf-content-muted)]">
          Press <kbd className="font-semibold">?</kbd> to toggle this overlay
        </p>
      </div>
    </Sheet>
  );
}
