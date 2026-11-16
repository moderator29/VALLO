"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type RefObject } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { cleanWords } from "@/lib/intelligence/client";
import type { IntelligenceTab, Suggestion } from "@/lib/intelligence/contract";
import { fill, groupSuggestions, moveActive, type IntelligenceCopy } from "./model";
import { useFinePointer, useIsMac, useRotatingHint, useSuggest } from "./use-intel";
import { useDictation } from "@/components/app/assistant/use-dictation";
import { banner } from "@/lib/ui/toast";

/** Once per device: that the browser, not Vallo, turns the voice into words (`lib/consent/inventory.ts`). */
const MIC_NOTE_KEY = "nf_intel_mic_note";

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
 * The list hangs under the field, never pinned to the bottom, over the page
 * rather than in its flow (so nothing under it jumps as it opens), and never
 * taller than what is left of the screen above the phone's keyboard
 * (`visualViewport`): it scrolls inside itself instead, so its last option is
 * always reachable. On a touch screen the field scrolls itself to the top of
 * the view as the list opens.
 *
 * TYPING IS NEVER FOUGHT (the bug round of 16 November 2026):
 *   - a pointer only lights an option when it MOVES over it (a mouse), never
 *     because the list opened under a resting pointer or a finger: Enter then
 *     searched the typed words, not whatever happened to be under the tap;
 *   - an input method's composition (Chinese, Japanese, Korean, a phone's
 *     word composer) never submits, and its committing Enter, which Safari
 *     sends after `compositionend` as key 229, is not a search;
 *   - the clear, the mic and the options keep the caret in the field (no
 *     blur, so the phone's keyboard does not drop and rise again), and a
 *     blur that is taken straight back no longer closes the list for good;
 *   - speaking stops the moment the person types, and nothing heard after a
 *     search was sent is written over the field.
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
  onOpenChange,
  controlRef,
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
  /** Told each time the suggestions list opens or closes (the screen's Back closes it first). */
  onOpenChange?: (open: boolean) => void;
  /** Filled with a way to close the list from outside: the screen's back control. */
  controlRef?: MutableRefObject<{ close: () => void } | null>;
}) {
  const listId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  /* An input method's composition in progress, and when it last ended (Safari's committing Enter comes after). */
  const composing = useRef(false);
  const composedAt = useRef(0);
  const blurTimer = useRef<number | null>(null);
  /* Whether what the microphone hears may still be written into the field. */
  const voiceLive = useRef(false);
  /* Where the mouse last was over the list: an option lights only once it has really moved there. */
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [focused, setFocused] = useState(false);
  /* Closed by Escape or a submit, until the words change again. */
  const [dismissed, setDismissed] = useState(false);
  /* The active option belongs to one list: a new list starts with none. */
  const [activeOf, setActiveOf] = useState<{ list: string; index: number }>({ list: "", index: -1 });
  const mac = useIsMac();
  const fine = useFinePointer();
  const hint = useRotatingHint(examples.length, focused || value.length > 0);

  /* Speaking a search, where the browser can turn speech into words itself
     (the assistant's own hook). What is heard is added after what was
     typed, and nothing is searched until the person presses Search. */
  const spokenBase = useRef("");
  const dictation = useDictation({
    onText: (spoken) => {
      if (!voiceLive.current) return;
      const base = spokenBase.current;
      onValueChange((base && spoken ? `${base} ${spoken}` : base || spoken).slice(0, 160));
    },
    onRefused: () => banner.error(copy.voice.blocked),
  });
  const stopVoice = () => {
    voiceLive.current = false;
    if (dictation.listening) dictation.stop();
  };
  const toggleVoice = () => {
    if (!dictation.listening) {
      voiceLive.current = true;
      spokenBase.current = value.trim();
      try {
        if (!window.localStorage.getItem(MIC_NOTE_KEY)) {
          window.localStorage.setItem(MIC_NOTE_KEY, "1");
          banner.info(copy.voice.note);
        }
      } catch {
        /* Blocked storage: the note may show again next time, which is harmless. */
      }
    }
    dictation.toggle();
    /* On a phone the field is left alone: focusing it would raise the keyboard over what is being said. */
    if (fine) inputRef.current?.focus({ preventScroll: true });
  };

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
      lastPointer.current = null;
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

  /* Never taller than what is left above the keyboard: measured against the visual viewport. */
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const room = Math.floor(bottom - list.getBoundingClientRect().top - 12);
      list.style.setProperty("--nf-intel-suggest-max", `${Math.max(160, room)}px`);
    };
    const soon = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.visualViewport?.addEventListener("resize", soon);
    window.visualViewport?.addEventListener("scroll", soon);
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", soon);
      window.visualViewport?.removeEventListener("scroll", soon);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
    };
  }, [open]);

  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  useEffect(() => {
    onOpenChangeRef.current?.(open);
  }, [open]);

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      close: () => {
        setDismissed(true);
        setActiveOf({ list: "", index: -1 });
        inputRef.current?.blur();
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef, inputRef]);

  useEffect(
    () => () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, inputRef]);

  const pick = (suggestion: Suggestion) => {
    setDismissed(true);
    setActive(-1);
    onPick(suggestion);
  };

  /* Composition still running, or its committing Enter (Safari: key 229, just after `compositionend`). */
  const inComposition = (native: { isComposing?: boolean; keyCode?: number; timeStamp: number }) =>
    Boolean(native.isComposing) || composing.current || (native.keyCode === 229 && native.timeStamp - composedAt.current < 150);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (inComposition(event.nativeEvent)) {
      /* The Enter that chooses a word in an input method is never a search. */
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (flat.length === 0) {
          /* Closed with Escape: Down opens it again, and the caret does not jump to the end. */
          if (dismissed && words) {
            event.preventDefault();
            setDismissed(false);
          }
          return;
        }
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
    <div className="nf-intel-combo" data-open={open || undefined} data-listening={dictation.listening || undefined}>
      <form
        ref={formRef}
        action="/intelligence"
        method="get"
        role="search"
        className="nf-intel-field"
        data-testid="intel-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (composing.current) return;
          setDismissed(true);
          setActive(-1);
          stopVoice();
          const now = cleanWords(inputRef.current?.value ?? value) || words;
          if (now) onSubmit(now);
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
              /* Typing takes over from the microphone. */
              if (dictation.listening) stopVoice();
              onValueChange(event.target.value);
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              composedAt.current = event.timeStamp;
            }}
            onFocus={() => {
              if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
              blurTimer.current = null;
              setFocused(true);
            }}
            /* A tap on a suggestion lands before the blur would close the list;
               a blur taken straight back (the clear, the mic) closes nothing. */
            onBlur={() => {
              if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
              blurTimer.current = window.setTimeout(() => {
                blurTimer.current = null;
                if (document.activeElement !== inputRef.current) setFocused(false);
              }, 120);
            }}
            onKeyDown={onKeyDown}
            className="nf-intel-field__input"
            data-testid="intel-input"
            data-intel-field=""
          />
          {value.length === 0 ? (
            <span className="nf-intel-field__hint" aria-hidden="true" key={dictation.listening ? "listening" : hint} data-testid="intel-hint">
              {dictation.listening ? copy.voice.listening : example}
            </span>
          ) : null}
        </span>
        {dictation.supported ? (
          <button
            type="button"
            className="nf-intel-mic nf-tap"
            aria-label={dictation.listening ? copy.voice.stop : copy.voice.start}
            aria-pressed={dictation.listening}
            data-testid="intel-voice"
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggleVoice}
          >
            <UiIcon name={dictation.listening ? "mic-off" : "mic"} size={20} />
          </button>
        ) : null}
        {value.length === 0 ? (
          fine && !dictation.listening ? (
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
            /* The caret stays in the field: no blur, so a phone's keyboard does not drop and rise again. */
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              stopVoice();
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
        ref={listRef}
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
                    /* Only a mouse that MOVES lights an option: a list opening under a
                       resting pointer, or a finger's tap, must not choose what Enter takes. */
                    onPointerMove={(event) => {
                      if (event.pointerType !== "mouse") return;
                      const last = lastPointer.current;
                      lastPointer.current = { x: event.clientX, y: event.clientY };
                      /* A browser's own move under a pointer that has not moved (the list just drew there) does not count. */
                      if (!last || (last.x === event.clientX && last.y === event.clientY)) return;
                      if (index !== active) setActive(index);
                    }}
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
