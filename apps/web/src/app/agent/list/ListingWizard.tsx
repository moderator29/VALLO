"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { countOf, formatDate, formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { ShotList } from "@/components/agent/ShotList";
import { fill } from "../_copy";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { canCapturePhoto, capturePhoto } from "@/lib/native/device";
import { Switch } from "@/components/ui/Switch";
import { ListerFeeGate } from "@/components/money/ListerFeeGate";
import {
  acceptanceMatches,
  feeGateHoldsSend,
  listerFeeFigures,
  type ListerFeeAcceptance,
  type ListerFeePolicy,
} from "@/lib/money/lister-fee";
import { fetchListerFeePolicy, recordListerFeeAcceptance } from "@/lib/money/lister-fee-actions";
import {
  addPhoto,
  addVideo,
  removePhoto,
  removeVideo,
  reorderMedia,
  saveDraft,
  setAmenities,
  setListingAccess,
  submitListing,
} from "@/lib/agent/listings-actions";
import type { ListingStatus, OwnAnswers, WizardDraft } from "@/lib/agent/listings-queries";
import { BROADCAST_MONEY_KEYS, type BroadcastKey, type BroadcastParse } from "@/lib/agent/broadcast";
import { BroadcastPaste } from "./BroadcastPaste";
import { PriceGuidePanel, usePriceGuide } from "./PriceGuide";
import { DraftMatches } from "./DraftMatches";
import { feeNormLine, type GuideSubject } from "@/lib/price-check/wizard-guide";
import {
  MAX_ACCESS_CODE,
  MAX_BACKUP_HOURS,
  MAX_ESTATE_NAME,
  MAX_GATE_DIRECTIONS,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_LABEL,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MAX_VIDEOS,
  MAX_VIDEO_SECONDS,
  MIN_MEDIA,
  RECOMMENDED_MEDIA,
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  rejectUpload,
  MAX_SECURITY_PHONE,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_WORDS,
  MIN_PHOTO_WIDTH,
  MIN_TITLE_LENGTH,
  collapseSpaces,
  CONDITION_CHOICES,
  countWords,
  FURNISHING_CHOICES,
  isRental,
  isTenancy,
  LISTING_INTENT_CHOICES,
  parseNairaToKobo,
  POWER_BACKUP_CHOICES,
  POWER_GRID_CHOICES,
  ratePeriodFor,
  RENT_PERIOD_CHOICES,
  SALE_STATUS_CHOICES,
  submitRequirements,
  TENURE_CHOICES,
  WATER_SUPPLY_CHOICES,
  type BuildCondition,
  type Furnishing,
  type LandTenure,
  type ListingIntent,
  type PowerBackup,
  type PowerGrid,
  type PropertyType,
  type RentPeriod,
  type SaleStatus,
  type WaterSupply,
} from "@/lib/agent/listings-model";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BackControl } from "@/components/ui/BackControl";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { Amount } from "@/components/ui/Amount";
import { moveInLines } from "@/components/app/listing/move-in-lines";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { canMove, mergeMedia, photoFirst } from "@/lib/listings/media-order";
import {
  looksLikeVideo,
  posterFrame,
  scrubVideoLocation,
  videoDuration,
  videoExtension,
  videoMime,
} from "@/lib/agent/video-prep";
import { forgetUploadPath, resumableUpload, stableUploadPath } from "@/lib/agent/resumable-upload";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Quantity } from "@/components/ui/Quantity";
import { ListingSentForReview } from "./ListingSentForReview";
import { PushPrompt } from "@/components/app/push/PushPrompt";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { TextField, TextArea } from "@/components/ui/Field";
import { CompoundQuestions } from "@/components/agent/CompoundQuestions";
import { EMPTY_COMPOUND_FORM, compoundPayload, type CompoundForm } from "@/lib/listings/compound";
import { EMPTY_SERVICE_FORM, servicePayload, type ServiceForm } from "@/lib/listings/service";
import { ServiceQuestions } from "@/components/agent/ServiceQuestions";
import { UnitQuestions } from "@/components/agent/UnitQuestions";
import { FloodQuestion } from "@/components/agent/FloodQuestion";
import type { Flooding } from "@/lib/around/pulse";
import { EMPTY_UNIT_FORM, takesShape, unitPayload, type UnitForm } from "@/lib/listings/unit-shape";
import { listingDraftKey } from "@/lib/agent/listing-draft-storage";
import { ProgressPath } from "@/components/supply/ProgressPath";
import { LISTING_STEP_TILES } from "@/components/supply/path-tiles";
import { useDeviceStorage } from "@/components/supply/use-device-storage";
import { Unfold } from "@/components/ui/Unfold";
import { looksLikeStreetAddress, STREET_IN_TITLE_WARNING } from "@/lib/listings/public-title";
import { tenantPreference } from "@/lib/safety/tenant-preference";
import {
  fileLine,
  isHeic,
  judgePhoto,
  looksLikeImage,
  uploadErrorText,
} from "@/lib/listings/photo-gate";
import { reviewerAsked } from "@/lib/agent/listings-edit-state";
import Link from "next/link";
import { IconPlate } from "@/components/ui/IconPlate";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import { DetailGlyph } from "@/components/app/listing/DetailGlyph";
import { feedback } from "@/lib/ui/feedback";
import "@/app/css/catalogue.css";
import "@/app/css/lister-publish.css";

/**
 * The List Apartment wizard: eight steps, canon reference 03.
 *
 * Built for one thumb at 390px. Every step is a single column, the controls are
 * 44px or larger, and the only fixed furniture is the step footer, so the
 * keyboard never covers the way forward. Work is saved on every step change:
 * to the platform as a DRAFT listing when the agent is signed in, and to this
 * device as well, always, so an interrupted listing survives a closed tab.
 *
 * Photos upload straight from the browser to the listing-photos bucket under
 * `<auth uid>/<listing id>/<uuid>.<ext>`, which storage RLS restricts to the
 * agent's own folder. The first photo is the cover. Anything under 1600px on
 * its long edge is refused here, and the server enforces the count at submit, so the
 * quality gate holds from both sides.
 *
 * Every string comes from the dictionary slice the page hands down, so the
 * whole wizard reads in the agent's language. The submit gate stays the
 * authority on WHICH requirements are unmet; the dictionary only decides how
 * each one reads, which is why the checklist and the server can never disagree.
 */

type WizardCopy = Dictionary["agentListings"];

/** The eight steps, in order. The names come from the dictionary. */
const STEP_KEYS = [
  "basics",
  "photos",
  "location",
  "amenities",
  "utilities",
  "pricing",
  "guestView",
  "submit",
] as const satisfies readonly (keyof WizardCopy["wizard"]["steps"])[];

/**
 * The step that owns a field the submit gate can name, so the checklist's
 * Edit lands on the box that fixes it. Anything the gate grows later, and
 * every rooms field, belongs to the first step.
 */
function stepOfGateField(field: string): number {
  switch (field) {
    case "photos":
      return STEP_KEYS.indexOf("photos");
    case "stateCode":
    case "city":
    case "area":
      return STEP_KEYS.indexOf("location");
    case "amenities":
      return STEP_KEYS.indexOf("amenities");
    case "price":
    case "rent":
    case "rentPeriod":
    case "rate":
    case "ratePeriod":
    case "salePrice":
    case "tenure":
    case "totalMoveIn":
      return STEP_KEYS.indexOf("pricing");
    default:
      return STEP_KEYS.indexOf("basics");
  }
}

/** Display order of the type cards, which is not the schema's storage order. */
/**
 * Display order of the type cards, which is not the schema's storage order.
 *
 * Shops, offices and land are on it now. They were not, which meant the
 * commercial and land categories existed in search, in the enum and in the
 * filter drawer, and there was no way on this platform to supply one: a person
 * with a plot to sell could not choose "Land" and gave up. A market you can
 * browse and cannot list in is worse than one you do not offer.
 */
const TYPE_ORDER: PropertyType[] = [
  "apartment",
  "shortlet",
  "home",
  "villa",
  "hotel",
  "rental",
  "shop",
  "office",
  "land",
  "restaurant",
];


type Values = {
  title: string;
  description: string;
  propertyType: PropertyType;
  stateCode: string;
  city: string;
  area: string;
  address: string;
  landmark: string;
  bedrooms: number;
  bathrooms: number;
  toilets: string;
  parkingSpaces: string;
  floor: string;
  totalFloors: string;
  sizeSqm: string;

  /** To let, or for sale. The first money question and the one all the rest hang off. */
  intent: ListingIntent;

  /* A tenancy. */
  rentNaira: string;
  rentPeriod: RentPeriod;
  rentNegotiable: boolean;
  cautionDepositNaira: string;
  serviceChargeNaira: string;
  serviceChargePeriod: RentPeriod;
  agencyFeeNaira: string;
  legalFeeNaira: string;
  agreementFeeNaira: string;
  totalMoveInNaira: string;
  minimumTenancyMonths: string;
  availableFrom: string;
  furnished: Furnishing | "";

  /* A short stay. The period is never asked for: the category decides it. */
  rateNaira: string;

  /* A sale. */
  salePriceNaira: string;
  saleAgencyFeeNaira: string;
  saleLegalFeeNaira: string;
  governorsConsentFeeNaira: string;
  stampDutyNaira: string;
  surveyRegistrationFeeNaira: string;
  totalPurchaseNaira: string;
  priceNegotiable: boolean;
  tenure: LandTenure | "";
  saleStatus: SaleStatus;
  yearBuilt: string;
  condition: BuildCondition | "";

  powerGrid: PowerGrid | "";
  powerBackup: PowerBackup | "";
  powerBackupHours: string;
  waterSupply: WaterSupply | "";
  prepaidMeter: boolean;
  /** V-28: the compound's five answers; "" is unanswered. */
  compound: CompoundForm;
  /** V-68: the service charge's answers. */
  service: ServiceForm;
  /** V-66: the unit's shape, en-suite rooms and BQ. */
  unit: UnitForm;
  /** V-41: the lister's flooding answer; "" is unanswered. */
  flooding: Flooding | "";
  estateName: string;
  gateDirections: string;
  securityPhone: string;
  accessCode: string;
};

type Photo = { id: string; path: string; url: string };

/** A walkthrough on the listing; its url is signed (or local until the next read). */
type Video = { id: string; url: string; posterUrl: string | null; durationSeconds: number | null };

/**
 * ONE ROW OF PHOTOS AND VIDEOS, the first of which (the cover) is a photo.
 * Stored across two tables and read back with `mergeMedia`.
 */
type Media = ({ kind: "photo" } & Photo) | ({ kind: "video" } & Video);

/** "0:42". */
function clockOf(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The row a stored draft opens on. */
function mediaFrom(draft: WizardDraft | null): Media[] {
  if (!draft) return [];
  return mergeMedia(
    draft.photos.map((photo, index) => ({ ...photo, position: photo.position ?? index })),
    (draft.videos ?? []).map((video, index) => ({ ...video, position: video.position ?? index })),
  ).map((entry) =>
    entry.kind === "photo"
      ? { kind: "photo" as const, id: entry.item.id, path: entry.item.path, url: entry.item.url }
      : {
          kind: "video" as const,
          id: entry.item.id,
          url: entry.item.url,
          posterUrl: entry.item.posterUrl ?? null,
          durationSeconds: entry.item.durationSeconds ?? null,
        },
  );
}

/** Keep an input numeric without fighting the caret. Empty stays empty. */
function digitsOnly(raw: string, max: number): string {
  return raw.replace(/[^0-9]/g, "").slice(0, max);
}

/** A box as the save sends it: what was typed, or null for a box left empty. */
function cleared(raw: string): string | null {
  return raw.trim() === "" ? null : raw;
}

const EMPTY: Values = {
  title: "",
  description: "",
  propertyType: "apartment",
  stateCode: "",
  city: "",
  area: "",
  address: "",
  landmark: "",
  bedrooms: 1,
  bathrooms: 1,
  toilets: "",
  parkingSpaces: "",
  floor: "",
  totalFloors: "",
  sizeSqm: "",
  intent: "rent",
  rentNaira: "",
  rentPeriod: "year",
  rentNegotiable: false,
  cautionDepositNaira: "",
  serviceChargeNaira: "",
  serviceChargePeriod: "year",
  agencyFeeNaira: "",
  legalFeeNaira: "",
  agreementFeeNaira: "",
  totalMoveInNaira: "",
  minimumTenancyMonths: "",
  availableFrom: "",
  furnished: "",
  rateNaira: "",
  salePriceNaira: "",
  saleAgencyFeeNaira: "",
  saleLegalFeeNaira: "",
  governorsConsentFeeNaira: "",
  stampDutyNaira: "",
  surveyRegistrationFeeNaira: "",
  totalPurchaseNaira: "",
  priceNegotiable: false,
  tenure: "",
  saleStatus: "available",
  yearBuilt: "",
  condition: "",
  powerGrid: "",
  powerBackup: "",
  powerBackupHours: "",
  waterSupply: "",
  prepaidMeter: false,
  compound: EMPTY_COMPOUND_FORM,
  service: EMPTY_SERVICE_FORM,
  unit: EMPTY_UNIT_FORM,
  flooding: "",
  estateName: "",
  gateDirections: "",
  securityPhone: "",
  accessCode: "",
};

function valuesFrom(draft: WizardDraft): Values {
  return {
    title: draft.title,
    description: draft.description,
    propertyType: draft.propertyType ?? "apartment",
    stateCode: draft.stateCode,
    city: draft.city,
    area: draft.area,
    address: draft.address,
    landmark: draft.landmark,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    toilets: draft.toilets,
    parkingSpaces: draft.parkingSpaces,
    floor: draft.floor,
    totalFloors: draft.totalFloors,
    sizeSqm: draft.sizeSqm,
    intent: draft.intent,
    rentNaira: draft.rentNaira,
    rentPeriod: draft.rentPeriod === "" ? "year" : draft.rentPeriod,
    rentNegotiable: draft.rentNegotiable,
    cautionDepositNaira: draft.cautionDepositNaira,
    serviceChargeNaira: draft.serviceChargeNaira,
    serviceChargePeriod: draft.serviceChargePeriod === "" ? "year" : draft.serviceChargePeriod,
    agencyFeeNaira: draft.agencyFeeNaira,
    legalFeeNaira: draft.legalFeeNaira,
    agreementFeeNaira: draft.agreementFeeNaira,
    totalMoveInNaira: draft.totalMoveInNaira,
    minimumTenancyMonths: draft.minimumTenancyMonths,
    availableFrom: draft.availableFrom,
    furnished: draft.furnished,
    rateNaira: draft.rateNaira,
    salePriceNaira: draft.salePriceNaira,
    saleAgencyFeeNaira: draft.saleAgencyFeeNaira,
    saleLegalFeeNaira: draft.saleLegalFeeNaira,
    governorsConsentFeeNaira: draft.governorsConsentFeeNaira,
    stampDutyNaira: draft.stampDutyNaira,
    surveyRegistrationFeeNaira: draft.surveyRegistrationFeeNaira,
    totalPurchaseNaira: draft.totalPurchaseNaira,
    priceNegotiable: draft.priceNegotiable,
    tenure: draft.tenure,
    saleStatus: draft.saleStatus === "" ? "available" : draft.saleStatus,
    yearBuilt: draft.yearBuilt,
    condition: draft.condition,
    powerGrid: draft.powerGrid,
    powerBackup: draft.powerBackup,
    powerBackupHours: draft.powerBackupHours,
    waterSupply: draft.waterSupply,
    prepaidMeter: draft.prepaidMeter,
    compound: draft.compound ?? EMPTY_COMPOUND_FORM,
    service: draft.service ?? EMPTY_SERVICE_FORM,
    unit: draft.unit ?? EMPTY_UNIT_FORM,
    flooding: draft.flooding ?? "",
    estateName: draft.access.estateName,
    gateDirections: draft.access.gateDirections,
    securityPhone: draft.access.securityPhone,
    accessCode: draft.access.accessCode,
  };
}

/* ------------------------------------------------------------ small parts */

/*
 * THE THIRD OF THREE SWITCHES STOOD HERE, AND IT IS GONE.
 *
 * `Toggle` drew its own 48x28 track with a 20px knob, animated on `left`
 * rather than on a transform (a layout property, so the row reflowed on every
 * frame of the animation instead of compositing), and painted
 * `--nf-gradient-agent` when on while every other switch on the platform
 * paints `--nf-brand-primary`. That last one is the part worth naming: the
 * same control meant the same thing in two places and was a different colour
 * in each, which is the uniqueness failure in its purest form.
 *
 * It is `components/ui/Switch.tsx` now, with `label` and `description`, which
 * is the primitive's OWN row branch. The research counted four separate row
 * layouts wrapped around one switch; this is the one the primitive already
 * ships, so the wrapper is deleted rather than replaced by a fourth.
 */


function Field({
  label,
  hint,
  error,
  fromMessage,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** V-09: the "From your message" mark and its "Looks right" control, when this value came from a pasted broadcast. */
  fromMessage?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="nf-label">
        {label}
        {fromMessage}
      </span>
      {children}
      {error ? (
        <span className="nf-body-sm mt-inline-tight block font-semibold text-[var(--nf-state-error)]">
          {error}
        </span>
      ) : hint ? (
        <span className="nf-body-sm mt-inline-tight block text-[var(--nf-content-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

/* ------------------------------------------------- the drawn furniture
 *
 * GOVERNING-06, -07 and -08 share one anatomy across all twelve screens, and
 * until now the wizard had none of it: a back chevron beside a row of small
 * filled rectangles, a display title with one quiet sentence under it and a
 * glass object on the right, a calm explanatory panel with a small round
 * glyph, and option cards that carry an object, a word, a line and a tick.
 * Each of those is one component here so a step cannot draw its own version.
 */

/**
 * The founder's 3D object on each step's header (30 September), in place of
 * the glass object's line twin. The amenities step has none.
 */
const STEP_ART: Partial<Record<(typeof STEP_KEYS)[number], Icon3DName>> = {
  basics: "list",
  photos: "camera",
  location: "explore",
  utilities: "power",
  pricing: "price-tag",
  guestView: "search",
  submit: "checklist",
};

/** The 3D object on each property type's card, where the sheets draw one. */
const TYPE_ART: Partial<Record<PropertyType, Icon3DName>> = {
  apartment: "apartment",
  shortlet: "shortlet",
  home: "home-verified",
  villa: "villa",
  hotel: "hotel",
  rental: "keys",
  office: "city",
  land: "land",
  restaurant: "restaurant",
};

/** The object each step's header carries, where the set has an honest one. */
const STEP_OBJECT: Partial<Record<(typeof STEP_KEYS)[number], BrandIconName>> = {
  basics: "apartment-block",
  photos: "camera",
  location: "pin-map",
  pricing: "naira-coins",
  guestView: "home-search",
  submit: "seal-pending",
  /*
   * `amenities` and `utilities` carry NO object, and that is a decision
   * rather than an omission. The render heads Light with a lightbulb and
   * Water with a droplet, and the 144-object glass pack has neither. The
   * nearest candidates mean something else in this product, and this codebase
   * already ruled that a glyph meaning the wrong thing is worse than no glyph
   * because the reader does not know they have misread it. Two objects are
   * named for the artwork list in the ledger instead.
   */
};

/** The object on each property type's card. 06 screen one draws all six. */
const TYPE_OBJECT: Record<PropertyType, BrandIconName> = {
  apartment: "apartment-block",
  shortlet: "shortlet",
  home: "modern-house",
  villa: "villa",
  hotel: "hotel",
  rental: "keys-home",
  shop: "shop-retail",
  office: "office-space",
  land: "land-plot",
  restaurant: "concierge-bell",
};

/** 06 screen four's four build conditions. */
const CONDITION_OBJECT: Record<BuildCondition, BrandIconName> = {
  newly_built: "home-check",
  renovated: "home-ring",
  old: "townhouse",
  off_plan: "doc-home",
};

/* 07 screens one and two. These are the stroked tier: they are small marks
   inside a card rather than the card's subject, which is what UiIcon is for. */
const GRID_GLYPH: Record<PowerGrid, UiIconName> = {
  BAND_A: "bolt",
  MOSTLY_ON: "bolt",
  PATCHY: "bolt",
  RARELY: "bolt",
  NONE: "block",
};
const BACKUP_GLYPH: Record<PowerBackup, UiIconName> = {
  NONE: "block",
  GENERATOR: "bolt",
  INVERTER: "bolt",
  SOLAR: "sun",
  GENERATOR_INVERTER: "bolt",
};
const WATER_GLYPH: Record<WaterSupply, UiIconName> = {
  TREATED_MAINS: "bath",
  BOREHOLE: "bath",
  PUMPED_STORAGE: "bath",
  TANKER: "bath",
  NONE: "block",
};

/** 07 screen three's twelve tiles. Same mapping the listing page tiles use. */
const AMENITY_GLYPH: Record<string, UiIconName> = {
  wifi: "wifi",
  ac: "snowflake",
  tv: "picture",
  kitchen: "kitchen",
  parking: "parking",
  pool: "pool",
  gym: "bolt",
  security: "verified",
  elevator: "arrow-up",
  furnished: "home",
  balcony: "building-apartment",
  garden: "map",
  laundry: "washing-machine",
  generator: "bolt",
  water: "bath",
  shower: "bath",
  breakfast: "utensils",
  workspace: "document",
};

/**
 * The one refusal shake (lister-publish.css, `[data-refused]`), replayed on
 * every refusal. The attribute is the DOM's, not React's, so taking it off and
 * putting it back across a reflow restarts the animation without remounting
 * the field the lister is typing in.
 */
function refuse(el: HTMLElement | null) {
  if (!el) return;
  el.removeAttribute("data-refused");
  void el.offsetWidth;
  el.setAttribute("data-refused", "");
}

/** The step header: title, one sentence, and the object where there is one. */
function StepHead({
  title,
  sub,
  object,
  art,
}: {
  title: string;
  sub?: string;
  object?: BrandIconName | "" | undefined;
  art?: Icon3DName | "" | undefined;
}) {
  return (
    <div className="nf-lw-head">
      <div className="min-w-0">
        {/* aria-live because the heading is what tells a screen reader the
            step changed, and this is the only heading on the screen. */}
        <h1 className="nf-lw-head__title" aria-live="polite">
          {title}
        </h1>
        {sub && <p className="nf-lw-head__sub">{sub}</p>}
      </div>
      {art ? (
        <span className="nf-lw-head__object grid size-14 shrink-0 place-items-center" aria-hidden="true" data-art={art}>
          <Icon3D name={art} size={56} priority />
        </span>
      ) : (
        object && (
          <IconPlate size="md" tone="brand" className="nf-lw-head__object">
            <UiIcon name={lineGlyphFor(object)} size={20} />
          </IconPlate>
        )
      )}
    </div>
  );
}

/**
 * The calm explanatory panel.
 *
 * The roles README names this as part of the register every surface inherits:
 * "the calm explanatory panel with a small round glyph that appears on almost
 * every screen in this set". The wizard had the sentences and drew them as
 * loose grey paragraphs, so the one piece of furniture the whole reference set
 * agrees on was the piece this flow did not have.
 */
function Note({
  children,
  glyph = "info",
  role,
}: {
  children: React.ReactNode;
  glyph?: UiIconName;
  role?: "status";
}) {
  return (
    <div className="nf-lw-note" role={role}>
      <span className="nf-lw-note__glyph" aria-hidden="true">
        <UiIcon name={glyph} size={16} />
      </span>
      <p className="nf-lw-note__body">{children}</p>
    </div>
  );
}

/** One option card: an object, a word, a line under it, and the tick. */
function Choice({
  name,
  sub,
  object,
  art,
  glyph,
  chosen,
  centred,
  onClick,
}: {
  name: string;
  sub?: string;
  object?: BrandIconName;
  /** The founder's 3D object, in place of the plate. */
  art?: Icon3DName | undefined;
  glyph?: UiIconName;
  chosen: boolean;
  centred?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={chosen}
      className={`nf-lw-choice${centred ? " nf-lw-choice--centred" : ""}`}
    >
      {art ? (
        <span className="nf-lw-choice__object grid size-12 place-items-center" aria-hidden="true" data-art={art}>
          <Icon3D name={art} size={48} />
        </span>
      ) : object ? (
        <IconPlate size="sm" tone={chosen ? "brand" : "neutral"} className="nf-lw-choice__object">
          <UiIcon name={lineGlyphFor(object)} size={20} />
        </IconPlate>
      ) : glyph ? (
        <span className="nf-lw-choice__glyph" aria-hidden="true">
          <UiIcon name={glyph} size={24} />
        </span>
      ) : null}
      <span className="nf-lw-choice__name">{name}</span>
      {sub && <span className="nf-lw-choice__sub">{sub}</span>}
      {chosen && (
        <span className="nf-lw-choice__tick" aria-hidden="true">
          <UiIcon name="verified-badge" size={20} />
        </span>
      )}
    </button>
  );
}

/**
 * The stepper of 06 screen three and 07 screen one: one rounded rectangle
 * holding minus, the figure and plus.
 *
 * The two ends are 44px, which is the whole reason this replaces the old
 * `.nf-icon-btn` pair: the drawn control is a single object and a thumb has
 * to be able to hit either end of it without looking.
 */
function Stepper({
  value,
  min,
  max,
  label,
  fewerLabel,
  moreLabel,
  inline,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  /** The group's accessible name: the thing being counted. */
  label: string;
  fewerLabel: string;
  moreLabel: string;
  inline?: boolean;
  onChange: (next: number) => void;
}) {
  /* The system's quantity stepper (section 19, kind 9). Inline beside a
     fact it sits at the row's end; alone it runs the full width, as the
     render draws the backup hours. */
  return (
    <Quantity
      value={value}
      min={min}
      max={max}
      label={label}
      decreaseLabel={fewerLabel}
      increaseLabel={moreLabel}
      onChange={onChange}
      className={inline ? "justify-self-end" : "w-full justify-between"}
    />
  );
}

/** A fact row: the object on its plate, the fact, the question, the control. */
function FactRow({
  glyph,
  name,
  ask,
  optional,
  children,
  stacked,
}: {
  glyph: UiIconName;
  name: string;
  ask: string;
  optional?: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={`nf-lw-fact${stacked ? " nf-lw-fact--stacked" : ""}`}>
      <span className="nf-lw-fact__plate" aria-hidden="true">
        <UiIcon name={glyph} size={24} />
      </span>
      <span className="nf-lw-fact__head">
        <span className="min-w-0">
          <span className="nf-lw-fact__name">{name}</span>
          <span className="nf-lw-fact__ask">{ask}</span>
        </span>
        {/* The Optional mark rides the head line, which is where the render
            puts it: top right of the card, level with the fact's name. */}
        {optional && <span className="nf-lw-fact__optional">{optional}</span>}
      </span>
      <div className="nf-lw-fact__control">{children}</div>
    </div>
  );
}

/**
 * WHAT A TENANT WILL ACTUALLY PAY, on the agent's own screen.
 *
 * GOVERNING-08 screen two, which this platform drew for the SEARCHER on the
 * listing page and never drew for the person setting the figures. So the
 * lister typed six amounts into six boxes and never once saw the sentence
 * those boxes make. This is that sentence, live, under the boxes.
 *
 * IT SHARES THE MODEL RATHER THAN MIRRORING IT. `moveInLines` is the single
 * place the honesty rule lives and the only reason it is a separate file: an
 * UNDECLARED cost is still LISTED, drawn with the words "Not declared", with
 * no figure, and contributes nothing to the total; a DECLARED ZERO agency fee
 * is a different fact and is drawn as "No agency fee" in the success ink. A
 * second implementation here is exactly what that file exists to prevent, so
 * the wizard builds the eight facts the model reads and hands them over.
 *
 * The total is never recomputed from the parts. The agent's own stated total
 * wins where they gave one, because agents fold fees into each other; where
 * they did not, the sum of the named parts is the honest FLOOR and it is
 * labelled "from" so it cannot read as a quote. That is the same rule the
 * listing page follows, in the same words.
 *
 * AND THE PLATFORM CHARGES NOTHING HERE. Every line is the agent's, the
 * landlord's or the estate's. There is no Vallo row because there is no Vallo
 * fee.
 */
function TenantPays({
  facts,
  currency,
  locale,
  copy,
  moveInCopy,
  moneyMap,
}: {
  facts: Parameters<typeof moveInLines>[0];
  currency: string;
  locale: Locale;
  copy: WizardCopy;
  moveInCopy: Dictionary["moveIn"];
  moneyMap?: Dictionary["afterTheGate"]["moneyMap"];
}) {
  /* V-46: the agent sees the captions a tenant will, and before a mandate is
     dated by staff no caption names a landlord. */
  const lines = moveInLines(
    facts,
    moveInCopy,
    moneyMap ? { ctx: { mandateVerified: false, ownershipVerified: false }, copy: moneyMap } : undefined,
  );
  const declared = lines.filter((line) => line.minor !== undefined && line.minor !== null);
  const total = declared.reduce((sum, line) => sum + (line.minor ?? 0), 0);

  /* Nothing has been named yet, so there is nothing honest to draw. The panel
     says where the breakdown will appear rather than drawing an empty one. */
  if (declared.length === 0) {
    return <Note>{copy.drawn.tenantPays.empty}</Note>;
  }

  return (
    <div className="nf-movein" data-testid="wizard-tenant-pays">
      <ul className="nf-movein__list">
        {lines.map((line) => {
          const isDeclared = line.minor !== undefined && line.minor !== null;
          return (
            <li
              key={line.key}
              className="nf-movein__row"
              data-declared={isDeclared || undefined}
              data-testid={`wizard-pays-${line.key}`}
            >
              <DetailGlyph name={line.glyph} className="nf-movein__plate" />
              <span className="nf-movein__name">
                <span className="nf-movein__label">
                  {line.label}
                  {line.basis && <span className="nf-movein__basis"> ({line.basis})</span>}
                </span>
                {/* A declared ZERO does not also say who keeps it: "No agency
                    fee" over "Paid to the agent" is two halves of a sentence
                    that contradict each other. */}
                {isDeclared && line.minor !== 0 && line.keeper && (
                  <span className="nf-movein__keeper">{line.keeper}</span>
                )}
              </span>
              <span className="nf-movein__figure">
                {isDeclared ? (
                  line.key === "agency" && line.minor === 0 ? (
                    <span className="nf-movein__free">{moveInCopy.noAgencyFee}</span>
                  ) : (
                    <Amount minorUnits={line.minor as number} locale={locale} currency={currency} />
                  )
                ) : (
                  <span className="nf-movein__undeclared">{moveInCopy.notDeclared}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="nf-movein__total" data-testid="wizard-pays-total">
        <DetailGlyph name="coins" size="lg" className="nf-movein__plate nf-movein__plate--total" />
        <span className="min-w-0">
          <span className="nf-movein__total-label">{moveInCopy.totalFrom}</span>
          <span className="nf-movein__total-figure">
            <Amount minorUnits={total} locale={locale} currency={currency} />
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * V-09: THE "FROM YOUR MESSAGE" MARK, AND THE ONE-TAP WAY TO CONFIRM IT.
 *
 * Drawn beside every field a pasted broadcast filled. "Looks right" confirms
 * the value without retyping it, which is what clears it from the set the
 * submit gate reads; editing the field clears it too. Nothing is drawn once
 * the agent has confirmed or changed the value.
 */
function FromMessageMark({
  tag,
  confirm,
  onConfirm,
}: {
  tag: string;
  confirm: string;
  onConfirm: () => void;
}) {
  return (
    <span className="ml-inline-tight inline-flex flex-wrap items-center gap-2xs align-middle" data-testid="from-message">
      <span className="nf-badge nf-badge--info">{tag}</span>
      <Button
        variant="quiet"
        size="sm"
        className="min-h-11"
        onClick={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        {confirm}
      </Button>
    </span>
  );
}

/* ------------------------------------------------------------- the wizard */

/**
 * True when a group's saved answers could not be read AND the lister has not
 * touched the empty form standing in for them. Such a group is left out of
 * the save rather than written back as nulls (review 13).
 */
function untouchedUnread(unread: readonly OwnAnswers[], group: OwnAnswers, value: unknown, empty: unknown): boolean {
  return unread.includes(group) && JSON.stringify(value) === JSON.stringify(empty);
}

export function ListingWizard({
  success,
  copy,
  reference,
  moveInCopy,
  compoundCopy,
  serviceCopy,
  unitCopy,
  floodCopy,
  floodOpen = false,
  feeGateBlocking = false,
  initialFeePolicy,
  remainderCopy,
  moneyMapCopy,
  locale,
  userId,
  states,
  amenities,
  initial,
  canPersist,
  startAt = 0,
  broadcastCopy,
  guideCopy,
  initialUnconfirmed = [],
  shotsCopy,
  demandCopy,
  pathCopy,
  listerCopy,
  sentFrom = null,
}: {
  /** Round 5: the publish moment's few words. Absent in older harnesses, which draw the card unlabelled. */
  listerCopy?: Dictionary["experienceLister"];
  /**
   * A listing the page found already with the review team (`?id=` of one in
   * SUBMITTED or UNDER_REVIEW): the wizard opens as the chain it became when
   * it was sent, settled, rather than a lock screen. It is also what keeps the
   * screen in place when sending revalidates this route (the page re-renders
   * with the listing now in review, and this is the same component there).
   */
  sentFrom?: { status: ListingStatus; submittedAt: string | null } | null;
  /**
   * The progress path's words (reference 7110). Absent in the harnesses that
   * photograph the governing screens, which then draw exactly what they did.
   */
  pathCopy?: Dictionary["experienceFeatures"]["wizard"];
  /** The page's `t.success`, for "Your listing is in review" over the chain. */
  success?: SuccessWords;
  /** V-70: the shot list's words. Without them the shot list is not drawn. */
  shotsCopy?: Dictionary["afterTheGate"]["shots"];
  /** V-10: the saved-search count on the last step. Absent in harnesses. */
  demandCopy?: Dictionary["frontDoor"]["demand"];
  /**
   * V-09: the unconfirmed set as the server holds it for this draft
   * (`listing_broadcast_marks`), so another device starts from the truth.
   * Null when the read failed: the set is then never written from here (an
   * empty set would wipe the server's) and submit waits until it is read.
   */
  initialUnconfirmed?: readonly string[] | null;
  copy: WizardCopy;
  /**
   * V-74: the pricing step's guide. Absent in the harnesses, which then draw
   * exactly what they did.
   */
  guideCopy?: Dictionary["frontDoor"]["guide"];
  /**
   * V-09, "Start from your WhatsApp message". Absent in the harnesses that
   * photograph the governing screens, which then draw exactly what they did.
   */
  broadcastCopy?: Dictionary["frontDoor"]["broadcast"];
  /* Its own slice rather than a key inside `agentListings`, because the same
     words are read by the search page, the public listing page and the
     lister's console, and one namespace owns them. */
  reference: Dictionary["listingReference"];
  /* The move-in slice, for the same reason `reference` is its own slice: the
     breakdown GOVERNING-08 screen two draws is the searcher's block turned
     round to face the agent, and it has to read in exactly the same words. */
  moveInCopy: Dictionary["moveIn"];
  /** V-28: the compound's five questions. */
  compoundCopy: Dictionary["shape"]["compound"];
  /** V-68: the service charge questions. */
  serviceCopy: Dictionary["shape"]["service"];
  /** V-66: the unit shape question. */
  unitCopy: Dictionary["shape"]["unit"];
  /** V-41: the flooding question. */
  floodCopy: Dictionary["shape"]["neighbours"];
  /** V-41 is behind a fail-closed flag; the question shows only when it is on. */
  floodOpen?: boolean;
  /**
   * D60: whether Send for review waits for a recorded fee acceptance
   * (`lister_fee_gate_blocking`, read fail closed). The fee screen is drawn on
   * the last step either way; off, which is the default, nothing waits.
   */
  feeGateBlocking?: boolean;
  /**
   * The fee rates as already read, for the harnesses that draw the last step
   * without a server (the `startAt` pattern). The product passes nothing and
   * the step reads them when it opens.
   */
  initialFeePolicy?: ListerFeePolicy | null;
  /** V-13: the sentence that refuses an unexplained remainder in the total. */
  remainderCopy?: Dictionary["afterTheGate"]["remainder"];
  /** V-46: the captions that say who each move-in line is paid to. */
  moneyMapCopy?: Dictionary["afterTheGate"]["moneyMap"];
  locale: Locale;
  userId: string | null;
  states: { code: string; name: string }[];
  amenities: { code: string; label: string }[];
  initial: WizardDraft | null;
  canPersist: boolean;
  /**
   * The step to open on, zero based and clamped.
   *
   * The preview harness passes it so every one of the eight steps can be
   * photographed beside its governing image; nothing in the product passes it
   * today, and the default is the first step, which is what /agent/list has
   * always done.
   */
  startAt?: number;
}) {
  const router = useRouter();
  /* Whether the draft really lands on this device, so the path's autosave
     line only says what is true. */
  const deviceKeeps = useDeviceStorage() && listingDraftKey(userId) !== null;
  const [step, setStep] = useState(() =>
    sentFrom ? STEP_KEYS.length - 1 : Math.min(Math.max(Math.trunc(startAt), 0), STEP_KEYS.length - 1),
  );
  /* Round 5: which way the lister is travelling, and whether anything has
     moved yet. Both change in the same render as the step, so the step being
     left never animates, and the first paint is still (lister-publish.css). */
  const [travel, setTravel] = useState<{ dir: "forward" | "back"; moved: boolean }>({ dir: "forward", moved: false });
  /** The step an Edit came from, while the lister is on an earlier one. */
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [values, setValues] = useState<Values>(initial ? valuesFrom(initial) : EMPTY);
  /* The answer groups whose saved values could not be read (review 13). */
  const unread = useMemo(() => initial?.unread ?? [], [initial]);
  /* The photos and videos, in the one order the lister arranged them. */
  const [media, setMedia] = useState<Media[]>(() => mediaFrom(initial));
  const photos = useMemo(() => media.filter((item): item is Media & { kind: "photo" } => item.kind === "photo"), [media]);
  const videos = useMemo(() => media.filter((item): item is Media & { kind: "video" } => item.kind === "video"), [media]);
  /** The video being uploaded now, for its progress line. */
  const [videoProgress, setVideoProgress] = useState<{ name: string; percent: number } | null>(null);
  /* The walkthrough upload in flight, so the lister can stop it. */
  const videoAbort = useRef<AbortController | null>(null);
  useEffect(() => () => videoAbort.current?.abort(), []);
  const [chosenAmenities, setChosenAmenities] = useState<string[]>(initial?.amenityCodes ?? []);
  const [listingId, setListingId] = useState<string | null>(initial?.id ?? null);
  /*
   * V-09: THE FIELDS A PASTED BROADCAST FILLED, until the agent touches them.
   * A key leaves this set the moment the agent edits that field, which is
   * what "confirmed" means here. The submit gate refuses while any MONEY key
   * is still in it: a figure read from a WhatsApp message is not sent for
   * review until a person has looked at it.
   */
  const [fromMessage, setFromMessage] = useState<ReadonlySet<string>>(() => new Set(initialUnconfirmed ?? []));
  const marksUnread = initialUnconfirmed === null;

  /*
   * The unconfirmed set survives a reload, keyed by the listing it belongs to
   * (or "new" before the first save). Without this a reload would quietly
   * treat every figure read from a WhatsApp message as confirmed. Storage
   * that is unavailable costs only the reminder: the values themselves are in
   * the draft.
   */
  const unconfirmedKey = `vallo_broadcast_unconfirmed:${listingId ?? "new"}`;
  const [unconfirmedLoaded, setUnconfirmedLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (unconfirmedLoaded === unconfirmedKey) return;
    try {
      const raw = localStorage.getItem(unconfirmedKey) ?? (listingId ? localStorage.getItem("vallo_broadcast_unconfirmed:new") : null);
      const keys = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(keys) && keys.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring from storage, once per key
        setFromMessage((prev) => new Set([...prev, ...keys.filter((k): k is string => typeof k === "string")]));
      }
    } catch {
      /* storage unavailable */
    }
    setUnconfirmedLoaded(unconfirmedKey);
  }, [unconfirmedKey, unconfirmedLoaded, listingId]);
  useEffect(() => {
    if (unconfirmedLoaded !== unconfirmedKey) return;
    try {
      if (fromMessage.size === 0) localStorage.removeItem(unconfirmedKey);
      else localStorage.setItem(unconfirmedKey, JSON.stringify([...fromMessage]));
      if (listingId) localStorage.removeItem("vallo_broadcast_unconfirmed:new");
    } catch {
      /* storage unavailable */
    }
  }, [fromMessage, unconfirmedKey, unconfirmedLoaded, listingId]);

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneGate, setPhoneGate] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  /** One line per file the last pick refused, naming the file. */
  const [photoProblems, setPhotoProblems] = useState<string[]>([]);
  /** The files the last pick could not upload for a reason a second try can fix. */
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  /* STORE-04: the shell's own camera, when the running binary carries it. */
  const [nativeCamera, setNativeCamera] = useState(false);
  useEffect(() => {
    let live = true;
    void canCapturePhoto().then((able) => {
      if (live) setNativeCamera(able);
    });
    return () => {
      live = false;
    };
  }, []);
  /*
   * SENT: what the server said when it accepted the listing, and whether that
   * happened in this sitting (`now`, which is what earns the arrival motion and
   * the one medium haptic). Only ever set from the action's own ok or from the
   * page's read of the stored row, so the chain never runs ahead of the truth.
   */
  const [sent, setSent] = useState<{ status: ListingStatus; at: string | null; now: boolean } | null>(() =>
    sentFrom ? { status: sentFrom.status, at: sentFrom.submittedAt, now: false } : null,
  );
  /* D51, D60, D61: THE FEE SCREEN. The rates in force for this listing are
     read when the submit step opens, and the screen is drawn above Send for
     review. `undefined` is "not read yet"; null is "could not be read", which
     the screen says in words. The acceptance is held here only while the
     blocking flag is on: with it off there is no accept to hold. */
  const [feePolicy, setFeePolicy] = useState<ListerFeePolicy | null | undefined>(initialFeePolicy);
  const [feeAcceptance, setFeeAcceptance] = useState<ListerFeeAcceptance | null>(null);
  const [pending, startTransition] = useTransition();
  /** Whether the last `persist` reached the server and was accepted. */
  const lastSaveOk = useRef(true);
  /** Whether step one's title refusal is currently being shown. */
  const titleGateOpen = useRef(false);
  const restored = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  /* The two counts the render draws as steppers and this form stored as
     text. Empty stays empty in `values` so a blank is still a blank to the
     save path; the stepper only ever sees a number. */
  /* `step` is clamped by `go`, so this is never undefined in practice. The
     narrowing is the compiler's, not a defence against a real case. */
  const stepKey = STEP_KEYS[step];
  const availableFromDate = (() => {
    const parts = values.availableFrom.split("-").map(Number);
    const [year, month, day] = parts;
    if (parts.length !== 3 || !year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day, 12));
  })();
  const toiletCount = Number(values.toilets) || 0;
  const backupHours = Number(values.powerBackupHours) || 0;
  const parkingCount = Number(values.parkingSpaces) || 0;

  const rental = isRental(values.propertyType);
  /*
   * Which of the three money shapes this listing is in.
   *
   * `sale` wins over everything: a property being sold has no rent and no
   * nightly rate. Otherwise the CATEGORY decides, not another question, because
   * a shop is let by the year and a shortlet is let by the night and asking
   * somebody to confirm what they already told us is a question with one
   * answer.
   */
  const forSale = values.intent === "sale";
  const tenancy = !forSale && isTenancy(values.propertyType);
  const shortStay = !forSale && !tenancy;
  const perHead = ratePeriodFor(values.propertyType) === "guest";

  const rentMinor = parseNairaToKobo(values.rentNaira) ?? 0;
  const rateMinor = parseNairaToKobo(values.rateNaira) ?? 0;
  const saleMinor = parseNairaToKobo(values.salePriceNaira) ?? 0;
  /* The headline figure, resolved exactly the way the catalogue resolves it, so
     the preview card on step 7 shows the number a renter will see. */
  const priceMinor = forSale ? saleMinor : tenancy ? rentMinor : rateMinor;
  const feeKind = forSale ? "sale" : tenancy ? "rent" : "stay";
  /* Void the moment the price, the rate or the terms move: an acceptance is of figures. */
  const feeAccepted = acceptanceMatches(feeAcceptance, listerFeeFigures(priceMinor, feePolicy ?? null), feePolicy ?? null);
  const feeHolds = feeGateHoldsSend(feeGateBlocking, feeAccepted);
  useEffect(() => {
    /* Sent, the fee screen is gone and its rates are not read. */
    if (step !== 7 || !listingId || sent) return;
    let live = true;
    void fetchListerFeePolicy(listingId)
      .catch(() => null)
      .then((policy) => {
        if (live) setFeePolicy(policy);
      });
    return () => {
      live = false;
    };
  }, [step, listingId, sent]);

  /* V-74: what similar homes in the area are asking, on the pricing step only. */
  const guideSubject = useMemo<GuideSubject>(
    () => ({
      stateCode: values.stateCode,
      city: values.city.trim() === "" ? null : values.city.trim(),
      area: values.area.trim() === "" ? null : values.area.trim(),
      propertyType: values.propertyType as GuideSubject["propertyType"],
      intent: values.intent,
      rentPeriod: forSale ? null : values.rentPeriod,
      bedrooms: values.bedrooms,
    }),
    [values.stateCode, values.city, values.area, values.propertyType, values.intent, values.rentPeriod, values.bedrooms, forSale],
  );
  const priceGuide = usePriceGuide(guideSubject, Boolean(guideCopy) && step === 5 && !shortStay);

  /* What has to be found before the keys change hands. Summed live so the
     lister watches the real number appear as they type the parts, which is the
     figure a Nigerian tenant is actually shopping on and the one the platform
     has never shown anybody. */
  /*
   * THE SERVICE CHARGE WAS MISSING FROM THIS LIST AND THE TENANT WAS ALWAYS
   * GOING TO BE SHOWN IT.
   *
   * Found by drawing GOVERNING-08 screen two under the boxes that feed it: the
   * breakdown totalled a stated tenancy at 5,150,000 while the hint two inches
   * above it said "leave blank and we show 5,000,000", and the gap was exactly
   * the service charge. `moveInParts` in `lib/listings/pricing.ts` is the
   * canonical list and has always counted it, so the listing page a searcher
   * reads counted it too. The only place that did not was the agent's own
   * floor, which is the number they price against.
   *
   * It raises the floor the stated total is checked against, which is the
   * correct direction: a total BELOW the parts the lister named is a quote
   * that contradicts its own breakdown.
   */
  const feeParts = [
    values.rentNaira,
    values.cautionDepositNaira,
    values.serviceChargeNaira,
    values.agencyFeeNaira,
    values.legalFeeNaira,
    values.agreementFeeNaira,
  ];
  const partsSumMinor = feeParts.reduce(
    (total, raw) => total + (parseNairaToKobo(raw) ?? 0),
    0,
  );
  /*
   * The eight facts `moveInLines` reads, straight off the form.
   *
   * `parseNairaToKobo` returns null for an EMPTY box and a number for a typed
   * one, including a typed zero. That is exactly the declared / undeclared
   * distinction the model needs, so `?? undefined` is the whole translation:
   * a blank stays absent and a typed 0 stays 0. Collapsing null to 0 here
   * would turn every silence into a claim of "free", which is the one thing
   * this model exists to stop.
   */
  const paysFacts = {
    priceMinor: rentMinor,
    pricePeriod: values.rentPeriod,
    agencyFeeMinor: parseNairaToKobo(values.agencyFeeNaira) ?? undefined,
    legalFeeMinor: parseNairaToKobo(values.legalFeeNaira) ?? undefined,
    agreementFeeMinor: parseNairaToKobo(values.agreementFeeNaira) ?? undefined,
    cautionDepositMinor: parseNairaToKobo(values.cautionDepositNaira) ?? undefined,
    serviceChargeMinor: parseNairaToKobo(values.serviceChargeNaira) ?? undefined,
    serviceChargePeriod: values.serviceChargePeriod,
  };
  const statedTotalMinor = parseNairaToKobo(values.totalMoveInNaira);
  /* V-13. The part of a stated total the fee boxes do not explain. */
  const moveInRemainderMinor =
    statedTotalMinor !== null && statedTotalMinor > partsSumMinor ? statedTotalMinor - partsSumMinor : 0;

  /* THE SAME ARITHMETIC ON THE SALE SIDE, and the price is one of the parts.
     "The total to buy" means the asking price plus everything on top of it, so
     a hundred and eighty million asking price is routinely two hundred million
     by the time the deed is signed, and until now this platform collected
     none of the difference. */
  const purchasePartsMinor = [
    values.salePriceNaira,
    values.saleAgencyFeeNaira,
    values.saleLegalFeeNaira,
    values.governorsConsentFeeNaira,
    values.stampDutyNaira,
    values.surveyRegistrationFeeNaira,
  ].reduce((total, raw) => total + (parseNairaToKobo(raw) ?? 0), 0);
  const statedPurchaseMinor = parseNairaToKobo(values.totalPurchaseNaira);
  const purchaseMinor = statedPurchaseMinor ?? purchasePartsMinor;

  const words = countWords(values.description);
  /* SEC-06: the database holds a listing that states a tenant preference for
     review; this says so while the lister is still typing. */
  const preference = tenantPreference(`${values.title} ${values.description}`);
  const stepNames = STEP_KEYS.map((key) => copy.wizard.steps[key]);
  const amenityNames = copy.amenities.names as Record<string, string | undefined>;
  /* The words after the headline figure, from the dictionary's own period
     table. A tenancy printed "per year" whatever cycle the rent was quoted
     in, so a monthly rent read on the preview card as a yearly one. */
  const pricePeriod = forSale
    ? copy.pricing.period.sale
    : tenancy
      ? copy.pricing.period[values.rentPeriod]
      : perHead
        ? copy.pricing.period.guest
        : copy.pricing.period.night;

  const unmet = useMemo(
    () =>
      submitRequirements({
        title: values.title,
        description: values.description,
        propertyType: values.propertyType,
        stateCode: values.stateCode,
        city: values.city,
        area: values.area,
        intent: values.intent,
        rentMinor: tenancy ? rentMinor : null,
        rentPeriod: tenancy ? values.rentPeriod : null,
        rateMinor: shortStay ? rateMinor : null,
        ratePeriod: shortStay ? ratePeriodFor(values.propertyType) : null,
        salePriceMinor: forSale ? saleMinor : null,
        tenure: values.tenure === "" ? null : values.tenure,
        bedrooms: values.bedrooms,
        bathrooms: values.bathrooms,
        unitShape: values.unit.shape === "" ? null : values.unit.shape,
        amenityCount: chosenAmenities.length,
        photoCount: photos.length,
        videoCount: videos.length,
        hasCover: media[0]?.kind === "photo",
        moveInStatedMinor: tenancy ? statedTotalMinor : null,
        moveInPartsMinor: tenancy ? [partsSumMinor] : [],
      }),
    [
      values,
      tenancy,
      shortStay,
      forSale,
      rentMinor,
      rateMinor,
      saleMinor,
      chosenAmenities.length,
      photos.length,
      videos.length,
      media,
      statedTotalMinor,
      partsSumMinor,
    ],
  );

  /**
   * The gate's verdict, in the agent's language.
   *
   * `submitRequirements` decides which fields are unmet; this decides how each
   * one reads. Where one field can fail two ways (a title too short or too
   * long, photos too few or no cover) the same local values that fed the gate
   * pick the sentence, so the wording always matches the actual failure. A
   * field the gate grows later falls through to the message it carried, which
   * is English but never blank.
   */
  type ChecklistRow = { field: string; label: string; covers?: string[] };
  /** The checklist rows, plus one for any unmet field no row stands for. */
  function withUncovered(rows: ChecklistRow[]): ChecklistRow[] {
    const covered = new Set(rows.flatMap((row) => row.covers ?? [row.field]));
    const extra = unmet
      .filter((u) => !covered.has(u.field))
      .map((u) => ({ field: u.field, label: gateText(u.field, u.message) }));
    return [...rows, ...extra];
  }

  function gateText(field: string, fallback: string): string {
    const g = copy.gate;
    switch (field) {
      case "title":
        return collapseSpaces(values.title).length > MAX_TITLE_LENGTH
          ? fill(g.titleLong, { max: MAX_TITLE_LENGTH })
          : fill(g.titleShort, { min: MIN_TITLE_LENGTH });
      case "description":
        return fill(g.description, { min: MIN_DESCRIPTION_WORDS, count: words });
      case "propertyType":
        return g.propertyType;
      case "photos":
        return media.length < MIN_MEDIA
          ? fill(g.photos, { min: MIN_MEDIA, count: media.length })
          : g.cover;
      case "stateCode":
        return g.stateCode;
      case "city":
        return g.city;
      case "area":
        return g.area;
      case "amenities":
        return g.amenities;
      /* The three money branches. The dictionary has two sentences, for a
         yearly rent and a nightly rate, which is what it was written against.
         The sale and per-head cases are new markets it has not been translated
         for yet, so they read in English rather than printing the wrong one of
         the two it does have. */
      case "rent":
        return values.rentPeriod === "year" ? g.priceYear : g.rent;
      case "rate":
        return perHead ? "Set the price per head in naira." : g.priceNight;
      case "salePrice":
        return "Set the asking price in naira.";
      case "tenure":
        return "Say what title comes with the property, for example Certificate of Occupancy.";
      case "rentPeriod":
        return "Say whether the rent is per year, quarter or month.";
      case "ratePeriod":
        return "Say what the rate covers.";
      case "bedrooms":
        return g.bedrooms;
      case "bathrooms":
        return g.bathrooms;
      case "unitShape":
        return unitCopy.wizardRequired;
      case "totalMoveIn":
        return remainderCopy && moveInRemainderMinor > 0
          ? fill(remainderCopy.gate, { amount: formatMoney(moveInRemainderMinor, locale) })
          : fallback;
      default:
        return fallback;
    }
  }

  /**
   * Screen reader wording for the two counter buttons. The label is lowercased
   * in the active locale so "One more bedrooms" reads as a sentence rather
   * than a heading, and so a language with its own casing rules keeps them.
   */
  function counterAria(direction: "fewer" | "more", label: string): string {
    const template = direction === "fewer" ? copy.basics.counterFewer : copy.basics.counterMore;
    return fill(template, { label: label.toLocaleLowerCase(locale) });
  }

  /* ---------------------------------------------------------- draft safety */

  /*
   * Restore a device draft once, and only when the platform did not hand us
   * one, so a stored listing always wins over whatever this browser remembers.
   *
   * The device draft now records WHICH listing it is a copy of, and that turns
   * out to be the load-bearing field. Without it the two halves of the save
   * could not tell each other apart: this browser remembered the words, the
   * platform held the row, the photos and the amenities, and nothing connected
   * them. Restoring the words into a wizard with no id meant the next autosave
   * INSERTED a second listing, so the host ended up owning two half drafts, saw
   * neither set of photos, and had every reason to believe their work was gone.
   *
   * When the stored draft names a listing the platform did NOT hand back, the
   * right answer is to drop it rather than retype it. That combination means
   * the listing has been deleted, or has moved past DRAFT and is no longer the
   * host's to edit; in both cases writing its old text into a brand new row
   * would resurrect something the host or a reviewer already settled.
   */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (initial) return;
    /* SUP-16: one account's draft, never the last person's on this device. */
    const draftKey = listingDraftKey(userId);
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        listingId?: string | null;
        values?: Partial<Values>;
        amenities?: string[];
      };
      if (typeof parsed.listingId === "string" && parsed.listingId.length > 0) {
        localStorage.removeItem(draftKey);
        return;
      }
      if (parsed.values) setValues((prev) => ({ ...prev, ...parsed.values }));
      if (parsed.amenities) setChosenAmenities(parsed.amenities);
    } catch {
      /* a malformed draft is not worth an error message */
    }
  }, [initial, userId]);

  useEffect(() => {
    /* A listing with the review team is not a draft to keep on the device. */
    if (!restored.current || sent) return;
    const draftKey = listingDraftKey(userId);
    if (!draftKey) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ listingId, values, amenities: chosenAmenities }),
      );
    } catch {
      /* storage unavailable, the platform copy still holds */
    }
  }, [listingId, values, chosenAmenities, userId, sent]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFromMessage((prev) => {
      if (!prev.has(key as string)) return prev;
      const next = new Set(prev);
      next.delete(key as string);
      return next;
    });
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  /**
   * V-09: put a pasted broadcast into the form. ONLY FIELDS STILL AT THEIR
   * EMPTY STARTING VALUE are filled, so nothing the agent typed is ever
   * overwritten, and every field filled is marked "from your message".
   * Returns the keys actually filled, for the panel's list.
   */
  function applyBroadcast(result: BroadcastParse): BroadcastKey[] {
    const taken: BroadcastKey[] = [];
    const next: Partial<Values> = {};
    for (const key of result.filled) {
      const incoming = result.values[key];
      if (incoming === undefined) continue;
      const current = values[key as keyof Values];
      const blank = EMPTY[key as keyof Values];
      if (current !== blank) continue;
      (next as Record<string, unknown>)[key] = incoming;
      taken.push(key);
    }
    if (taken.length === 0) return taken;
    setValues((prev) => ({ ...prev, ...next }));
    setFromMessage((prev) => new Set([...prev, ...taken]));
    return taken;
  }

  /** Confirm a filled value as it stands: it leaves the set the gate reads. */
  function confirmFromMessage(keys: readonly string[]) {
    setFromMessage((prev) => {
      const next = new Set(prev);
      for (const key of keys) next.delete(key);
      return next;
    });
  }

  /** The "From your message" mark for one or more fields, or nothing. */
  const mark = (...keys: (keyof Values)[]): React.ReactNode => {
    if (!broadcastCopy) return undefined;
    const live = keys.filter((key) => fromMessage.has(key as string)) as string[];
    if (live.length === 0) return undefined;
    return (
      <FromMessageMark
        tag={broadcastCopy.tag}
        confirm={broadcastCopy.confirm}
        onConfirm={() => confirmFromMessage(live)}
      />
    );
  };

  const unconfirmedMoney = BROADCAST_MONEY_KEYS.filter((key) => fromMessage.has(key));
  /** Whether Send for review is held, and so whether the last step reads "ready". */
  const sendBlocked = unmet.length > 0 || unconfirmedMoney.length > 0 || marksUnread || feeHolds;

  /* --------------------------------------------------------------- saving */

  /** Push the current state to the platform. Returns the listing id, or null. */
  const persist = useCallback(async (): Promise<string | null> => {
    if (!canPersist) return null;
    /* Nothing is sent below two characters. That is only a successful save
       when a stored draft already exists; with none, `go` and `send` must
       not treat the step as saved. */
    if (values.title.trim().length < 2) {
      lastSaveOk.current = listingId !== null;
      return listingId;
    }

    /* A server action can throw rather than answer: a dropped connection, or a
       deploy between two taps ("Failed to find Server Action"). Uncaught, that
       unmounted the whole wizard to the error page. It is caught here, said
       plainly, and recorded so `go` does not move on from a step that did not
       save. */
    let result: Awaited<ReturnType<typeof saveDraft>>;
    try {
      result = await saveDraft({
      id: listingId ?? undefined,
      /* V-09: the unconfirmed set goes to the server in the same save. */
      broadcastUnconfirmed: marksUnread ? undefined : [...fromMessage],
      title: values.title,
      /* EVERY BOX THE LISTER EMPTIED IS SENT AS NULL, which the action reads as
         "clear the column". An empty box used to be left out of the save, and
         the server keeps what it is not sent, so a deleted fee, address or
         count stayed on the listing that went to review and came back here on
         the next visit. Undefined is now only ever "not this save's business". */
      description: cleared(values.description),
      propertyType: values.propertyType,
      stateCode: values.stateCode === "" ? null : values.stateCode,
      city: cleared(values.city),
      area: cleared(values.area),
      address: cleared(values.address),
      landmark: cleared(values.landmark),
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      toilets: cleared(values.toilets),
      parkingSpaces: cleared(values.parkingSpaces),
      floor: cleared(values.floor),
      totalFloors: cleared(values.totalFloors),
      sizeSqm: cleared(values.sizeSqm),
      intent: values.intent,
      rentNaira: cleared(values.rentNaira),
      rentPeriod: values.rentPeriod,
      rentNegotiable: values.rentNegotiable,
      cautionDepositNaira: cleared(values.cautionDepositNaira),
      serviceChargeNaira: cleared(values.serviceChargeNaira),
      serviceChargePeriod: values.serviceChargePeriod,
      agencyFeeNaira: cleared(values.agencyFeeNaira),
      legalFeeNaira: cleared(values.legalFeeNaira),
      agreementFeeNaira: cleared(values.agreementFeeNaira),
      totalMoveInNaira: cleared(values.totalMoveInNaira),
      minimumTenancyMonths: cleared(values.minimumTenancyMonths),
      availableFrom: cleared(values.availableFrom),
      furnished: values.furnished === "" ? null : values.furnished,
      rateNaira: cleared(values.rateNaira),
      salePriceNaira: cleared(values.salePriceNaira),
      saleAgencyFeeNaira: cleared(values.saleAgencyFeeNaira),
      saleLegalFeeNaira: cleared(values.saleLegalFeeNaira),
      governorsConsentFeeNaira: cleared(values.governorsConsentFeeNaira),
      stampDutyNaira: cleared(values.stampDutyNaira),
      surveyRegistrationFeeNaira: cleared(values.surveyRegistrationFeeNaira),
      totalPurchaseNaira: cleared(values.totalPurchaseNaira),
      priceNegotiable: values.priceNegotiable,
      tenure: values.tenure === "" ? null : values.tenure,
      saleStatus: values.saleStatus,
      yearBuilt: cleared(values.yearBuilt),
      condition: values.condition === "" ? null : values.condition,
      powerGrid: values.powerGrid === "" ? null : values.powerGrid,
      powerBackup: values.powerBackup === "" ? null : values.powerBackup,
      powerBackupHours: cleared(values.powerBackupHours),
      waterSupply: values.waterSupply === "" ? null : values.waterSupply,
      prepaidMeter: values.prepaidMeter,
      /* A group whose saved answers could not be read, and which the lister
         has not touched, is left out: sending its empty form would write
         nulls over answers this screen never saw (review 13). */
      ...(untouchedUnread(unread, "compound", values.compound, EMPTY_COMPOUND_FORM) ? {} : compoundPayload(values.compound)),
      ...(untouchedUnread(unread, "service", values.service, EMPTY_SERVICE_FORM) ? {} : servicePayload(values.service)),
      ...(untouchedUnread(unread, "unit", values.unit, EMPTY_UNIT_FORM) ? {} : unitPayload(values.unit, values.bedrooms)),
      ...(untouchedUnread(unread, "flood", values.flooding, "") ? {} : { flooding: values.flooding === "" ? null : values.flooding }),
    });
    } catch {
      lastSaveOk.current = false;
      setNotice(copy.wizard.saveUnreached);
      return listingId;
    }

    if (!result.ok) {
      lastSaveOk.current = false;
      setNotice(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return listingId;
    }

    lastSaveOk.current = true;
    setNotice(null);
    /* Only the server's own field errors are cleared by a good save. The
       step-one title refusal is the client gate's, not the server's, and a
       save that succeeds with a two-letter title must not wipe the sentence
       explaining why Next did not move (the draft saves from two characters,
       the step needs eight). */
    setFieldErrors((prev): Record<string, string> =>
      prev.title && titleGateOpen.current ? { title: prev.title } : {},
    );
    setListingId(result.data.id);
    setSavedAt(formatDate(new Date(), locale, { hour: "2-digit", minute: "2-digit" }));

    /* The two follow-up writes are guarded like the first: either one
       throwing (a dropped connection between taps) used to reject the whole
       transition and unmount the wizard, and either one refusing let `go`
       and `send` carry on as if everything had saved. */
    try {
      const amenityResult = await setAmenities({
        listingId: result.data.id,
        codes: chosenAmenities,
      });
      if (!amenityResult.ok) {
        lastSaveOk.current = false;
        setNotice(amenityResult.error);
      }

      /* The gate details go to their own table, which the public page cannot
         read. Written on every autosave like everything else, so a host who
         types a gate code and closes the phone does not lose it. */
      const accessResult = await setListingAccess({
        listingId: result.data.id,
        estateName: values.estateName,
        gateDirections: values.gateDirections,
        securityPhone: values.securityPhone,
        accessCode: values.accessCode,
      });
      if (!accessResult.ok) {
        lastSaveOk.current = false;
        setNotice(accessResult.error);
        const accessErrors = accessResult.fieldErrors;
        if (accessErrors) setFieldErrors((prev) => ({ ...prev, ...accessErrors }));
      }
    } catch {
      lastSaveOk.current = false;
      setNotice(copy.wizard.saveUnreached);
    }

    return result.data.id;
  }, [canPersist, chosenAmenities, listingId, values, unread, fromMessage, marksUnread, copy.wizard.saveUnreached]);

  function go(next: number) {
    if (pending) return;
    const target = Math.min(STEP_KEYS.length - 1, Math.max(0, next));

    // The title is the one thing asked for before moving on, and the sentence
    // shown is the gate's own, so step one and the submit checklist never
    // phrase the same requirement two different ways. The draft is still saved
    // before we stop, because a refusal must never cost the agent their work.
    const titleIssue = unmet.find((item) => item.field === "title");
    if (target > step && step === 0 && titleIssue) {
      titleGateOpen.current = true;
      setFieldErrors((prev) => ({ ...prev, title: gateText("title", titleIssue.message) }));
      /* On a phone the title sits far above Next, so the refusal was
         happening off screen. The refusal is immediate (CRAFT_DOCTRINE 5):
         focusing the field brings it into view in one move, above the sticky
         bar (its scroll margin), where a smooth scroll to the centre used to
         race the keyboard opening. The field shakes once and says why. */
      const field = document.getElementById("listing-title-field");
      refuse(field);
      field?.querySelector("input")?.focus();
      feedback("error");
      startTransition(async () => {
        await persist();
      });
      return;
    }
    titleGateOpen.current = false;

    startTransition(async () => {
      await persist();
      /* Moving forward from a step whose save was refused left the refusal
         on a step no longer shown, and every later autosave failed on the
         same field. Stay, and show why. Going back is always allowed. */
      if (!lastSaveOk.current && target > step) {
        /* The refusal is at the top: shown at once, never scrolled to slowly. */
        window.scrollTo({ top: 0, behavior: "instant" });
        feedback("error");
        return;
      }
      setTravel({ dir: target < step ? "back" : "forward", moved: true });
      setStep(target);
      /* Arriving at (or past) the step an Edit came from ends the way back. */
      setReturnTo((prev) => (prev !== null && target >= prev ? null : prev));
    });
  }

  /**
   * An Edit on the last two steps: go to the step that owns the fact, and
   * remember where the lister came from, so one tap brings them back to it
   * (`returnTo`, drawn under the step's title) instead of Next through every
   * step in between, each one a save.
   */
  function editStep(target: number) {
    if (pending || target < 0 || target >= step) return;
    setReturnTo(step);
    go(target);
  }

  /* The new step is put in view BEFORE it paints, and only when the rail has
     gone above the fold: a smooth scroll here used to run under the step's own
     arrival, two motions for one change. */
  useLayoutEffect(() => {
    if (!travel.moved) return;
    const rail = railRef.current;
    if (rail && rail.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, travel.moved]);

  /* Sent: the checklist, the fee screen and the button are gone from under
     the lister's thumb, so the page is put on the card, before it paints, and
     the card lands there (lister-publish.css). One move, to the subject. */
  const sentNow = sent?.now === true;
  useLayoutEffect(() => {
    if (sentNow) cardRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [sentNow]);

  /* --------------------------------------------------------------- photos */

  /**
   * The photo's pixel size, or null when this browser cannot decode it (HEIC
   * outside Safari). The gate reads the long edge; see `lib/listings/photo-gate`.
   */
  async function sizeOf(file: File): Promise<{ width: number; height: number } | null> {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
      } catch {
        /* fall through to the image element */
      }
    }
    return await new Promise<{ width: number; height: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      image.src = url;
    });
  }

  /**
   * Re-encode a photo before it leaves the phone.
   *
   * A camera photo carries EXIF, and on a phone that usually includes GPS
   * coordinates. Listing photos are served from a public bucket, so uploading
   * the original file would publish the exact location of the property to
   * anyone who downloads the image, which is precisely what the platform
   * promises not to do before an inspection. Drawing the image onto a canvas
   * and exporting it produces pixels with no metadata at all, so the tag
   * cannot survive.
   *
   * The long edge is capped at 2560px, comfortably above the 1600px minimum
   * the quality gate demands, which also cuts the upload down for someone on
   * a slow connection. If anything about the re-encode fails the original file
   * is refused rather than uploaded, because publishing a geotagged photo is
   * worse than asking for another one.
   */
  async function stripMetadata(file: File): Promise<Blob | null> {
    const MAX_EDGE = 2560;
    /*
     * The decoded image, by either door. `createImageBitmap` is missing or
     * refuses some files on older Android WebViews and in Safari for HEIC,
     * where an <img> element still decodes them; without this second door a
     * photo that measured fine was refused at the re-encode.
     */
    const decoded = await (async (): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void } | null> => {
      if (typeof createImageBitmap === "function") {
        try {
          const bitmap = await createImageBitmap(file);
          return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
        } catch {
          /* try the image element */
        }
      }
      return await new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () =>
          resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, done: () => URL.revokeObjectURL(url) });
        image.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        image.src = url;
      });
    })();
    if (!decoded || decoded.width <= 0 || decoded.height <= 0) {
      decoded?.done();
      return null;
    }
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
      const width = Math.round(decoded.width * scale);
      const height = Math.round(decoded.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(decoded.source, 0, 0, width, height);

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
      });
    } catch {
      return null;
    } finally {
      decoded.done();
    }
  }

  async function onFiles(files: FileList | readonly File[] | null) {
    if (!files || files.length === 0) return;
    /* Copied now: a FileList is live and the input is emptied below. */
    const chosen = Array.from(files);
    setPhotoNotice(null);
    setPhotoProblems([]);
    setRetryFiles([]);

    if (!canPersist || !userId) {
      setPhotoNotice(copy.photos.needsKeys);
      return;
    }

    setUploading(true);
    try {
      const id = listingId ?? (await persist());
      if (!id) {
        /* No listing to attach to. With a title that is because the save did
           not reach the server, which a second try can fix; without one, the
           title is what is missing. */
        if (values.title.trim().length >= 2) {
          setPhotoNotice(copy.wizard.saveUnreached);
          setRetryFiles(chosen);
        } else {
          setPhotoNotice(copy.photos.needsTitle);
        }
        return;
      }

      /* The browser client loads now, when photos are chosen, not with the
         wizard (lib/supabase/load-client.ts). A chunk that cannot be fetched
         is the upload failure the wizard already says for a photo. */
      const supabase = await loadBrowserClient();
      if (!supabase) {
        setPhotoNotice(copy.photos.uploadFailed);
        setRetryFiles(chosen);
        return;
      }
      let slot = photos.length;
      /*
       * ONE LINE PER REFUSED FILE. A single notice was overwritten by every
       * later file, so choosing six photos with two bad ones showed at most
       * the last refusal, without saying which photo it was about.
       *
       * AND THE ONES A SECOND TRY CAN FIX ARE KEPT. A dropped connection on
       * the upload or on the attach is not a problem with the photo, so those
       * files are held for "Try again" rather than sent back to the gallery
       * to be found and chosen a second time. A refusal about the photo itself
       * (too small, wrong type, too big) is not kept: trying it again changes
       * nothing.
       */
      const problems: string[] = [];
      const retry: File[] = [];
      const refuse = (file: File, reason: string, again = false) => {
        problems.push(fileLine(file.name, reason));
        if (again) retry.push(file);
      };

      let videoCount = videos.length;
      for (const file of chosen) {
        /* A VIDEO, mixed in with the photos in the one picker. */
        if (looksLikeVideo(file)) {
          if (videoCount >= MAX_VIDEOS) {
            refuse(file, fill(copy.photos.videoCeiling, { max: MAX_VIDEOS }));
            continue;
          }
          const added = await uploadVideo(file, id, supabase, refuse);
          if (added) {
            setMedia((prev) => [...prev, added]);
            videoCount += 1;
          }
          continue;
        }
        if (slot >= MAX_PHOTOS) {
          refuse(file, fill(copy.photos.ceiling, { max: MAX_PHOTOS }));
          continue;
        }
        const verdict = judgePhoto(file, looksLikeImage(file) ? await sizeOf(file) : null);
        if (verdict === "not-image") {
          refuse(file, copy.photos.notAnImage);
          continue;
        }
        if (verdict === "heic-undecodable") {
          refuse(file, copy.photos.heicUndecodable);
          continue;
        }
        if (verdict === "undecodable") {
          refuse(file, copy.photos.undecodable);
          continue;
        }
        if (verdict === "too-small") {
          refuse(file, fill(copy.photos.tooNarrow, { width: MIN_PHOTO_WIDTH }));
          continue;
        }

        // Strip location metadata before the photo leaves the device. The
        // re-encode always produces a JPEG, so the stored extension follows.
        const clean = await stripMetadata(file);
        if (!clean) {
          refuse(file, isHeic(file) ? copy.photos.heicUndecodable : copy.photos.notPrepared);
          continue;
        }

        /*
         * THE BUCKET'S OWN CEILING, CHECKED BEFORE THE BYTES LEAVE.
         *
         * `MAX_UPLOAD_BYTES` (a video's) is far above the `listing-photos`
         * bucket's ten megabytes, so a photograph between the two was
         * uploaded in full on somebody's mobile data and then refused by
         * storage at the very end. The re-encode above usually lands well
         * under ten, which is exactly why this is measured on the RE-ENCODED
         * blob: that is the object that will be posted, and the original's
         * size says nothing about it.
         */
        const tooBig = rejectUpload(
          { type: "image/jpeg", size: clean.size },
          PHOTO_MIME_TYPES,
          MAX_PHOTO_BYTES,
        );
        if (tooBig) {
          refuse(file, tooBig);
          continue;
        }

        const path = `${userId}/${id}/${crypto.randomUUID()}.jpg`;

        let uploadError: { message?: string; statusCode?: string | number } | null = null;
        try {
          const upload = await supabase.storage
            .from("listing-photos")
            .upload(path, clean, { contentType: "image/jpeg", upsert: false });
          uploadError = upload.error as typeof uploadError;
        } catch {
          uploadError = { message: "network" };
        }
        if (uploadError) {
          const reason = uploadErrorText(uploadError, {
            tooBig: fill(copy.photos.uploadTooBig, { max: MAX_PHOTO_LABEL }),
            wrongType: copy.photos.uploadWrongType,
            signedOut: copy.photos.uploadSignedOut,
            failed: copy.photos.uploadFailed,
          });
          refuse(file, reason, reason === copy.photos.uploadFailed);
          continue;
        }

        let attached: Awaited<ReturnType<typeof addPhoto>>;
        try {
          attached = await addPhoto({ listingId: id, storagePath: path, position: slot });
        } catch {
          /* The attach never reached the server, so nothing there removes the
             object it would have named. It is in this lister's own folder of
             a public bucket, so it goes now, best effort, rather than staying
             downloadable for ever under a path no row points at. */
          void supabase.storage
            .from("listing-photos")
            .remove([path])
            .catch(() => undefined);
          refuse(file, copy.wizard.saveUnreached, true);
          continue;
        }
        if (!attached.ok) {
          refuse(file, attached.error);
          continue;
        }

        const url = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
        setMedia((prev) => [...prev, { kind: "photo", id: attached.data.photoId, path, url }]);
        slot += 1;
      }
      setPhotoProblems(problems);
      setRetryFiles(retry);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /**
   * ONE VIDEO, from the picker to the listing: checked (type, size, length),
   * its filmed location taken out, a still drawn from it, uploaded to the
   * private `listing-videos` bucket under the lister's own folder (the photo
   * rule: `<uid>/<listing>/<uuid>`), the still to the photo bucket, and both
   * attached by `addVideo`, which reads the real size and type back from
   * storage. Returns the row item, or null with the reason already said.
   */
  async function uploadVideo(
    file: File,
    id: string,
    supabase: NonNullable<Awaited<ReturnType<typeof loadBrowserClient>>>,
    refuse: (file: File, reason: string, again?: boolean) => void,
  ): Promise<Media | null> {
    const mime = videoMime(file);
    if (file.type !== "" && !(VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
      refuse(file, copy.photos.notAnImage);
      return null;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      refuse(file, fill(copy.photos.videoTooBig, { max: MAX_UPLOAD_LABEL }));
      return null;
    }
    const seconds = await videoDuration(file);
    if (seconds === null) {
      refuse(file, copy.photos.videoUnreadable);
      return null;
    }
    if (seconds > MAX_VIDEO_SECONDS) {
      refuse(file, fill(copy.photos.videoTooLong, { seconds: MAX_VIDEO_SECONDS }));
      return null;
    }

    const scrubbed = await scrubVideoLocation(file);
    /* The original's last modified time is kept, so the same file is known
       again on a second press and its upload resumes rather than restarts. */
    const clean = new File([scrubbed], file.name, { type: mime, lastModified: file.lastModified });
    const poster = await posterFrame(clean);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      refuse(file, copy.photos.uploadSignedOut);
      return null;
    }

    const folder = `${userId}/${id}/`;
    const pathScope = `listing-videos:${folder}`;
    const path = stableUploadPath(pathScope, folder, clean, () => `${folder}${crypto.randomUUID()}.${videoExtension(file)}`);
    const controller = new AbortController();
    videoAbort.current = controller;
    setVideoProgress({ name: file.name, percent: 0 });
    const result = await resumableUpload({
      file: clean,
      bucket: "listing-videos",
      path,
      supabaseUrl: SUPABASE_URL,
      accessToken: token,
      signal: controller.signal,
      onProgress: (progress) =>
        setVideoProgress({
          name: file.name,
          percent: progress.total > 0 ? Math.min(100, Math.round((progress.uploaded / progress.total) * 100)) : 0,
        }),
    });
    if (videoAbort.current === controller) videoAbort.current = null;
    setVideoProgress(null);
    if (!result.ok) {
      if (result.reason === "cancelled") {
        /* Stopped on purpose: the half-sent bytes are dropped and the next
           try starts clean. */
        forgetUploadPath(pathScope, clean);
        refuse(file, copy.photos.videoCancelled);
        return null;
      }
      /* A dropped connection keeps its path, so pressing again resumes. */
      if (result.reason !== "network") forgetUploadPath(pathScope, clean);
      refuse(file, result.reason === "network" ? copy.photos.videoFailed : result.message, result.reason === "network");
      return null;
    }
    /* Uploaded: whatever the attach says next, this path is finished with
       (attached, or removed by the refusal). */
    forgetUploadPath(pathScope, clean);

    /* The still is a nicety: without it the video still plays. */
    let posterPath: string | undefined;
    if (poster) {
      const stillPath = `${userId}/${id}/${crypto.randomUUID()}.jpg`;
      try {
        const upload = await supabase.storage
          .from("listing-photos")
          .upload(stillPath, poster, { contentType: "image/jpeg", upsert: false });
        if (!upload.error) posterPath = stillPath;
      } catch {
        /* no still */
      }
    }

    let attached: Awaited<ReturnType<typeof addVideo>>;
    try {
      attached = await addVideo({
        listingId: id,
        storagePath: result.path,
        durationSeconds: seconds,
        ...(posterPath ? { posterPath } : {}),
      });
    } catch {
      void supabase.storage.from("listing-videos").remove([result.path]).catch(() => undefined);
      if (posterPath) void supabase.storage.from("listing-photos").remove([posterPath]).catch(() => undefined);
      refuse(file, copy.wizard.saveUnreached, true);
      return null;
    }
    if (!attached.ok) {
      refuse(file, attached.error);
      return null;
    }
    return {
      kind: "video",
      id: attached.data.videoId,
      url: URL.createObjectURL(clean),
      posterUrl: posterPath ? supabase.storage.from("listing-photos").getPublicUrl(posterPath).data.publicUrl : null,
      durationSeconds: seconds,
    };
  }

  /**
   * Put the row in a new order and store it: photos by rank, videos by place
   * (`reorderMedia`). A refusal puts the row back as the listing holds it, or
   * the cover on screen would not be the cover a renter sees.
   */
  function orderMedia(next: Media[]) {
    const before = media;
    setMedia(next);
    if (!canPersist || !listingId) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof reorderMedia>>;
      try {
        result = await reorderMedia({
          listingId,
          items: next.map((item) => ({ kind: item.kind, id: item.id })),
        });
      } catch {
        setMedia(before);
        setPhotoNotice(copy.wizard.saveUnreached);
        return;
      }
      if (!result.ok) {
        setMedia(before);
        setPhotoNotice(result.error);
        return;
      }
      setPhotoNotice(null);
      /* Adopt the ids the platform settled on: at the ten photo ceiling one
         photo row is rewritten, and a stale id would break the next move. */
      setMedia((prev) =>
        mergeMedia(
          result.data.photos.map((photo) => ({
            ...photo,
            url: prev.find((item) => item.kind === "photo" && item.path === photo.path)?.url ?? "",
          })),
          result.data.videos.map((video) => ({ ...video })),
        ).map((entry): Media => {
          if (entry.kind === "photo") {
            return { kind: "photo", id: entry.item.id, path: entry.item.path, url: entry.item.url };
          }
          const held = prev.find((item) => item.kind === "video" && item.id === entry.item.id);
          return held ?? { kind: "video", id: entry.item.id, url: "", posterUrl: null, durationSeconds: null };
        }),
      );
    });
  }

  /*
   * Move one item one place, which is what the grid's two arrows do. The
   * cover IS the first item, and it has to be a photo, so a move that would
   * put a video first is not offered (`canMove`).
   */
  function moveMedia(from: number, to: number) {
    if (!canMove(media, from, to)) return;
    const next = media.slice();
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    orderMedia(next);
  }

  function dropMedia(index: number) {
    const chosen = media[index];
    if (!chosen) return;
    const before = media;
    /* Taking the cover off leaves the next photo as the cover, never a video. */
    setMedia(photoFirst(media.filter((_, i) => i !== index)));
    if (!canPersist || !listingId) return;
    startTransition(async () => {
      /* A refused removal put the item back on screen nowhere: the grid
         showed it gone while the listing still held it, and the count the
         submit gate reads disagreed with the one the lister saw. */
      let error: string | null = null;
      try {
        const result =
          chosen.kind === "photo"
            ? await removePhoto({ listingId, photoId: chosen.id })
            : await removeVideo({ listingId, videoId: chosen.id });
        if (!result.ok) error = result.error;
      } catch {
        error = copy.wizard.saveUnreached;
      }
      if (error) {
        setMedia(before);
        setPhotoNotice(error);
      }
    });
  }

  /* --------------------------------------------------------------- submit */

  function send() {
    setPhoneGate(false);
    startTransition(async () => {
      /* Saved first, always: the draft and its unconfirmed set (V-09) must be
         what the server checks, not what it held before the last tap. */
      const id = (await persist()) ?? listingId;
      /* A refused save leaves the stored row behind the screen, and the
         review team would be sent the older version. Stop with the save's
         own refusal on screen instead. */
      if (!lastSaveOk.current) return;
      if (!id) {
        setNotice(canPersist ? copy.submit.needsTitle : copy.submit.needsKeys);
        return;
      }
      /* D60: ONLY WITH THE BLOCKING FLAG ON is the acceptance recorded first,
         and a listing whose acceptance was not recorded is not sent (D51).
         With it off nothing is recorded and nothing waits. */
      if (feeGateBlocking) {
        if (!feeAcceptance || !feeAccepted) return;
        const recorded = await recordListerFeeAcceptance({ listingId: id, ...feeAcceptance }).catch(() => null);
        if (!recorded || !recorded.ok) {
          setNotice(recorded && !recorded.ok ? recorded.error : copy.wizard.saveUnreached);
          if (recorded && !recorded.ok) setFeeAcceptance(null);
          return;
        }
      }
      let result: Awaited<ReturnType<typeof submitListing>>;
      try {
        result = await submitListing({ listingId: id });
      } catch {
        setNotice(copy.wizard.saveUnreached);
        feedback("error");
        return;
      }
      if (!result.ok) {
        /* The server's gate reads the STORED listing, so it can refuse what
           the checklist here passed (a cover left at a gap after a removed
           photo, a save that did not land). Its summary says "each one is
           listed below", so the reasons are listed, in the checklist's own
           words, rather than leaving a green checklist under a refusal. */
        const reasons = Object.entries(result.fieldErrors ?? {}).map(([field, message]) => gateText(field, message));
        setNotice([result.error, ...new Set(reasons)].join(" "));
        setPhoneGate(result.gate === "phone");
        setFieldErrors(result.fieldErrors ?? {});
        feedback("error");
        return;
      }
      setNotice(null);
      setFieldErrors({});
      /* ACCEPTED, and only now: the card the lister built stays where it is,
         its status turns to the server's word, the step's controls give way to
         the chain, and the hand feels one medium beat because a commit was
         accepted. Nothing pops and nothing is heavy: the listing is not live,
         and the payoff waits for the day it is (lister-live). */
      setSent({ status: result.data.status, at: result.data.submittedAt ?? null, now: true });
      setTravel((prev) => ({ ...prev, moved: true }));
      feedback("confirm");
      try {
        const draftKey = listingDraftKey(userId);
        if (draftKey) localStorage.removeItem(draftKey);
      } catch {
        /* nothing depends on this */
      }
      router.refresh();
    });
  }

  /* ----------------------------------------------------------- the render */

  const price = priceMinor > 0 ? formatMoney(priceMinor, locale) : null;
  const stateName = states.find((s) => s.code === values.stateCode)?.name ?? "";
  const sentWords = success ? successCopy(success, "listingSubmitted") : null;
  /*
   * THE CARD AS A MEMBER WILL SEE IT, built from the lister's own work: the
   * cover photo, the title, the place, the price. Step 7 shows it too, and
   * once the listing is sent it is the same element that stays on screen
   * while everything around it changes (round 5): the lister watches THIS
   * card go to review, not a confirmation page that replaced it.
   */
  const memberCard = (
    <article className="nf-panel nf-panel--card block overflow-hidden" data-testid="member-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--nf-surface-raised)]">
        {photos[0] ? (
          /* The guest view's cover: one wide 4:3 plate, so it earns a
             larger candidate than the grid above it. */
          <RemoteImage
            src={photos[0].url}
            alt=""
            width={960}
            height={720}
            sizes="(max-width: 48rem) 100vw, 30rem"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {copy.guestView.addPhotos}
          </div>
        )}
        <div
          /* The platform scrim, not a hand-rolled black gradient. One
             definition, used by the listing card and the gallery too, so
             a preview of a card matches the card it previews. */
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ backgroundImage: "var(--nf-scrim-media)" }}
          aria-hidden="true"
        />
        {/* One badge, and which one it is says which market this is. The
            instant-book badge is gone with the column behind it. */}
        {forSale ? (
          <span className="nf-badge nf-badge--warning absolute left-3 top-3">
            For sale
          </span>
        ) : rental ? (
          <span className="nf-badge nf-badge--brand absolute left-3 top-3">
            {copy.guestView.rentBadge}
          </span>
        ) : null}
        {/*
          ON MEDIA, WHICH IS ITS OWN TOKEN FAMILY.

          This line sits on the listing's own photograph, so it is not
          a dark-theme colour and it is not a light-theme colour: it is
          ink on somebody's picture, in both themes, and
          `--nf-content-on-media` is the token that says so. The
          `text-white/90` and `text-white/70` it replaces happened to
          look right and could never follow a theme, which is exactly
          the distinction the on-media family exists to hold.
        */}
        <p className="nf-body-sm absolute bottom-3 left-3 right-3 flex items-center gap-inline-tight font-semibold text-[var(--nf-content-on-media)]">
          <UiIcon
            name="location"
            size={12}
            className="shrink-0 text-[var(--nf-content-on-media-muted)]"
          />
          <span className="truncate">
            {[values.area, values.city, stateName].filter(Boolean).join(", ") ||
              copy.guestView.locationPlaceholder}
          </span>
        </p>
      </div>
      <div className="p-card">
        <h3 className="text-[length:var(--nf-text-body-sm)] font-semibold leading-snug">
          {values.title || copy.guestView.titlePlaceholder}
        </h3>
        <p className="nf-body-sm mt-inline-tight text-[var(--nf-content-muted)]">
          {/* The dictionary sentence names a guest count this model no
              longer has, so the preview states the two facts it does
              hold rather than printing a number nothing stores. */}
          {[
            `${values.bedrooms} bed`,
            `${values.bathrooms} bath`,
            values.toilets ? `${values.toilets} toilet` : null,
            values.sizeSqm ? `${values.sizeSqm} sqm` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-inline flex items-baseline gap-inline-tight">
          <span className="nf-numeric text-[length:var(--nf-text-body-lg)] font-bold">
            {price ?? copy.guestView.priceToSet}
          </span>
          <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {pricePeriod}
          </span>
        </p>
        {chosenAmenities.length > 0 && (
          <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">
            {chosenAmenities
              .map(
                (code) =>
                  amenityNames[code] ??
                  amenities.find((a) => a.code === code)?.label ??
                  code,
              )
              .slice(0, 4)
              .join(" · ")}
          </p>
        )}
      </div>
    </article>
  );

  return (
    <div
      className="nf-lw-wizard mx-auto max-w-2xl pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
      data-dir={travel.dir}
      data-moved={travel.moved ? "" : undefined}
    >
      {/*
        THE RAIL, DRAWN AS THE THREE GOVERNING IMAGES DRAW IT.

        A back chevron, then the row of small filled rectangles, on one line.
        `SegmentedProgress` is gone from this surface and is untouched for its
        other callers: it draws a full-width track of `--nf-radius-pill`
        segments, and the roles README calls this row "small filled
        rectangles" and translates every capsule in these renders to a rounded
        rectangle. The ARIA contract it carried is kept exactly, because a
        screen reader being told where it is in an eight step form was the
        whole reason that component was written.

        The jump-back control keeps its geometry too: a transparent row of
        44pt buttons laid OVER a 10px bar, rather than 10px tap targets on the
        control that undoes a wrong turn.
      */}
      <div className="nf-lw-rail py-lg" ref={railRef}>
        <BackControl
          onBack={() => go(step - 1)}
          disabled={step === 0 || pending || Boolean(sent)}
          label={copy.wizard.back}
          className="nf-lw-back"
        />
        <div className="relative flex-1">
          <div
            role="progressbar"
            aria-label={fill(copy.wizard.stepCounter, {
              current: step + 1,
              total: STEP_KEYS.length,
            })}
            aria-valuemin={1}
            aria-valuemax={STEP_KEYS.length}
            aria-valuenow={step + 1}
            className="nf-lw-rail__track"
          >
            {stepNames.map((name, index) => (
              <span
                key={name}
                className="nf-lw-rail__seg"
                data-done={index <= step ? "" : undefined}
                data-at={index === step ? "" : undefined}
              />
            ))}
          </div>
          <ol
            className="absolute inset-0 flex items-stretch gap-inline-tight"
            aria-label={copy.wizard.stepsLabel}
          >
            {stepNames.map((name, index) => (
              <li key={name} className="flex-1">
                <button
                  type="button"
                  onClick={() => index <= step && go(index)}
                  disabled={index > step || pending || Boolean(sent)}
                  aria-current={index === step ? "step" : undefined}
                  aria-label={fill(copy.wizard.stepAria, { number: index + 1, name })}
                  className="block h-full w-full"
                />
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* THE PROGRESS PATH (reference 7110): every step on one path, done ones
          a tap away, with the autosave said only as far as it is true. Folded
          under the rail so the step itself stays the subject; the rail and
          the steps are unchanged (D28). */}
      {pathCopy && !sent ? (
        <Unfold
          className="mb-group"
          headingLevel={2}
          items={[
            {
              id: "path",
              icon: "clipboard-list",
              title: pathCopy.allSteps,
              hint: [
                fill(pathCopy.stepOf, { n: step + 1, total: STEP_KEYS.length }),
                deviceKeeps && canPersist
                  ? pathCopy.savedBoth
                  : deviceKeeps
                    ? pathCopy.savedDevice
                    : canPersist
                      ? pathCopy.savedAccount
                      : null,
              ]
                .filter(Boolean)
                .join(" "),
              content: (
                <ProgressPath
                  steps={stepNames.map((name, index) => {
                    const key = STEP_KEYS[index] ?? name;
                    return { id: key, label: name, tile: LISTING_STEP_TILES[key] };
                  })}
                  at={step}
                  onJump={(index) => go(index)}
                  disabled={pending}
                  copy={{ done: pathCopy.done, current: pathCopy.current, upcoming: pathCopy.upcoming }}
                  locale={locale}
                />
              ),
            },
          ]}
        />
      ) : null}

      {/* The title and its one sentence, with the step's object on the right.
          The "3 of 8" counter is gone from the picture and kept in the rail's
          accessible name, which is where the renders put that information:
          the row of rectangles says it to a sighted reader already. */}
      <StepHead
        /* Keyed by the step (Track M), so the title and its object arrive
           fresh on every step instead of changing in place; and keyed again
           once sent, so the verdict arrives the same way. */
        key={sent ? "sent" : stepKey || step}
        title={
          sent
            ? (sentWords?.title ?? copy.submitted.title)
            : (stepKey && copy.drawn.titles[stepKey]) || (stepNames[step] ?? "")
        }
        sub={sent ? (sentWords?.body ?? copy.submitted.body) : stepKey && copy.drawn.subtitles[stepKey]}
        object={sent ? undefined : stepKey && STEP_OBJECT[stepKey]}
        art={sent ? undefined : stepKey && STEP_ART[stepKey]}
      />

      {/* The way back to the step an Edit came from (see `editStep`). */}
      {returnTo !== null && step < returnTo && !sent && (
        <div className="mt-group">
          <Button
            variant="secondary"
            size="sm"
            arrow
            onClick={() => go(returnTo)}
            disabled={pending}
            data-testid="wizard-return"
          >
            {fill(copy.wizard.returnTo, { step: stepNames[returnTo] ?? "" })}
          </Button>
        </div>
      )}

      {!canPersist && (
        <div className="mt-group">
          <Note>{copy.wizard.unconfiguredNotice}</Note>
        </div>
      )}

      {/* On the last step a refusal is said beside Send for review, where the
          lister's thumb is, rather than at the top of a long step. */}
      {notice && step !== STEP_KEYS.length - 1 && (
        <div className="mt-group">
          <Note glyph="flag" role="status">
            {notice}
          </Note>
        </div>
      )}

      {/* A listing sent back by review reopens with the reviewer's sentence in
          front of the lister. It used to appear only on the workspace row, so
          the form they fixed it in never said what needed fixing. */}
      {reviewerAsked(initial) && (
        <div className="mt-group" data-testid="reviewer-note">
          <Note glyph="flag">
            <span className="block font-semibold">What the reviewer said</span>
            <span className="block">{initial?.reviewNotes}</span>
          </Note>
        </div>
      )}

      <div className="nf-panel nf-panel--card nf-lw-body block mt-group p-card sm:p-cell">
        {/* ---------------------------------------------------- 1 basic info */}
        {step === 0 && (
          <div className="space-y-lg">
            {broadcastCopy && (
              <BroadcastPaste copy={broadcastCopy} locale={locale} onApply={applyBroadcast} />
            )}
            {/*
              The two fields that can actually fail validation use the shared
              TextField/TextArea. The local `Field` above them only draws a
              label and a message: `aria-invalid` on a `.nf-field` changes
              nothing a sighted user can see, because that class paints its
              border with a border-box gradient and the error rule sets
              `border-color` underneath it. A screen reader knew the title was
              rejected; nobody else did.
            */}
            <div id="listing-title-field">
            <TextField
              label={copy.basics.titleLabel}
              /* STORE-16: a warning, never a refusal. */
              hint={looksLikeStreetAddress(values.title) ? STREET_IN_TITLE_WARNING : copy.basics.titleHint}
              error={fieldErrors.title}
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={copy.basics.titlePlaceholder}
              maxLength={80}
            />
            </div>
            {mark("title")}

            <div>
              <span className="nf-label">
                {copy.basics.propertyTypeLabel}
                {mark("propertyType")}
              </span>
              {/*
                06 screen one draws the property types THREE ACROSS, each one
                a centred glass object over a single word, with no description
                inside the card and a tick on the one chosen. They were two
                across with the blurb inside them, which is the same
                information at twice the height and none of the drawn grid.

                THE BLURB IS NOT DROPPED, it moves. A card that only says
                "Rental" cannot tell somebody it means a yearly tenancy rather
                than a house let by the night, and that distinction is the
                whole reason both cards exist. So the chosen type's line sits
                in the calm panel under the grid, which is where the reader
                needs it: after choosing, not before.
              */}
              <div className="nf-lw-choices nf-lw-choices--3">
                {TYPE_ORDER.map((type) => (
                  <Choice
                    key={type}
                    centred
                    name={copy.propertyTypes[type].label}
                    object={TYPE_OBJECT[type]}
                    art={TYPE_ART[type]}
                    chosen={values.propertyType === type}
                    onClick={() => set("propertyType", type)}
                  />
                ))}
              </div>
              <div className="mt-row">
                <Note glyph="info">{copy.propertyTypes[values.propertyType].blurb}</Note>
              </div>
              {rental && (
                <div className="mt-row">
                  <Note>{copy.basics.rentalNote}</Note>
                </div>
              )}
            </div>

            <TextArea
              label={copy.basics.descriptionLabel}
              error={fieldErrors.description}
              hint={fill(copy.basics.descriptionHint, {
                words,
                min: MIN_DESCRIPTION_WORDS,
              })}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={copy.basics.descriptionPlaceholder}
              textAreaClassName="min-h-[9rem]"
            />
            {mark("description")}
            {preference && (
              <div className="mt-row" data-testid="tenant-preference-warning">
                <Note glyph="info">
                  {`This reads as a tenant preference ("${preference}"). Vallo does not allow refusing people for their ethnicity, religion, marital status or gender, so a listing that says this is held for review before it goes up. See `}
                  <Link href="/standards" className="underline">our standards</Link>.
                </Note>
              </div>
            )}

            {/*
              THE ROOMS, DRAWN AS GOVERNING-06 SCREEN THREE DRAWS THEM.

              Every fact is a row: the object on its plate, the fact's name,
              the question it is asking under that, and the control on the
              right. The three counts get the stepper the render draws as one
              rounded rectangle; the three that are not counts get a field or
              a select on a line of their own inside the same row. Size
              carries the Optional mark, which is a capsule in the render and
              a rounded rectangle here.

              What this replaces is six bare inputs in a two column grid with
              their labels floating above them, which shares no anatomy with
              the render at all. Guests and beds are still gone with the
              short-stay model, for the reason recorded before: asking for a
              number nothing stores is asking somebody to type into a void.
            */}
            {/* ------------------------------------ the shape (V-66) */}
            {takesShape(values.propertyType) && (
              <UnitQuestions
                copy={unitCopy}
                value={values.unit}
                bedrooms={values.bedrooms}
                error={fieldErrors.unitShape}
                onChange={(next) => set("unit", next)}
              />
            )}

            <div>
              <span className="nf-label">
                {copy.drawn.rooms.title}
                {/* Furnishing included: its only control is in this group now. */}
                {mark("bedrooms", "bathrooms", "toilets", "parkingSpaces", "furnished")}
              </span>
              <div className="nf-lw-facts">
                <FactRow
                  glyph="bed"
                  name={copy.basics.counters.bedrooms}
                  ask={copy.drawn.rooms.bedroomsAsk}
                >
                  <Stepper
                    inline
                    value={values.bedrooms}
                    min={0}
                    max={20}
                    label={copy.basics.counters.bedrooms}
                    fewerLabel={counterAria("fewer", copy.basics.counters.bedrooms)}
                    moreLabel={counterAria("more", copy.basics.counters.bedrooms)}
                    onChange={(v) => set("bedrooms", v)}
                  />
                </FactRow>
                <FactRow
                  glyph="bath"
                  name={copy.basics.counters.bathrooms}
                  ask={copy.drawn.rooms.bathroomsAsk}
                >
                  <Stepper
                    inline
                    value={values.bathrooms}
                    min={0}
                    max={20}
                    label={copy.basics.counters.bathrooms}
                    fewerLabel={counterAria("fewer", copy.basics.counters.bathrooms)}
                    moreLabel={counterAria("more", copy.basics.counters.bathrooms)}
                    onChange={(v) => set("bathrooms", v)}
                  />
                </FactRow>
                {/* Toilets is a count in the render and was a free text box
                    here, which is the one row a Nigerian listing is asked
                    about most and the one that could be typed wrong. */}
                <FactRow
                  glyph="bath"
                  name={copy.drawn.rooms.toilets}
                  ask={copy.drawn.rooms.toiletsAsk}
                >
                  <Stepper
                    inline
                    value={toiletCount}
                    min={0}
                    max={20}
                    label={copy.drawn.rooms.toilets}
                    fewerLabel={counterAria("fewer", copy.drawn.rooms.toilets)}
                    moreLabel={counterAria("more", copy.drawn.rooms.toilets)}
                    onChange={(v) => set("toilets", v === 0 ? "" : String(v))}
                  />
                </FactRow>
                <FactRow
                  glyph="parking"
                  name={copy.drawn.rooms.parking}
                  ask={copy.drawn.rooms.parkingAsk}
                >
                  <Stepper
                    inline
                    value={parkingCount}
                    min={0}
                    max={20}
                    label={copy.drawn.rooms.parking}
                    fewerLabel={counterAria("fewer", copy.drawn.rooms.parking)}
                    moreLabel={counterAria("more", copy.drawn.rooms.parking)}
                    onChange={(v) => set("parkingSpaces", v === 0 ? "" : String(v))}
                  />
                </FactRow>

                <FactRow
                  stacked
                  glyph="grid"
                  name={copy.drawn.rooms.size}
                  ask={copy.drawn.rooms.sizeAsk}
                  optional={copy.drawn.rooms.optional}
                >
                  <input
                    className="nf-field"
                    inputMode="decimal"
                    aria-label={copy.drawn.rooms.size}
                    value={values.sizeSqm}
                    onChange={(e) =>
                      set("sizeSqm", e.target.value.replace(/[^0-9.]/g, "").slice(0, 10))
                    }
                    placeholder="150"
                  />
                  {fieldErrors.sizeSqm && (
                    <span className="nf-body-sm mt-inline-tight block font-semibold text-[var(--nf-state-error)]">
                      {fieldErrors.sizeSqm}
                    </span>
                  )}
                </FactRow>

                <FactRow
                  stacked
                  glyph="home"
                  name={copy.drawn.rooms.furnishing}
                  ask={copy.drawn.rooms.furnishingAsk}
                >
                  <select
                    className="nf-field"
                    aria-label={copy.drawn.rooms.furnishing}
                    value={values.furnished}
                    onChange={(e) => set("furnished", e.target.value as Furnishing | "")}
                  >
                    <option value="">{copy.drawn.rooms.notStated}</option>
                    {FURNISHING_CHOICES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </FactRow>

                <FactRow
                  stacked
                  glyph="building-apartment"
                  name={copy.drawn.rooms.floor}
                  ask={copy.drawn.rooms.floorAsk}
                >
                  <div className="grid grid-cols-2 gap-row">
                    <input
                      className="nf-field"
                      inputMode="numeric"
                      aria-label={copy.drawn.rooms.floor}
                      value={values.floor}
                      onChange={(e) => set("floor", digitsOnly(e.target.value, 3))}
                      placeholder="2"
                    />
                    <input
                      className="nf-field"
                      inputMode="numeric"
                      aria-label={copy.drawn.rooms.floors}
                      value={values.totalFloors}
                      onChange={(e) => set("totalFloors", digitsOnly(e.target.value, 3))}
                      placeholder="5"
                    />
                  </div>
                  {(fieldErrors.floor || fieldErrors.totalFloors) && (
                    <span className="nf-body-sm mt-inline-tight block font-semibold text-[var(--nf-state-error)]">
                      {fieldErrors.floor ?? fieldErrors.totalFloors}
                    </span>
                  )}
                </FactRow>
              </div>
            </div>

            {/*
              BUILD CONDITION, AND IT USED TO BE ASKED ONLY OF A SALE.

              GOVERNING-06 screen four heads "Condition and availability" and
              draws the four conditions as cards. It is a fact about the
              BUILDING, not about the transaction, and a tenant asks it as
              often as a buyer does: "newly built" and "older build" are the
              difference between a flat you move into and one you renovate.
              The column has always been on every listing and was null on
              every rental, because the only control that wrote it lived
              inside the for-sale branch.

              The availability half of that render stays with the tenancy
              terms on the price step, where the date sits beside the shortest
              tenancy it has to agree with.
            */}
            <fieldset>
              <legend className="nf-label mb-inline">
                {copy.drawn.checkOver.keys.condition}
              </legend>
              <div className="nf-lw-choices">
                {CONDITION_CHOICES.map((c) => (
                  <Choice
                    key={c.value}
                    name={c.label}
                    object={CONDITION_OBJECT[c.value]}
                    chosen={values.condition === c.value}
                    onClick={() => set("condition", values.condition === c.value ? "" : c.value)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {/* -------------------------------------------------------- 2 photos */}
        {step === 1 && (
          <div className="space-y-group">
            <Note>
              {fill(copy.photos.intro, {
                min: MIN_MEDIA,
                recommended: RECOMMENDED_MEDIA,
                max: MAX_PHOTOS,
                videos: MAX_VIDEOS,
              })}{" "}
              {fill(copy.photos.tooNarrow, { width: MIN_PHOTO_WIDTH })}
            </Note>

            <input
              ref={fileInput}
              type="file"
              /* Photos and videos in the one picker (founder, 12 October). */
              accept={["image/*", ...VIDEO_MIME_TYPES].join(",")}
              multiple
              className="sr-only"
              onChange={(e) => void onFiles(e.target.files)}
            />

            {photoNotice && <Note glyph="flag" role="status">{photoNotice}</Note>}
            {photoProblems.length > 0 && (
              <Note glyph="flag" role="status">
                {/* Spans, not a list: the note's body is a paragraph. */}
                <span className="block space-y-inline-tight" data-testid="photo-problems">
                  {photoProblems.map((line, index) => (
                    <span key={`${index}-${line}`} className="block">{line}</span>
                  ))}
                </span>
              </Note>
            )}
            {/* The same files again, for the failures a second try can fix. */}
            {retryFiles.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onFiles(retryFiles)}
                disabled={uploading}
                loading={uploading}
                data-testid="photo-retry"
              >
                {copy.photos.retry}
              </Button>
            )}

            {/*
              THE GRID OF GOVERNING-07 SCREEN FOUR.

              Three across, each photograph in a rounded rectangle with the
              Cover mark on the first, a round cross to drop it, and the add
              cell last carrying a round plus. The render's bottom-corner grip
              is a DRAG handle; ours is a pair of real move controls, because
              a reorder that needs a pointer is a photograph an agent on a
              phone cannot move, and every photograph on this platform is
              uploaded from a phone.

              The "Make cover" text button is gone: moving a photograph to the
              front IS making it the cover, which the grid now says with the
              mark rather than with a second control that meant the same
              thing.
            */}
            <ul className="nf-lw-shots">
              {media.map((item, index) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="nf-lw-shot"
                  data-cover={index === 0 ? "" : undefined}
                  data-kind={item.kind}
                >
                  {item.kind === "photo" ? (
                    <RemoteImage
                      src={item.url}
                      alt=""
                      width={640}
                      height={480}
                      sizes="(max-width: 40rem) 50vw, 14rem"
                      className="nf-lw-shot__img"
                    />
                  ) : (
                    /* Muted and still: a poster when there is one, and nothing
                       fetched until the lister presses play. */
                    <video
                      src={item.url}
                      poster={item.posterUrl ?? undefined}
                      preload={item.posterUrl ? "none" : "metadata"}
                      muted
                      playsInline
                      controls={false}
                      className="nf-lw-shot__img"
                      aria-label={
                        item.durationSeconds === null
                          ? copy.photos.video
                          : `${copy.photos.video}, ${clockOf(item.durationSeconds)}`
                      }
                    />
                  )}
                  {index === 0 && <span className="nf-lw-shot__cover">{copy.photos.cover}</span>}
                  {item.kind === "video" && (
                    <span className="nf-lw-shot__kind" aria-hidden="true">
                      <UiIcon name="circle-play" size={16} />
                      {item.durationSeconds === null ? null : clockOf(item.durationSeconds)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="nf-lw-shot__drop"
                    aria-label={copy.photos.remove}
                    /* One change at a time: a second reorder sent while the
                       first is still moving rows races it on the unique
                       position index, and at ten photos holds a stale id. */
                    disabled={pending || uploading}
                    onClick={() => dropMedia(index)}
                  >
                    <UiIcon name="close" size={16} />
                  </button>
                  <span className="nf-lw-shot__moves">
                    <button
                      type="button"
                      className="nf-lw-shot__move"
                      aria-label={copy.drawn.photos.earlier}
                      disabled={!canMove(media, index, index - 1) || pending || uploading}
                      onClick={() => moveMedia(index, index - 1)}
                    >
                      <UiIcon name="arrow-left" size={16} />
                    </button>
                    <button
                      type="button"
                      className="nf-lw-shot__move"
                      aria-label={copy.drawn.photos.later}
                      disabled={!canMove(media, index, index + 1) || pending || uploading}
                      onClick={() => moveMedia(index, index + 1)}
                    >
                      <UiIcon name="arrow-right" size={16} />
                    </button>
                  </span>
                </li>
              ))}
              {(photos.length < MAX_PHOTOS || videos.length < MAX_VIDEOS) && (
                <li className="contents">
                  <button
                    type="button"
                    className="nf-lw-add"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                  >
                    <span className="nf-lw-add__plus" aria-hidden="true">
                      <UiIcon name="plus" size={20} />
                    </span>
                    <span>{uploading ? copy.photos.uploading : copy.drawn.photos.add}</span>
                  </button>
                </li>
              )}
              {photos.length < MAX_PHOTOS && nativeCamera && (
                <li className="contents">
                  <button
                    type="button"
                    className="nf-lw-add"
                    data-testid="listing-photo-camera"
                    onClick={() =>
                      void capturePhoto().then((shot) => {
                        if (shot) void onFiles([shot]);
                      })
                    }
                    disabled={uploading}
                  >
                    <span className="nf-lw-add__plus" aria-hidden="true">
                      <UiIcon name="picture" size={20} />
                    </span>
                    <span>{copy.photos.takePhoto}</span>
                  </button>
                </li>
              )}
            </ul>
            {/* V-70: say what each photo shows. Additive; drawn only with its copy. */}
            {shotsCopy && (
              <ShotList
                listingId={listingId}
                photos={photos.map((photo) => ({ id: photo.id, url: photo.url }))}
                claims={{ prepaidMeter: values.prepaidMeter, waterSupply: values.waterSupply || null, powerBackup: values.powerBackup || null }}
                copy={shotsCopy}
              />
            )}

            {videoProgress && (
              <div className="flex flex-wrap items-center gap-sm">
                <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status" data-testid="video-progress">
                  {fill(copy.photos.videoUploading, { name: videoProgress.name, percent: videoProgress.percent })}
                </p>
                <Button variant="secondary" size="sm" onClick={() => videoAbort.current?.abort()} data-testid="video-cancel">
                  {copy.photos.videoCancel}
                </Button>
              </div>
            )}

            {/* The count, then the nudge from the minimum to the recommendation. */}
            <p className="nf-numeric text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]" data-testid="media-count">
              {fill(copy.photos.progress, { count: media.length, min: MIN_MEDIA })}
              {media.length >= MIN_MEDIA && media.length < RECOMMENDED_MEDIA
                ? ` ${fill(copy.photos.recommend, { more: RECOMMENDED_MEDIA - media.length })}`
                : null}
            </p>

            {media.length === 0 && <Note>{copy.photos.empty}</Note>}
          </div>
        )}

        {/* ------------------------------------------------------ 3 location */}
        {step === 2 && (
          <div className="space-y-lg">
            <Field fromMessage={mark("stateCode")} label={copy.location.stateLabel} error={fieldErrors.stateCode}>
              <select
                className="nf-field"
                value={values.stateCode}
                onChange={(e) => set("stateCode", e.target.value)}
              >
                <option value="">{copy.location.statePlaceholder}</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field fromMessage={mark("city")} label={copy.location.cityLabel} error={fieldErrors.city}>
              <input
                className="nf-field"
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder={copy.location.cityPlaceholder}
              />
            </Field>
            <Field fromMessage={mark("area")}
              label={copy.location.areaLabel}
              error={fieldErrors.area}
              hint={copy.location.areaHint}
            >
              <input
                className="nf-field"
                value={values.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder={copy.location.areaPlaceholder}
              />
            </Field>
            <Field label={copy.location.addressLabel} hint={copy.location.addressHint}>
              <input
                className="nf-field"
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder={copy.location.addressPlaceholder}
              />
            </Field>
            <Field label={copy.location.landmarkLabel} hint={copy.location.landmarkHint}>
              <input
                className="nf-field"
                value={values.landmark}
                onChange={(e) => set("landmark", e.target.value)}
                placeholder={copy.location.landmarkPlaceholder}
              />
            </Field>
          </div>
        )}

        {/* ----------------------------------------------------- 4 amenities */}
        {step === 3 && (
          <div>
            <Note>{copy.amenities.intro}</Note>
            {fieldErrors.amenities && (
              <p className="nf-body-sm mt-row font-semibold text-[var(--nf-state-error)]">
                {fieldErrors.amenities}
              </p>
            )}
            {/* Three across, a glyph over one word, a round tick on the ones
                that are on. They were wrapping chips, which put the same list
                on the screen with none of the render's grid, none of its
                objects and none of its ticks. */}
            <div className="nf-lw-tiles mt-group">
              {amenities.map((amenity) => {
                const active = chosenAmenities.includes(amenity.code);
                return (
                  <button
                    key={amenity.code}
                    type="button"
                    className="nf-lw-tile"
                    aria-pressed={active}
                    onClick={() =>
                      setChosenAmenities((prev) =>
                        prev.includes(amenity.code)
                          ? prev.filter((c) => c !== amenity.code)
                          : [...prev, amenity.code],
                      )
                    }
                  >
                    <UiIcon name={AMENITY_GLYPH[amenity.code] ?? "circle-check"} size={24} />
                    <span>{amenityNames[amenity.code] ?? amenity.label}</span>
                    {active && (
                      <span className="nf-lw-choice__tick" aria-hidden="true">
                        <UiIcon name="verified-badge" size={20} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --------------------------------------------- 5 light and water */}
        {step === 4 && (
          <div className="space-y-heading">
            <Note>
              Is there light, is there water, and how does somebody get through
              the gate? These are the first questions anyone asks here, whether
              they are renting, buying or staying a night, and honest answers
              win you the enquiries that listings without them lose.
            </Note>

            {/*
              GOVERNING-07 SCREENS ONE AND TWO, WHICH THIS STEP HELD AS CHIPS.

              Power supply, backup and water are each a grid of option cards
              with a glyph, a word, the line that says what the word means and
              a round tick on the one chosen. The blurbs were `title`
              attributes and a single line under the row that changed as you
              picked: a tooltip is invisible on a phone, and one line under
              five choices makes you choose before you can read what you chose.
              Every blurb is on its own card now.
            */}
            <fieldset>
              <legend className="nf-label mb-inline">
                {copy.drawn.supply.power}
                {mark("powerGrid")}
              </legend>
              <div className="nf-lw-choices">
                {POWER_GRID_CHOICES.map((choice) => (
                  <Choice
                    key={choice.value}
                    name={choice.label}
                    sub={choice.blurb}
                    glyph={GRID_GLYPH[choice.value]}
                    chosen={values.powerGrid === choice.value}
                    onClick={() =>
                      set("powerGrid", values.powerGrid === choice.value ? "" : choice.value)
                    }
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="nf-label mb-inline">
                {copy.drawn.supply.backup}
                {mark("powerBackup")}
              </legend>
              <div className="nf-lw-choices">
                {POWER_BACKUP_CHOICES.map((choice) => (
                  <Choice
                    key={choice.value}
                    name={choice.label}
                    glyph={BACKUP_GLYPH[choice.value]}
                    chosen={values.powerBackup === choice.value}
                    onClick={() => {
                      const next = values.powerBackup === choice.value ? "" : choice.value;
                      set("powerBackup", next);
                      /* Hours against a backup that does not exist is refused
                         by the database, so choosing "no backup" clears them
                         here rather than letting the save bounce. */
                      if (next === "NONE" || next === "") set("powerBackupHours", "");
                    }}
                  />
                ))}
              </div>
            </fieldset>

            {values.powerBackup !== "" && values.powerBackup !== "NONE" && (
              <div>
                <span className="nf-label">{copy.drawn.supply.backupHours}</span>
                {/* The render draws this as one wide stepper rather than a
                    number field, and it is right: an agent knows the hours as
                    a count and typing "8" into a box is the slower way to say
                    a number you are already holding up on your fingers. */}
                <Stepper
                  value={backupHours}
                  min={0}
                  max={MAX_BACKUP_HOURS}
                  label={copy.drawn.supply.backupHours}
                  fewerLabel={counterAria("fewer", copy.drawn.supply.backupHours)}
                  moreLabel={counterAria("more", copy.drawn.supply.backupHours)}
                  onChange={(v) => set("powerBackupHours", String(v))}
                />
                {fieldErrors.powerBackupHours ? (
                  <span className="nf-body-sm mt-inline-tight block font-semibold text-[var(--nf-state-error)]">
                    {fieldErrors.powerBackupHours}
                  </span>
                ) : (
                  <span className="nf-body-sm mt-inline-tight block text-[var(--nf-content-muted)]">
                    &quot;Generator&quot; on its own tells a guest nothing; the hours are the answer.
                  </span>
                )}
              </div>
            )}

            <fieldset>
              <legend className="nf-label mb-inline">
                {copy.drawn.supply.water}
                {mark("waterSupply")}
              </legend>
              <div className="nf-lw-choices">
                {WATER_SUPPLY_CHOICES.map((choice) => (
                  <Choice
                    key={choice.value}
                    name={choice.label}
                    sub={choice.blurb}
                    glyph={WATER_GLYPH[choice.value]}
                    chosen={values.waterSupply === choice.value}
                    onClick={() =>
                      set("waterSupply", values.waterSupply === choice.value ? "" : choice.value)
                    }
                  />
                ))}
              </div>
            </fieldset>

            {/* The render draws a TOGGLE on this row, and it was a bare 24px
                checkbox painted with `accent-color`: the one control on this
                step that the platform's own switch primitive already owned. */}
            <Switch
              label={copy.drawn.supply.prepaid}
              description={copy.drawn.supply.prepaidBody}
              checked={values.prepaidMeter}
              onCheckedChange={(v) => set("prepaidMeter", v)}
            />
            {mark("prepaidMeter")}

            {/* ------------------------ the service charge and the gate (V-68) */}
            {/* What the charge covers is asked only where a charge is stated on
                a home to let or sell (batch 4 review); the gate always is. */}
            <ServiceQuestions
              copy={serviceCopy}
              value={values.service}
              onChange={(next) => set("service", next)}
              chargeMinor={(tenancy || forSale) ? parseNairaToKobo(values.serviceChargeNaira) : null}
            />

            {/* ------------------------------------- flooding (V-41) */}
            {floodOpen && (
              <FloodQuestion
                copy={floodCopy}
                value={values.flooding}
                onChange={(next) => set("flooding", next)}
              />
            )}

            {/* ---------------------------------------- the compound (V-28) */}
            <CompoundQuestions
              copy={compoundCopy}
              value={values.compound}
              onChange={(next) => set("compound", next)}
              flatsError={fieldErrors.flatsInCompound}
            />

            {/* ------------------------------------------------ the gate */}
            <div className="nf-panel nf-panel--card block p-card">
              <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                Getting through the gate
              </p>
              <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-muted)]">
                Nobody can read any of this from your public page. It is released
                only to a guest whose booking is confirmed, and to nobody else,
                ever. The page will say the estate has a gate and that the
                details arrive on confirmation.
              </p>

              <div className="mt-group space-y-group">
                <Field label="Estate or compound name" error={fieldErrors.estateName}>
                  <input
                    className="nf-field"
                    value={values.estateName}
                    maxLength={MAX_ESTATE_NAME}
                    onChange={(e) => set("estateName", e.target.value)}
                    placeholder="Alagomeji Court"
                  />
                </Field>
                <Field
                  label="What to tell the gate"
                  hint="The words that get somebody through, in the order they need them."
                  error={fieldErrors.gateDirections}
                >
                  <textarea
                    className="nf-field min-h-[84px] resize-y"
                    value={values.gateDirections}
                    maxLength={MAX_GATE_DIRECTIONS}
                    onChange={(e) => set("gateDirections", e.target.value)}
                    placeholder="Second gate off Herbert Macaulay. Tell security you are visiting flat 4B."
                  />
                </Field>
                <Field label="Security desk number" error={fieldErrors.securityPhone}>
                  <input
                    className="nf-field"
                    inputMode="tel"
                    value={values.securityPhone}
                    maxLength={MAX_SECURITY_PHONE}
                    onChange={(e) => set("securityPhone", e.target.value)}
                    placeholder="0803 000 0000"
                  />
                </Field>
                <Field label="Access code" error={fieldErrors.accessCode}>
                  <input
                    className="nf-field"
                    value={values.accessCode}
                    maxLength={MAX_ACCESS_CODE}
                    onChange={(e) => set("accessCode", e.target.value)}
                    placeholder="4471"
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------- 5 pricing */}
        {step === 5 && (
          <div className="space-y-lg">
            {/*
              The first question, and everything below it follows.

              This is the choice the whole product turns on and until now the
              wizard never asked it: a person with a flat to sell had to price
              it per night. The two cards are deliberately the same size and
              equally weighted, because Vallo is a marketplace for renting AND
              buying and leaning the layout toward one of them would quietly
              tell half the listers they are in the wrong place.
            */}
            <fieldset>
              <legend className="nf-label mb-inline">
                What are you listing it for?
                {mark("intent")}
              </legend>
              <div className="nf-lw-choices">
                {LISTING_INTENT_CHOICES.map((choice) => (
                  <Choice
                    key={choice.value}
                    name={choice.label}
                    sub={choice.blurb}
                    object={choice.value === "sale" ? "keys-tag" : "keys-home"}
                    chosen={values.intent === choice.value}
                    onClick={() => set("intent", choice.value)}
                  />
                ))}
              </div>
            </fieldset>

            {/* ------------------------------------------------------- a sale */}
            {forSale && (
              <>
                <Field fromMessage={mark("salePriceNaira")}
                  label="Asking price"
                  error={fieldErrors.salePrice ?? fieldErrors.salePriceNaira}
                  hint={
                    saleMinor > 0
                      ? `${formatMoney(saleMinor, locale)} asking price`
                      : "In naira. Buyers filter on this figure, so it is the one number that has to be right."
                  }
                >
                  <input
                    className="nf-field"
                    inputMode="decimal"
                    value={values.salePriceNaira}
                    onChange={(e) => set("salePriceNaira", e.target.value)}
                    placeholder="180,000,000"
                  />
                </Field>

                {/* V-74: what similar homes in the area are asking. */}
                {guideCopy && (
                  <PriceGuidePanel
                    subject={guideSubject}
                    loading={priceGuide.loading}
                    guide={priceGuide.guide}
                    copy={guideCopy}
                    locale={locale}
                  />
                )}

                <Switch
                  label="The price is negotiable"
                  description="Say so and a buyer will open the conversation rather than scroll past."
                  checked={values.priceNegotiable}
                  onCheckedChange={(v) => set("priceNegotiable", v)}
                />
                {mark("priceNegotiable")}

                {/*
                  WHAT A BUYER ACTUALLY PAYS.

                  The tenancy side has had an honest cost model for weeks and
                  the sale side had an asking price and nothing else, which is
                  the same lie in a much bigger currency. Agency and legal are
                  conventionally five per cent each, and Governor's consent,
                  stamp duty and registration run to several per cent more of
                  the value of the land. A buyer who plans around the asking
                  price finds twenty million naira they had not budgeted for
                  after they are committed.

                  Nothing here is calculated from the price, although four of
                  the five have a conventional percentage. A rate that is
                  usually five per cent is not five per cent, and a number this
                  platform worked out and printed as a fact would be an
                  invented number. The lister states what they charge.
                */}
                <div className="nf-panel nf-panel--card block p-card">
                  <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                    What a buyer actually pays
                  </p>
                  <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-muted)]">
                    Fill in whatever applies. Anything you leave blank is shown
                    as not stated, never as zero, and a fee you do not charge is
                    worth saying with a nought.
                  </p>

                  <div className="mt-group grid grid-cols-2 gap-row">
                    <Field fromMessage={mark("saleAgencyFeeNaira")} label="Agency fee" error={fieldErrors.saleAgencyFeeNaira}>
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.saleAgencyFeeNaira}
                        onChange={(e) => set("saleAgencyFeeNaira", e.target.value)}
                        placeholder="9,000,000"
                      />
                    </Field>
                    <Field fromMessage={mark("saleLegalFeeNaira")} label="Legal fee" error={fieldErrors.saleLegalFeeNaira}>
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.saleLegalFeeNaira}
                        onChange={(e) => set("saleLegalFeeNaira", e.target.value)}
                        placeholder="9,000,000"
                      />
                    </Field>
                    <Field
                      label="Governor's consent"
                      error={fieldErrors.governorsConsentFeeNaira}
                    >
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.governorsConsentFeeNaira}
                        onChange={(e) => set("governorsConsentFeeNaira", e.target.value)}
                        placeholder="14,000,000"
                      />
                    </Field>
                    <Field label="Stamp duty" error={fieldErrors.stampDutyNaira}>
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.stampDutyNaira}
                        onChange={(e) => set("stampDutyNaira", e.target.value)}
                        placeholder="1,440,000"
                      />
                    </Field>
                  </div>

                  <div className="mt-row">
                    <Field
                      label="Survey and registration"
                      error={fieldErrors.surveyRegistrationFeeNaira}
                    >
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.surveyRegistrationFeeNaira}
                        onChange={(e) => set("surveyRegistrationFeeNaira", e.target.value)}
                        placeholder="900,000"
                      />
                    </Field>
                  </div>

                  <div className="mt-group">
                    <Field
                      label="Total to buy"
                      error={fieldErrors.totalPurchaseNaira}
                      hint={
                        statedPurchaseMinor === null
                          ? purchasePartsMinor > 0
                            ? `Leave blank and we show ${formatMoney(purchasePartsMinor, locale)}, which is the price plus the costs above.`
                            : "The number a buyer has to find. Leave it blank and we add up the price and the costs above."
                          : `${formatMoney(statedPurchaseMinor, locale)} all in. It has to be at least ${formatMoney(purchasePartsMinor, locale)}, which is the price plus the costs above.`
                      }
                    >
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.totalPurchaseNaira}
                        onChange={(e) => set("totalPurchaseNaira", e.target.value)}
                        placeholder="205,000,000"
                      />
                    </Field>
                  </div>

                  {purchaseMinor > 0 && (
                    <div className="mt-group flex items-baseline justify-between gap-inline border-t border-[var(--nf-border-subtle)] pt-row">
                      <span className="nf-body-sm text-[var(--nf-content-secondary)]">
                        Total to buy
                      </span>
                      <span className="nf-numeric nf-h4 font-bold">
                        {formatMoney(purchaseMinor, locale)}
                      </span>
                    </div>
                  )}
                  {purchaseMinor > 0 && (
                    <p className="nf-caption mt-inline-tight text-right text-[var(--nf-content-muted)]">
                      {statedPurchaseMinor === null
                        ? "from the price and the costs above"
                        : "as you stated it"}
                    </p>
                  )}
                </div>

                {/*
                  The question every Nigerian buyer asks first, and the one a
                  fraudulent listing will not answer. It is required by the
                  submit gate rather than encouraged, because a property for
                  sale with no stated title is the shape of every land scam
                  there has ever been.
                */}
                <fieldset>
                  <legend className="nf-label mb-inline">What title comes with it?</legend>
                  <div className="flex flex-wrap gap-inline">
                    {TENURE_CHOICES.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        className="nf-chip min-h-11"
                        aria-pressed={values.tenure === choice.value}
                        title={choice.blurb}
                        onClick={() =>
                          set("tenure", values.tenure === choice.value ? "" : choice.value)
                        }
                      >
                        {values.tenure === choice.value && <UiIcon name="verified" size={16} />}
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  <p className="nf-body-sm mt-inline text-[var(--nf-content-muted)]">
                    {TENURE_CHOICES.find((c) => c.value === values.tenure)?.blurb ??
                      "A buyer will ask before anything else. Answering here saves both of you a journey."}
                  </p>
                  {fieldErrors.tenure && (
                    <p className="nf-body-sm mt-inline-tight font-semibold text-[var(--nf-state-error)]">
                      {fieldErrors.tenure}
                    </p>
                  )}
                </fieldset>

                <fieldset>
                  <legend className="nf-label mb-inline">Where the sale stands</legend>
                  <div className="flex flex-wrap gap-inline">
                    {SALE_STATUS_CHOICES.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        className="nf-chip min-h-11"
                        aria-pressed={values.saleStatus === choice.value}
                        onClick={() => set("saleStatus", choice.value)}
                      >
                        {values.saleStatus === choice.value && (
                          <UiIcon name="verified" size={16} />
                        )}
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-2 gap-row">
                  <Field label="Year built" error={fieldErrors.yearBuilt}>
                    <input
                      className="nf-field"
                      inputMode="numeric"
                      value={values.yearBuilt}
                      onChange={(e) => set("yearBuilt", digitsOnly(e.target.value, 4))}
                      placeholder="2019"
                    />
                  </Field>
                </div>


              </>
            )}

            {/* ---------------------------------------------------- a tenancy */}
            {tenancy && (
              <>
                <Field fromMessage={mark("rentNaira")}
                  label="Rent"
                  error={fieldErrors.rent ?? fieldErrors.rentNaira}
                  hint={
                    rentMinor > 0
                      ? `${formatMoney(rentMinor, locale)} ${copy.pricing.period[values.rentPeriod]}`
                      : copy.pricing.priceHint
                  }
                >
                  <input
                    className="nf-field"
                    inputMode="decimal"
                    value={values.rentNaira}
                    onChange={(e) => set("rentNaira", e.target.value)}
                    placeholder="4,500,000"
                  />
                </Field>

                {/* V-74: what similar homes in the area are asking. */}
                {guideCopy && (
                  <PriceGuidePanel
                    subject={guideSubject}
                    loading={priceGuide.loading}
                    guide={priceGuide.guide}
                    copy={guideCopy}
                    locale={locale}
                  />
                )}

                <fieldset>
                  <legend className="nf-label mb-inline">
                    How often is it paid?
                    {mark("rentPeriod", "rentNegotiable")}
                  </legend>
                  <div className="flex flex-wrap gap-inline">
                    {RENT_PERIOD_CHOICES.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        className="nf-chip min-h-11"
                        aria-pressed={values.rentPeriod === choice.value}
                        onClick={() => set("rentPeriod", choice.value)}
                      >
                        {values.rentPeriod === choice.value && (
                          <UiIcon name="verified" size={16} />
                        )}
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <Switch
                  label="The rent is negotiable"
                  description="Say so and somebody who is close will start the conversation."
                  checked={values.rentNegotiable}
                  onCheckedChange={(v) => set("rentNegotiable", v)}
                />

                {/*
                  WHAT IT ACTUALLY COSTS TO MOVE IN.

                  A 4.5m yearly rent in Lagos routinely means seven million at
                  the door once caution, agency, legal and agreement fees are
                  counted, and every one of those was invisible on this platform
                  until now. A tenant who travels across the city to be told the
                  real figure has been wasted, and the agent has wasted a
                  Saturday too. Every field is optional because agents genuinely
                  quote different subsets, and an unstated fee renders as
                  unstated rather than as zero: "no agency fee" is a selling
                  point and "we did not say" is not the same promise.
                */}
                <div className="nf-panel nf-panel--card block p-card">
                  <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                    What it costs to move in
                  </p>
                  <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-muted)]">
                    Fill in whatever you charge. Anything you leave blank is
                    shown as not stated, never as zero.
                  </p>

                  <div className="mt-group grid grid-cols-2 gap-row">
                    <Field fromMessage={mark("cautionDepositNaira")} label="Caution deposit" error={fieldErrors.cautionDepositNaira}>
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.cautionDepositNaira}
                        onChange={(e) => set("cautionDepositNaira", e.target.value)}
                        placeholder="450,000"
                      />
                    </Field>
                    <Field
                      fromMessage={mark("agencyFeeNaira")}
                      label="Agency fee"
                      error={fieldErrors.agencyFeeNaira}
                      hint={guideCopy ? (feeNormLine("agency", priceGuide.norms, guideCopy) ?? undefined) : undefined}
                    >
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.agencyFeeNaira}
                        onChange={(e) => set("agencyFeeNaira", e.target.value)}
                        placeholder="450,000"
                      />
                    </Field>
                    <Field
                      fromMessage={mark("legalFeeNaira")}
                      label="Legal fee"
                      error={fieldErrors.legalFeeNaira}
                      hint={guideCopy ? (feeNormLine("legal", priceGuide.norms, guideCopy) ?? undefined) : undefined}
                    >
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.legalFeeNaira}
                        onChange={(e) => set("legalFeeNaira", e.target.value)}
                        placeholder="225,000"
                      />
                    </Field>
                    <Field fromMessage={mark("agreementFeeNaira")} label="Agreement fee" error={fieldErrors.agreementFeeNaira}>
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.agreementFeeNaira}
                        onChange={(e) => set("agreementFeeNaira", e.target.value)}
                        placeholder="225,000"
                      />
                    </Field>
                  </div>

                  <div className="mt-row grid grid-cols-2 gap-row">
                    <Field fromMessage={mark("serviceChargeNaira")} label="Service charge" error={fieldErrors.serviceChargeNaira}>
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.serviceChargeNaira}
                        onChange={(e) => set("serviceChargeNaira", e.target.value)}
                        placeholder="600,000"
                      />
                    </Field>
                    <Field label="Service charge cycle">
                      <select
                        className="nf-field"
                        value={values.serviceChargePeriod}
                        onChange={(e) =>
                          set("serviceChargePeriod", e.target.value as RentPeriod)
                        }
                      >
                        {RENT_PERIOD_CHOICES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="mt-group">
                    <Field fromMessage={mark("totalMoveInNaira")}
                      label="Total to move in"
                      error={
                        fieldErrors.totalMoveInNaira ??
                        (remainderCopy && moveInRemainderMinor > 0
                          ? fill(remainderCopy.gate, { amount: formatMoney(moveInRemainderMinor, locale) })
                          : undefined)
                      }
                      hint={
                        statedTotalMinor === null
                          ? partsSumMinor > 0
                            ? `Leave blank and we show ${formatMoney(partsSumMinor, locale)}, which is what the parts above come to.`
                            : "The one number people shop on. Leave it blank and we add up the parts above."
                          : `${formatMoney(statedTotalMinor, locale)} at the door. It has to be at least ${formatMoney(partsSumMinor, locale)}, which is what the parts above come to.`
                      }
                    >
                      <input
                        className="nf-field"
                        inputMode="decimal"
                        value={values.totalMoveInNaira}
                        onChange={(e) => set("totalMoveInNaira", e.target.value)}
                        /* The parts' own sum, never an example: the example
                           (7,000,000) was a total above the parts, which the
                           gate refuses. */
                        placeholder={partsSumMinor > 0 ? formatMoney(partsSumMinor, locale) : undefined}
                      />
                    </Field>
                  </div>

                </div>

                {/*
                  GOVERNING-08 SCREEN TWO, AND IT WAS THE ONE SCREEN OF THE
                  TWELVE THAT EXISTED NOWHERE IN THIS FLOW.

                  What stood here was one bold figure and a four word caption.
                  The render is a breakdown: a row per cost with its object,
                  its basis, its amount and who keeps it, then the total in its
                  own lit panel. It matters more here than on the listing page,
                  because this is the screen where the silences are still
                  fixable: an agent who sees "Not declared" against the legal
                  fee, in the reader's own words, can go up two boxes and
                  declare it.
                */}
                <div>
                  <p className="nf-label">{copy.drawn.tenantPays.title}</p>
                  <p className="nf-body-sm mb-row text-[var(--nf-content-secondary)]">
                    {copy.drawn.tenantPays.lede}
                  </p>
                  <TenantPays
                    facts={paysFacts}
                    currency="NGN"
                    locale={locale}
                    copy={copy}
                    moveInCopy={moveInCopy}
                    moneyMap={moneyMapCopy}
                  />
                  {statedTotalMinor !== null && statedTotalMinor > partsSumMinor && (
                    <div className="mt-row">
                      <Note>
                        {fill(
                          "You have stated {total} as the total to move in, which is {gap} more than the parts above come to. A searcher sees your total, so name what the difference is for.",
                          {
                            total: formatMoney(statedTotalMinor, locale),
                            gap: formatMoney(statedTotalMinor - partsSumMinor, locale),
                          },
                        )}
                      </Note>
                    </div>
                  )}
                </div>

                {/* Bottom aligned: at phone width the first label wraps to two
                    lines and pushed its box below its neighbour's. */}
                <div className="grid grid-cols-2 items-end gap-row">
                  <Field
                    label="Shortest tenancy, in months"
                    error={fieldErrors.minimumTenancyMonths}
                  >
                    <input
                      className="nf-field"
                      inputMode="numeric"
                      value={values.minimumTenancyMonths}
                      onChange={(e) =>
                        set("minimumTenancyMonths", digitsOnly(e.target.value, 3))
                      }
                      placeholder="12"
                    />
                  </Field>
                  <Field label="Available from" error={fieldErrors.availableFrom}>
                    <input
                      className="nf-field"
                      type="date"
                      value={values.availableFrom}
                      onChange={(e) => set("availableFrom", e.target.value)}
                    />
                  </Field>
                </div>

                {/* Furnishing is asked once, with the rooms on the first step.
                    It was asked here too, a second control for the same
                    answer, with its own wording for "not stated". */}

                <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {copy.pricing.rentalNote}
                </p>
              </>
            )}

            {/* ------------------------------------------------- a short stay */}
            {shortStay && (
              <Field fromMessage={mark("rateNaira")}
                label={perHead ? "Price per head" : copy.pricing.priceNightLabel}
                error={fieldErrors.rate ?? fieldErrors.rateNaira}
                hint={
                  rateMinor > 0
                    ? fill(copy.pricing.priceWithPeriod, {
                        price: formatMoney(rateMinor, locale),
                        period: perHead ? "per head" : copy.pricing.perNight,
                      })
                    : copy.pricing.priceHint
                }
              >
                <input
                  className="nf-field"
                  inputMode="decimal"
                  value={values.rateNaira}
                  onChange={(e) => set("rateNaira", e.target.value)}
                  placeholder={copy.pricing.priceNightPlaceholder}
                />
              </Field>
            )}

            {/* A tenancy asks for the date beside its shortest term, above; a
                second "Available from" row here only said "Set above". */}
            {(shortStay || forSale) && (
              <Field
                label="Available from"
                hint="Shown on the listing so nobody asks."
                error={fieldErrors.availableFrom}
              >
                <input
                  className="nf-field"
                  type="date"
                  value={values.availableFrom}
                  onChange={(e) => set("availableFrom", e.target.value)}
                />
              </Field>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- 6 guest view */}
        {step === 6 && (
          <div>
            <Note>{copy.guestView.intro}</Note>
            {/* V-10: whose saved searches this would reach, once it exists. */}
            {demandCopy && listingId && (
              <div className="mt-group">
                <DraftMatches listingId={listingId} copy={demandCopy} />
              </div>
            )}
            <div className="mt-group">{memberCard}</div>
            <p className="nf-body-sm mt-group whitespace-pre-line leading-relaxed text-[var(--nf-content-secondary)]">
              {values.description || copy.guestView.descriptionPlaceholder}
            </p>

            {/*
              THE LISTING DETAILS TABLE OF GOVERNING-08 SCREEN THREE.

              A glyph, the fact, the value, and the control that goes back and
              changes it. The wizard had the preview card and stopped there, so
              the last thing an agent saw before sending was a picture they
              could not act on: spotting a wrong bedroom count meant walking
              back through the steps by hand to find where it lived.

              EVERY VALUE HERE IS WHAT THE FORM HOLDS, and a fact nobody has
              set reads "Not set" rather than a zero or a guess. `Edit` jumps
              to the step that OWNS the fact, which is why the target is a step
              index and not a scroll position.
            */}
            <p className="nf-label mt-heading">{copy.drawn.checkOver.detailsTitle}</p>
            <div className="nf-lw-details">
              {[
                {
                  key: "propertyType",
                  glyph: "home" as UiIconName,
                  label: copy.drawn.checkOver.keys.propertyType,
                  value: copy.propertyTypes[values.propertyType]?.label,
                  step: 0,
                },
                /* Both counts are always answered (the steppers start at one),
                   so a zero is the lister's answer, a studio or a plot, and
                   prints as 0 rather than as "Not set". */
                {
                  key: "bedrooms",
                  glyph: "bed" as UiIconName,
                  label: copy.drawn.checkOver.keys.bedrooms,
                  value: String(values.bedrooms),
                  step: 0,
                },
                {
                  key: "bathrooms",
                  glyph: "bath" as UiIconName,
                  label: copy.drawn.checkOver.keys.bathrooms,
                  value: String(values.bathrooms),
                  step: 0,
                },
                {
                  key: "size",
                  glyph: "grid" as UiIconName,
                  label: copy.drawn.checkOver.keys.size,
                  /* The unit is written beside the figure rather than folded
                     into it, because the figure is the agent's and the unit
                     is ours. */
                  value: values.sizeSqm ? `${values.sizeSqm} m²` : null,
                  step: 0,
                },
                {
                  key: "furnishing",
                  glyph: "home" as UiIconName,
                  label: copy.drawn.checkOver.keys.furnishing,
                  value:
                    FURNISHING_CHOICES.find((c) => c.value === values.furnished)?.label ?? null,
                  step: 0,
                },
                {
                  key: "floor",
                  glyph: "building-apartment" as UiIconName,
                  label: copy.drawn.checkOver.keys.floor,
                  value: values.floor === "" ? null : values.floor,
                  step: 0,
                },
                /* Condition is asked on the first step (it moved there from
                   the sale branch of the price step); Edit sent the lister to
                   the price step, where it is not. */
                {
                  key: "condition",
                  glyph: "verified" as UiIconName,
                  label: copy.drawn.checkOver.keys.condition,
                  value: CONDITION_CHOICES.find((c) => c.value === values.condition)?.label ?? null,
                  step: 0,
                },
                /* The rows for the steps the table did not cover, so every
                   fact on the card above is one Edit away. */
                {
                  key: "photos",
                  glyph: "picture" as UiIconName,
                  label: copy.drawn.checkOver.keys.photos,
                  value:
                    media.length === 0
                      ? null
                      : [
                          photos.length === 0
                            ? null
                            : photos.length === 1
                              ? copy.workspace.photoCountOne
                              : fill(copy.workspace.photoCount, { count: photos.length }),
                          videos.length === 0
                            ? null
                            : countOf(videos.length, "videos", locale),
                        ]
                          .filter(Boolean)
                          .join(", "),
                  step: STEP_KEYS.indexOf("photos"),
                },
                {
                  key: "location",
                  glyph: "location" as UiIconName,
                  label: copy.drawn.checkOver.keys.location,
                  value: [values.area, values.city, stateName].filter(Boolean).join(", ") || null,
                  step: STEP_KEYS.indexOf("location"),
                },
                {
                  key: "amenities",
                  glyph: "circle-check" as UiIconName,
                  label: copy.drawn.checkOver.keys.amenities,
                  value:
                    chosenAmenities.length === 0
                      ? null
                      : fill(copy.drawn.checkOver.amenitiesCount, { count: chosenAmenities.length }),
                  step: STEP_KEYS.indexOf("amenities"),
                },
                {
                  key: "utilities",
                  glyph: "bolt" as UiIconName,
                  label: copy.drawn.checkOver.keys.utilities,
                  value:
                    [
                      POWER_GRID_CHOICES.find((c) => c.value === values.powerGrid)?.label,
                      WATER_SUPPLY_CHOICES.find((c) => c.value === values.waterSupply)?.label,
                    ]
                      .filter(Boolean)
                      .join(", ") || null,
                  step: STEP_KEYS.indexOf("utilities"),
                },
                {
                  key: "price",
                  glyph: "coins" as UiIconName,
                  label: copy.drawn.checkOver.keys.price,
                  value: price ? `${price} ${pricePeriod}` : null,
                  step: STEP_KEYS.indexOf("pricing"),
                },
                {
                  key: "availability",
                  glyph: "calendar-booking" as UiIconName,
                  label: copy.drawn.checkOver.keys.availability,
                  /* The box holds an ISO day. `formatDate` takes a Date, and
                     a bare `new Date("2026-10-01")` is parsed as UTC midnight,
                     which reads as the day before in every timezone west of
                     Greenwich. Splitting the parts builds it in local time. */
                  value: availableFromDate
                    ? formatDate(availableFromDate, locale)
                    : copy.drawn.checkOver.availableNow,
                  step: STEP_KEYS.indexOf("pricing"),
                },
              ].map((row) => (
                <div key={row.key} className="nf-lw-detail">
                  <span className="nf-lw-detail__glyph" aria-hidden="true">
                    <UiIcon name={row.glyph} size={16} />
                  </span>
                  <span className="nf-lw-detail__key">{row.label}</span>
                  <span className="nf-lw-detail__value">
                    {row.value ?? (
                      <span className="text-[var(--nf-content-muted)]">
                        {copy.drawn.checkOver.notSet}
                      </span>
                    )}
                  </span>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => editStep(row.step)}
                    aria-label={`${copy.drawn.checkOver.edit}: ${row.label}`}
                  >
                    {copy.drawn.checkOver.edit}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- 7 submit */}
        {step === 7 && (
          <div className="nf-lw-publish" data-sent={sent ? (sent.now ? "now" : "settled") : undefined}>
            {/* The card heads the last step, so what is being sent is in view
                as it is sent; its status is the workspace's word for where it
                stands, the server's once it has answered. Keyed so the word
                crossfades as it turns. */}
            <div className="nf-lw-publish__label">
              <p className="nf-label">{listerCopy?.publish.cardLabel ?? copy.guestView.intro}</p>
              <span key={sent?.status ?? "DRAFT"} className="nf-lw-publish__status" data-testid="member-card-status">
                <StatusPill tone={toneForStatus(sent?.status ?? "DRAFT")}>
                  {copy.workspace.status[sent?.status ?? "DRAFT"]}
                </StatusPill>
              </span>
            </div>
            <div className="nf-lw-publish__card mt-row" ref={cardRef}>
              {memberCard}
            </div>
            {sent ? (
              <>
                <ListingSentForReview
                  copy={copy}
                  reference={reference}
                  lister={listerCopy}
                  status={sent.status}
                  submittedAt={sent.at}
                  locale={locale}
                />
                {/* Sent: the lister now wants to know when somebody asks.
                    PushPrompt decides whether to ask at all (moments.ts). */}
                <PushPrompt moment="listing_published" />
              </>
            ) : (
              <div className="nf-lw-publish__send mt-heading">
                <h2 className="nf-h3" data-testid="send-title">
                  {sendBlocked ? copy.submit.notReadyTitle : copy.submit.title}
                </h2>
                <p className="nf-body-sm mt-inline leading-relaxed text-[var(--nf-content-secondary)]">
                  {copy.submit.body}
                </p>

                <ul className="mt-group space-y-row">
                  {/*
                    EVERY UNMET REQUIREMENT HAS A ROW. The rows used to be keyed by
                    one field each, and the "price" row by a field the gate never
                    reports: an unset rent, rate, sale price, tenure or period, or
                    a missing unit shape or bedroom count, disabled Send for review
                    while every row showed green. A row now owns every gate field
                    it stands for, and anything the gate reports that no row owns
                    gets a row of its own, so the button is never disabled with
                    nothing on screen saying why.
                  */}
                  {withUncovered([
                    { field: "title", label: copy.submit.checklist.title },
                    {
                      field: "description",
                      label: fill(copy.submit.checklist.description, { min: MIN_DESCRIPTION_WORDS }),
                    },
                    {
                      field: "photos",
                      label: fill(copy.submit.checklist.photos, { min: MIN_MEDIA }),
                    },
                    { field: "stateCode", label: copy.submit.checklist.stateCode },
                    { field: "city", label: copy.submit.checklist.city },
                    { field: "area", label: copy.submit.checklist.area },
                    { field: "amenities", label: copy.submit.checklist.amenities },
                    {
                      field: "price",
                      covers: ["rent", "rentPeriod", "rate", "ratePeriod", "salePrice", "tenure"],
                      /* Named for the market the listing is in. It read
                         "Price per night" on a sale and on a restaurant, and
                         "Yearly rent" on a plot for sale or a monthly let. The
                         dictionary has the yearly and nightly wordings; the
                         rest read in English, as the price step's do. */
                      label: forSale
                        ? "Asking price and title deed"
                        : tenancy
                          ? values.rentPeriod === "year"
                            ? copy.submit.checklist.priceYear
                            : "Rent and how often it is paid"
                          : perHead
                            ? "Price per head"
                            : copy.submit.checklist.priceNight,
                    },
                    {
                      field: "bathrooms",
                      covers: ["bathrooms", "bedrooms", "unitShape"],
                      label: copy.submit.checklist.rooms,
                    },
                    ...(remainderCopy && unmet.some((u) => u.field === "totalMoveIn")
                      ? [{ field: "totalMoveIn", label: remainderCopy.gateShort }]
                      : []),
                  ]).map((item) => {
                    const problem = unmet.find((u) => (item.covers ?? [item.field]).includes(u.field));
                    /* A met line and an open one differ by shape and by words,
                       not by colour alone: a tick, or a mark with the reason
                       under it and an Edit that goes to the step that fixes
                       it. Every line used to carry the same shield, told apart
                       only by its tint, and none of them led anywhere. */
                    return (
                      <li
                        key={item.field}
                        className="flex items-start gap-row"
                        data-testid={`send-check-${item.field}`}
                        data-met={problem ? undefined : ""}
                      >
                        <span
                          className="mt-inline-tight grid h-5 w-5 shrink-0 place-items-center rounded-full"
                          style={{
                            background: problem
                              ? "var(--nf-state-warning-surface)"
                              : "var(--nf-state-success-surface)",
                            color: problem ? "var(--nf-state-warning)" : "var(--nf-state-success)",
                          }}
                          aria-hidden="true"
                        >
                          <UiIcon name={problem ? "info" : "check"} size={12} />
                        </span>
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="block text-[length:var(--nf-text-body-sm)] font-semibold">{item.label}</span>
                          {problem && (
                            <span className="block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                              {gateText(problem.field, problem.message)}
                            </span>
                          )}
                        </span>
                        {problem && (
                          <Button
                            variant="quiet"
                            size="sm"
                            className="shrink-0"
                            onClick={() => editStep(stepOfGateField(problem.field))}
                            disabled={pending}
                            aria-label={`${copy.drawn.checkOver.edit}: ${item.label}`}
                          >
                            {copy.drawn.checkOver.edit}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {broadcastCopy && marksUnread && (
                  <p className="nf-body-sm mt-heading text-[var(--nf-content-secondary)]" role="status" data-testid="broadcast-unread">
                    {broadcastCopy.marksUnreachable}
                  </p>
                )}
                {broadcastCopy && unconfirmedMoney.length > 0 && (
                  <div className="mt-heading" role="status" data-testid="broadcast-confirm">
                    <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">
                      {broadcastCopy.confirmTitle}
                    </p>
                    <p className="nf-body-sm mt-inline-tight text-[var(--nf-content-secondary)]">
                      {fill(broadcastCopy.confirmBody, {
                        fields: unconfirmedMoney.map((key) => broadcastCopy.fields[key]).join(", "),
                      })}
                    </p>
                  </div>
                )}
                {/* Drawn once the read has answered (or when there is no saved
                    listing to read for), so "cannot show" never flashes first. */}
                {(feePolicy !== undefined || !listingId) && (
                  <div className="mt-heading">
                    <ListerFeeGate
                      kind={feeKind}
                      priceMinor={priceMinor > 0 ? priceMinor : null}
                      policy={feePolicy ?? null}
                      locale={locale}
                      blocking={feeGateBlocking}
                      accepted={feeAcceptance}
                      onAcceptedChange={setFeeAcceptance}
                    />
                  </div>
                )}
                {notice && (
                  <div className="mt-heading" data-testid="send-refused">
                    <Note glyph="flag" role="status">
                      {notice}
                    </Note>
                  </div>
                )}
                <PhoneGateLink show={phoneGate && notice !== null} full className="mt-sm" />
                <Button
                  variant="primary"
                  full
                  className="mt-heading"
                  onClick={send}
                  disabled={sendBlocked}
                  data-testid="listing-send"
                  loading={pending}
                >
                  {copy.submit.action}
                </Button>
                <p className="nf-body-sm mt-row text-center text-[var(--nf-content-muted)]">
                  {copy.submit.note}
                </p>

              </div>
            )}
          </div>
        )}
      </div>

      {savedAt && (
        <p className="nf-body-sm mt-row text-center text-[var(--nf-content-muted)]">
          {fill(copy.wizard.savedAt, { time: savedAt })}
        </p>
      )}

      {/* Sticky step footer: the way forward never moves. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--nf-border-subtle)] bg-[var(--nf-surface-primary)] px-gutter pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-row lg:left-[var(--nf-rail-width)]">
        <div className="mx-auto flex max-w-2xl items-center gap-md">
          {sent ? (
            /* Sent: the bar stays where it was and offers the two ways on.
               "List another" is the one control on the platform that means a
               blank wizard, so it says so (`?new=1`); bare /agent/list would
               resume an open draft. */
            <>
              <ButtonLink href="/agent/list?new=1" variant="secondary" className="flex-1">
                {copy.submitted.another}
              </ButtonLink>
              <ButtonLink href="/agent/listings" variant="primary" className="flex-1">
                {copy.submitted.goToListings}
              </ButtonLink>
            </>
          ) : (
          <>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => go(step - 1)}
            disabled={step === 0 || pending}
          >
            {copy.wizard.back}
          </Button>
          {step < STEP_KEYS.length - 1 ? (
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => go(step + 1)}
              loading={pending}
            >
              {copy.wizard.next}
            </Button>
          ) : (
            <ButtonLink href="/agent/listings" variant="secondary" className="flex-1">
              {copy.wizard.myListings}
            </ButtonLink>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
