"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import type { FilterKey, IntelFilters as FilterSet } from "@/lib/intelligence/client";
import type { IntelligenceTab, Understood } from "@/lib/intelligence/contract";
import { FILTER_FIELDS, digits, draftOf, filtersOfDraft, type Draft, type IntelligenceCopy } from "./model";

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
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: IntelligenceTab;
  /** What the open search understood, the person's own filters over the words. */
  current: Partial<Understood>;
  copy: IntelligenceCopy;
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
            enterKeyHint="done"
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
          <div className="nf-intel-filters__pair">
            {has("minPrice") ? (
              <TextField
                label={f.minPrice}
                value={draft.minPrice}
                onChange={(e) => put("minPrice", digits(e.target.value))}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                name="min"
              />
            ) : null}
            {has("maxPrice") ? (
              <TextField
                label={f.maxPrice}
                value={draft.maxPrice}
                onChange={(e) => put("maxPrice", digits(e.target.value))}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                name="max"
              />
            ) : null}
          </div>
        ) : null}
        {has("checkIn") || has("checkOut") ? (
          <div className="nf-intel-filters__pair">
            <TextField label={f.checkIn} value={draft.checkIn} onChange={(e) => put("checkIn", e.target.value)} type="date" name="in" autoComplete="off" />
            <TextField label={f.checkOut} value={draft.checkOut} onChange={(e) => put("checkOut", e.target.value)} type="date" name="out" autoComplete="off" />
          </div>
        ) : null}
        {has("guests") ? (
          <TextField
            label={f.guests}
            value={draft.guests}
            onChange={(e) => put("guests", digits(e.target.value).slice(0, 2))}
            type="text"
            inputMode="numeric"
            autoComplete="off"
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
