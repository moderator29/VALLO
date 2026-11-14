"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { useRouter } from "next/navigation";
import { formatMoney, formatNumber } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconTiles } from "./IconTiles";
import { RadioPills } from "./RadioPills";
import { PriceSpread } from "./PriceSpread";
import { BudgetInCurrency } from "@/components/currency/BudgetInCurrency";
import { liveMatchCount, seeHomesLabel } from "./filter-count";
import { priceFigures } from "@/lib/search/price-histogram";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { BrandIcon, type BrandIconProp } from "@/design-system/icons/BrandIcon";
import { SPACE_OBJECT } from "@/components/app/home/space-types";
import { BQ_OBJECT, SHAPE_OBJECT } from "./shape-objects";
import { priceScale } from "@/lib/listings/price-bounds";
import { hasBackupPower, rentMeansTenancy } from "@/lib/listings/filter";

import { UNIT_SHAPES, takesShape, type UnitShape } from "@/lib/listings/unit-shape";
import { RUSH_WITHIN, commuteCount } from "@/lib/listings/commute";

/* V-65: the drawer's one upfront choice, "One year upfront at most". */
const ONE_YEAR = 12;
import {
  WATER_SOURCES,
  type ListingIntent,
  type ListingKind,
  type WaterSupply,
} from "@/lib/listings/types";
import {
  LISTING_ROLES,
  LISTING_ROLE_FILTER_HEADING,
  LISTING_ROLE_FILTER_LABEL,
  type ListingRole,
} from "@/lib/supply/roles";
import {
  KIND_ORDER,
  SORTS,
  sortBasisOf,
  kindLabel,
  koboToNaira,
  nairaToKobo,
  WATER_LABEL,
  type SortKey,
} from "@/lib/listings/search-params";
import {
  clearedShelf,
  shelfFilter,
  staySideHref,
  toShelfHref,
  type ShelfQuery,
} from "@/components/app/search/shelf-query";
import { amenityLabel, sortAmenityCodes } from "./amenities";
import { ICON } from "@/components/app/Screen";
import type { FilterDrawerProps } from "./FilterDrawer";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { isDataSaver } from "@/lib/ui/data-saver";
import { useSelectPop } from "@/lib/motion/select-pop";
import "@/app/css/catalogue.css";

/**
 * The filter sheet's BODY, to the right-hand panel of 3EB3E2A9. Its trigger is
 * `FilterDrawer`, which loads this module only when the sheet is wanted (see
 * `lib/ui/lazy-sheet.ts`), so none of it is in the first load of /search.
 *
 * Property type as a row of tiles, the market as Buy and Rent, the price
 * range on the two-handled slider, Bedrooms and Bathrooms as Any 1+ 2+ 3+
 * 4+, the amenities as switches, then the location and sort rows and the
 * Reset and Apply pair with the live count on Apply.
 *
 * THE POOL LOGIC IS UNCHANGED. Every option is offered only where the pool
 * (the whole catalogue for the current text) can answer it, and the count on
 * Apply is computed in the browser from the same `matchesFacts` the server
 * uses, so the number a person presses is the number they get.
 */

/** The markets the Market group offers; see `marketOptions`. */
type Market = ListingIntent;
/** The segmented control's answers: the two Property markets, and Shortlet, which opens the Stays search. */
type MarketChoice = Market | "shortlet";

type Draft = {
  q: string;
  kind?: ListingKind;
  intent?: ListingIntent;
  sort: SortKey;
  minNaira: string;
  maxNaira: string;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  amenities: string[];
  instantBook: boolean;
  verifiedOnly: boolean;
  powerBackup: boolean;
  powerBandA: boolean;
  waterSupply: WaterSupply[];
  listerRoles: ListingRole[];
  landlordAway: boolean;
  parkingInside: boolean;
  servicedOnly: boolean;
  gatedEstate: boolean;
  /** V-65: at most this many months up front; absent means not asked. */
  maxUpfront?: number;
  /** V-66: the shapes the reader will take, any of them. */
  shapes: UnitShape[];
  withBq: boolean;
  /** V-41: no flooding reported. */
  noFlood: boolean;
  /** V-43: the anchor's slug, and whether the rush-hour limit is on. */
  to: string;
  withinOn: boolean;
};

function draftFrom(query: ShelfQuery): Draft {
  return {
    q: query.q ?? "",
    ...(query.kind !== undefined ? { kind: query.kind } : {}),
    ...(query.intent !== undefined ? { intent: query.intent } : {}),
    sort: query.sort,
    minNaira: query.minMinor === undefined ? "" : String(koboToNaira(query.minMinor)),
    maxNaira: query.maxMinor === undefined ? "" : String(koboToNaira(query.maxMinor)),
    bedrooms: query.bedrooms ?? 0,
    bathrooms: query.bathrooms ?? 0,
    guests: query.guests ?? 0,
    amenities: query.amenities,
    instantBook: query.instantBook,
    verifiedOnly: query.verifiedOnly,
    powerBackup: query.powerBackup,
    powerBandA: query.powerBandA,
    waterSupply: query.waterSupply,
    listerRoles: query.listerRoles,
    landlordAway: query.landlordAway,
    parkingInside: query.parkingInside,
    servicedOnly: query.servicedOnly,
    gatedEstate: query.gatedEstate,
    ...(query.maxUpfront !== undefined ? { maxUpfront: query.maxUpfront } : {}),
    shapes: query.shapes ?? [],
    withBq: query.withBq === true,
    noFlood: query.noFlood === true,
    to: query.to ?? "",
    withinOn: query.within !== undefined,
  };
}

function digits(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 9);
}

function nairaOf(value: string): number | undefined {
  const clean = digits(value);
  if (clean.length === 0) return undefined;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function queryFrom(base: ShelfQuery, draft: Draft): ShelfQuery {
  let min = nairaOf(draft.minNaira);
  let max = nairaOf(draft.maxNaira);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  const next: ShelfQuery = {
    sort: draft.sort,
    view: base.view,
    amenities: draft.amenities,
    instantBook: draft.instantBook,
    verifiedOnly: draft.verifiedOnly,
    powerBackup: draft.powerBackup,
    powerBandA: draft.powerBandA,
    waterSupply: draft.waterSupply,
    listerRoles: draft.listerRoles,
    landlordAway: draft.landlordAway,
    parkingInside: draft.parkingInside,
    servicedOnly: draft.servicedOnly,
    gatedEstate: draft.gatedEstate,
  };
  const q = draft.q.trim();
  if (q.length > 0) next.q = q;
  if (draft.kind) next.kind = draft.kind;
  if (draft.intent) next.intent = draft.intent;
  if (min !== undefined) next.minMinor = nairaToKobo(min);
  if (max !== undefined) next.maxMinor = nairaToKobo(max);
  if (draft.bedrooms > 0) next.bedrooms = draft.bedrooms;
  if (draft.bathrooms > 0) next.bathrooms = draft.bathrooms;
  if (draft.guests > 0) next.guests = draft.guests;
  /* The upfront limit only means something on the Rent market's tenancies. */
  if (draft.maxUpfront !== undefined && rentMeansTenancy(draft)) next.maxUpfront = draft.maxUpfront;
  /* V-66: shapes only mean something for homes; areas are the address's own. */
  const homes = !draft.kind || takesShape(draft.kind);
  if (homes && draft.shapes.length > 0) next.shapes = draft.shapes;
  if (homes && draft.withBq) next.withBq = true;
  if (base.areas && base.areas.length > 0) next.areas = base.areas;
  if (draft.noFlood) next.noFlood = true;
  if (draft.to) {
    next.to = draft.to;
    if (draft.withinOn) next.within = RUSH_WITHIN;
  }
  return next;
}

/* Any, then 1+ to 5+, as the reference draws them. Zero is "any", which the
   query does not carry. */
const ROOM_STEPS: number[] = [0, 1, 2, 3, 4, 5];

/* The segmented control's order, the reference's: rent, sale, shortlet. */
const MARKET_ORDER: readonly string[] = ["rent", "sale", "shortlet"];

const AMENITY_ICON: Record<string, UiIconName> = {
  pool: "pool",
  gym: "bolt",
  security: "verified",
  generator: "bolt",
  furnished: "home",
  parking: "parking",
  wifi: "wifi",
  kitchen: "kitchen",
  ac: "snowflake",
  water: "droplet",
};

/*
 * THE GLYPH FOR EACH ANSWER in the property type and space tiles (track J).
 * Every kind and every shape has one from the UI glyph family: the fallback
 * under the realistic 3D objects (`SPACE_OBJECT`, `SHAPE_OBJECT`) the tiles
 * draw first since 13 October 2026.
 */
const KIND_ICON: Record<ListingKind | "all", UiIconName> = {
  all: "grid",
  hotel: "building-hotel",
  apartment: "building-apartment",
  home: "house",
  shortlet: "calendar-booking",
  villa: "pool",
  rental: "key",
  shop: "storefront",
  office: "briefcase",
  land: "land-plot",
  restaurant: "utensils",
  experience: "ticket",
};
/** The founder's clay 3D object for the stay and food kinds the sheets draw. */
const KIND_ART: Partial<Record<ListingKind, Icon3DName>> = {
  hotel: "hotel",
  shortlet: "shortlet",
  restaurant: "restaurant",
};
/** The realistic 3D object for each property type: the "Spaces for you" set. */
function kindObject(kind: ListingKind): BrandIconProp | undefined {
  /* The stays' types draw the same realistic family as the property types:
     the serviced block for a shortlet and the hotel the Stays tiles draw. A
     restaurant has no realistic object and keeps its 3D one. */
  const stays: Partial<Record<string, BrandIconProp>> = { shortlet: "serviced-block", hotel: "hotel" };
  return (SPACE_OBJECT as Partial<Record<string, BrandIconProp>>)[kind] ?? stays[kind];
}
const SHAPE_ICON: Record<UnitShape, UiIconName> = {
  self_contain: "door",
  room_parlour: "bed",
  mini_flat: "key",
  flat: "building-apartment",
  duplex: "house-duplex",
  terrace: "house-terrace",
  semi_detached: "home",
  detached: "house",
  bungalow: "house-bungalow",
  maisonette: "house-duplex",
  penthouse: "tower-penthouse",
  boys_quarters: "door",
};

function Group({
  id,
  title,
  onClear,
  clearLabel,
  hint,
  children,
}: {
  id: string;
  title: string;
  onClear?: () => void;
  clearLabel: string;
  hint?: string;
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
      {hint && <p className="nf-filters__hint">{hint}</p>}
      {children}
    </section>
  );
}

function SwitchRow({
  icon,
  object,
  label,
  hint,
  checked,
  onChange,
  testId,
}: {
  icon: UiIconName;
  /** A realistic 3D object drawn in the glyph's place (32px, fixed box). */
  object?: BrandIconProp;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  return (
    <div className="nf-filters__switch">
      <span className="nf-filters__switch-label">
        {object ? (
          <span className="grid size-8 shrink-0 place-items-center" aria-hidden="true" data-object={object} data-host-plate>
            <BrandIcon name={object} size={32} preferRender />
          </span>
        ) : (
          <UiIcon name={icon} size={ICON.inline} />
        )}
        <span className="min-w-0">
          {label}
          {hint && <span className="nf-filters__switch-hint">{hint}</span>}
        </span>
      </span>
      <span data-testid={testId} className="shrink-0">
        <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      </span>
    </div>
  );
}

/* `router.prefetch`'s option for the whole page rather than its loading shell,
   typed from `useRouter` itself so no internal Next module is imported. */
const WHOLE = { kind: "full" } as unknown as NonNullable<
  Parameters<ReturnType<typeof useRouter>["prefetch"]>[1]
>;

export function FilterDrawerPanel({
  query,
  facts,
  locale,
  copy,
  costCopy,
  compoundCopy,
  sortCopy,
  serviceCopy,
  cashCopy,
  unitCopy,
  feesBasis,
  anchors = [],
  commuteCopy,
  kindCopy,
  noFloodLabel,
  searchCopy,
  open,
  onClose,
}: FilterDrawerProps & {
  /** Owned by the trigger (`FilterDrawer`), which keeps this body mounted
      once it has been opened, so the draft survives closing and reopening. */
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  /* A chosen tile gives the small push the chip spec asks for (`select-pop.ts`). */
  useSelectPop();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(query));

  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setDraft(draftFrom(query));
  }

  /* Escape, Back, the focus trap and its return to the opener, the counted
     scroll lock and drag or flick down to close are the platform's `Sheet`,
     in its page shape with the right-hand panel on a wide screen. This used
     to be a hand-built `fixed inset-0` panel with a painted grip that did not
     drag. */
  const close = onClose;

  const kindOptions = useMemo(() => {
    const present = new Set<ListingKind>();
    for (const fact of facts) present.add(fact.kind);
    if (draft.kind) present.add(draft.kind);
    return KIND_ORDER.filter((kind) => present.has(kind));
  }, [facts, draft.kind]);

  /*
   * BUY AND RENT: the Property side's two markets, each a `listing_intent`
   * value. Shortlet was a third and left with the stays (V-67). Buy is
   * offered only where the pool holds something it could return.
   */
  const marketOptions = useMemo(() => {
    const sale = facts.some((fact) => fact.intent === "sale") || draft.intent === "sale";
    const options: { value: Market; label: string; icon: UiIconName }[] = [];
    /*
     * BUY IS THE HOUSE AND RENT IS THE KEY, and these two were the other way
     * round.
     *
     * `components/site/landing/SearchPill.tsx` draws `buy` with the house and
     * `rent` with the key, which is what the governing hero shows; this drawer
     * drew Buy with the key and Rent with the house. Two surfaces two taps
     * apart teaching a person opposite things about the same two words. The
     * hero settles it, so this is the side that moves. (R1 finding A14.)
     */
    if (sale) options.push({ value: "sale", label: "Buy", icon: "home" });
    options.push({ value: "rent", label: "Rent", icon: "key" });
    /* No Shortlet: a shortlet is a stay and lives on the Stays side (V-67). */
    return options;
  }, [facts, draft.intent]);

  /* Which market the draft currently stands on. */
  const market: Market | undefined = draft.intent;

  const amenityOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const fact of facts) for (const code of fact.amenities) codes.add(code);
    for (const code of draft.amenities) codes.add(code);
    return sortAmenityCodes([...codes]);
  }, [facts, draft.amenities]);

  const utilityOptions = useMemo(() => {
    let backup = draft.powerBackup;
    let bandA = draft.powerBandA;
    const water = new Set<WaterSupply>(draft.waterSupply);
    for (const fact of facts) {
      if (hasBackupPower(fact)) backup = true;
      if (fact.utilities?.powerGrid === "BAND_A") bandA = true;
      const source = fact.utilities?.waterSupply;
      if (source !== undefined && source !== "NONE") water.add(source);
    }
    return { backup, bandA, water: WATER_SOURCES.filter((value) => water.has(value)) };
  }, [facts, draft.powerBackup, draft.powerBandA, draft.waterSupply]);
  const showUtilities =
    utilityOptions.backup || utilityOptions.bandA || utilityOptions.water.length > 0;

  /* V-28. The compound filters are strict about silence, so they are offered
     only when the pool in front of the reader holds an answer, the same rule
     light and water follow: a switch that can only ever return nothing is a
     dead end. A switch already on is always shown, so it can be turned off. */
  const compoundOptions = useMemo(() => {
    let landlord = draft.landlordAway;
    let parking = draft.parkingInside;
    for (const fact of facts) {
      if (fact.compound?.landlordOnSite === false) landlord = true;
      if (fact.compound?.parkingType === "inside") parking = true;
    }
    return { landlord, parking };
  }, [facts, draft.landlordAway, draft.parkingInside]);

  /* V-68. The same rule for Serviced and the gated estate. */
  /* V-41: offered only when the page could judge flooding (flag on). */
  const floodJudged = useMemo(() => facts.some((fact) => fact.floodClear !== undefined), [facts]);
  const serviceOptions = useMemo(() => {
    let serviced = draft.servicedOnly;
    let gated = draft.gatedEstate;
    for (const fact of facts) {
      if (fact.service?.serviced) serviced = true;
      if (fact.service?.estateType === "gated_estate") gated = true;
    }
    return { serviced, gated };
  }, [facts, draft.servicedOnly, draft.gatedEstate]);

  /* V-66: the shapes the pool holds, in the list's order, plus any already
     chosen, so a chip never offers an empty result by construction. */
  const shapeOptions = useMemo(() => {
    const present = new Set<UnitShape>(draft.shapes);
    let bq = draft.withBq;
    for (const fact of facts) {
      if (fact.unit?.shape) present.add(fact.unit.shape);
      if (fact.unit?.hasBq) bq = true;
    }
    return { shapes: UNIT_SHAPES.filter((shape) => present.has(shape)), bq };
  }, [facts, draft.shapes, draft.withBq]);
  const toggleShape = useCallback((shape: UnitShape) => {
    setDraft((current) => ({
      ...current,
      shapes: UNIT_SHAPES.filter((s) => (s === shape ? !current.shapes.includes(s) : current.shapes.includes(s))),
    }));
  }, []);

  const pending = useMemo(() => queryFrom(query, draft), [query, draft]);

  /*
   * THE RESULTS ARE READY BEFORE THE TAP (Track M performance).
   *
   * "Show N results" navigated only when it was pressed, so the shelf's
   * skeleton filled the screen while the server drew the new list: the
   * loading the founder saw on Search. The page the sheet will open is
   * fetched whole once the choice has been still for a moment, and so is the
   * one Reset opens, so either lands at once. About 35 KB a fetch on the wire;
   * nothing is fetched ahead under data saving.
   */
  const target = toShelfHref(pending);
  const resetTarget = toShelfHref(clearedShelf(query));
  useEffect(() => {
    if (!open || isDataSaver()) return;
    const timer = window.setTimeout(() => {
      router.prefetch(target, WHOLE);
      router.prefetch(resetTarget, WHOLE);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [open, router, target, resetTarget]);
  /* V-43: the pool carries bands to the anchor the shelf was loaded with, so
     "within" is counted only for that anchor; a newly chosen one is counted
     after Apply, and the sheet says so. */
  const commute = commuteCount(draft, query.to);
  const commutePending = commute.pending;
  const matchCount = useMemo(() => {
    const counted = commuteCount({ to: draft.to, withinOn: draft.withinOn }, query.to);
    return liveMatchCount(facts, shelfFilter(pending), counted.passes);
  }, [facts, pending, draft.to, draft.withinOn, query.to]);
  /* The figures the price bars are drawn from: every home the rest of the
     draft keeps, judged at the figure the budget judges (V-65). */
  const priceSpread = useMemo(() => priceFigures(facts, shelfFilter(pending)), [facts, pending]);

  /* THE PRICE CONTROL IS SCALED TO THE MARKET (V-67). A fixed range per
     market (`PRICE_BOUNDS`), the Rent scale when no market is chosen, so the
     track never runs to the dearest sale. V-65: on the Rent market the figure
     it bounds is the cash at the door. */
  const cashMarket = rentMeansTenancy(draft);
  const scale = useMemo(() => priceScale(draft.intent), [draft.intent]);

  /* The basis of the ordering the reader is currently choosing, for the line
     under the control. Null on the orderings that are not about money. */
  const draftBasisKey = sortBasisOf(draft.sort);
  const draftBasis =
    draftBasisKey === "price"
      ? costCopy.basisPrice
      : draftBasisKey === "move-in"
        ? costCopy.basisMoveIn
        : draftBasisKey === "fees"
          ? (feesBasis ?? null)
          : null;

  // Naira, because that is what the control holds. It becomes kobo the moment
  // it is shown or stored, and never before.
  const minInNaira = nairaOf(draft.minNaira);
  const maxInNaira = nairaOf(draft.maxNaira);
  const sliderMin = Math.min(Math.max(minInNaira ?? scale.floor, scale.floor), scale.ceiling);
  const sliderMax = Math.max(Math.min(maxInNaira ?? scale.ceiling, scale.ceiling), scale.floor);

  /* The search copy (V2), when the bar passed it; older callers fall back to
     the words this sheet always drew. */
  const sv = searchCopy ?? null;
  const shortlet = draft.kind === "shortlet";
  const marketValue: MarketChoice | undefined = shortlet ? "shortlet" : market;
  const marketChoices: { value: MarketChoice; label: string }[] = [
    ...marketOptions.map((option) => ({
      value: option.value as MarketChoice,
      label: option.value === "sale" ? (sv?.forSale ?? option.label) : (sv?.forRent ?? option.label),
    })),
    ...(sv ? [{ value: "shortlet" as const, label: sv.shortlet }] : []),
  ].sort((a, b) => MARKET_ORDER.indexOf(a.value) - MARKET_ORDER.indexOf(b.value));

  function pickMarketChoice(next: MarketChoice | undefined) {
    setDraft((current) => {
      const { intent: _wasIntent, kind: wasKind, ...rest } = current;
      void _wasIntent;
      /* A kind chosen in the tiles survives a market change; Shortlet is not
         a tile, it is the market, so it goes when another market is picked. */
      const kept = wasKind && wasKind !== "shortlet" ? { kind: wasKind } : {};
      if (next === undefined) return { ...rest, ...kept };
      if (next === "shortlet") return { ...rest, kind: "shortlet" as const };
      return { ...rest, ...kept, intent: next };
    });
  }

  function apply() {
    if (shortlet) {
      /* A shortlet is a stay (V-67): the Stays search, carrying the words and
         every parameter that search reads, exactly as the shelf's own
         redirect would, without the extra hop through /search. */
      const params = Object.fromEntries(new URLSearchParams(target.includes("?") ? target.slice(target.indexOf("?") + 1) : ""));
      router.push(staySideHref("shortlet", params) ?? target);
      onClose();
      return;
    }
    router.push(target);
    onClose();
  }

  function clearAll() {
    const cleared = clearedShelf(query);
    setDraft(draftFrom(cleared));
    router.push(toShelfHref(cleared));
    onClose();
  }

  function pickKind(value: ListingKind | "all") {
    setDraft((current) => {
      const { kind: _was, ...rest } = current;
      return value === "all" ? rest : { ...rest, kind: value };
    });
  }

  function toggleWater(value: WaterSupply) {
    setDraft((current) => ({
      ...current,
      waterSupply: current.waterSupply.includes(value)
        ? current.waterSupply.filter((v) => v !== value)
        : [...current.waterSupply, value],
    }));
  }

  function toggleRole(value: ListingRole) {
    setDraft((current) => ({
      ...current,
      /* Rebuilt from LISTING_ROLES rather than appended to, so two people who
         ticked the same boxes in a different order produce the same URL. */
      listerRoles: LISTING_ROLES.filter((role) =>
        role === value ? !current.listerRoles.includes(role) : current.listerRoles.includes(role),
      ),
    }));
  }

  function toggleAmenity(code: string, on: boolean) {
    setDraft((current) => ({
      ...current,
      amenities: on
        ? current.amenities.includes(code)
          ? current.amenities
          : [...current.amenities, code]
        : current.amenities.filter((c) => c !== code),
    }));
  }

  const roomOptions = ROOM_STEPS.map((value) => ({
    value,
    label: value === 0 ? copy.any : `${value}+`,
  }));

  const panel = (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={copy.title}
      closeLabel={copy.close}
      fullPage
      sideOnWide
      testId="filters-drawer"
      headAction={
        /* The reference's Reset, top right; it clears every filter and the
           market, as the footer's Reset did. */
        <Button variant="quiet" size="sm" data-testid="filters-clear" onClick={clearAll} className="shrink-0">
          {copy.reset}
        </Button>
      }
      footer={
        /* One sticky action with the real live count, as the reference's
           "See 231 homes": the same `matchesFacts` the shelf runs. The label
           wraps a long word rather than spilling out of the footer. */
        <div className="border-t border-[var(--nf-panel-hair)] pt-sm">
          <Button variant="primary" data-testid="filters-apply" data-count={shortlet ? undefined : matchCount} onClick={apply} full size="lg" className="whitespace-normal">
            {shortlet && sv
              ? sv.seeShortlets
              : sv
                ? seeHomesLabel(matchCount, locale, sv)
                : matchCount === 0
                  ? copy.applyNone
                  : copy.apply.replace("{count}", formatNumber(matchCount, locale))}
          </Button>
        </div>
      }
    >
          <div className="mx-auto max-w-2xl" data-select-pop="">
            {/* ------------------------------------------------- market
                The reference's segmented control at the top: For rent, For
                sale (where the pool holds a sale), Shortlet. A radio group;
                tapping the chosen answer again takes it away (any market), as
                the market tiles always did. Shortlet is a stay, so it opens
                the Stays search with the words kept (V-67). */}
            <div className="mb-lg">
              <RadioPills<MarketChoice>
                label={sv?.market ?? copy.market}
                testPrefix="filter-market"
                allowClear
                options={marketChoices}
                value={marketValue}
                onPick={pickMarketChoice}
              />
              {shortlet && sv && (
                <p className="nf-filters__hint mt-sm mb-0" data-testid="filter-shortlet-note">
                  {sv.shortletNote}
                </p>
              )}
            </div>

            {!shortlet && (
              <>
            {/* --------------------------------------------------- price */}
            <Group
              id="filter-price"
              title={cashMarket ? cashCopy.budgetTitle : copy.priceRange}
              clearLabel={copy.clear}
              onClear={
                draft.minNaira || draft.maxNaira
                  ? () => setDraft((current) => ({ ...current, minNaira: "", maxNaira: "" }))
                  : undefined
              }
            >
              {/* The reference's two fields over the spread of prices: typed
                  in naira, held as digits, shown grouped. */}
              <div className="nf-price-fields">
                <label className="nf-price-field">
                  <span className="sr-only">{sv?.minBudget ?? "Minimum price"}</span>
                  <span className="nf-price-field__unit" aria-hidden="true">₦</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    data-testid="filter-price-min"
                    placeholder={sv?.minBudget}
                    value={draft.minNaira ? formatNumber(Number(draft.minNaira), locale) : ""}
                    onChange={(event) => setDraft((current) => ({ ...current, minNaira: digits(event.target.value) }))}
                    className="nf-price-field__input"
                  />
                </label>
                <span className="nf-price-fields__dash" aria-hidden="true" />
                <label className="nf-price-field">
                  <span className="sr-only">{sv?.maxBudget ?? "Maximum price"}</span>
                  <span className="nf-price-field__unit" aria-hidden="true">₦</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    data-testid="filter-price-max"
                    placeholder={sv?.maxBudget}
                    value={draft.maxNaira ? formatNumber(Number(draft.maxNaira), locale) : ""}
                    onChange={(event) => setDraft((current) => ({ ...current, maxNaira: digits(event.target.value) }))}
                    className="nf-price-field__input"
                  />
                </label>
              </div>
              <PriceSpread
                figures={priceSpread}
                ceilingMinor={nairaToKobo(scale.ceiling)}
                minMinor={nairaToKobo(sliderMin)}
                maxMinor={sliderMax >= scale.ceiling ? Number.POSITIVE_INFINITY : nairaToKobo(sliderMax)}
              />
              <div className="nf-range" data-testid="filter-range">
                <span aria-hidden="true" className="nf-range__track" />
                <span
                  aria-hidden="true"
                  className="nf-range__fill"
                  style={{
                    left: `${((sliderMin - scale.floor) / scale.span) * 100}%`,
                    right: `${100 - ((sliderMax - scale.floor) / scale.span) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  aria-label="Minimum price"
                  data-testid="filter-range-min"
                  min={scale.floor}
                  max={scale.ceiling}
                  step={scale.step}
                  value={sliderMin}
                  onChange={(event) => {
                    const next = Math.min(Number(event.target.value), sliderMax - scale.step);
                    setDraft((current) => ({
                      ...current,
                      minNaira: next <= scale.floor ? "" : String(next),
                    }));
                  }}
                  className="nf-range__input"
                />
                <input
                  type="range"
                  aria-label="Maximum price"
                  data-testid="filter-range-max"
                  min={scale.floor}
                  max={scale.ceiling}
                  step={scale.step}
                  value={sliderMax}
                  onChange={(event) => {
                    const next = Math.max(Number(event.target.value), sliderMin + scale.step);
                    setDraft((current) => ({
                      ...current,
                      maxNaira: next >= scale.ceiling ? "" : String(next),
                    }));
                  }}
                  className="nf-range__input"
                />
              </div>
              {/* Money formats from kobo through formatMoney, never from naira. */}
              <div className="nf-filters__range-labels nf-numeric">
                <span>{formatMoney(nairaToKobo(sliderMin), locale)}</span>
                <span>
                  {sliderMax >= scale.ceiling
                    ? `${formatMoney(nairaToKobo(scale.ceiling), locale)}+`
                    : formatMoney(nairaToKobo(sliderMax), locale)}
                </span>
              </div>
              {sliderMax >= scale.ceiling && (
                <p className="nf-filters__hint mt-inline-tight">{copy.noUpperLimit}</p>
              )}
              {/* Currency tool 2: the same budget typed in the reader's currency.
                  It writes the naira fields above and draws nothing without a
                  fresh rate (see BudgetInCurrency). */}
              <BudgetInCurrency
                minNaira={draft.minNaira}
                maxNaira={draft.maxNaira}
                locale={locale}
                placeholders={{ min: sv?.minBudget, max: sv?.maxBudget }}
                onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
              />
              {cashMarket && (
                <>
                  <p className="nf-filters__hint mt-inline-tight" data-testid="filter-cash-basis">
                    {cashCopy.budgetBasis}
                  </p>
                  <div className="mt-sm divide-y divide-[var(--nf-panel-hair)]">
                    <SwitchRow
                      icon="wallet"
                      label={cashCopy.oneYearAtMost}
                      checked={draft.maxUpfront !== undefined}
                      testId="filter-upfront"
                      onChange={(next) =>
                        setDraft((current) => {
                          const { maxUpfront: _dropped, ...rest } = current;
                          void _dropped;
                          return next ? { ...rest, maxUpfront: ONE_YEAR } : rest;
                        })
                      }
                    />
                  </div>
                </>
              )}
            </Group>

            {/* ------------------------------------------------ bedrooms */}
            <Group
              id="filter-bedrooms"
              title={copy.bedrooms}
              hint={sv?.minimumCount}
              clearLabel={copy.clear}
              onClear={
                draft.bedrooms > 0
                  ? () => setDraft((current) => ({ ...current, bedrooms: 0 }))
                  : undefined
              }
            >
              <RadioPills<number>
                labelledBy="filter-bedrooms"
                testPrefix="filter-bedrooms"
                options={roomOptions}
                value={draft.bedrooms}
                onPick={(value) => setDraft((current) => ({ ...current, bedrooms: value ?? 0 }))}
              />
            </Group>

            {/* ----------------------------------------------- bathrooms */}
            <Group
              id="filter-bathrooms"
              title={copy.bathrooms}
              hint={sv?.minimumCount}
              clearLabel={copy.clear}
              onClear={
                draft.bathrooms > 0
                  ? () => setDraft((current) => ({ ...current, bathrooms: 0 }))
                  : undefined
              }
            >
              <RadioPills<number>
                labelledBy="filter-bathrooms"
                testPrefix="filter-bathrooms"
                options={roomOptions}
                value={draft.bathrooms}
                onPick={(value) => setDraft((current) => ({ ...current, bathrooms: value ?? 0 }))}
              />
            </Group>

            {/* ------------------------------------------- property type */}
            {kindOptions.length > 0 && (
              <Group
                id="filter-kind"
                title={copy.propertyType}
                clearLabel={copy.clear}
                onClear={draft.kind ? () => pickKind("all") : undefined}
              >
                <IconTiles<ListingKind | "all">
                  label={copy.propertyType}
                  mode="single"
                  testPrefix="filter-kind"
                  selected={[draft.kind ?? "all"]}
                  onToggle={pickKind}
                  options={[
                    { value: "all" as const, label: copy.all, icon: KIND_ICON.all },
                    ...kindOptions.map((kind) => ({ value: kind, label: kindLabel(kind, kindCopy.kinds), icon: KIND_ICON[kind], art: KIND_ART[kind], object: kindObject(kind) })),
                  ]}
                />
              </Group>
            )}

            {/* ------------------------------------------ shape (V-66) */}
            {(!draft.kind || takesShape(draft.kind)) && (shapeOptions.shapes.length > 0 || shapeOptions.bq) && (
              <Group
                id="filter-shape"
                title={unitCopy.filterTitle}
                clearLabel={copy.clear}
                onClear={
                  draft.shapes.length > 0 || draft.withBq
                    ? () => setDraft((current) => ({ ...current, shapes: [], withBq: false }))
                    : undefined
                }
              >
                {shapeOptions.shapes.length > 0 && (
                  <IconTiles<UnitShape>
                    label={unitCopy.filterTitle}
                    mode="multi"
                    testPrefix="filter-shape"
                    selected={draft.shapes}
                    onToggle={toggleShape}
                    options={shapeOptions.shapes.map((shape) => ({
                      value: shape,
                      label: unitCopy.shapes[shape],
                      icon: SHAPE_ICON[shape],
                      object: SHAPE_OBJECT[shape],
                    }))}
                  />
                )}
                {shapeOptions.bq && (
                  <div className="mt-sm divide-y divide-[var(--nf-panel-hair)]">
                    <SwitchRow
                      icon="key"
                      object={BQ_OBJECT}
                      label={unitCopy.filterBq}
                      checked={draft.withBq}
                      testId="filter-bq"
                      onChange={(next) => setDraft((current) => ({ ...current, withBq: next }))}
                    />
                  </div>
                )}
              </Group>
            )}

            {/* ----------------------------------------------- amenities */}
            {amenityOptions.length > 0 && (
              <Group
                id="filter-amenities"
                title={copy.amenities}
                clearLabel={copy.clear}
                onClear={
                  draft.amenities.length > 0
                    ? () => setDraft((current) => ({ ...current, amenities: [] }))
                    : undefined
                }
              >
                <div className="divide-y divide-[var(--nf-panel-hair)]">
                  {amenityOptions.map((code) => (
                    <div key={code} data-testid={`filter-amenity-${code}`}>
                      <SwitchRow
                        icon={AMENITY_ICON[code] ?? "circle-check"}
                        label={amenityLabel(code)}
                        checked={draft.amenities.includes(code)}
                        onChange={(next) => toggleAmenity(code, next)}
                        testId={`filter-amenity-switch-${code}`}
                      />
                    </div>
                  ))}
                </div>
              </Group>
            )}

            {/* ------------------------------------------ light and water */}
            {showUtilities && (
              <Group
                id="filter-utilities"
                title={copy.lightAndWater}
                clearLabel={copy.clear}
                onClear={
                  draft.powerBackup || draft.powerBandA || draft.waterSupply.length > 0
                    ? () =>
                        setDraft((current) => ({
                          ...current,
                          powerBackup: false,
                          powerBandA: false,
                          waterSupply: [],
                        }))
                    : undefined
                }
              >
                <div className="divide-y divide-[var(--nf-panel-hair)]">
                  {utilityOptions.backup && (
                    <SwitchRow
                      icon="bolt"
                      label={copy.backupPower}
                      checked={draft.powerBackup}
                      testId="filter-power-backup"
                      onChange={(next) => setDraft((current) => ({ ...current, powerBackup: next }))}
                    />
                  )}
                  {utilityOptions.bandA && (
                    <SwitchRow
                      icon="bolt"
                      label={copy.bandA}
                      checked={draft.powerBandA}
                      testId="filter-power-band-a"
                      onChange={(next) => setDraft((current) => ({ ...current, powerBandA: next }))}
                    />
                  )}
                </div>
                {utilityOptions.water.length > 0 && (
                  <>
                    <p className="nf-filters__hint mt-sm">{copy.water}</p>
                    <div className="flex flex-wrap gap-xs">
                      {utilityOptions.water.map((value) => {
                        const on = draft.waterSupply.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={on}
                            data-testid={`filter-water-${value.toLowerCase()}`}
                            onClick={() => toggleWater(value)}
                            className="nf-filters__tile"
                          >
                            {WATER_LABEL[value]}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </Group>
            )}

            {/* ---------------------------------------------- compound */}
            {(compoundOptions.landlord || compoundOptions.parking) && (
              <Group
                id="filter-compound"
                title={compoundCopy.title}
                clearLabel={copy.clear}
                onClear={
                  draft.landlordAway || draft.parkingInside
                    ? () =>
                        setDraft((current) => ({ ...current, landlordAway: false, parkingInside: false }))
                    : undefined
                }
              >
                <div className="divide-y divide-[var(--nf-panel-hair)]">
                  {compoundOptions.landlord && (
                    <SwitchRow
                      icon="house"
                      label={compoundCopy.filterLandlordAway}
                      checked={draft.landlordAway}
                      testId="filter-landlord-away"
                      onChange={(next) => setDraft((current) => ({ ...current, landlordAway: next }))}
                    />
                  )}
                  {compoundOptions.parking && (
                    <SwitchRow
                      icon="parking"
                      label={compoundCopy.filterParkingInside}
                      checked={draft.parkingInside}
                      testId="filter-parking-inside"
                      onChange={(next) => setDraft((current) => ({ ...current, parkingInside: next }))}
                    />
                  )}
                </div>
              </Group>
            )}

            {/* ------------------------------------------ service (V-68) */}
            {(serviceOptions.serviced || serviceOptions.gated) && (
              <Group
                id="filter-service"
                title={serviceCopy.filterTitle}
                clearLabel={copy.clear}
                onClear={
                  draft.servicedOnly || draft.gatedEstate
                    ? () => setDraft((current) => ({ ...current, servicedOnly: false, gatedEstate: false }))
                    : undefined
                }
              >
                <div className="divide-y divide-[var(--nf-panel-hair)]">
                  {serviceOptions.serviced && (
                    <SwitchRow
                      icon="bolt"
                      label={serviceCopy.filterServiced}
                      checked={draft.servicedOnly}
                      testId="filter-serviced"
                      onChange={(next) => setDraft((current) => ({ ...current, servicedOnly: next }))}
                    />
                  )}
                  {serviceOptions.gated && (
                    <SwitchRow
                      icon="key"
                      label={serviceCopy.filterGated}
                      checked={draft.gatedEstate}
                      testId="filter-gated-estate"
                      onChange={(next) => setDraft((current) => ({ ...current, gatedEstate: next }))}
                    />
                  )}
                </div>
              </Group>
            )}

            {/* -------------------------- no flooding reported (V-41) */}
            {floodJudged && noFloodLabel && (
              <Group
                id="filter-flood"
                title={noFloodLabel.label}
                clearLabel={copy.clear}
                onClear={draft.noFlood ? () => setDraft((current) => ({ ...current, noFlood: false })) : undefined}
              >
                <div className="divide-y divide-[var(--nf-panel-hair)]">
                  <SwitchRow
                    icon="sun"
                    label={noFloodLabel.label}
                    hint={noFloodLabel.hint}
                    checked={draft.noFlood}
                    testId="filter-no-flood"
                    onChange={(next) => setDraft((current) => ({ ...current, noFlood: next }))}
                  />
                </div>
              </Group>
            )}

            {/* --------------------------------- commute (V-43) */}
            {anchors.length > 0 && (
              <Group
                id="filter-commute"
                title={commuteCopy.filterTitle}
                clearLabel={copy.clear}
                onClear={draft.to ? () => setDraft((current) => ({ ...current, to: "", withinOn: false })) : undefined}
              >
                <label className="block">
                  <span className="sr-only">{commuteCopy.filterTitle}</span>
                  <select
                    className="nf-field"
                    value={draft.to}
                    data-testid="filter-commute-to"
                    onChange={(event) => {
                      const to = event.target.value;
                      setDraft((current) => ({ ...current, to, withinOn: to ? current.withinOn : false }));
                    }}
                  >
                    <option value="">{commuteCopy.anywhere}</option>
                    {anchors.map((anchor) => (
                      <option key={anchor.id} value={anchor.slug}>
                        {anchor.name}, {anchor.city}
                      </option>
                    ))}
                  </select>
                </label>
                {draft.to && (
                  <div className="mt-sm divide-y divide-[var(--nf-panel-hair)]">
                    <SwitchRow
                      icon="history"
                      label={commuteCopy.within.replace("{n}", String(RUSH_WITHIN))}
                      hint={commuteCopy.withinHint}
                      checked={draft.withinOn}
                      testId="filter-commute-within"
                      onChange={(next) => setDraft((current) => ({ ...current, withinOn: next }))}
                    />
                  </div>
                )}
                {commutePending && (
                  <p className="nf-filters__hint mt-inline-tight" role="status">
                    {commuteCopy.countAfterApply}
                  </p>
                )}
              </Group>
            )}

            {/* ------------------------------------------------ trust */}
            <Group
              id="filter-booking"
              title={copy.trust}
              clearLabel={copy.clear}
              onClear={
                draft.instantBook || draft.verifiedOnly || draft.listerRoles.length > 0
                  ? () =>
                      setDraft((current) => ({
                        ...current,
                        instantBook: false,
                        verifiedOnly: false,
                        listerRoles: [],
                      }))
                  : undefined
              }
            >
              <div className="divide-y divide-[var(--nf-panel-hair)]">
                <SwitchRow
                  icon="verified"
                  label={copy.verifiedOnly}
                  checked={draft.verifiedOnly}
                  testId="filter-verified"
                  onChange={(next) => setDraft((current) => ({ ...current, verifiedOnly: next }))}
                />
              </div>
              {/*
                WHO IS OFFERING IT. Chips rather than switches, because this is
                one column with one value and any of them will do, exactly like
                water. `LISTING_ROLE_FILTER_LABEL` was written for this control
                in Track G and had no consumer anywhere until now.

                Offered unconditionally, unlike light and water. Those are
                hidden when the pool in front of the reader holds no answer,
                because a filter that can only ever return nothing is a dead
                end. Hiding the supply-kind control would hide the single
                question this two-sided platform is about, and the reader is
                better served by an empty result they asked for than by a
                control that was never there.
              */}
              <p className="nf-filters__hint mt-sm">{LISTING_ROLE_FILTER_HEADING}</p>
              <div className="flex flex-wrap gap-xs">
                {LISTING_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={draft.listerRoles.includes(role)}
                    data-testid={`filter-role-${role}`}
                    onClick={() => toggleRole(role)}
                    className="nf-filters__tile"
                  >
                    {LISTING_ROLE_FILTER_LABEL[role]}
                  </button>
                ))}
              </div>
            </Group>

              </>
            )}
            {/* ------------------------------------------------ location */}
            <Group
              id="filter-location"
              title={copy.location}
              clearLabel={copy.clear}
              onClear={
                draft.q.trim().length > 0
                  ? () => setDraft((current) => ({ ...current, q: "" }))
                  : undefined
              }
            >
              <label className="nf-filters__row">
                <UiIcon name="location" size={ICON.inline} />
                <span className="sr-only">{copy.location}</span>
                <input
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  data-testid="filter-search"
                  value={draft.q}
                  onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
                  placeholder={copy.locationPlaceholder}
                  className="nf-filters__row-input"
                />
                <UiIcon name="chevron-right" size={16} className="text-[var(--nf-content-muted)]" />
              </label>
            </Group>

            {!shortlet && (
              <>
            {/* ---------------------------------------------------- sort */}
            {/* Clearing a sort means going back to the order the shelf opens
                in, which is the first entry in SORTS, so the control is live
                exactly when the reader has moved off it. */}
            <Group
              id="filter-sort"
              title={copy.sortBy}
              clearLabel={copy.clear}
              onClear={
                SORTS[0] && draft.sort !== SORTS[0].key
                  ? () => setDraft((current) => ({ ...current, sort: SORTS[0]!.key }))
                  : undefined
              }
            >
              <label className="nf-filters__row">
                <UiIcon name="sliders" size={ICON.inline} />
                <span className="sr-only">{copy.sortBy}</span>
                <select
                  value={draft.sort}
                  data-testid="filter-sort"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, sort: event.target.value as SortKey }))
                  }
                  className="nf-filters__row-select"
                >
                  {SORTS.map((sort) => (
                    <option key={sort.key} value={sort.key}>
                      {sortCopy[sort.key]}
                    </option>
                  ))}
                </select>
                <UiIcon name="chevron-down" size={16} className="text-[var(--nf-content-muted)]" />
              </label>
              {/* WHICH NUMBER, IN THE DRAWER TOO. The shelf prints this under
                  its count; the drawer is where the choice is made, so it says
                  it here as well rather than only after the sheet closes. */}
              {draftBasis && (
                <p
                  data-testid="filter-sort-basis"
                  className="nf-caption mt-inline-tight text-[var(--nf-content-muted)]"
                >
                  {draftBasis}
                </p>
              )}
            </Group>
              </>
            )}
          </div>
    </Sheet>
  );

  return panel;
}
