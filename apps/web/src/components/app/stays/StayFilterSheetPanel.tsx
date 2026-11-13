"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Sheet } from "@/components/ui/Sheet";
import {
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
  toStaysHref,
  type StaysQuery,
  type StaysSort,
} from "@/lib/stays/query";
import { ROOM_CATEGORIES, type RoomCategory } from "@/lib/stays/types";
import { ICON } from "@/components/app/Screen";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import type { StayFilterSheetProps } from "./StayFilterSheet";
import { useSelectPop } from "@/lib/motion/select-pop";
import "@/app/css/catalogue.css";

/**
 * The stays filter sheet's BODY. Its trigger is `StayFilterSheet`, which loads
 * this module only when the sheet is wanted (see `lib/ui/lazy-sheet.ts`).
 *
 * The property sheet's anatomy over BB's twelve
 * filters (`lib/stays/filters.ts` is the contract). Rating, room type, the
 * named facilities, breakfast, air conditioning, parking, Wi-Fi, verified,
 * free cancellation, near a landmark within a radius, the price range, the
 * dates and the party, and the sort. Apply builds the URL through
 * `toStaysHref`, so every choice is a link.
 *
 * The count on Apply is not drawn here: the projection answers on the
 * server, and a number this sheet cannot compute is a number it does not
 * print.
 */
type Draft = {
  q: string;
  near: string;
  radiusKm: number;
  checkIn: string;
  checkOut: string;
  guests: string;
  rooms: number;
  minNaira: string;
  maxNaira: string;
  minRating: number | undefined;
  roomCategories: RoomCategory[];
  facilities: string[];
  ac: boolean;
  parking: boolean;
  wifi: boolean;
  breakfast: boolean;
  freeCancellation: boolean;
  verified: boolean;
  sort: StaysSort;
};

const NAMED = new Set(["ac", "parking", "wifi"]);
const FACILITIES: { code: string; icon: UiIconName }[] = [
  { code: "pool", icon: "pool" },
  { code: "gym", icon: "bolt" },
  { code: "kitchen", icon: "kitchen" },
  { code: "security", icon: "verified" },
  { code: "generator", icon: "bolt" },
];
const RATINGS = [0, 3, 4, 4.5];
const CEILING_NAIRA = 1_000_000;
const STEP_NAIRA = 5_000;

function draftFrom(query: StaysQuery): Draft {
  return {
    q: query.q ?? "",
    near: query.near ?? "",
    radiusKm: Math.round(query.radiusM / 1000) || DEFAULT_RADIUS_KM,
    checkIn: query.checkIn ?? "",
    checkOut: query.checkOut ?? "",
    guests: query.guests === undefined ? "" : String(query.guests),
    rooms: query.rooms,
    minNaira: query.minPriceMinor === undefined ? "" : String(Math.round(query.minPriceMinor / 100)),
    maxNaira: query.maxPriceMinor === undefined ? "" : String(Math.round(query.maxPriceMinor / 100)),
    minRating: query.minRating,
    roomCategories: query.roomCategories,
    facilities: query.amenities.filter((code) => !NAMED.has(code)),
    ac: query.amenities.includes("ac"),
    parking: query.amenities.includes("parking"),
    wifi: query.amenities.includes("wifi"),
    breakfast: query.breakfast,
    freeCancellation: query.freeCancellation,
    verified: query.verified,
    sort: query.sort,
  };
}

function nairaOf(value: string): number | undefined {
  const clean = value.replace(/[^0-9]/g, "").slice(0, 9);
  if (!clean) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

function queryFrom(base: StaysQuery, draft: Draft): StaysQuery {
  let min = nairaOf(draft.minNaira);
  let max = nairaOf(draft.maxNaira);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  const amenities = [...draft.facilities];
  if (draft.ac) amenities.push("ac");
  if (draft.parking) amenities.push("parking");
  if (draft.wifi) amenities.push("wifi");
  const guests = nairaOf(draft.guests);
  const next: StaysQuery = {
    radiusM: draft.radiusKm * 1000,
    rooms: draft.rooms,
    roomCategories: draft.roomCategories,
    amenities,
    breakfast: draft.breakfast,
    freeCancellation: draft.freeCancellation,
    verified: draft.verified,
    sort: draft.sort,
    page: 1,
  };
  if (base.stateCode) next.stateCode = base.stateCode;
  if (base.city) next.city = base.city;
  if (base.area) next.area = base.area;
  if (draft.q.trim()) next.q = draft.q.trim();
  if (draft.near.trim()) next.near = draft.near.trim();
  if (draft.checkIn && draft.checkOut && draft.checkOut > draft.checkIn) {
    next.checkIn = draft.checkIn;
    next.checkOut = draft.checkOut;
  }
  if (guests !== undefined && guests > 0) next.guests = guests;
  // Kobo at the boundary and nowhere else.
  if (min !== undefined) next.minPriceMinor = Math.round(min) * 100;
  if (max !== undefined) next.maxPriceMinor = Math.round(max) * 100;
  if (draft.minRating !== undefined && draft.minRating > 0) next.minRating = draft.minRating;
  return next;
}

function Group({
  id,
  title,
  onClear,
  clearLabel,
  children,
}: {
  id: string;
  title: string;
  onClear?: () => void;
  clearLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="nf-filters__group">
      <div className="nf-filters__group-head">
        <h2 id={id} className="nf-filters__group-title">
          {title}
        </h2>
        {/*
          ALWAYS DRAWN, DISABLED WHEN THERE IS NOTHING TO CLEAR.

          3EB3E2A9 shows "Clear" beside every group heading. It used to appear
          only once the group had a value, which made every heading in the
          sheet jump sideways as a person touched the controls under it. It is
          drawn at rest now and genuinely disabled - the attribute, so the
          browser refuses the press, skips it in the tab order and announces it
          - rather than a live-looking control that does nothing. Its
          accessible name names its group, because nine controls all called
          "Clear" are nine identical announcements.
        */}
        <Button
          variant="quiet"
          size="sm"
          onClick={onClear}
          disabled={!onClear}
          aria-label={`${clearLabel}: ${title}`}
          data-testid={`${id}-clear`}
        >
          {clearLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  icon,
  label,
  checked,
  onChange,
  testId,
}: {
  icon: UiIconName;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  return (
    <div className="nf-filters__switch">
      <span className="nf-filters__switch-label">
        <UiIcon name={icon} size={ICON.inline} />
        <span className="min-w-0">{label}</span>
      </span>
      <span data-testid={testId} className="shrink-0">
        <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      </span>
    </div>
  );
}

export function StayFilterSheetPanel({
  query,
  locale,
  t,
  basePath = "/stays/search",
  extra = {},
  today,
  open,
  onClose,
}: StayFilterSheetProps & {
  /** Owned by the trigger (`StayFilterSheet`), which keeps this body mounted
      once it has been opened, so the draft survives closing and reopening. */
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  /* A chosen tile gives the small push the chip spec asks for (`select-pop.ts`). */
  useSelectPop();
  const copy = t.catalogue;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(query));

  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setDraft(draftFrom(query));
  }

  /* Escape, Back, the focus trap and its return to the opener, the scroll
     lock and drag or flick down to close are the platform's `Sheet`, in its
     page shape with the right-hand panel on a wide screen. */
  const close = onClose;

  const pending = useMemo(() => queryFrom(query, draft), [query, draft]);

  function hrefOf(next: StaysQuery): string {
    let href = toStaysHref(next, basePath);
    for (const [key, value] of Object.entries(extra)) {
      if (!value) continue;
      href += `${href.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
    }
    return href;
  }

  function apply() {
    router.push(hrefOf(pending));
    onClose();
  }

  function reset() {
    const cleared: StaysQuery = {
      radiusM: DEFAULT_RADIUS_KM * 1000,
      rooms: 1,
      roomCategories: [],
      amenities: [],
      breakfast: false,
      freeCancellation: false,
      verified: false,
      sort: "recommended",
      page: 1,
    };
    if (query.q) cleared.q = query.q;
    setDraft(draftFrom(cleared));
    router.push(hrefOf(cleared));
    onClose();
  }

  const sliderMin = Math.min(nairaOf(draft.minNaira) ?? 0, CEILING_NAIRA);
  const sliderMax = Math.min(nairaOf(draft.maxNaira) ?? CEILING_NAIRA, CEILING_NAIRA);

  const panel = (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={copy.filters.title}
      closeLabel={copy.filters.close}
      fullPage
      sideOnWide
      testId="stay-filters"
      footer={
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-xs border-t border-[var(--nf-panel-hair)] pt-sm">
          <Button variant="secondary" data-testid="stay-filters-reset" onClick={reset} full size="lg" className="whitespace-normal">
            {copy.filters.reset}
          </Button>
          <Button variant="primary" data-testid="stay-filters-apply" onClick={apply} full size="lg" className="whitespace-normal">
            {copy.filters.apply.replace(" ({count})", "")}
          </Button>
        </div>
      }
    >
          <div className="mx-auto max-w-2xl" data-select-pop="">
            {/* ------------------------------------------- dates and party */}
            <Group id="stay-dates" title={copy.stays.checkIn} clearLabel={copy.filters.clear}
              onClear={draft.checkIn || draft.checkOut ? () => setDraft((c) => ({ ...c, checkIn: "", checkOut: "" })) : undefined}>
              <div className="grid grid-cols-2 gap-xs">
                <label className="nf-filters__row">
                  <UiIcon name="calendar-booking" size={ICON.inline} />
                  <span className="sr-only">{copy.stays.checkIn}</span>
                  <input type="date" min={today} value={draft.checkIn} data-testid="stay-check-in"
                    onChange={(e) => setDraft((c) => ({ ...c, checkIn: e.target.value }))} className="nf-filters__row-input" />
                </label>
                <label className="nf-filters__row">
                  <UiIcon name="calendar-booking" size={ICON.inline} />
                  <span className="sr-only">{copy.stays.checkOut}</span>
                  <input type="date" min={draft.checkIn || today} value={draft.checkOut} data-testid="stay-check-out"
                    onChange={(e) => setDraft((c) => ({ ...c, checkOut: e.target.value }))} className="nf-filters__row-input" />
                </label>
              </div>
              <label className="nf-filters__row mt-xs">
                <UiIcon name="user" size={ICON.inline} />
                <span className="nf-filters__row-label">{copy.stays.guests}</span>
                <input type="number" inputMode="numeric" min={1} max={30} value={draft.guests} placeholder="2"
                  onChange={(e) => setDraft((c) => ({ ...c, guests: e.target.value }))} className="nf-filters__row-input text-right" />
              </label>
            </Group>

            {/* ------------------------------------------------ price */}
            <Group id="stay-price" title={copy.filters.priceRange} clearLabel={copy.filters.clear}
              onClear={draft.minNaira || draft.maxNaira ? () => setDraft((c) => ({ ...c, minNaira: "", maxNaira: "" })) : undefined}>
              <div className="nf-range" data-testid="stay-range">
                <span aria-hidden="true" className="nf-range__track" />
                <span aria-hidden="true" className="nf-range__fill"
                  style={{ left: `${(sliderMin / CEILING_NAIRA) * 100}%`, right: `${100 - (sliderMax / CEILING_NAIRA) * 100}%` }} />
                <input type="range" aria-label="Minimum nightly price" min={0} max={CEILING_NAIRA} step={STEP_NAIRA} value={sliderMin}
                  onChange={(e) => {
                    const next = Math.min(Number(e.target.value), sliderMax - STEP_NAIRA);
                    setDraft((c) => ({ ...c, minNaira: next <= 0 ? "" : String(next) }));
                  }} className="nf-range__input" />
                <input type="range" aria-label="Maximum nightly price" min={0} max={CEILING_NAIRA} step={STEP_NAIRA} value={sliderMax}
                  onChange={(e) => {
                    const next = Math.max(Number(e.target.value), sliderMin + STEP_NAIRA);
                    setDraft((c) => ({ ...c, maxNaira: next >= CEILING_NAIRA ? "" : String(next) }));
                  }} className="nf-range__input" />
              </div>
              <div className="nf-filters__range-labels nf-numeric">
                <span>{formatMoney(sliderMin * 100, locale)}</span>
                <span>{sliderMax >= CEILING_NAIRA ? `${formatMoney(CEILING_NAIRA * 100, locale)}+` : formatMoney(sliderMax * 100, locale)}</span>
              </div>
            </Group>

            {/* ------------------------------------------------ rating */}
            <Group id="stay-rating" title={copy.stays.rating} clearLabel={copy.filters.clear}
              onClear={draft.minRating ? () => setDraft((c) => ({ ...c, minRating: undefined })) : undefined}>
              <div className="nf-filters__grid nf-filters__grid--5" role="group">
                {RATINGS.map((value) => {
                  const on = (draft.minRating ?? 0) === value;
                  return (
                    <button key={value} type="button" aria-pressed={on} data-testid={`stay-rating-${value}`}
                      onClick={() => setDraft((c) => ({ ...c, minRating: value || undefined }))} className="nf-filters__tile">
                      {value === 0 ? copy.stays.anyRating : (<><UiIcon name="star" size={16} filled />{value}+</>)}
                    </button>
                  );
                })}
              </div>
            </Group>

            {/* --------------------------------------------- room type */}
            <Group id="stay-room" title={copy.stays.roomType} clearLabel={copy.filters.clear}
              onClear={draft.roomCategories.length > 0 ? () => setDraft((c) => ({ ...c, roomCategories: [] })) : undefined}>
              <div className="nf-filters__grid nf-filters__grid--3" role="group">
                {ROOM_CATEGORIES.map((category) => {
                  const on = draft.roomCategories.includes(category);
                  return (
                    <button key={category} type="button" aria-pressed={on} data-testid={`stay-room-${category}`}
                      onClick={() => setDraft((c) => ({ ...c, roomCategories: on ? c.roomCategories.filter((v) => v !== category) : [...c.roomCategories, category] }))}
                      className="nf-filters__tile">
                      {t.stayDetail.category[category]}
                    </button>
                  );
                })}
              </div>
            </Group>

            {/* --------------------------------------------- amenities */}
            <Group id="stay-amenities" title={copy.filters.amenities} clearLabel={copy.filters.clear}
              onClear={draft.facilities.length > 0 || draft.ac || draft.parking || draft.wifi || draft.breakfast
                ? () => setDraft((c) => ({ ...c, facilities: [], ac: false, parking: false, wifi: false, breakfast: false })) : undefined}>
              <div className="divide-y divide-[var(--nf-divider)]">
                <SwitchRow icon="wifi" label="Wi-Fi" checked={draft.wifi} testId="stay-wifi" onChange={(v) => setDraft((c) => ({ ...c, wifi: v }))} />
                <SwitchRow icon="snowflake" label="Air conditioning" checked={draft.ac} testId="stay-ac" onChange={(v) => setDraft((c) => ({ ...c, ac: v }))} />
                <SwitchRow icon="parking" label="Parking" checked={draft.parking} testId="stay-parking" onChange={(v) => setDraft((c) => ({ ...c, parking: v }))} />
                <SwitchRow icon="utensils" label={copy.stays.breakfast} checked={draft.breakfast} testId="stay-breakfast" onChange={(v) => setDraft((c) => ({ ...c, breakfast: v }))} />
                {FACILITIES.map((facility) => (
                  <SwitchRow key={facility.code} icon={facility.icon} label={facility.code.charAt(0).toUpperCase() + facility.code.slice(1)}
                    checked={draft.facilities.includes(facility.code)} testId={`stay-facility-${facility.code}`}
                    onChange={(v) => setDraft((c) => ({ ...c, facilities: v ? [...c.facilities, facility.code] : c.facilities.filter((x) => x !== facility.code) }))} />
                ))}
              </div>
            </Group>

            {/* ------------------------------------------------ trust */}
            <Group id="stay-trust" title={copy.filters.trust} clearLabel={copy.filters.clear}
              onClear={draft.verified || draft.freeCancellation
                ? () => setDraft((c) => ({ ...c, verified: false, freeCancellation: false })) : undefined}>
              <div className="divide-y divide-[var(--nf-divider)]">
                <SwitchRow icon="verified" label={copy.stays.verified} checked={draft.verified} testId="stay-verified" onChange={(v) => setDraft((c) => ({ ...c, verified: v }))} />
                <SwitchRow icon="history" label={copy.stays.freeCancellation} checked={draft.freeCancellation} testId="stay-free-cancellation" onChange={(v) => setDraft((c) => ({ ...c, freeCancellation: v }))} />
              </div>
            </Group>

            {/* ------------------------------------------- location */}
            <Group id="stay-location" title={copy.filters.location} clearLabel={copy.filters.clear}
              onClear={draft.q || draft.near ? () => setDraft((c) => ({ ...c, q: "", near: "" })) : undefined}>
              <label className="nf-filters__row">
                <UiIcon name="location" size={ICON.inline} />
                <span className="sr-only">{copy.filters.location}</span>
                <input type="search" enterKeyHint="search" value={draft.q} data-testid="stay-q" placeholder={copy.filters.locationPlaceholder}
                  onChange={(e) => setDraft((c) => ({ ...c, q: e.target.value }))} className="nf-filters__row-input" />
              </label>
              <label className="nf-filters__row mt-xs">
                <UiIcon name="map" size={ICON.inline} />
                <span className="sr-only">{copy.stays.nearLandmark}</span>
                <input type="search" enterKeyHint="search" value={draft.near} data-testid="stay-near" placeholder={copy.stays.nearLandmark}
                  onChange={(e) => setDraft((c) => ({ ...c, near: e.target.value }))} className="nf-filters__row-input" />
              </label>
              {draft.near.trim() && (
                <div className="mt-xs">
                  <input type="range" aria-label={copy.stays.withinKm.replace("{km}", String(draft.radiusKm))} min={1} max={MAX_RADIUS_KM} value={draft.radiusKm}
                    onChange={(e) => setDraft((c) => ({ ...c, radiusKm: Number(e.target.value) }))} className="w-full" />
                  <p className="nf-filters__hint mt-2xs">{copy.stays.withinKm.replace("{km}", String(draft.radiusKm))}</p>
                </div>
              )}
            </Group>

            {/* ---------------------------------------------------- sort */}
            {/* Clearing a sort is returning to the order the shelf opens in. */}
            <Group id="stay-sort" title={copy.filters.sortBy} clearLabel={copy.filters.clear}
              onClear={draft.sort !== "recommended"
                ? () => setDraft((c) => ({ ...c, sort: "recommended" })) : undefined}>
              <label className="nf-filters__row">
                <UiIcon name="sliders" size={ICON.inline} />
                <span className="sr-only">{copy.filters.sortBy}</span>
                <select value={draft.sort} data-testid="stay-sort" onChange={(e) => setDraft((c) => ({ ...c, sort: e.target.value as StaysSort }))} className="nf-filters__row-select">
                  <option value="recommended">{t.stays.sortRecommended}</option>
                  <option value="price-asc">{t.stays.sortPriceAsc}</option>
                  <option value="price-desc">{t.stays.sortPriceDesc}</option>
                  <option value="top-rated">{t.stays.sortRating}</option>
                  <option value="distance">{copy.stays.sortDistance}</option>
                </select>
                <UiIcon name="chevron-down" size={16} className="text-[var(--nf-content-muted)]" />
              </label>
            </Group>
          </div>
    </Sheet>
  );

  return panel;
}
