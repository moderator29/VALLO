import "server-only";

import { cache } from "react";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { LISTING_PRIVATE_COLUMNS, withListingPrivate, withoutColumns } from "../supabase/private-fields";
import type { Database } from "../supabase/database.types";
import { readClosedReasons } from "../landlord/queries";
import { SUPABASE_URL } from "../supabase/env";
import { resolveSession } from "../actions/session";
import { loadUnreadCounts } from "../messages/unread";
import type { AgentProfile } from "./types";
import { listingCompleteness, type Completeness } from "./completeness";
import { hasBadge, toBadgeTier } from "../trust/badge-tier";
import {
  AMENITY_CHOICES,
  type BuildCondition,
  type Furnishing,
  type LandTenure,
  type ListingIntent,
  type PropertyType,
  type RatePeriod,
  type RentPeriod,
  type SaleStatus,
  feeToNairaInput,
  koboToNairaInput,
  type PowerBackup,
  type PowerGrid,
  type WaterSupply,
} from "./listings-model";
import { headlinePrice, headlinePeriod, type PricePeriod } from "../listings/pricing";
import {
  COMPOUND_COLUMNS,
  compoundFormOf,
  readCompound,
  type Compound,
  type CompoundForm,
  type CompoundRow,
} from "../listings/compound";
import {
  SERVICE_COLUMNS,
  readService,
  serviceFormOf,
  type ServiceFacts,
  type ServiceForm,
  type ServiceRow,
} from "../listings/service";
import { readFlooding } from "../around/pulse-queries";
import type { Flooding } from "../around/pulse";
import { UNIT_COLUMNS, readUnit, unitFormOf, type UnitFacts, type UnitForm, type UnitRow } from "../listings/unit-shape";

/**
 * Server-side reads for the agent supply loop.
 *
 * Everything here runs as the signed-in agent through their own RLS-bound
 * client, so the database decides what they may see and this file never has to
 * repeat an ownership rule. The write half lives in listings-actions.ts; the
 * two share the agent resolution below so a caller cannot accidentally hold a
 * different definition of "this agent".
 */

export const PHOTO_BUCKET = "listing-photos";

export type ListingStatus = Database["public"]["Enums"]["listing_status"];

export type AgentIdentity = {
  id: string;
  displayName: string;
  status: Database["public"]["Enums"]["agent_application_status"];
  type: Database["public"]["Enums"]["agent_type"];
  /** The account's side, `agents.role`: `owner` is a landlord, `agent` an agent. */
  role: Database["public"]["Enums"]["supply_role"];
  verified: boolean;
  /**
   * Where they stand on the verification ladder, 0 to 4.
   *
   * Carried on the identity rather than fetched where it is needed, because the
   * agents row is already being read here and one more column on a query that
   * runs on every workspace page beats a second round trip on one of them.
   * `private.agent_tier` owns the arithmetic; this is only the answer.
   */
  verificationTier: number;
};

export type AgentContext =
  | { state: "unconfigured" }
  | { state: "signed-out" }
  | { state: "not-agent"; supabase: SupabaseClient<Database>; user: User }
  | {
      state: "agent";
      supabase: SupabaseClient<Database>;
      user: User;
      agent: AgentIdentity;
    };

/** The published tier off an embedded `agent_badges` row, which PostgREST may hand back as an object or a one-row list. */
function publishedTier(embed: unknown): unknown {
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row && typeof row === "object" ? (row as { tier?: unknown }).tier : undefined;
}

/**
 * Who is asking, and are they an approved agent?
 *
 * listings.agent_id points at public.agents, never at the auth user, so every
 * path through this feature starts by walking agents.user_id = auth.uid().
 */
/* Grade 1 (survey B-04): memoised per request with React's cache, so a page,
   its layout and its parts read the agents table once, not two or three times. */
export const getAgentContext = cache(getAgentContextOnce);

async function getAgentContextOnce(): Promise<AgentContext> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { state: "unconfigured" };
  if (session.state === "signed-out") return { state: "signed-out" };

  const { data, error } = await session.supabase
    .from("agents")
    .select("id, display_name, status, type, role, verification_tier, agent_badges(tier)")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    return { state: "not-agent", supabase: session.supabase, user: session.user };
  }

  return {
    state: "agent",
    supabase: session.supabase,
    user: session.user,
    agent: {
      id: data.id,
      displayName: data.display_name,
      status: data.status,
      type: data.type,
      role: data.role,
      /*
       * THE RAIL'S "VERIFIED AGENT" CHIP, READ FROM THE PUBLISHED BADGE.
       *
       * It first read `agents.verified`, which the application approval wrote
       * as true at tier 0. It then derived the chip here from the ladder
       * (`verification_tier >= 1`), which is the rule `lib/trust/badge-tier.ts`
       * says may live nowhere in `src`: a second derivation that can disagree
       * with the badge every other surface draws (audit A9, 6 October). So it
       * reads `agent_badges.tier`, the same published answer a listing and a
       * thread read, through `toBadgeTier`; a missing row or an unknown value
       * is no chip. `lib/trust/promotion-trust.test.ts` holds the shape.
       */
      verified: hasBadge(toBadgeTier(publishedTier(data.agent_badges))),
      verificationTier: data.verification_tier ?? 0,
    },
  };
}

/**
 * The rail's identity card, built from the real agents row rather than seed
 * content, so a signed-in agent sees their own name in the workspace chrome.
 */
export function agentProfileFrom(agent: AgentIdentity): AgentProfile {
  return {
    id: agent.id,
    displayName: agent.displayName,
    status: agent.status,
    type: agent.type,
    role: agent.role,
    verified: agent.verified,
  };
}

/** Public URL for an object in the world-readable listing-photos bucket. */
export function photoPublicUrl(storagePath: string): string {
  const base = SUPABASE_URL.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`;
}

/* --------------------------------------------------------- listing shapes */

export type ListingPhoto = { id: string; path: string; url: string; position: number };

/** One walkthrough on a listing. Same shape as a photo, plus what a video has. */
export type ListingVideo = {
  id: string;
  path: string;
  url: string;
  posterUrl: string | null;
  durationSeconds: number | null;
  position: number;
};

/** One card in the agent's workspace. Money stays integer kobo. */
export type ListingSummary = {
  id: string;
  /**
   * The code a person reads out over the phone, or null while the listing is
   * still in review. The database issues it at publish and never at draft, so
   * null here is a real state and the row says nothing rather than drawing an
   * empty field.
   */
  reference: string | null;
  title: string;
  status: ListingStatus;
  propertyType: PropertyType;
  intent: ListingIntent;
  /**
   * What the headline figure is quoted in, or "sale" when it is an asking price
   * and there is no period at all. Resolved by `headlinePrice`, the same
   * function the public catalogue uses, so the agent's own card and the card a
   * renter sees cannot print different numbers.
   */
  pricePeriod: PricePeriod | "sale";
  priceMinor: number;
  city: string | null;
  area: string | null;
  photoCount: number;
  coverUrl: string | null;
  updatedAt: string;
  submittedAt: string | null;
  /** When it last went live. Optional so older fixtures still type. */
  publishedAt?: string | null;
  reviewNotes: string | null;
  /** SCUML item 17: owner, agent or firm. Optional so older fixtures still type. */
  listingRole?: "owner" | "agent" | "firm" | null;
  /** Steps done out of steps (`lib/agent/completeness.ts`). Optional so older fixtures still type. */
  completeness?: Completeness;
};

/** Everything the wizard needs to reopen a draft exactly as it was left. */
/** The answer groups kept in their own columns. */
export type OwnAnswers = "compound" | "service" | "unit" | "flood";

export type WizardDraft = {
  id: string;
  status: ListingStatus;
  /**
   * When the review team received it, for a listing reopened in review (the
   * wizard's "sent" chain prints the date). Optional so older fixtures type.
   */
  submittedAt?: string | null;
  title: string;
  description: string;
  propertyType: PropertyType | null;
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

  /** To let, or for sale. Every money field below hangs off this one answer. */
  intent: ListingIntent;

  /* A tenancy: the rent, its cycle, and what it costs to get through the door. */
  rentNaira: string;
  rentPeriod: RentPeriod | "";
  rentNegotiable: boolean;
  cautionDepositNaira: string;
  serviceChargeNaira: string;
  serviceChargePeriod: RentPeriod | "";
  agencyFeeNaira: string;
  legalFeeNaira: string;
  agreementFeeNaira: string;
  totalMoveInNaira: string;
  minimumTenancyMonths: string;
  availableFrom: string;
  furnished: Furnishing | "";

  /* A short stay: one rate, per night or per head. */
  rateNaira: string;
  ratePeriod: RatePeriod | "";

  /* A sale: the asking price and the title being transferred with it. */
  salePriceNaira: string;
  saleAgencyFeeNaira: string;
  saleLegalFeeNaira: string;
  governorsConsentFeeNaira: string;
  stampDutyNaira: string;
  surveyRegistrationFeeNaira: string;
  totalPurchaseNaira: string;
  priceNegotiable: boolean;
  tenure: LandTenure | "";
  saleStatus: SaleStatus | "";
  yearBuilt: string;
  condition: BuildCondition | "";

  powerGrid: PowerGrid | "";
  powerBackup: PowerBackup | "";
  powerBackupHours: string;
  waterSupply: WaterSupply | "";
  prepaidMeter: boolean;
  /** V-28: the compound's five answers, as the wizard's controls hold them. */
  compound?: CompoundForm;
  /** V-68: the service charge's answers, as the wizard's controls hold them. */
  service?: ServiceForm;
  /** V-66: the unit's shape, as the wizard's controls hold it. */
  unit?: UnitForm;
  /** V-41: the lister's flooding answer; "" is unanswered. */
  flooding?: Flooding | "";
  /** Which of those groups could not be read, so a save leaves them alone. */
  unread?: OwnAnswers[];
  /** Never public. Read from public.listing_access, which only the host,
      an admin and a guest with a CONFIRMED booking may select from. */
  access: {
    estateName: string;
    gateDirections: string;
    securityPhone: string;
    accessCode: string;
  };
  amenityCodes: string[];
  photos: ListingPhoto[];
  videos: ListingVideo[];
  reviewNotes: string | null;
};

const LISTING_SELECT =
  "id, reference, title, description, status, property_type, listing_intent, " +
  "rent_amount_minor, rent_period, rent_negotiable, caution_deposit_minor, " +
  "service_charge_minor, service_charge_period, agency_fee_minor, legal_fee_minor, " +
  "agreement_fee_minor, total_move_in_cost_minor, minimum_tenancy_months, available_from, " +
  "furnished, rate_minor, rate_period, sale_price_minor, price_negotiable, tenure, " +
  "sale_status, year_built, condition, size_sqm, toilets, parking_spaces, floor, total_floors, " +
  "sale_agency_fee_minor, sale_legal_fee_minor, governors_consent_fee_minor, " +
  "stamp_duty_minor, survey_registration_fee_minor, total_purchase_cost_minor, " +
  "state_code, city, area, address, landmark, bedrooms, bathrooms, submitted_at, published_at, " +
  "review_notes, listing_role, updated_at, power_grid, power_backup, power_backup_hours, water_supply, " +
  "prepaid_meter, listing_photos(id, storage_path, position), " +
  "listing_videos(id, storage_path, poster_path, duration_seconds, position), " +
  "listing_amenities(amenities(code)), " +
  "listing_access(estate_name, gate_directions, security_phone, access_code)";

/**
 * The street address, landmark and the reviewer's note are the lister's and
 * staff's, not every member's. The table read names only the
 * public columns; the private ones come from `listing_private_fields`, which
 * answers only for the caller's own listings.
 */
export const LISTING_PUBLIC_SELECT = withoutColumns(LISTING_SELECT, LISTING_PRIVATE_COLUMNS);

/** The row with its private fields, or null when they could not be read. */
async function withListingPrivateOrNull(
  supabase: Parameters<typeof withListingPrivate>[0],
  row: ListingWithChildren,
) {
  try {
    const [merged] = await withListingPrivate(supabase, [row]);
    return merged ?? null;
  } catch {
    return null;
  }
}

type ListingWithChildren = {
  id: string;
  reference: string | null;
  title: string;
  description: string | null;
  status: ListingStatus;
  property_type: PropertyType;
  listing_intent: ListingIntent;
  rent_amount_minor: number | null;
  rent_period: RentPeriod | null;
  rent_negotiable: boolean | null;
  caution_deposit_minor: number | null;
  service_charge_minor: number | null;
  service_charge_period: RentPeriod | null;
  agency_fee_minor: number | null;
  legal_fee_minor: number | null;
  agreement_fee_minor: number | null;
  total_move_in_cost_minor: number | null;
  minimum_tenancy_months: number | null;
  available_from: string | null;
  furnished: Furnishing | null;
  rate_minor: number;
  rate_period: RatePeriod | null;
  sale_price_minor: number | null;
  sale_agency_fee_minor: number | null;
  sale_legal_fee_minor: number | null;
  governors_consent_fee_minor: number | null;
  stamp_duty_minor: number | null;
  survey_registration_fee_minor: number | null;
  total_purchase_cost_minor: number | null;
  price_negotiable: boolean | null;
  tenure: LandTenure | null;
  sale_status: SaleStatus | null;
  year_built: number | null;
  condition: BuildCondition | null;
  size_sqm: number | string | null;
  toilets: number | null;
  parking_spaces: number | null;
  floor: number | null;
  total_floors: number | null;
  state_code: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  landmark: string | null;
  bedrooms: number;
  bathrooms: number;
  submitted_at: string | null;
  /** When it last went live: the lister's payoff reads it (lib/agent/lister-live.ts). */
  published_at?: string | null;
  review_notes: string | null;
  /** SCUML item 17: who the lister is on this listing; an agent or firm files a mandate. */
  listing_role?: "owner" | "agent" | "firm" | null;
  updated_at: string;
  power_grid: PowerGrid | null;
  power_backup: PowerBackup | null;
  power_backup_hours: number | null;
  water_supply: WaterSupply | null;
  prepaid_meter: boolean | null;
  listing_photos: { id: string; storage_path: string; position: number }[] | null;
  listing_videos:
    | {
        id: string;
        storage_path: string;
        poster_path: string | null;
        duration_seconds: number | null;
        position: number;
      }[]
    | null;
  listing_amenities: { amenities: { code: string } | null }[] | null;
  /* One row or none. PostgREST returns an object for a one-to-one embed and
     null when the row does not exist, so both shapes are handled. */
  listing_access:
    | {
        estate_name: string | null;
        gate_directions: string | null;
        security_phone: string | null;
        access_code: string | null;
      }
    | null;
};

function sortedPhotos(row: ListingWithChildren): ListingPhoto[] {
  return [...(row.listing_photos ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      id: p.id,
      path: p.storage_path,
      url: photoPublicUrl(p.storage_path),
      position: p.position,
    }));
}

/**
 * Walkthroughs. Private, so the wizard reads them through a signed URL exactly
 * as the public catalogue does. See lib/listings/supabase-repository for why
 * this bucket is not public when listing-photos is.
 */
export const VIDEO_BUCKET = "listing-videos";
const VIDEO_URL_SECONDS = 3600;

/**
 * The rows, with a signed URL each. Async because signing is a request, and one
 * request for all of a listing's videos rather than one each.
 *
 * A video whose URL will not sign comes back with an empty url rather than
 * being dropped: this is the OWNER's own workspace, and silently hiding a file
 * they uploaded would look exactly like losing it.
 */
async function sortedVideos(
  supabase: SupabaseClient<Database>,
  row: ListingWithChildren,
): Promise<ListingVideo[]> {
  const rows = [...(row.listing_videos ?? [])].sort((a, b) => a.position - b.position);
  if (rows.length === 0) return [];

  const signed = new Map<string, string>();
  try {
    const { data } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrls(
        rows.map((v) => v.storage_path),
        VIDEO_URL_SECONDS,
      );
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  } catch {
    /* Storage unreachable. The list still renders with what it knows. */
  }

  return rows.map((v) => ({
    id: v.id,
    path: v.storage_path,
    url: signed.get(v.storage_path) ?? "",
    posterUrl: v.poster_path ? photoPublicUrl(v.poster_path) : null,
    durationSeconds: v.duration_seconds,
    position: v.position,
  }));
}

function amenityCodesOf(row: ListingWithChildren): string[] {
  return (row.listing_amenities ?? [])
    .map((join) => join.amenities?.code)
    .filter((code): code is string => typeof code === "string");
}

function toSummary(row: ListingWithChildren): ListingSummary {
  const photos = sortedPhotos(row);
  const cover = photos[0];
  const headline = headlinePrice(row);
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    propertyType: row.property_type,
    intent: row.listing_intent,
    pricePeriod: headlinePeriod(headline),
    priceMinor: headline.minor,
    city: row.city,
    area: row.area,
    photoCount: photos.length,
    coverUrl: cover ? cover.url : null,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    publishedAt: row.published_at ?? null,
    reviewNotes: row.review_notes,
    listingRole: row.listing_role ?? null,
    completeness: completenessOf(row, photos),
  };
}

/** The meter's facts, read from the row the list already holds. */
function completenessOf(row: ListingWithChildren, photos: ListingPhoto[]): Completeness {
  return listingCompleteness({
    gate: {
      title: row.title,
      description: row.description,
      propertyType: row.property_type,
      stateCode: row.state_code,
      city: row.city,
      area: row.area,
      intent: row.listing_intent,
      rentMinor: row.rent_amount_minor,
      rentPeriod: row.rent_period,
      rateMinor: row.rate_minor,
      ratePeriod: row.rate_period,
      salePriceMinor: row.sale_price_minor,
      tenure: row.tenure,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      amenityCount: (row.listing_amenities ?? []).length,
      photoCount: photos.length,
      videoCount: (row.listing_videos ?? []).length,
      hasCover: photos.some((photo) => photo.position === 0),
      moveInStatedMinor: row.total_move_in_cost_minor,
      moveInPartsMinor: [
        row.rent_amount_minor,
        row.caution_deposit_minor,
        row.service_charge_minor,
        row.agency_fee_minor,
        row.legal_fee_minor,
        row.agreement_fee_minor,
      ],
    },
    videoCount: (row.listing_videos ?? []).length,
    utilitiesAnswered: Boolean(row.power_grid || row.power_backup || row.water_supply),
    hasLandmark: Boolean((row.landmark ?? "").trim() || (row.address ?? "").trim()),
  });
}

/** A number for an input: the value as typed, or an empty box. */
function numberInput(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

async function toDraft(
  supabase: SupabaseClient<Database>,
  row: ListingWithChildren,
): Promise<WizardDraft> {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    description: row.description ?? "",
    propertyType: row.property_type,
    stateCode: row.state_code ?? "",
    city: row.city ?? "",
    area: row.area ?? "",
    address: row.address ?? "",
    landmark: row.landmark ?? "",
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    toilets: numberInput(row.toilets),
    parkingSpaces: numberInput(row.parking_spaces),
    floor: numberInput(row.floor),
    totalFloors: numberInput(row.total_floors),
    sizeSqm: numberInput(row.size_sqm),

    intent: row.listing_intent,

    rentNaira: koboToNairaInput(row.rent_amount_minor),
    rentPeriod: row.rent_period ?? "",
    rentNegotiable: row.rent_negotiable ?? false,
    cautionDepositNaira: feeToNairaInput(row.caution_deposit_minor),
    serviceChargeNaira: feeToNairaInput(row.service_charge_minor),
    serviceChargePeriod: row.service_charge_period ?? "",
    agencyFeeNaira: feeToNairaInput(row.agency_fee_minor),
    legalFeeNaira: feeToNairaInput(row.legal_fee_minor),
    agreementFeeNaira: feeToNairaInput(row.agreement_fee_minor),
    totalMoveInNaira: koboToNairaInput(row.total_move_in_cost_minor),
    minimumTenancyMonths: numberInput(row.minimum_tenancy_months),
    availableFrom: row.available_from ?? "",
    furnished: row.furnished ?? "",

    rateNaira: koboToNairaInput(row.rate_minor),
    ratePeriod: row.rate_period ?? "",

    salePriceNaira: koboToNairaInput(row.sale_price_minor),
    saleAgencyFeeNaira: feeToNairaInput(row.sale_agency_fee_minor),
    saleLegalFeeNaira: feeToNairaInput(row.sale_legal_fee_minor),
    governorsConsentFeeNaira: feeToNairaInput(row.governors_consent_fee_minor),
    stampDutyNaira: feeToNairaInput(row.stamp_duty_minor),
    surveyRegistrationFeeNaira: feeToNairaInput(row.survey_registration_fee_minor),
    totalPurchaseNaira: koboToNairaInput(row.total_purchase_cost_minor),
    priceNegotiable: row.price_negotiable ?? false,
    tenure: row.tenure ?? "",
    saleStatus: row.sale_status ?? "",
    yearBuilt: numberInput(row.year_built),
    condition: row.condition ?? "",

    powerGrid: row.power_grid ?? "",
    powerBackup: row.power_backup ?? "",
    powerBackupHours: row.power_backup_hours === null ? "" : String(row.power_backup_hours),
    waterSupply: row.water_supply ?? "",
    prepaidMeter: row.prepaid_meter ?? false,
    ...(await ownAnswers(supabase, row.id)),
    access: {
      estateName: row.listing_access?.estate_name ?? "",
      gateDirections: row.listing_access?.gate_directions ?? "",
      securityPhone: row.listing_access?.security_phone ?? "",
      accessCode: row.listing_access?.access_code ?? "",
    },
    amenityCodes: amenityCodesOf(row),
    photos: sortedPhotos(row),
    videos: await sortedVideos(supabase, row),
    reviewNotes: row.review_notes,
    submittedAt: row.submitted_at,
  };
}

/**
 * The answers kept in their own columns (V-28, V-68, V-66), read on their
 * own. A read that FAILED is named in `unread`, so the wizard does not send
 * its empty form back as nulls and wipe answers it never saw (review 13).
 */
async function ownAnswers(
  supabase: SupabaseClient<Database>,
  listingId: string,
): Promise<Pick<WizardDraft, "compound" | "service" | "unit" | "flooding" | "unread">> {
  const [compound, service, unit, flooding] = await Promise.all([
    readCompoundFor(supabase, listingId),
    readServiceFor(supabase, listingId),
    readUnitFor(supabase, listingId),
    readFlooding(supabase, listingId),
  ]);
  const unread: OwnAnswers[] = [];
  if (compound === undefined) unread.push("compound");
  if (service === undefined) unread.push("service");
  if (unit === undefined) unread.push("unit");
  if (flooding === undefined) unread.push("flood");
  return {
    compound: compoundFormOf(compound ?? null),
    service: serviceFormOf(service ?? null),
    unit: unitFormOf(unit ?? null),
    flooding: flooding ?? "",
    unread,
  };
}

/**
 * The compound's five answers for one draft (V-28), by their own read so a
 * database without the migration still opens the wizard: an error is "nothing
 * answered". See `getCompoundFacts` in the listings repository for why.
 */
async function readCompoundFor(
  supabase: SupabaseClient<Database>,
  listingId: string,
): Promise<Compound | null | undefined> {
  try {
    const { data, error } = await supabase
      .from("listings")
      .select(COMPOUND_COLUMNS)
      .eq("id", listingId)
      .maybeSingle();
    if (error || !data) return undefined;
    return readCompound(data as unknown as CompoundRow);
  } catch {
    return undefined;
  }
}

/** V-68: the service charge's answers for one draft, by their own read. */
async function readServiceFor(
  supabase: SupabaseClient<Database>,
  listingId: string,
): Promise<ServiceFacts | null | undefined> {
  try {
    const { data, error } = await supabase
      .from("listings")
      .select(SERVICE_COLUMNS)
      .eq("id", listingId)
      .maybeSingle();
    if (error || !data) return undefined;
    return readService(data as unknown as ServiceRow);
  } catch {
    return undefined;
  }
}

/** V-66: the unit's shape for one draft, by its own read. */
async function readUnitFor(
  supabase: SupabaseClient<Database>,
  listingId: string,
): Promise<UnitFacts | null | undefined> {
  try {
    const { data, error } = await supabase.from("listings").select(UNIT_COLUMNS).eq("id", listingId).maybeSingle();
    if (error || !data) return undefined;
    return readUnit(data as unknown as UnitRow);
  } catch {
    return undefined;
  }
}

/**
 * Every listing the agent owns, newest activity first, all statuses. Null
 * when they could not be read, which is not the same as having none.
 */
export async function readMyListings(
  supabase: SupabaseClient<Database>,
  agentId: string,
): Promise<ListingSummary[] | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_PUBLIC_SELECT)
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false });

  if (error || !data) return null;
  try {
    const rows = await withListingPrivate(supabase, data as unknown as ListingWithChildren[]);
    return rows.map(toSummary);
  } catch {
    return null;
  }
}

/**
 * A draft read that failed, as distinct from one that found nothing. The page
 * says "could not load, try again" for this rather than treating it as "not
 * yours" or, worse, opening a blank wizard whose first save files a second
 * listing.
 */
export const DRAFT_READ_FAILED = "read-failed" as const;
export type DraftRead = WizardDraft | null | typeof DRAFT_READ_FAILED;

/** One listing, fully hydrated for the wizard. Null when it is not theirs. */
export async function readDraft(
  supabase: SupabaseClient<Database>,
  agentId: string,
  listingId: string,
): Promise<DraftRead> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_PUBLIC_SELECT)
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) return DRAFT_READ_FAILED;
  if (!data) return null;
  const row = await withListingPrivateOrNull(supabase, data as unknown as ListingWithChildren);
  return row ? toDraft(supabase, row) : DRAFT_READ_FAILED;
}

/**
 * The draft a host would expect to walk back into, or null.
 *
 * The wizard already saved everything: the row, the photos, the amenities and
 * the gate details all went to Postgres on every step change. What it could not
 * do was find that work again. Opening /agent/list with no `?id=` handed the
 * wizard a blank draft, and the next autosave INSERTED a second listings row,
 * because the id lived only in the state of a page that had been closed. A host
 * who typed a title in the taxi, put the phone down, and opened the app again
 * that evening was looking at an empty form with their four uploaded photos
 * attached to a listing they had no way to see, and their honest reading of
 * that screen is that the platform lost their work.
 *
 * DRAFT only, deliberately. MORE_INFO_REQUIRED and REJECTED are also editable,
 * but both mean a reviewer has said something, and the workspace groups them
 * under "Needs your attention" with that note attached. Dropping somebody
 * straight into one of those without the reviewer's sentence in front of them
 * would answer a question they did not ask.
 *
 * Most recently touched first, because with several drafts open the one a host
 * means is the one they were last in.
 */
export async function readOpenDraft(
  supabase: SupabaseClient<Database>,
  agentId: string,
): Promise<DraftRead> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_PUBLIC_SELECT)
    .eq("agent_id", agentId)
    .eq("status", "DRAFT")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  /* A failed read is not "no draft": opening blank here would file a second
     listing beside the one the host came back to finish. */
  if (error) return DRAFT_READ_FAILED;
  if (!data) return null;
  const row = await withListingPrivateOrNull(supabase, data as unknown as ListingWithChildren);
  return row ? toDraft(supabase, row) : DRAFT_READ_FAILED;
}

/* ------------------------------------------------------- reference data */

/** The 37 states for the location select, names from the platform. */
export async function readStates(
  supabase: SupabaseClient<Database>,
): Promise<{ code: string; name: string }[]> {
  const { data, error } = await supabase.from("states").select("code, name").order("name");
  if (error || !data) return [];
  return data;
}

/** The seeded amenity chips. Falls back to the canonical list on any error. */
export async function readAmenities(
  supabase: SupabaseClient<Database>,
): Promise<{ code: string; label: string }[]> {
  const { data, error } = await supabase.from("amenities").select("code, label").order("label");
  if (error || !data || data.length === 0) return AMENITY_CHOICES;
  return data;
}

/* --------------------------------------------------------- dashboard */

export type AgentBookingRow = {
  id: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  totalMinor: number;
  status: Database["public"]["Enums"]["booking_status"];
};

export type AgentNumbers = {
  byStatus: Record<ListingStatus, number>;
  totalListings: number;
  liveListings: number;
  inReview: number;
  drafts: number;
  upcomingBookings: AgentBookingRow[];
  upcomingBookingCount: number;
  /** Null when the count could not be read: shown as unknown, never as 0. */
  unreadMessages: number | null;
};

const EMPTY_STATUS_COUNTS: Record<ListingStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 0,
  UNDER_REVIEW: 0,
  MORE_INFO_REQUIRED: 0,
  APPROVED: 0,
  PUBLISHED: 0,
  REJECTED: 0,
  SUSPENDED: 0,
};

/** Today in Lagos as an ISO date, so "upcoming" means the same to everyone. */
function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

/**
 * The agent's real numbers: listings by status, their next stays, and how many
 * guest messages are still waiting on a reply. Each read is independent, so a
 * single failing query degrades one number rather than the whole dashboard.
 */
export async function readAgentNumbers(
  supabase: SupabaseClient<Database>,
  agentId: string,
  /* Kept for the callers; the unread count now comes from auth.uid() in
     my_unread_counts(), which cannot be pointed at somebody else. */
  _userId: string,
): Promise<AgentNumbers> {
  const today = lagosToday();

  const [statusRes, bookingRes, unreadCounts] = await Promise.all([
    supabase.from("listings").select("id, status").eq("agent_id", agentId),
    supabase
      .from("bookings")
      .select("id, check_in, check_out, total_minor, status, listings!inner(title, agent_id)", { count: "exact" })
      .eq("listings.agent_id", agentId)
      .gte("check_out", today)
      .in("status", ["PENDING", "CONFIRMED"])
      .order("check_in", { ascending: true })
      .limit(6),
    /* DB2: my_unread_counts() says which side of each thread the caller is
       on, so the lister side is summed without listing its conversations
       (a list PostgREST capped at 1000). */
    loadUnreadCounts(supabase),
  ]);

  /* V-48: a listing closed with a reason is SUSPENDED underneath and is not a
     suspension, so it is not counted as one. The read fails soft into "none
     closed", which counts exactly as before. */
  const closed = await readClosedReasons((statusRes.data ?? []).map((row) => row.id));
  const byStatus: Record<ListingStatus, number> = { ...EMPTY_STATUS_COUNTS };
  for (const row of statusRes.data ?? []) {
    if (row.id in closed) continue;
    byStatus[row.status] += 1;
  }

  const bookings = (bookingRes.data ?? []) as unknown as {
    id: string;
    check_in: string;
    check_out: string;
    total_minor: number;
    status: Database["public"]["Enums"]["booking_status"];
    listings: { title: string } | null;
  }[];

  const upcomingBookings: AgentBookingRow[] = bookings.map((b) => ({
    id: b.id,
    listingTitle: b.listings?.title ?? "Your listing",
    checkIn: b.check_in,
    checkOut: b.check_out,
    totalMinor: b.total_minor,
    status: b.status,
  }));

  const unreadMessages = unreadCounts ? unreadCounts.asAgent : null;

  const totalListings = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

  return {
    byStatus,
    totalListings,
    liveListings: byStatus.PUBLISHED + byStatus.APPROVED,
    inReview: byStatus.SUBMITTED + byStatus.UNDER_REVIEW,
    /* Everything the lister can still edit, which is the set
       `guard_owner_write` calls editable. REJECTED was counted nowhere, so a
       listing sent back by review vanished from every figure. */
    drafts: byStatus.DRAFT + byStatus.MORE_INFO_REQUIRED + byStatus.REJECTED,
    upcomingBookings,
    /* The rows are capped at six for the list; the figure is the real count. */
    upcomingBookingCount: bookingRes.count ?? upcomingBookings.length,
    unreadMessages,
  };
}

/* ------------------------------------------------------------- labels */

// The status label and tone tables live in listings-schema, which carries no
// server-only import, because the workspace renders them from a client
// component. Re-exported here so server callers keep one import site.
export { STATUS_LABEL, STATUS_TONE } from "./listings-model";
