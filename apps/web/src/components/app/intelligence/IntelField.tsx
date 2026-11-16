"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { cleanWords } from "@/lib/intelligence/client";
import type { IntelligenceTab, Suggestion } from "@/lib/intelligence/contract";
import { fill, groupSuggestions, moveActive, type IntelligenceCopy } from "./model";
import { useFinePointer, useIsMac, useRotatingHint, useSuggest } from "./use-intel";

const SUGGESTION_ICON: Record<Suggestion["kind"], UiIconName> = {
  query: "search",
  recent: "history",
  place: "location",
  property: "house",
  stay: "bed",
  restaurant: "utensils",
  roommate: "house-duplex",
  person: "user",
  community: "circle-people",
  post: "feed",
  screen: "arrow-up-right",
  guide: "file-text",
  personal: "heart",
};

/**
 * THE ONE FIELD, AND WHAT IT OFFERS AS YOU TYPE.
 *
 * A real GET form to `/intelligence` (so it works before any script), with a
 * combobox on top: the suggestions from `/api/intelligence/suggest` in their
 * groups, walked with Up and Down, taken with Enter or a tap, closed with
 * Escape (a second Escape clears the words). The options are never focused
 * themselves: the field keeps the caret and points at the active option with
 * `aria-activedescendant`, which is how a screen reader hears the walk.
 *
 * The list sits in the page's flow under the field, never pinned to the
 * bottom, and on a touch screen the field scrolls itself to the top of the
 * view as the list opens, so the phone's keyboard never covers it.
 */
export function IntelField({
  copy,
  value,
  onValueChange,
  onSubmit,
  onPick,
  tab,
  inputRef,
  examples,
  autoFocus = false,
}: {
  copy: IntelligenceCopy;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (words: string) => void;
  onPick: (suggestion: Suggestion) => void;
  tab: IntelligenceTab;
  inputRef: RefObject<HTMLInputElement | null>;
  /** The rotating examples in the empty field. */
  examples: readonly string[];
  autoFocus?: boolean;
}) {
  const listId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [focused, setFocused] = useState(false);
  /* Closed by Escape or a submit, until the words change again. */
  const [dismissed, setDismissed] = useState(false);
  /* The active option belongs to one list: a new list starts with none. */
  const [activeOf, setActiveOf] = useState<{ list: string; index: number }>({ list: "", index: -1 });
  const mac = useIsMac();
  const fine = useFinePointer();
  const hint = useRotatingHint(examples.length, focused || value.length > 0);

  const suggest = useSuggest(value, tab, focused && !dismissed);
  const { groups, flat } = groupSuggestions(suggest.suggestions);
  const words = cleanWords(value);
  const open = focused && !dismissed && words.length > 0 && (flat.length > 0 || Boolean(suggest.didYouMean));

  /* The same options answered again (a refreshed list) keep the active one. */
  const listKey = flat.map((s) => s.key).join("|");
  const active = activeOf.list === listKey ? activeOf.index : -1;
  const setActive = (next: number | ((current: number) => number)) =>
    setActiveOf({ list: listKey, index: typeof next === "function" ? next(active) : next });

  /* On a touch screen, lift the field to the top as the list opens. */
  const lifted = useRef(false);
  useEffect(() => {
    if (!open) {
      lifted.current = false;
      return;
    }
    if (lifted.current) return;
    lifted.current = true;
    try {
      if (window.matchMedia("(pointer: coarse)").matches) formRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    } catch {
      /* Nothing to lift. */
    }
  }, [open]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, inputRef]);

  const pick = (suggestion: Suggestion) => {
    setDismissed(true);
    setActive(-1);
    onPick(suggestion);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (flat.length === 0) return;
        event.preventDefault();
        if (dismissed) setDismissed(false);
        setActive((i) => moveActive(i, event.key === "ArrowDown" ? 1 : -1, flat.length));
        return;
      }
      case "Enter": {
        if (open && active >= 0 && flat[active]) {
          event.preventDefault();
          pick(flat[active]);
        }
        return;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          setDismissed(true);
          setActive(-1);
        } else if (value) {
          event.preventDefault();
          onValueChange("");
        }
        return;
      }
      case "Tab":
        setDismissed(true);
        return;
      default:
        return;
    }
  };

  const optionId = (index: number) => `${listId}-o${index}`;
  const example = examples[hint] ?? examples[0] ?? "";

  return (
    <div className="nf-intel-combo" data-open={open || undefined}>
      <form
        ref={formRef}
        action="/intelligence"
        method="get"
        role="search"
        className="nf-intel-field"
        data-testid="intel-form"
        onSubmit={(event) => {
          event.preventDefault();
          setDismissed(true);
          setActive(-1);
          if (words) onSubmit(words);
        }}
      >
        <UiIcon name="search" size={22} className="nf-intel-field__glyph" />
        <span className="nf-intel-field__slot">
          <input
            ref={inputRef}
            id={`${listId}-input`}
            name="q"
            type="text"
            role="combobox"
            aria-label={copy.fieldLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={160}
            value={value}
            onChange={(event) => {
              setDismissed(false);
              onValueChange(event.target.value);
            }}
            onFocus={() => setFocused(true)}
            /* A tap on a suggestion lands before the blur would close the list. */
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onKeyDown={onKeyDown}
            className="nf-intel-field__input"
            data-testid="intel-input"
            data-intel-field=""
          />
          {value.length === 0 ? (
            <span className="nf-intel-field__hint" aria-hidden="true" key={hint} data-testid="intel-hint">
              {example}
            </span>
          ) : null}
        </span>
        {value.length === 0 ? (
          fine ? (
            <kbd className="nf-intel-kbd" aria-label={copy.shortcutLabel}>
              {mac ? copy.shortcutMac : copy.shortcutOther}
            </kbd>
          ) : null
        ) : (
          <button
            type="button"
            className="nf-intel-clear nf-tap"
            aria-label={copy.clear}
            data-testid="intel-clear"
            onClick={() => {
              onValueChange("");
              setDismissed(false);
              inputRef.current?.focus();
            }}
          >
            <UiIcon name="close" size={18} />
          </button>
        )}
        <button type="submit" className="nf-intel-go" aria-label={copy.go} data-testid="intel-go">
          <UiIcon name="arrow-right" size={20} />
        </button>
      </form>

      <div
        id={listId}
        role="listbox"
        aria-label={copy.suggest.label}
        className="nf-intel-suggest"
        hidden={!open}
        data-testid="intel-suggest"
        onMouseDown={(event) => event.preventDefault()}
      >
        {open && suggest.didYouMean ? (
          <p className="nf-intel-suggest__dym" role="presentation">
            {fill(copy.suggest.didYouMean, { query: suggest.didYouMean })}
          </p>
        ) : null}
        {open
          ? groups.map((group) => (
              <div key={group.key} role="group" aria-labelledby={`${listId}-g-${group.key}`} className="nf-intel-suggest__group">
                <p id={`${listId}-g-${group.key}`} className="nf-intel-overline" role="presentation">
                  {copy.suggest.groups[group.key]}
                </p>
                {group.items.map(({ suggestion, index }) => (
                  <div
                    key={suggestion.key}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    className="nf-intel-option"
                    data-testid="intel-option"
                    data-kind={suggestion.kind}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(suggestion)}
                  >
                    {suggestion.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a 40px engine thumbnail, already sized
                      <img src={suggestion.imageUrl} alt="" width={40} height={40} loading="lazy" decoding="async" className="nf-intel-option__thumb" />
                    ) : (
                      <span className="nf-intel-option__icon" aria-hidden="true">
                        <UiIcon name={SUGGESTION_ICON[suggestion.kind] ?? "search"} size={18} />
                      </span>
                    )}
                    <span className="nf-intel-option__text">
                      <span className="nf-intel-option__label">{suggestion.label}</span>
                      {suggestion.hint ? <span className="nf-intel-option__hint">{suggestion.hint}</span> : null}
                    </span>
                    <UiIcon name={suggestion.href ? "chevron-right" : "arrow-up-right"} size={16} className="nf-intel-option__go" />
                  </div>
                ))}
              </div>
            ))
          : null}
      </div>
    </div>
  );
}
