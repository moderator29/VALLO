"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { decideKey, KEY_HELP, nextIndex } from "@/lib/nav/member-keys";

/**
 * B17: THE DESKTOP MEMBER'S KEYBOARD. Fine pointer only, and never while
 * typing (`lib/nav/member-keys.ts` decides; this component only acts):
 * "/" search, "g" then h, s, m or p to go, j and k through the rows on the
 * screen, "s" saves the listing in focus, "?" shows the keys.
 *
 * A touch phone never gets a listener at all.
 */
const ROWS = '[data-testid="inbox-row"], [data-testid="listing-card"], [data-kb-row]';
const FIELD = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(ROWS)).filter((el) => el.offsetParent !== null);
}

function focusRow(row: HTMLElement) {
  const target = row.matches("a, button") ? row : row.querySelector<HTMLElement>("a[href], button");
  (target ?? row).focus();
  (target ?? row).scrollIntoView({ block: "nearest" });
}

export function MemberKeys() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [help, setHelp] = useState(false);
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    try {
      setEnabled(window.matchMedia("(pointer: fine)").matches);
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const target = event.target as HTMLElement | null;
      /* A dialog already open owns its keys, apart from the cheat sheet's own. */
      if (!help && document.querySelector('[aria-modal="true"]:not([data-closing])')) return;
      const action = decideKey({
        key: event.key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        inField: Boolean(target?.closest(FIELD)),
        pendingGAt: pendingG.current,
        now: Date.now(),
      });
      if (!action) {
        pendingG.current = null;
        return;
      }
      if (action.type === "pending-g") {
        pendingG.current = Date.now();
        return;
      }
      pendingG.current = null;
      switch (action.type) {
        case "go":
          event.preventDefault();
          router.push(action.href);
          return;
        case "search": {
          event.preventDefault();
          const field = document.querySelector<HTMLInputElement>(
            '[role="search"] input, input[type="search"], [data-testid="inbox-search"] input, input[data-testid="inbox-search"]',
          );
          if (field) field.focus();
          else router.push("/search");
          return;
        }
        case "intelligence": {
          event.preventDefault();
          /* On the screen itself, the caret goes to its field; anywhere else, it opens. */
          const own = document.querySelector<HTMLInputElement>("[data-intel-field]");
          if (own) {
            own.focus();
            own.select();
          } else router.push("/intelligence?focus=1");
          return;
        }
        case "help":
          event.preventDefault();
          setHelp(true);
          return;
        case "move": {
          const rows = focusables();
          if (rows.length === 0) return;
          event.preventDefault();
          const current = rows.findIndex((row) => row.contains(document.activeElement));
          const next = nextIndex(current, action.dir, rows.length);
          if (next >= 0) focusRow(rows[next]!);
          return;
        }
        case "save": {
          const card = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-testid="listing-card"]');
          const heart = card?.querySelector<HTMLButtonElement>('[data-testid="card-save"]');
          if (heart) {
            event.preventDefault();
            heart.click();
          }
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, help, router]);

  if (!enabled) return null;
  return (
    <Sheet open={help} onOpenChange={setHelp} title="Keyboard shortcuts" detents={[0.7]} sideOnWide testId="member-keys-help">
      <dl className="nf-keys" data-testid="member-keys-list">
        {KEY_HELP.map((row) => (
          <div key={row.keys} className="nf-keys__row">
            <dt>
              {/* "j / k" is either key; "g h" is one key then the other. */}
              {row.keys.split(" ").map((k, i, all) =>
                k === "/" && all.length === 3 ? (
                  <span key={i} className="nf-keys__or">
                    or
                  </span>
                ) : (
                  <span key={i} className="contents">
                    {i > 0 && all[i - 1] !== "/" ? <span className="nf-keys__or">then</span> : null}
                    <kbd className="nf-keys__key">{k}</kbd>
                  </span>
                ),
              )}
            </dt>
            <dd>{row.what}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
