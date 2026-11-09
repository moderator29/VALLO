import type { OwnAnswers, WizardDraft } from "@/lib/agent/listings-queries";
import {
  asksFact,
  isTenancy,
  parseNairaToKobo,
  ratePeriodFor,
  type BuildCondition,
  type Furnishing,
  type LandTenure,
  type ListingFact,
  type ListingIntent,
  type PowerBackup,
  type PowerGrid,
  type PropertyType,
  type RentPeriod,
  type SaleStatus,
  type WaterSupply,
} from "@/lib/agent/listings-model";
import { mergeMedia } from "@/lib/listings/media-order";
import { EMPTY_COMPOUND_FORM, type CompoundForm } from "@/lib/listings/compound";
import { EMPTY_SERVICE_FORM, type ServiceForm } from "@/lib/listings/service";
import { EMPTY_UNIT_FORM, takesShape, type UnitForm } from "@/lib/listings/unit-shape";
import type { Flooding } from "@/lib/around/pulse";

/**
 * THE LISTING WIZARD AS DATA (P1.1, LW-01 and LW-02, November 2026).
 *
 * The wizard was eight screens holding about sixty questions, every one of
 * them drawn by one 4,700-line component. It is one question per screen now,
 * on the platform's `StepFrame`, and the ORDER of those screens, which ones a
 * listing is asked, and which step owns which answer all live here, as a list,
 * rather than as `step === 5` branches in a render. The step components in this
 * folder draw the questions; `ListingWizard.tsx` keeps the one state store,
 * the saves, the uploads and the send.
 *
 * Pure: no React, no server imports. Tested in `model.test.ts`.
 */

/* ----------------------------------------------------------- the answers */

export type Values = {
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

export type Photo = { id: string; path: string; url: string };

/** A walkthrough on the listing; its url is signed (or local until the next read). */
export type Video = { id: string; url: string; posterUrl: string | null; durationSeconds: number | null };

/**
 * ONE ROW OF PHOTOS AND VIDEOS, the first of which (the cover) is a photo.
 * Stored across two tables and read back with `mergeMedia`.
 */
export type Media = ({ kind: "photo" } & Photo) | ({ kind: "video" } & Video);

/** "0:42". */
export function clockOf(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The row a stored draft opens on. */
export function mediaFrom(draft: WizardDraft | null): Media[] {
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
export function digitsOnly(raw: string, max: number): string {
  return raw.replace(/[^0-9]/g, "").slice(0, max);
}

/** A box as the save sends it: what was typed, or null for a box left empty. */
export function cleared(raw: string): string | null {
  return raw.trim() === "" ? null : raw;
}

/**
 * True when a group's saved answers could not be read AND the lister has not
 * touched the empty form standing in for them. Such a group is left out of
 * the save rather than written back as nulls (review 13).
 */
export function untouchedUnread(unread: readonly OwnAnswers[], group: OwnAnswers, value: unknown, empty: unknown): boolean {
  return unread.includes(group) && JSON.stringify(value) === JSON.stringify(empty);
}

export const EMPTY: Values = {
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

export function valuesFrom(draft: WizardDraft): Values {
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

/* -------------------------------------------------------- the three kinds */

/**
 * WHAT IS BEING LISTED, the first question (R18.1). It is not a column: it is
 * read from the two answers that already decide the market, the intent and
 * the property type, exactly as the money model reads them (`sale` wins; a
 * tenancy category is let by the year; everything else is booked by the
 * night). So a draft saved before this question existed opens on its answer.
 */
export type ListingKind = "stay" | "rent" | "sale";

export function kindOf(values: Pick<Values, "intent" | "propertyType">): ListingKind {
  if (values.intent === "sale") return "sale";
  return isTenancy(values.propertyType) ? "rent" : "stay";
}

/* Hotels and restaurants are listed from the host workspace with their own
   rooms, rates and tables; the property wizard offers them only to a draft
   that was already saved as one. */
export const HOST_ONLY: ReadonlySet<PropertyType> = new Set<PropertyType>(["hotel", "restaurant"]);

/** The type tiles each kind offers, in display order (not the schema's storage order). */
const TYPES_FOR: Record<ListingKind, readonly PropertyType[]> = {
  stay: ["apartment", "shortlet", "home", "villa"],
  rent: ["rental", "shop", "office", "land"],
  sale: ["apartment", "home", "villa", "shop", "office", "land"],
};

/** The tiles for a kind, plus the draft's own type when it is one the kind does not offer (a hotel, a legacy answer). */
export function typesFor(kind: ListingKind, current: PropertyType): PropertyType[] {
  const list = [...TYPES_FOR[kind]];
  if (!list.includes(current) && kindOf({ intent: kind === "sale" ? "sale" : "rent", propertyType: current }) === kind) {
    list.push(current);
  }
  return list;
}

/**
 * Choosing a kind: the intent it means, and a type it can have when the one
 * chosen before cannot (a yearly rental is not a stay). A type the kind
 * already allows is kept, so changing nothing changes nothing.
 */
export function applyKind(values: Pick<Values, "intent" | "propertyType">, kind: ListingKind): Pick<Values, "intent" | "propertyType"> {
  const intent: ListingIntent = kind === "sale" ? "sale" : "rent";
  const fits = kindOf({ intent, propertyType: values.propertyType }) === kind && !(kind === "sale" && values.propertyType === "shortlet");
  if (fits) return { intent, propertyType: values.propertyType };
  const fallback: Record<ListingKind, PropertyType> = { stay: "shortlet", rent: "rental", sale: "home" };
  return { intent, propertyType: fallback[kind] };
}

/* ------------------------------------------------------------- the money */

/**
 * Every figure the money steps and the check page read, worked out once from
 * the answers, in kobo. `parseNairaToKobo` gives null for an EMPTY box and a
 * number for a typed one, a typed zero included: that is the declared versus
 * undeclared line the move-in model needs, so a blank stays absent.
 */
export function moneyOf(values: Values) {
  const forSale = values.intent === "sale";
  const tenancy = !forSale && isTenancy(values.propertyType);
  const shortStay = !forSale && !tenancy;
  const perHead = ratePeriodFor(values.propertyType) === "guest";
  const rentMinor = parseNairaToKobo(values.rentNaira) ?? 0;
  const rateMinor = parseNairaToKobo(values.rateNaira) ?? 0;
  const saleMinor = parseNairaToKobo(values.salePriceNaira) ?? 0;
  const priceMinor = forSale ? saleMinor : tenancy ? rentMinor : rateMinor;
  /* The service charge is a part (it was missing once, and the floor the
     stated total is checked against was too low by exactly that charge). */
  const partsSumMinor = [
    values.rentNaira,
    values.cautionDepositNaira,
    values.serviceChargeNaira,
    values.agencyFeeNaira,
    values.legalFeeNaira,
    values.agreementFeeNaira,
  ].reduce((total, raw) => total + (parseNairaToKobo(raw) ?? 0), 0);
  const statedTotalMinor = parseNairaToKobo(values.totalMoveInNaira);
  /* V-13. The part of a stated total the fee boxes do not explain. */
  const moveInRemainderMinor =
    statedTotalMinor !== null && statedTotalMinor > partsSumMinor ? statedTotalMinor - partsSumMinor : 0;
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
  return {
    forSale,
    tenancy,
    shortStay,
    perHead,
    rentMinor,
    rateMinor,
    saleMinor,
    priceMinor,
    partsSumMinor,
    statedTotalMinor,
    moveInRemainderMinor,
    purchasePartsMinor,
    statedPurchaseMinor,
    purchaseMinor,
    paysFacts,
  };
}

export type Money = ReturnType<typeof moneyOf>;

/* The named charges, in the order their cards are offered. Each is one
   column the draft already stores; a charge card is a way to fill it. */
export const RENT_CHARGE_KEYS = [
  "cautionDepositNaira",
  "agencyFeeNaira",
  "legalFeeNaira",
  "agreementFeeNaira",
  "serviceChargeNaira",
] as const satisfies readonly (keyof Values)[];

export const SALE_CHARGE_KEYS = [
  "saleAgencyFeeNaira",
  "saleLegalFeeNaira",
  "governorsConsentFeeNaira",
  "stampDutyNaira",
  "surveyRegistrationFeeNaira",
] as const satisfies readonly (keyof Values)[];

export type ChargeKey = (typeof RENT_CHARGE_KEYS)[number] | (typeof SALE_CHARGE_KEYS)[number];

/** A percentage of a base, in whole naira, as the box stores it. Null when there is nothing to take it of. */
export function percentOf(baseMinor: number, percent: string): string | null {
  const share = Number(percent.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(share) || share < 0 || baseMinor <= 0) return null;
  return String(Math.round((baseMinor * share) / 100 / 100));
}

/* ------------------------------------------------------------- the steps */

export type StepId =
  | "kind"
  | "type"
  | "location"
  | "rooms"
  | "place"
  | "supply"
  | "compound"
  | "access"
  | "amenities"
  | "price"
  | "charges"
  | "terms"
  | "photos"
  | "describe"
  | "check";

export type EyebrowKey =
  | "basics"
  | "location"
  | "details"
  | "supply"
  | "compound"
  | "access"
  | "amenities"
  | "pricing"
  | "charges"
  | "terms"
  | "photos"
  | "finish"
  | "check";

/** What a step's `applies` reads: the answers that decide which questions a listing is asked. */
export type StepSubject = { kind: ListingKind; propertyType: PropertyType };

export type StepDef = {
  id: StepId;
  eyebrow: EyebrowKey;
  /**
   * The answers this step owns: the gate's field names (`submitRequirements`)
   * and the form's own keys. The check page's Change and every "Fix" land on
   * the step that owns the field.
   */
  owns: readonly string[];
  /** Whether a listing of this kind and type is asked this step. */
  applies: (subject: StepSubject) => boolean;
};

const always = () => true;
const asks = (fact: ListingFact) => (s: StepSubject) => asksFact(s.propertyType, fact);

/**
 * THE ORDER OF THE FLOW. The count is honest and computed (R29, pattern 11):
 * a plot skips the rooms' shape, the light and water and the amenities, so it
 * is asked twelve questions where a flat is asked fifteen.
 */
export const STEP_DEFS: readonly StepDef[] = [
  { id: "kind", eyebrow: "basics", owns: ["intent"], applies: always },
  { id: "type", eyebrow: "basics", owns: ["propertyType"], applies: always },
  { id: "location", eyebrow: "location", owns: ["stateCode", "city", "area", "address", "landmark"], applies: always },
  {
    id: "rooms",
    eyebrow: "details",
    owns: ["bedrooms", "bathrooms", "toilets", "parkingSpaces", "sizeSqm"],
    applies: always,
  },
  {
    id: "place",
    eyebrow: "details",
    owns: ["unitShape", "furnished", "floor", "totalFloors", "condition"],
    applies: (s) =>
      takesShape(s.propertyType) ||
      asksFact(s.propertyType, "furnishing") ||
      asksFact(s.propertyType, "floor") ||
      asksFact(s.propertyType, "condition"),
  },
  {
    id: "supply",
    eyebrow: "supply",
    owns: ["powerGrid", "powerBackup", "powerBackupHours", "waterSupply", "prepaidMeter"],
    applies: (s) => asksFact(s.propertyType, "power") || asksFact(s.propertyType, "water"),
  },
  { id: "compound", eyebrow: "compound", owns: ["service", "flooding", "compound", "flatsInCompound"], applies: always },
  { id: "access", eyebrow: "access", owns: ["estateName", "gateDirections", "securityPhone", "accessCode"], applies: always },
  { id: "amenities", eyebrow: "amenities", owns: ["amenities"], applies: asks("amenities") },
  {
    id: "price",
    eyebrow: "pricing",
    owns: ["price", "rent", "rentPeriod", "rate", "ratePeriod", "salePrice", "rentNaira", "rateNaira", "salePriceNaira", "rentNegotiable", "priceNegotiable"],
    applies: always,
  },
  {
    id: "charges",
    eyebrow: "charges",
    owns: ["totalMoveIn", "totalMoveInNaira", "totalPurchaseNaira", ...RENT_CHARGE_KEYS, ...SALE_CHARGE_KEYS, "serviceChargePeriod"],
    applies: always,
  },
  {
    id: "terms",
    eyebrow: "terms",
    owns: ["tenure", "saleStatus", "yearBuilt", "minimumTenancyMonths", "availableFrom"],
    applies: always,
  },
  { id: "photos", eyebrow: "photos", owns: ["photos"], applies: always },
  { id: "describe", eyebrow: "finish", owns: ["title", "description"], applies: always },
  { id: "check", eyebrow: "check", owns: [], applies: always },
];

/** The steps this listing is asked, in order. */
export function stepsFor(subject: StepSubject): StepDef[] {
  return STEP_DEFS.filter((step) => step.applies(subject));
}

/**
 * The step that owns a field the submit gate (or the server) can name, so a
 * Fix lands on the box that fixes it. A field nothing owns, which the gate
 * may grow later, lands on the rooms, where the old first step put it.
 */
export function stepOfGateField(field: string, steps: readonly StepDef[]): StepId {
  return steps.find((step) => step.owns.includes(field))?.id ?? (steps.some((s) => s.id === "rooms") ? "rooms" : "describe");
}

/** Where a `startAt` lands: a step id when it is one this listing is asked, else a clamped index. */
export function startStep(startAt: number | StepId, steps: readonly StepDef[]): StepId {
  if (typeof startAt === "string") {
    return steps.some((step) => step.id === startAt) ? startAt : (steps[0]?.id ?? "kind");
  }
  const index = Math.min(Math.max(Math.trunc(startAt), 0), steps.length - 1);
  return steps[index]?.id ?? "kind";
}
