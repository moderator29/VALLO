"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useOverlay } from "@/lib/ui/use-overlay";
import { overlayIsOpen } from "@/lib/ui/overlay-registry";
import { feedback } from "@/lib/ui/feedback";
import { CONSOLE_JUMPS } from "@/components/app/desk/desk-keys";
import { NavIcon } from "./AdminGlyph";
import { currentDestination, labelFor, type ShellCopy, type NavViewer } from "./nav";
import { deskIndex, paletteActions, rankDesks } from "./palette";
import "./admin-material.css";
import { Button } from "@/components/ui/Button";

/**
 * THE CONSOLE SEARCH: A COMMAND PALETTE OVER THE DESK INDEX (reference 7067).
 *
 * One box. Type a desk and Enter takes you there; paste a reference and Enter
 * looks it up across the desks you may open; type a word and it offers the
 * open desk's own search, the people list and the unified queue. Opened with
 * Control or Command K from anywhere in the console, or with the search button
 * the bar shows on a phone, where the bar has no room for a field.
 *
 * WHAT IT DECIDES AND WHAT IT DOES NOT. It routes. It never reads a record and
 * never acts on one: every row is a link to a desk or to a search, and the
 * search itself runs on the desk it lands on, under that desk's own access
 * check. A desk this account cannot open is still listed (the rail lists it
 * too), and opening it answers with the refusal the desk always gave. The
 * counts beside a desk are the ones the rail's badges carry, passed down by the
 * layout; the palette computes none.
 *
 * REFERENCE 7067, TRANSLATED. A white card on a quiet ground, the field on top
 * with its glyph, a hairline, then rows that are a small tile and a name, the
 * highlighted row a soft tint with its return key drawn at the end. In Vallo's
 * material that is an Island (navy glass at night, white with the blue shadow
 * on Paper), Plate rows at radius 14, the active row tinted rather than lit.
 * The rows carry a second line (what the desk is for, reference 7086's
 * title-and-line rhythm) because "Fees" alone does not tell a new operator
 * whether it is where a lister's charge is explained.
 *
 * KEYBOARD, THE WHOLE CONTRACT. The field is a combobox: ArrowDown and ArrowUp
 * move through the rows (wrapping), Enter opens the highlighted one, Escape
 * closes. Tab stays inside (`useOverlay`) and focus returns to whatever opened
 * it. A polite live region says how many results there are as the list changes.
 * The highlighted row scrolls into view. The pointer moves the highlight too,
 * so the two never disagree about which row Enter will open.
 *
 * MOTION. It arrives on `land` (160ms, a short rise and fade: browsing
 * rhythm, CRAFT_DOCTRINE section 5) and leaves instantly. Nothing animates per
 * keystroke. Reduced motion and Calm collapse the arrival (motion tokens go to
 * 1ms), and data saver drops the blur (the Island token). Transform and
 * opacity only.
 *
 * ON A PHONE the card is pinned to the top with the safe-area inset and a 16px
 * gutter, so the keyboard never covers it, the rows are 52px, and the close
 * control is a 44px circle. A tap outside closes it.
 */
export type PaletteCopy = {
  open: string;
  title: string;
  placeholder: string;
  desks: string;
  actions: string;
  shortcut: string;
  shortcutMac: string;
  resultsOne: string;
  resultsMany: string;
  resultsNone: string;
  noMatchTitle: string;
  noMatchBody: string;
  searchDesk: string;
  searchPeople: string;
  searchQueue: string;
  lookup: string;
  waiting: string;
  jump: string;
  keyMove: string;
  keyOpen: string;
  keyClose: string;
  close: string;
};

type Row =
  | { kind: "desk"; id: string; href: string; label: string; lede: string; count: number; jump: string | null; icon: ReturnType<typeof deskIndex>[number]["icon"] }
  | { kind: "action"; id: string; href: string; label: string };

export function ConsolePalette({
  copy,
  ledes,
  counts,
  shell,
  viewer,
}: {
  copy: PaletteCopy;
  ledes: Readonly<Record<string, string | undefined>>;
  counts: Record<string, number>;
  shell?: ShellCopy;
  /** Who is searching, so the palette offers only the desks they can open. */
  viewer?: NavViewer;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const panel = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  /* Control K on a PC, Command K on a Mac. The server cannot know, so the
     server snapshot is the PC's and the browser's is read after hydration
     (a store that never changes, so no effect and no mismatch). */
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent),
    () => false,
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setAt(0);
  }, []);
  useOverlay({ open, onClose: close, panelRef: panel });

  /* The one shortcut. The bar's field used to take Control K for itself; it now
     opens this, which is a field and more.

     TWO PLACES IT DOES NOT ANSWER (D49.3). Inside a textarea or an editable
     region the chord is the writer's: Control K deletes to the end of the line
     on a Mac, and a reviewer drafting a note must not lose the line to a
     dialog. And while another overlay is open (a sheet, a drawer) it does not
     open a second modal dialog on top: two `aria-modal` dialogs at once leave
     a screen reader in neither. It still closes itself. */
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (!openRef.current && overlayIsOpen()) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const index = useMemo(
    () => deskIndex({ shell, ledes, counts, jumps: CONSOLE_JUMPS, ...(viewer ? { viewer } : {}) }),
    [shell, ledes, counts],
  );
  const here = currentDestination(pathname);
  const rows: Row[] = useMemo(() => {
    const desks = rankDesks(index, query).map<Row>((desk) => ({
      kind: "desk",
      id: `d-${desk.key}`,
      href: desk.href,
      label: desk.label,
      lede: desk.lede,
      count: desk.count,
      jump: desk.jump,
      icon: desk.icon,
    }));
    const actions = paletteActions(
      query,
      pathname,
      { searchDesk: copy.searchDesk, searchPeople: copy.searchPeople, searchQueue: copy.searchQueue, lookup: copy.lookup },
      here ? labelFor(here, shell) : null,
    ).map<Row>((action) => ({ kind: "action", id: `a-${action.id}`, href: action.href, label: action.label }));
    /* A pasted reference leads with its lookup, so Enter on it does what the
       person came to do; a word leads with the desk it names. */
    return query.trim().length > 0 && actions[0]?.id === "a-lookup" ? [...actions, ...desks] : [...desks, ...actions];
  }, [index, query, pathname, copy, here, shell]);

  const active = Math.min(at, Math.max(0, rows.length - 1));

  /* The highlighted row stays in view as the arrows move it. */
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-active="true"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, rows]);

  const go = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      feedback("select");
      close();
      router.push(row.href);
    },
    [close, router],
  );

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAt((value) => (rows.length === 0 ? 0 : (Math.min(value, rows.length - 1) + 1) % rows.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setAt((value) => (rows.length === 0 ? 0 : (Math.min(value, rows.length - 1) + rows.length - 1) % rows.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(rows[active]);
    } else if (event.key === "Home") {
      setAt(0);
    }
  };

  const status =
    rows.length === 0 ? copy.resultsNone : rows.length === 1 ? copy.resultsOne : copy.resultsMany.replace("{count}", String(rows.length));
  const showNoMatch = query.trim().length > 0 && !rows.some((row) => row.kind === "desk");
  const deskRows = rows.filter((row) => row.kind === "desk");
  const actionRows = rows.filter((row) => row.kind === "action");
  /* The lookup leads, and says so in its own section, when a reference was pasted. */
  const leadingAction = rows[0]?.kind === "action";
  const sections: { title: string; rows: Row[] }[] = leadingAction
    ? [
        { title: copy.actions, rows: actionRows },
        { title: copy.desks, rows: deskRows },
      ]
    : [
        { title: copy.desks, rows: deskRows },
        { title: copy.actions, rows: actionRows },
      ];

  return (
    <>
      <button
        type="button"
        className="nf-admin-icon-btn nf-admin-palette-open"
        aria-label={copy.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <UiIcon name="search" size={20} />
      </button>
      {open && (
        <div className="nf-admin-palette" data-testid="console-palette">
          <button type="button" className="nf-admin-palette__scrim" aria-label={copy.close} tabIndex={-1} onClick={close} />
          <div ref={panel} className="nf-admin-palette__panel nf-island" role="dialog" aria-modal="true" aria-label={copy.title}>
            <div className="nf-admin-palette__field">
              <UiIcon name="search" size={20} className="nf-admin-palette__glyph" />
              <input
                ref={input}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={rows[active] ? `${listId}-${rows[active].id}` : undefined}
                aria-label={copy.title}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                placeholder={copy.placeholder}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setAt(0);
                }}
                onKeyDown={onInputKey}
              />
              <Button type="button" variant="icon" round className="nf-admin-palette__close" aria-label={copy.close} onClick={close}>
                <UiIcon name="close" size={20} />
              </Button>
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {status}
            </p>
            <ul ref={list} id={listId} role="listbox" aria-label={copy.title} className="nf-admin-palette__list">
              {sections.map((section) =>
                section.rows.length === 0 ? null : (
                  <li key={section.title} role="presentation" className="nf-admin-palette__group">
                    <p className="nf-admin-palette__heading" aria-hidden="true">
                      {section.title}
                    </p>
                    <ul role="presentation">
                      {section.rows.map((row) => {
                        const on = rows[active]?.id === row.id;
                        return (
                          <li
                            key={row.id}
                            id={`${listId}-${row.id}`}
                            role="option"
                            aria-selected={on}
                            data-active={on}
                            className="nf-admin-palette__row"
                            onMouseMove={() => {
                              const next = rows.findIndex((candidate) => candidate.id === row.id);
                              if (next !== at) setAt(next);
                            }}
                            onClick={() => go(row)}
                          >
                            <span className="nf-admin-palette__tile" aria-hidden="true">
                              {row.kind === "desk" ? <NavIcon icon={row.icon} size={20} /> : <UiIcon name="search" size={20} />}
                            </span>
                            <span className="nf-admin-palette__text">
                              <span className="nf-admin-palette__name">{row.label}</span>
                              {row.kind === "desk" && row.lede ? <span className="nf-admin-palette__lede">{row.lede}</span> : null}
                            </span>
                            {row.kind === "desk" && row.count > 0 ? (
                              <span className="nf-admin-palette__count nf-numeric">{copy.waiting.replace("{count}", String(row.count))}</span>
                            ) : null}
                            {row.kind === "desk" && row.jump ? (
                              <kbd className="nf-admin-palette__kbd">{copy.jump.replace("{key}", row.jump)}</kbd>
                            ) : null}
                            {on ? <UiIcon name="arrow-right" size={16} className="nf-admin-palette__enter" /> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ),
              )}
              {showNoMatch && (
                <li role="presentation" className="nf-admin-palette__none">
                  <p className="nf-admin-palette__name">{copy.noMatchTitle}</p>
                  <p className="nf-admin-palette__lede">{copy.noMatchBody}</p>
                </li>
              )}
            </ul>
            <p className="nf-admin-palette__keys" aria-hidden="true">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> {copy.keyMove}
              </span>
              <span>
                <kbd>↵</kbd> {copy.keyOpen}
              </span>
              <span>
                <kbd>Esc</kbd> {copy.keyClose}
              </span>
              <span className="nf-admin-palette__where">{mac ? copy.shortcutMac : copy.shortcut}</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
