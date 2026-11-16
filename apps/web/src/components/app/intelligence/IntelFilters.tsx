"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import type { FilterKey, IntelFilters as FilterSet } from "@/lib/intelligence/client";
import type { IntelligenceTab, Understood } from "@/lib/intelligence/contract";
import { FILTER_FIELDS, caretAfterDigits, digits, draftOf, filtersOfDraft, groupedAmount, lagosToday, type Draft, type IntelligenceCopy } from "./model";

/* Return on a phone's keyboard in a filter field puts the keyboard away; it does not apply. */
const doneOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.blur();
};

/**
 * AN AMOUNT IN NAIRA, GROUPED AS IT IS TYPED ("1,500,000"), WITH THE CARET
 * WHERE THE PERSON PUT IT. The draft keeps only the digits; the field shows
 * them grouped; after each change the caret is put back after the same
 * number of digits, so typing in the middle never throws it to the end. A
 * Backspace over a separator takes the digit before it, as a person means.
 * A text field with the number keypad, never `type=number` (which refuses a
 * comma, scrolls the value on a wheel and reads back as NaN).
 */
function AmountField({ label, value, onValue, name, locale }: { label: string; value: string; onValue: (digits: string) => void; name: string; locale: Locale }) {
  const caret = useRef<{ el: HTMLInputElement; digits: number } | null>(null);
  useLayoutEffect(() => {
    const at = caret.current;
    if (!at) return;
    caret.current = null;
    if (document.activeElement !== at.el) return;
    const pos = caretAfterDigits(at.el.value, at.digits);
    try {
      at.el.setSelectionRange(pos, pos);
    } catch {
      /* A field that cannot hold a selection. */
    }
  });
  return (
    <TextField
      label={label}
      value={groupedAmount(value, locale)}
      onChange={(event) => {
        const el = event.target;
        const end = el.selectionStart ?? el.value.length;
        let next = digits(el.value);
        let before = digits(el.value.slice(0, end)).length;
        const deleting = (event.nativeEvent as InputEvent).inputType === "deleteContentBackward";
        if (deleting && next === value && before > 0) {
          next = next.slice(0, before - 1) + next.slice(before);
          before -= 1;
        }
        caret.current = { el, digits: before };
        onValue(next);
      }}
      onKeyDown={doneOnEnter}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      name={name}
    />
  );
}

/**
 * THE FILTERS FOR ONE TAB, in the app's own sheet (`Sheet`): a page sliding
 * up from the bottom on a phone, a panel docked to the right on a wide
 * screen, the way every filter drawer on Vallo sits. It opens on what the
 * search already understood, so the drawer and the chips never disagree,
 * and Apply is a new address like every other change.
 */
export function IntelFilters({
  open,
  onOpenChange,
  tab,
  current,
  copy,
  locale,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: IntelligenceTab;
  /** What the open search understood, the person's own filters over the words. */
  current: Partial<Understood>;
  copy: IntelligenceCopy;
  locale: Locale;
  onApply: (set: FilterSet, cleared: FilterKey[]) => void;
}) {
  const f = copy.filters;
  const fields = FILTER_FIELDS[tab];
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  /* Each time the drawer opens, it starts from what the search understood
     (state adjusted while rendering, React's own pattern for "reset on a
     prop change", rather than an effect that draws the old draft first). */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(draftOf(current));
  }

  const put = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  /* The Lagos calendar's today, the earliest a stay can start. */
  const [today] = useState(() => lagosToday());
  const has = (key: FilterKey) => fields.includes(key);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={f.title}
      fullPage
      sideOnWide
      closeLabel={copy.close}
      reset={{ label: f.reset, onClick: () => setDraft(draftOf({})) }}
      apply={{
        label: f.apply,
        onClick: () => {
          const { set, cleared } = filtersOfDraft(draft, fields);
          onApply(set, cleared);
          onOpenChange(false);
        },
      }}
      className="nf-intel-sheet"
      testId="intel-filters"
    >
      <div className="nf-intel-filters">
        {has("intent") ? (
          <Segmented
            semantics="radio"
            label={f.intent}
            value={draft.intent || "any"}
            onChange={(v) => put("intent", v === "any" ? "" : (v as "rent" | "buy"))}
            options={[
              { value: "any", label: f.intentAny },
              { value: "rent", label: f.intentRent },
              { value: "buy", label: f.intentBuy },
            ]}
            full
          />
        ) : null}
        {has("place") ? (
          <TextField
            label={f.place}
            hint={f.placeHint}
            value={draft.place}
            onChange={(e) => put("place", e.target.value.slice(0, 60))}
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            enterKeyHint="done"
            onKeyDown={doneOnEnter}
            maxLength={60}
            name="place"
          />
        ) : null}
        {has("bedrooms") ? (
          <Segmented
            semantics="radio"
            label={f.bedrooms}
            value={draft.bedrooms || "any"}
            onChange={(v) => put("bedrooms", v === "any" ? "" : v)}
            options={[
              { value: "any", label: f.bedroomsAny },
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
              { value: "5", label: "5+" },
            ]}
            full
          />
        ) : null}
        {has("minPrice") || has("maxPrice") ? (
          /* Side by side only when there are two: a lone highest price takes the row. */
          <div className={has("minPrice") && has("maxPrice") ? "nf-intel-filters__pair" : undefined}>
            {has("minPrice") ? <AmountField label={f.minPrice} value={draft.minPrice} onValue={(v) => put("minPrice", v)} name="min" locale={locale} /> : null}
            {has("maxPrice") ? <AmountField label={f.maxPrice} value={draft.maxPrice} onValue={(v) => put("maxPrice", v)} name="max" locale={locale} /> : null}
          </div>
        ) : null}
        {has("checkIn") || has("checkOut") ? (
          <div className="nf-intel-filters__pair">
            {/* Never a day before today in Lagos, and a check out never on or before the check in:
                moving the check in past it clears it, rather than leaving a stay that ends first. */}
            <TextField
              label={f.checkIn}
              value={draft.checkIn}
              onChange={(e) => {
                const value = e.target.value;
                setDraft((d) => ({ ...d, checkIn: value, checkOut: d.checkOut && value && d.checkOut <= value ? "" : d.checkOut }));
              }}
              type="date"
              min={today}
              name="in"
              autoComplete="off"
            />
            <TextField
              label={f.checkOut}
              value={draft.checkOut}
              onChange={(e) => put("checkOut", e.target.value)}
              type="date"
              min={draft.checkIn ? nextDay(draft.checkIn) : today}
              name="out"
              autoComplete="off"
            />
          </div>
        ) : null}
        {has("guests") ? (
          <TextField
            label={f.guests}
            value={draft.guests}
            onChange={(e) => put("guests", digits(e.target.value).slice(0, 2))}
            onKeyDown={doneOnEnter}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            name="guests"
          />
        ) : null}
        {has("furnished") ? (
          <label className="nf-intel-check">
            <input type="checkbox" checked={draft.furnished} onChange={(e) => put("furnished", e.target.checked)} />
            <span>{f.furnished}</span>
          </label>
        ) : null}
      </div>
    </Sheet>
  );
}

/** The day after an ISO date, as an ISO date (calendar arithmetic in UTC, which has no daylight saving). */
function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
