"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CSSProperties } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TextField } from "@/components/ui/Field";
import { matchesSearch } from "@/lib/places/reference";
import type { PickersCopy } from "@/components/app/welcome/welcome-copy";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * One choice out of a very long list, without a very long list.
 *
 * 749 occupations and 774 local governments are both far past the size where a
 * native select is usable: on a phone it becomes a spinning wheel somebody has
 * to scroll for half a minute. So the control is a row showing the current
 * answer, and tapping it opens a full-page drawer with a search field at the
 * top and the options grouped underneath.
 *
 * Full page, never partial, per the house rules. The drawer is portalled to the
 * body because every card on these screens is glass, and a `backdrop-filter`
 * ancestor becomes the containing block for a fixed child, which would trap the
 * drawer inside the card that opened it.
 *
 * The chosen value is mirrored into a hidden input, so this works inside a plain
 * form post with no client state plumbing on the page around it.
 */

export type Choice = { code: string; name: string };
export type ChoiceGroup = {
  category: string;
  options: Choice[];
  /**
   * A pinned group of rows that also appear further down under their own
   * heading, the way "Common in Nigeria" sits above the occupation alphabet.
   * It is a browsing shortcut, so it is dropped the moment a search is running:
   * a query already reaches the whole list, and leaving the shortcut in would
   * return the same row twice with no way to tell the two apart.
   */
  shortcut?: boolean;
};

/**
 * The invalid paint, restated.
 *
 * `.nf-field` draws its border with a `border-box` gradient over a transparent
 * 1px border, so `.nf-field[aria-invalid="true"] { border-color: … }` recolours
 * a surface the gradient is already covering: the rule fires and nothing
 * changes. This trigger is a button wearing `.nf-field`, not an input, so it
 * cannot borrow `TextField`'s fix - it has to replace the gradient's own
 * border-box layer here, the same way, keeping the padding-box fill or the
 * field would blank out. Tokens only; no literal enters the palette.
 */
const INVALID_STYLE: CSSProperties = {
  background:
    "linear-gradient(var(--nf-surface-inset), var(--nf-surface-inset)) padding-box, linear-gradient(var(--nf-state-error), var(--nf-state-error)) border-box",
  boxShadow: "0 0 0 3px color-mix(in oklab, var(--nf-state-error) 26%, transparent)",
};

export function ChoicePicker({
  t,
  name,
  label,
  hint,
  placeholder,
  value,
  groups,
  onChange,
  onOpen,
  disabled = false,
  disabledHint,
  loading = false,
  error,
  allowClear = true,
  searchPlaceholder,
  testId,
}: {
  /*
   * The dictionary, handed down. Every word this drawer draws - the clear
   * affordance, the close label, both empty states - used to be an English
   * literal, and this control is on the sign-up form, which is the first screen
   * somebody who chose Hausa ever sees.
   */
  t: PickersCopy;
  /** The form field name the choice is posted under. */
  name: string;
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  /** Options, already grouped. One group with an empty category renders flat. */
  groups: ChoiceGroup[];
  onChange: (code: string) => void;
  /** Called the first time the drawer opens, for lists loaded on demand. */
  onOpen?: () => void;
  disabled?: boolean;
  disabledHint?: string;
  loading?: boolean;
  error?: string | undefined;
  allowClear?: boolean;
  searchPlaceholder?: string | undefined;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const base = useId();
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closePicker = useCallback(() => setOpen(false), []);


  /* Escape, Back, the Tab trap, the counted scroll lock, the focus return
     and drag or flick down to close all come with `Sheet`, in its full-page
     shape. The picker used to be a hand-built `fixed inset-0` panel with its
     own copy of the first four and no gesture. */

  /*
   * Focus the search once the drawer has settled, unchanged in behaviour: the
   * 60ms wait is what stops the focus landing mid-transition and scrolling the
   * panel. The field is found in the panel rather than held on a ref, because
   * `TextField` owns its own input ref and takes none from a caller. The panel
   * has exactly one search input, and `place-pickers.spec` asserts that.
   */
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  const selected = useMemo(() => {
    for (const group of groups) {
      const found = group.options.find((option) => option.code === value);
      if (found) return found;
    }
    return null;
  }, [groups, value]);

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return groups;
    const out: ChoiceGroup[] = [];
    for (const group of groups) {
      if (group.shortcut) continue;
      const options = group.options.filter((option) => matchesSearch(option.name, query));
      if (options.length > 0) out.push({ category: group.category, options });
    }
    return out;
  }, [groups, query]);

  const total = useMemo(
    () => filtered.reduce((sum, group) => sum + group.options.length, 0),
    [filtered],
  );

  const openDrawer = () => {
    if (disabled) return;
    setQuery("");
    setOpen(true);
    onOpen?.();
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />

      <div className="flex items-baseline justify-between gap-xs">
        <span className="nf-label">{label}</span>
        {allowClear && value !== "" && !disabled && (
          <Button variant="quiet" size="sm" onClick={() => onChange("")}>
            {t.pickers.clear}
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={openDrawer}
        disabled={disabled}
        data-testid={testId}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [disabled && disabledHint ? hintId : null, !disabled && hint ? hintId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        style={error ? INVALID_STYLE : undefined}
        className="nf-field mt-2xs flex w-full items-center justify-between gap-sm text-left disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span
          className={
            selected
              ? "min-w-0 flex-1 truncate text-[var(--nf-content-primary)]"
              : "min-w-0 flex-1 truncate text-[var(--nf-content-muted)]"
          }
          title={selected ? selected.name : placeholder}
        >
          {selected ? selected.name : placeholder}
        </span>
        <UiIcon
          name="chevron-down"
          size={16}
          className="shrink-0 -rotate-90 text-[var(--nf-content-muted)]"
        />
      </button>

      {disabled && disabledHint && (
        <p id={hintId} className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {disabledHint}
        </p>
      )}
      {!disabled && hint && (
        <p id={hintId} className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {hint}
        </p>
      )}
      {/* The picker keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id={errorId} message={error} />

      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) closePicker();
        }}
        title={label}
        closeLabel={t.pickers.close}
        fullPage
        testId={testId ? `${testId}-drawer` : undefined}
      >
              <div ref={panelRef}>
                {/*
                  Was a `.nf-field .nf-focus-well` flex wrapper around a bare
                  transparent input - the fifth arrangement of a leading search
                  icon on the platform, at the fifth size. `TextField` owns the
                  icon slot, the label/control pairing and the 16px coarse-
                  pointer floor that stops mobile Safari zooming the drawer the
                  moment this field takes focus.

                  It also brings the clear affordance, which is the one this
                  control most needed: 749 occupations behind a search box that
                  could only be emptied by selecting the text and deleting it.

                  Sticky, so the search stays in reach over a long list, and a
                  fixed height so the group headings can stick under it.
                */}
                <div className="sticky top-0 z-20 -mx-gutter flex h-[4rem] items-center border-b border-[var(--nf-border-subtle)] bg-[var(--nf-panel-fill)] px-gutter">
                  <TextField
                    className="w-full"
                    label={searchPlaceholder ?? t.pickers.search}
                    hideLabel
                    type="search"
                    leadingIcon="search"
                    clearable={t.pickers.clearSearch}
                    onClear={() => setQuery("")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder ?? t.pickers.search}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                <div className="pt-xs">
                {loading ? (
                  <p className="py-xl text-center text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
                    {t.pickers.loading}
                  </p>
                ) : total === 0 ? (
                  <div className="py-2xl text-center">
                    <p className="text-[length:var(--nf-text-body-sm)] font-semibold">{t.pickers.emptyTitle}</p>
                    <p className="mx-auto mt-2xs max-w-[34ch] text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
                      {groups.length === 0 ? t.pickers.emptyUnreachable : t.pickers.emptySearch}
                    </p>
                  </div>
                ) : (
                  filtered.map((group) => (
                    <section key={group.category || "all"} className="pt-md first:pt-xs">
                      {group.category && (
                        <h3 className="nf-overline sticky top-[4rem] z-10 -mx-gutter bg-[var(--nf-panel-fill)] px-gutter py-xs">
                          {group.category}
                        </h3>
                      )}
                      <ul className="divide-y divide-[var(--nf-border-subtle)]">
                        {group.options.map((option) => {
                          const active = option.code === value;
                          return (
                            <li key={option.code}>
                              <button
                                type="button"
                                onClick={() => {
                                  onChange(option.code);
                                  setOpen(false);
                                }}
                                aria-pressed={active}
                                className="flex w-full items-center justify-between gap-sm py-sm text-left text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)]"
                              >
                                <span className="min-w-0 flex-1">{option.name}</span>
                                {active && (
                                  <UiIcon
                                    name="verified"
                                    size={16}
                                    className="shrink-0 text-[var(--nf-state-success)]"
                                  />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
                )}
                </div>
              </div>
      </Sheet>
    </div>
  );
}
