"use server";

/**
 * The supply loop: an agent's listings, from first typed word to review queue.
 *
 * Every export here is a public endpoint, so every one of them starts the same
 * way: resolve the session, respect the "agent_listings" flag, then resolve the
 * caller's row in public.agents. That last step is the load-bearing one.
 * listings.agent_id references public.agents(id), never the auth user id, so an
 * action that skipped it would either write nothing or write the wrong owner.
 * Whoever has no agents row gets one honest sentence and a way forward.
 *
 * Writes go through the caller's own RLS-bound client, so Postgres is the
 * authority on ownership and this file never re-implements a policy. The
 * service role is not used anywhere in this feature: an agent managing their
 * own supply needs no privilege escalation.
 *
 * submitListing runs the canonical gate from listings-schema against the STORED
 * row, its photos and its amenities. The wizard runs the same function on the
 * client to draw its checklist. The client copy is a courtesy; this one is the
 * rule, and it is the half of the photo quality gate that cannot be skipped by
 * anyone posting straight at the endpoint.
 */

import { LISTING_KEPT_MESSAGE, isMandateRetentionRefusal } from "../compliance/beneficial-ownership";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { hashListingPhotos } from "../photo-hash/hash-server";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { phoneGateFor } from "../phone-otp/gate";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import { setupExempt } from "../actions/setup-exempt";
import { isFeatureEnabled } from "../flags";
import { compoundColumns, type CompoundPayload } from "../listings/compound";
import { serviceColumns, type ServicePayload } from "../listings/service";
import { unitColumns, type UnitPayload } from "../listings/unit-shape";
import { flagIsOn, NEIGHBOURS_FLAG } from "../flags/read";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "../locale";
import { BROADCAST_MONEY_KEYS } from "./broadcast";
import { readBroadcastMarks, writeBroadcastMarks } from "./broadcast-marks-queries";
import { CLOSED_LISTING_MESSAGE, isClosedListingRefusal } from "../landlord/closed";
import { RATE_AGREEMENT_NEEDED_MESSAGE, isRateAgreementRefusal } from "../pricing/rate-agreement";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { SCRUB_REFUSED_MESSAGE, scrubPublicPhoto } from "../images/scrub";
import { inspectStoredVideo } from "./video-inspect";
import { inListingFolder } from "./media-path";
import {
  PHOTO_BUCKET,
  VIDEO_BUCKET,
  readMyListings,
  type ListingStatus,
  type ListingSummary,
} from "./listings-queries";
import {
  GATE_SUMMARY_MESSAGE,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_LABEL,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MAX_VIDEOS,
  MAX_VIDEO_SECONDS,
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  addPhotoSchema,
  addVideoSchema,
  removeVideoSchema,
  draftInputSchema,
  gateFieldErrors,
  listingAccessSchema,
  listingIdSchema,
  isTenancy,
  ratePeriodFor,
  removePhotoSchema,
  reorderMediaSchema,
  reorderPhotosSchema,
  setAmenitiesSchema,
  submitRequirements,
  type DraftInput,
  type ListingAccessInput,
  type PropertyType,
  type RentPeriod,
} from "./listings-schema";
import { dbLimitRefusal } from "@/lib/security/db-limit";
import { storedPositions } from "../listings/media-order";

const NOT_AGENT_MESSAGE =
  "Only approved agents can manage listings. Apply in two minutes.";

const PAUSED_MESSAGE =
  "Listing tools are paused for a moment while we make improvements. Nothing you entered was lost.";

const NOT_FOUND_MESSAGE =
  "We could not find that listing on your account. Reload the page to see the listings you have.";

const LOCKED_MESSAGE =
  "This listing is with our review team. Return it to a draft first, then edit it.";

const SAVE_FAILED_MESSAGE =
  "We could not save this listing just now. Nothing you typed was lost. Please try again.";

const PHOTO_GONE_MESSAGE =
  "That photo is no longer on this listing. Reload the page to see the photos it has now.";

const REVIEW_PENDING_MESSAGE =
  "This listing is already with our review team. We will let you know as soon as it is decided.";

const PHOTO_FAILED_MESSAGE =
  "We could not attach that photo just now. Please try it again.";

const VIDEO_FAILED_MESSAGE =
  "We could not attach that video just now. Please try it again.";

/** Statuses an agent may still edit themselves. */
const EDITABLE: ListingStatus[] = ["DRAFT", "MORE_INFO_REQUIRED", "REJECTED"];

type AgentGate =
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: SupabaseClient<Database>;
      user: User;
      agentId: string;
    };

/**
 * Session, flag and agent identity in one gate. Every action calls it first,
 * so the three failure sentences are written once and stay consistent.
 */
async function requireAgent(): Promise<AgentGate> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { ok: false, error: NOT_CONFIGURED_MESSAGE };
  if (session.state === "signed-out") return { ok: false, error: SIGNED_OUT_MESSAGE };

  if (!(await isFeatureEnabled("agent_listings"))) {
    return { ok: false, error: PAUSED_MESSAGE };
  }

  const { data, error } = await session.supabase
    .from("agents")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, error: NOT_AGENT_MESSAGE };

  return { ok: true, supabase: session.supabase, user: session.user, agentId: data.id };
}

/** Read one listing the caller owns, or null. Ownership is proven by the read. */
async function ownedListing(
  supabase: SupabaseClient<Database>,
  agentId: string,
  listingId: string,
) {
  const { data } = await supabase
    .from("listings")
    .select(
      "id, status, title, description, property_type, listing_intent, rent_amount_minor, rent_period, rate_minor, rate_period, sale_price_minor, sale_status, tenure, caution_deposit_minor, service_charge_minor, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor, sale_agency_fee_minor, sale_legal_fee_minor, governors_consent_fee_minor, stamp_duty_minor, survey_registration_fee_minor, state_code, city, area, bedrooms, bathrooms",
    )
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .maybeSingle();
  return data;
}

function refreshAgentSurfaces() {
  revalidatePath("/agent/listings");
  revalidatePath("/agent/list");
  revalidatePath("/agent/dashboard");
  /* Inspections hang off a listing, and both surfaces that show them read a
     title from it. Publishing, unpublishing or renaming a property has to
     reach the queue that names it, or an agent sees a row about a listing
     that no longer says what it says. */
  revalidatePath("/agent/inspections");
}

/* --------------------------------------------------------------- drafts */

export type SavedDraft = { id: string; status: ListingStatus };

/**
 * Save the wizard's current state as a DRAFT the agent owns.
 *
 * Insert when no id arrives, update when one does. Only the title is required,
 * because the alternative is losing a listing to an interruption. Fields the
 * wizard omits are left exactly as they were rather than being cleared, so a
 * partial save can never eat earlier work; a field sent as null is one the
 * lister emptied, and its column is emptied with it.
 */
export async function saveDraft(input: DraftInput): Promise<ActionResult<SavedDraft>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(draftInputSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const value = parsed.data;

  /* The row as it stands, when there is one. Read before the columns are built
     because three of the rules below (which intent applies, whether a stated
     total still covers its parts, which period an amount inherits) are
     questions about the whole row rather than about this request, and a
     forgiving draft save sends only what changed. */
  const existing = value.id
    ? await ownedListing(gate.supabase, gate.agentId, value.id)
    : null;
  if (value.id) {
    if (!existing) return fail(NOT_FOUND_MESSAGE);
    if (!EDITABLE.includes(existing.status)) return fail(LOCKED_MESSAGE);
  }

  const propertyType: PropertyType =
    value.propertyType ?? existing?.property_type ?? "apartment";
  const intent = value.intent ?? existing?.listing_intent ?? "rent";
  const tenancy = isTenancy(propertyType);

  /* An amount without its cycle is not an amount, and Postgres says so in
     three separate check constraints. Rather than bouncing a 23514 the host
     cannot act on, every amount that arrives without a period is given the
     obvious one: a rent defaults to yearly, which is what the Nigerian tenancy
     market quotes, and a service charge follows the rent it sits beside. */
  const rentPeriod: RentPeriod | undefined =
    value.rentPeriod ?? existing?.rent_period ?? (typeof value.rentNaira === "number" ? "year" : undefined);
  const serviceChargePeriod: RentPeriod | undefined =
    value.serviceChargePeriod ??
    (typeof value.serviceChargeNaira === "number" ? (rentPeriod ?? "year") : undefined);

  /*
   * The total to find at the door, checked against its own parts here rather
   * than at the database.
   *
   * `listings_total_move_in_covers_its_parts` refuses a total below the sum of
   * the parts that were named, which is right: a total of 4.5m beside a rent of
   * 4.5m and an agency fee of 450k is arithmetic nobody meant. But the
   * constraint fires as a 23514 with a constraint name in it, and the host who
   * mistyped one digit deserves the sentence rather than the error code. The
   * parts are resolved against the stored row for anything this request did not
   * send, because a forgiving draft save sends only what changed.
   */
  /* Sent wins; a part this save cleared (null) counts as nothing; a part it did
     not send keeps what is stored. */
  const settled = (sent: number | null | undefined, stored: number | null | undefined) =>
    sent === undefined ? Number(stored ?? 0) : (sent ?? 0);
  const partsSum =
    settled(value.rentNaira, existing?.rent_amount_minor) +
    settled(value.cautionDepositNaira, existing?.caution_deposit_minor) +
    settled(value.agencyFeeNaira, existing?.agency_fee_minor) +
    settled(value.legalFeeNaira, existing?.legal_fee_minor) +
    settled(value.agreementFeeNaira, existing?.agreement_fee_minor);
  if (typeof value.totalMoveInNaira === "number" && value.totalMoveInNaira < partsSum) {
    return fail(
      "The total to move in is less than the fees you listed, so one of the two figures is wrong.",
      {
        totalMoveInNaira: `The parts you have entered already come to ${formatKobo(partsSum)}. The total has to be at least that.`,
      },
    );
  }

  /*
   * The same check on the sale side, against `listings_total_purchase_covers_its_parts`.
   *
   * The price is one of the parts here, which is the difference from the
   * tenancy model: "the total to buy" means the price plus everything on top,
   * so a total below the asking price alone is already impossible.
   */
  const purchaseSum =
    settled(value.salePriceNaira, existing?.sale_price_minor) +
    settled(value.saleAgencyFeeNaira, existing?.sale_agency_fee_minor) +
    settled(value.saleLegalFeeNaira, existing?.sale_legal_fee_minor) +
    settled(value.governorsConsentFeeNaira, existing?.governors_consent_fee_minor) +
    settled(value.stampDutyNaira, existing?.stamp_duty_minor) +
    settled(value.surveyRegistrationFeeNaira, existing?.survey_registration_fee_minor);
  if (typeof value.totalPurchaseNaira === "number" && value.totalPurchaseNaira < purchaseSum) {
    return fail(
      "The total to buy is less than the price and the fees you listed, so one of the figures is wrong.",
      {
        totalPurchaseNaira: `The price and the costs you have entered already come to ${formatKobo(purchaseSum)}. The total has to be at least that.`,
      },
    );
  }

  // Shared column set. Undefined keys are dropped before the request, which is
  // exactly the "leave it as it was" behaviour a forgiving draft needs.
  const columns = {
    title: value.title,
    description: value.description,
    property_type: propertyType,
    listing_intent: intent,
    state_code: value.stateCode,
    city: value.city,
    area: value.area,
    address: value.address,
    landmark: value.landmark,
    bedrooms: value.bedrooms,
    /* The en-suite count travels with the bedrooms it is capped by
       (`listings_ensuite_count_within_bedrooms`). Written only by
       `writeUnit`, after this update, lowering the bedrooms below the stored
       count broke the check and the whole save failed. */
    ensuite_count: value.ensuiteCount,
    bathrooms: value.bathrooms,
    toilets: value.toilets,
    parking_spaces: value.parkingSpaces,
    floor: value.floor,
    total_floors: value.totalFloors,
    size_sqm: value.sizeSqm,

    /* ------------------------------------------------------------ the rent
       Written whatever the intent, because a lister who typed a rent, changed
       their mind to sale and changed it back must find their figure still
       there. What the intent decides is which one is READ, and that is decided
       once in `headlinePrice`, not here. */
    rent_amount_minor: tenancy ? value.rentNaira : undefined,
    rent_period: tenancy ? rentPeriod : undefined,
    rent_negotiable: value.rentNegotiable,
    caution_deposit_minor: value.cautionDepositNaira,
    service_charge_minor: value.serviceChargeNaira,
    service_charge_period: serviceChargePeriod,
    agency_fee_minor: value.agencyFeeNaira,
    legal_fee_minor: value.legalFeeNaira,
    agreement_fee_minor: value.agreementFeeNaira,
    total_move_in_cost_minor: value.totalMoveInNaira,
    minimum_tenancy_months: value.minimumTenancyMonths,
    available_from: value.availableFrom,
    furnished: value.furnished,

    /* ------------------------------------------------------------ the rate
       A nightly or per-head figure, for the categories that are let that way.
       The period is never asked for: a restaurant is per head and everything
       else on this side is per night, and asking somebody to confirm the
       category they already chose is a question with one answer. */
    /* `rate_minor` is NOT NULL, so a rate the lister cleared is stored as the
       zero the column has always meant "no rate set". */
    rate_minor: tenancy || value.rateNaira === undefined ? undefined : (value.rateNaira ?? 0),
    rate_period:
      tenancy || value.rateNaira === undefined
        ? undefined
        : (value.rateNaira ?? 0) > 0
          ? ratePeriodFor(propertyType)
          : null,

    /* ------------------------------------------------------------ the sale
       `listings_sale_needs_a_status` requires a status on a sale and forbids
       one on anything else, in both directions, so switching intent has to
       write the column either way. 'available' is the only honest default: a
       listing somebody is putting up is one they are still selling. */
    sale_price_minor: value.salePriceNaira,
    price_negotiable: value.priceNegotiable,
    /* The sale cost model. Written whatever the intent, for the same reason
       the rent fields are: a lister who typed a legal fee, switched to a
       tenancy and switched back must find their figure still there. */
    sale_agency_fee_minor: value.saleAgencyFeeNaira,
    sale_legal_fee_minor: value.saleLegalFeeNaira,
    governors_consent_fee_minor: value.governorsConsentFeeNaira,
    stamp_duty_minor: value.stampDutyNaira,
    survey_registration_fee_minor: value.surveyRegistrationFeeNaira,
    total_purchase_cost_minor: value.totalPurchaseNaira,
    tenure: value.tenure,
    year_built: value.yearBuilt,
    condition: value.condition,
    sale_status:
      intent === "sale" ? (value.saleStatus ?? existing?.sale_status ?? "available") : null,

    power_grid: value.powerGrid,
    power_backup: value.powerBackup,
    // The database refuses hours against a backup that does not exist
    // (listings_backup_hours_need_backup_chk), so clearing the backup clears
    // the hours here rather than letting the write bounce with a 23514 the
    // host cannot act on.
    power_backup_hours:
      value.powerBackup === "NONE" || value.powerBackup === null ? null : value.powerBackupHours,
    water_supply: value.waterSupply,
    prepaid_meter: value.prepaidMeter,
  };

  if (value.id && existing) {
    const { error } = await gate.supabase
      .from("listings")
      .update(columns)
      .eq("id", value.id)
      .eq("agent_id", gate.agentId);
    if (error) return fail(SAVE_FAILED_MESSAGE);
    if (!(await writeCompound(gate.supabase, value.id, gate.agentId, value))) {
      return fail(SAVE_FAILED_MESSAGE);
    }
    if (!(await writeService(gate.supabase, value.id, gate.agentId, value))) {
      return fail(SAVE_FAILED_MESSAGE);
    }
    if (!(await writeUnit(gate.supabase, value.id, gate.agentId, value))) {
      return fail(SAVE_FAILED_MESSAGE);
    }
    if (!(await writeFlooding(gate.supabase, value.id, gate.agentId, value.flooding))) {
      return fail(SAVE_FAILED_MESSAGE);
    }
    /* V-09: the unconfirmed set, in the same save, so it cannot lag the draft. */
    if (value.broadcastUnconfirmed !== undefined && !(await writeBroadcastMarks(gate.supabase, value.id, value.broadcastUnconfirmed))) {
      return fail(SAVE_FAILED_MESSAGE);
    }

    refreshAgentSurfaces();
    return ok({ id: value.id, status: existing.status });
  }

  const { data: created, error } = await gate.supabase
    .from("listings")
    /*
     * `listing_role` is absent on purpose and the database fills it.
     *
     * `private.listing_role_from_its_lister` derives it on insert from the
     * lister's own declared supply role, which is a fact about the person and
     * not a field this form should be asking them to type. The generated type
     * marks the column required because it is NOT NULL with no column default,
     * which a trigger-filled column always looks like.
     *
     * This exact insert was refused with 23502 from 22 September until that
     * trigger landed, and a stale `database.types.ts` is why `tsc` could not
     * see it. The types are current now, which is why the cast is narrow and
     * named rather than a blanket `any`.
     */
    .insert({ ...columns, agent_id: gate.agentId, status: "DRAFT" } as never)
    .select("id, status")
    .single();

  if (error || !created) return fail(dbLimitRefusal(error) ?? SAVE_FAILED_MESSAGE);
  /* Every follow-up write belongs to the draft just made. If any fails, the
     draft is taken back and the save fails, so a retry starts clean and no
     half-written draft (above all one whose unchecked figures were not
     recorded, V-09) is left behind. The marks go first. */
  const followUps = [
    () =>
      value.broadcastUnconfirmed !== undefined && value.broadcastUnconfirmed.length > 0
        ? writeBroadcastMarks(gate.supabase, created.id, value.broadcastUnconfirmed)
        : Promise.resolve(true),
    () => writeCompound(gate.supabase, created.id, gate.agentId, value),
    () => writeService(gate.supabase, created.id, gate.agentId, value),
    () => writeUnit(gate.supabase, created.id, gate.agentId, value),
    () => writeFlooding(gate.supabase, created.id, gate.agentId, value.flooding),
  ];
  for (const write of followUps) {
    if (!(await write())) {
      const { error: rollbackError } = await gate.supabase
        .from("listings")
        .delete()
        .eq("id", created.id)
        .eq("agent_id", gate.agentId);
      /* A draft left behind is harmless to the lister (it is theirs, and a
         draft) but must not go unseen. */
      if (rollbackError) console.warn(`[saveDraft] rollback of draft ${created.id} failed: ${rollbackError.message}`);
      return fail(SAVE_FAILED_MESSAGE);
    }
  }

  refreshAgentSurfaces();
  return ok({ id: created.id, status: created.status });
}

/**
 * THE COMPOUND'S FIVE ANSWERS (V-28), WRITTEN BY THEIR OWN UPDATE.
 *
 * Separate from `columns` above because it was written before the columns
 * existed in production. They exist now (V-28, V-66, V-68 and V-41 are all
 * applied), so a refusal of any kind, including a missing column, is a failed
 * save: it used to be treated as saved, and the answers were silently lost on
 * every save while the wizard said "Saved". Nothing is sent when no answer
 * changed.
 */
async function writeCompound(
  supabase: SupabaseClient<Database>,
  listingId: string,
  agentId: string,
  value: {
    parkingType?: CompoundPayload["parkingType"] | undefined;
    flatsInCompound?: CompoundPayload["flatsInCompound"] | undefined;
    landlordOnSite?: CompoundPayload["landlordOnSite"] | undefined;
    wasteDisposal?: CompoundPayload["wasteDisposal"] | undefined;
    carAccess?: CompoundPayload["carAccess"] | undefined;
  },
): Promise<boolean> {
  const row = compoundColumns({
    ...(value.parkingType !== undefined ? { parkingType: value.parkingType } : {}),
    ...(value.flatsInCompound !== undefined ? { flatsInCompound: value.flatsInCompound } : {}),
    ...(value.landlordOnSite !== undefined ? { landlordOnSite: value.landlordOnSite } : {}),
    ...(value.wasteDisposal !== undefined ? { wasteDisposal: value.wasteDisposal } : {}),
    ...(value.carAccess !== undefined ? { carAccess: value.carAccess } : {}),
  });
  if (Object.keys(row).length === 0) return true;
  const { error } = await supabase
    .from("listings")
    .update(row as never)
    .eq("id", listingId)
    .eq("agent_id", agentId);
  return !error;
}

/**
 * THE SERVICE CHARGE'S ANSWERS (V-68), by their own update for the reason
 * `writeCompound` gives. `is_serviced` is generated by the database and is
 * never written from here.
 */
async function writeService(
  supabase: SupabaseClient<Database>,
  listingId: string,
  agentId: string,
  value: {
    serviceChargeCovers?: ServicePayload["serviceChargeCovers"] | undefined;
    serviceChargeReconciled?: ServicePayload["serviceChargeReconciled"] | undefined;
    estateType?: ServicePayload["estateType"] | undefined;
  },
): Promise<boolean> {
  const row = serviceColumns({
    ...(value.serviceChargeCovers !== undefined ? { serviceChargeCovers: value.serviceChargeCovers } : {}),
    ...(value.serviceChargeReconciled !== undefined
      ? { serviceChargeReconciled: value.serviceChargeReconciled }
      : {}),
    ...(value.estateType !== undefined ? { estateType: value.estateType } : {}),
  });
  if (Object.keys(row).length === 0) return true;
  const { error } = await supabase
    .from("listings")
    .update(row as never)
    .eq("id", listingId)
    .eq("agent_id", agentId);
  return !error;
}

/**
 * THE UNIT'S SHAPE (V-66), by its own update for the reason `writeCompound`
 * gives. A check violation (more en-suite rooms than bedrooms) is a failure.
 */
async function writeUnit(
  supabase: SupabaseClient<Database>,
  listingId: string,
  agentId: string,
  value: {
    unitShape?: UnitPayload["unitShape"] | undefined;
    ensuiteCount?: UnitPayload["ensuiteCount"] | undefined;
    hasBq?: UnitPayload["hasBq"] | undefined;
  },
): Promise<boolean> {
  const row = unitColumns({
    ...(value.unitShape !== undefined ? { unitShape: value.unitShape } : {}),
    ...(value.ensuiteCount !== undefined ? { ensuiteCount: value.ensuiteCount } : {}),
    ...(value.hasBq !== undefined ? { hasBq: value.hasBq } : {}),
  });
  if (Object.keys(row).length === 0) return true;
  const { error } = await supabase
    .from("listings")
    .update(row as never)
    .eq("id", listingId)
    .eq("agent_id", agentId);
  return !error;
}

/** V-41: the lister's flooding answer, by its own update for the same reason. */
async function writeFlooding(
  supabase: SupabaseClient<Database>,
  listingId: string,
  agentId: string,
  flooding: string | null | undefined,
): Promise<boolean> {
  if (flooding === undefined) return true;
  /* Behind the V-41 flag: with it off the answer is dropped, not written. */
  if (!(await flagIsOn(NEIGHBOURS_FLAG))) return true;
  const { error } = await supabase
    .from("listings")
    .update({ flooding } as never)
    .eq("id", listingId)
    .eq("agent_id", agentId);
  return !error;
}

/**
 * V-66: the shape for the submit gate, or undefined when it could not be read.
 * The caller refuses the submit on undefined: skipping the check on a failed
 * read would let a listing past the gate without the one answer it requires.
 */
async function readUnitShape(
  supabase: SupabaseClient<Database>,
  listingId: string,
): Promise<string | null | undefined> {
  try {
    const { data, error } = await supabase.from("listings").select("unit_shape").eq("id", listingId).maybeSingle();
    if (error || !data) return undefined;
    return ((data as { unit_shape?: string | null }).unit_shape ?? null);
  } catch {
    return undefined;
  }
}

/** Kobo as naira text, for one error sentence. Integer division, never a float. */
function formatKobo(minor: number): string {
  const kobo = minor % 100;
  const naira = (minor - kobo) / 100;
  const grouped = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return kobo === 0 ? `${grouped} naira` : `${grouped}.${String(kobo).padStart(2, "0")} naira`;
}

/**
 * Remove an uploaded photo object that no photo row points at. Best effort:
 * the refusal the caller is returning is the answer either way.
 *
 * Narrow on purpose. The path must be `<uid>/<this listing>/<file>` (the
 * caller has already checked the uid prefix, and storage RLS limits removal
 * to the caller's own folder), and no `listing_photos` row may name it.
 */
async function discardUnattached(
  supabase: SupabaseClient<Database>,
  listingId: string,
  storagePath: string,
): Promise<void> {
  const parts = storagePath.split("/");
  if (parts.length !== 3 || parts[1] !== listingId) return;
  try {
    const { data, error } = await supabase
      .from("listing_photos")
      .select("id")
      .eq("storage_path", storagePath)
      .limit(1);
    if (error || (data ?? []).length > 0) return;
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  } catch {
    /* the object costs storage, not correctness */
  }
}

/* --------------------------------------------------------------- photos */

/**
 * Attach an uploaded object to a listing.
 *
 * The browser uploads to listing-photos under `<auth uid>/<listing id>/...`,
 * which storage RLS already restricts to that user's own folder; this checks
 * the same folder, for this listing, so a path pointing at somebody else's
 * folder (or at another of the caller's listings) can never be recorded. Position 0 is the cover, and the requested slot is honoured only
 * when it is free, so the unique (listing_id, position) index is never raced.
 */
export async function addPhoto(input: {
  listingId: string;
  storagePath: string;
  position?: number;
}): Promise<ActionResult<{ photoId: string; position: number }>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(addPhotoSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, storagePath, position } = parsed.data;

  if (!inListingFolder(storagePath, gate.user.id, listingId)) {
    return fail(
      "That photo was not uploaded to your own folder, so we did not attach it. Choose the photo again.",
    );
  }

  /*
   * EVERY REFUSAL FROM HERE ON TAKES THE UPLOADED OBJECT WITH IT.
   *
   * The browser uploads first and attaches second, so a refused attach (a
   * listing that moved to review, the ten photo ceiling, a wrong type, a
   * failed insert) left the object sitting in the PUBLIC bucket, unlisted
   * but downloadable, for ever. `discardUnattached` removes it, and only
   * when it is in this listing's own folder and no photo row names it, so a
   * path pointing at a photo already attached elsewhere is never deleted.
   */
  const refuse = async (message: string): Promise<ActionResult<{ photoId: string; position: number }>> => {
    await discardUnattached(gate.supabase, listingId, storagePath);
    return fail(message);
  };

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return refuse(NOT_FOUND_MESSAGE);
  if (!EDITABLE.includes(listing.status)) return refuse(LOCKED_MESSAGE);

  const { data: existing, error: readError } = await gate.supabase
    .from("listing_photos")
    .select("id, position")
    .eq("listing_id", listingId);
  if (readError) return refuse(PHOTO_FAILED_MESSAGE);

  const taken = new Set((existing ?? []).map((p) => p.position));
  if (taken.size >= MAX_PHOTOS) {
    return refuse(`A listing holds up to ${MAX_PHOTOS} photos. Remove one to add another.`);
  }

  let slot = position !== undefined && !taken.has(position) ? position : -1;
  if (slot < 0) {
    for (let i = 0; i < MAX_PHOTOS; i += 1) {
      if (!taken.has(i)) {
        slot = i;
        break;
      }
    }
  }
  if (slot < 0) {
    return refuse(`A listing holds up to ${MAX_PHOTOS} photos. Remove one to add another.`);
  }

  /*
   * THE THIRD CHECK THE SCHEMA PROMISES AND THIS ACTION NEVER PERFORMED.
   *
   * `listings-schema.ts:82-101` states the rule out loud: every media limit is
   * enforced in three places, the browser, the bucket and the server action
   * that reads the object's real size and type BACK FROM STORAGE. `addVideo`
   * does all three. This one validated the path shape and the ownership prefix
   * and then inserted the row, so the schema's own comment overstated what was
   * enforced, and anything the browser checked and storage did not could be
   * walked past by posting at this endpoint directly.
   *
   * `list` on the containing folder is the only way to see an object's size
   * and mime through the storage client, so the path is split and the entry
   * found by name. An object that is not there at all is the common honest
   * case: the upload failed and the browser attached anyway.
   */
  const cut = storagePath.lastIndexOf("/");
  const folder = cut < 0 ? "" : storagePath.slice(0, cut);
  const fileName = cut < 0 ? storagePath : storagePath.slice(cut + 1);

  const { data: objects, error: objectError } = await gate.supabase.storage
    .from(PHOTO_BUCKET)
    .list(folder, { search: fileName, limit: 100 });
  if (objectError) return refuse(PHOTO_FAILED_MESSAGE);

  const object = (objects ?? []).find((entry) => entry.name === fileName);
  if (!object) return refuse("That upload did not finish. Try the photo again.");

  const size = Number(object.metadata?.["size"] ?? 0);
  const mime = String(object.metadata?.["mimetype"] ?? "");
  if (size > MAX_PHOTO_BYTES) {
    return refuse(
      `That photo is over ${MAX_PHOTO_LABEL}. Most phones can export a smaller copy.`,
    );
  }
  if (!(PHOTO_MIME_TYPES as readonly string[]).includes(mime)) {
    return refuse("That file is not a photo we can show. Use JPEG, PNG or WebP.");
  }

  /*
   * OPS-13 / SEC-04: the wizard re-encodes in the browser, which strips EXIF,
   * but a direct upload with the member's own token skips the wizard. The
   * server strips it here too, before the row makes the object public.
   */
  const scrubbed = await scrubPublicPhoto(PHOTO_BUCKET, storagePath);
  if (!scrubbed.ok) return refuse(SCRUB_REFUSED_MESSAGE);

  const { data: created, error } = await gate.supabase
    .from("listing_photos")
    .insert({ listing_id: listingId, storage_path: storagePath, position: slot })
    .select("id, position")
    .single();

  if (error || !created) return refuse(PHOTO_FAILED_MESSAGE);

  /* V-45: hash the stored photograph after the response, as the service
     role, so the review desk can compare it. Never slows the upload and
     never fails it. */
  after(() => hashListingPhotos(listingId));

  refreshAgentSurfaces();
  return ok({ photoId: created.id, position: created.position });
}

/**
 * Move photo rows into the given order.
 *
 * positions are unique per listing AND constrained to 0..9, so there is no
 * spare band to park rows in: the classic "add 100 then renumber" trick would
 * fail the check constraint. Instead rows are moved one at a time into slots
 * that are genuinely free, which is always possible while fewer than ten
 * photos exist. At exactly ten, one row is parked out of the table and put back
 * at the end, which is the only case where a row briefly does not exist.
 */
async function applyOrder(
  supabase: SupabaseClient<Database>,
  listingId: string,
  ordered: { id: string; path: string }[],
): Promise<boolean> {
  const position = new Map<string, number>();
  const occupant = new Map<number, string>();

  const { data: current, error } = await supabase
    .from("listing_photos")
    .select("id, position")
    .eq("listing_id", listingId);
  if (error || !current) return false;
  for (const row of current) {
    position.set(row.id, row.position);
    occupant.set(row.position, row.id);
  }

  const move = async (id: string, to: number): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from("listing_photos")
      .update({ position: to })
      .eq("id", id)
      .eq("listing_id", listingId);
    if (updateError) return false;
    const from = position.get(id);
    if (from !== undefined) occupant.delete(from);
    position.set(id, to);
    occupant.set(to, id);
    return true;
  };

  const freeSlot = (): number => {
    for (let i = 0; i < MAX_PHOTOS; i += 1) if (!occupant.has(i)) return i;
    return -1;
  };

  // Ten photos and ten slots leaves nowhere to step aside, so park the row
  // that belongs last and put it back once the rest have settled.
  /*
   * Parking deletes the row, and V-70's shot label (`listing_photo_slots`)
   * hangs off the photo id with ON DELETE CASCADE, so the parked photo lost
   * its label on every reorder at ten photos. The label is read first and put
   * back on the new row.
   */
  let parked: { path: string; to: number; slot: string | null } | null = null;
  if (ordered.length >= MAX_PHOTOS) {
    const tail = ordered[ordered.length - 1];
    if (tail) {
      const loose = supabase as unknown as SupabaseClient;
      const { data: label } = await loose
        .from("listing_photo_slots")
        .select("slot")
        .eq("photo_id", tail.id)
        .maybeSingle();
      const { error: deleteError } = await supabase
        .from("listing_photos")
        .delete()
        .eq("id", tail.id)
        .eq("listing_id", listingId);
      if (deleteError) return false;
      const from = position.get(tail.id);
      if (from !== undefined) occupant.delete(from);
      position.delete(tail.id);
      parked = {
        path: tail.path,
        to: ordered.length - 1,
        slot: typeof (label as { slot?: unknown } | null)?.slot === "string" ? (label as { slot: string }).slot : null,
      };
    }
  }

  const targets = ordered
    .map((photo, index) => ({ id: photo.id, to: index }))
    .filter((item) => position.has(item.id));

  let guard = 0;
  for (;;) {
    const pending = targets.filter((item) => position.get(item.id) !== item.to);
    if (pending.length === 0) break;
    if ((guard += 1) > MAX_PHOTOS * 4) return false;

    const straightforward = pending.filter((item) => !occupant.has(item.to));
    if (straightforward.length > 0) {
      for (const item of straightforward) {
        if (!(await move(item.id, item.to))) return false;
      }
      continue;
    }

    // Every remaining target is occupied by another pending row: step one of
    // them aside into a free slot and the chain unwinds on the next pass.
    const slot = freeSlot();
    const first = pending[0];
    if (slot < 0 || !first) return false;
    if (!(await move(first.id, slot))) return false;
  }

  if (parked) {
    const { data: back, error: insertError } = await supabase
      .from("listing_photos")
      .insert({ listing_id: listingId, storage_path: parked.path, position: parked.to })
      .select("id")
      .single();
    if (insertError || !back) return false;
    if (parked.slot) {
      /* Best effort: a label that does not come back is a label the lister
         can set again, and the order itself is already right. */
      const { data: relabel, error: relabelError } = await (supabase as unknown as SupabaseClient).rpc(
        "set_listing_photo_slot",
        { p_photo: back.id, p_slot: parked.slot },
      );
      const relabelStatus =
        relabel && typeof relabel === "object" ? String((relabel as Record<string, unknown>).status) : null;
      if (relabelError || relabelStatus !== "ok") {
        console.warn(
          `[applyOrder] shot label "${parked.slot}" not restored on photo ${back.id} of listing ${listingId}: ${relabelError?.message ?? relabelStatus ?? "no answer"}`,
        );
      }
    }
    /* The new row has no V-45 hash yet; the desk also hashes on open. */
    after(() => hashListingPhotos(listingId));
  }

  return true;
}

/** Remove a photo, then close the gap so positions stay 0 upwards. */
export async function removePhoto(input: {
  listingId: string;
  photoId: string;
}): Promise<ActionResult<null>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(removePhotoSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, photoId } = parsed.data;

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  if (!EDITABLE.includes(listing.status)) return fail(LOCKED_MESSAGE);

  const { data: photos, error: readError } = await gate.supabase
    .from("listing_photos")
    .select("id, storage_path, position")
    .eq("listing_id", listingId)
    .order("position", { ascending: true });
  if (readError || !photos) return fail(PHOTO_FAILED_MESSAGE);

  const target = photos.find((p) => p.id === photoId);
  if (!target) return fail(PHOTO_GONE_MESSAGE);

  const { error: deleteError } = await gate.supabase
    .from("listing_photos")
    .delete()
    .eq("id", photoId)
    .eq("listing_id", listingId);
  if (deleteError) return fail(PHOTO_FAILED_MESSAGE);

  // The object itself goes too, so the bucket does not fill with orphans.
  // Best effort: the listing is already correct either way.
  await gate.supabase.storage.from(PHOTO_BUCKET).remove([target.storage_path]);

  const remaining = photos
    .filter((p) => p.id !== photoId)
    .map((p) => ({ id: p.id, path: p.storage_path }));
  await applyOrder(gate.supabase, listingId, remaining);

  refreshAgentSurfaces();
  return ok(null);
}

/**
 * Reorder photos, cover first. The first id in the list becomes the cover.
 *
 * Returns the settled order, because a listing at the ten photo ceiling has one
 * row parked out and put back, which mints a new id for it. Handing the caller
 * the truth costs one read and saves them from sending a stale id next time.
 */
export async function reorderPhotos(input: {
  listingId: string;
  orderedIds: string[];
}): Promise<ActionResult<{ photos: { id: string; path: string }[] }>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(reorderPhotosSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, orderedIds } = parsed.data;

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  if (!EDITABLE.includes(listing.status)) return fail(LOCKED_MESSAGE);

  const { data: photos, error: readError } = await gate.supabase
    .from("listing_photos")
    .select("id, storage_path")
    .eq("listing_id", listingId);
  if (readError || !photos) return fail(PHOTO_FAILED_MESSAGE);

  const byId = new Map(photos.map((p) => [p.id, p.storage_path]));
  if (orderedIds.length !== photos.length || orderedIds.some((id) => !byId.has(id))) {
    return fail("The photo order was out of date. Reload the page and try again.");
  }

  const ordered = orderedIds.map((id) => ({ id, path: byId.get(id) ?? "" }));
  const moved = await applyOrder(gate.supabase, listingId, ordered);
  if (!moved) return fail("We could not reorder the photos just now. Please try again.");

  const { data: settled } = await gate.supabase
    .from("listing_photos")
    .select("id, storage_path")
    .eq("listing_id", listingId)
    .order("position", { ascending: true });

  refreshAgentSurfaces();
  return ok({
    photos: (settled ?? []).map((p) => ({ id: p.id, path: p.storage_path })),
  });
}

/**
 * Put a listing's photos and videos in one order, the first a photo (the
 * cover). Photos take their rank among photos, which `applyOrder` writes
 * without breaking the unique, 0..9 position; each video takes its place in
 * the whole row (lib/listings/media-order.ts). Returns both lists as stored,
 * because at ten photos one photo row is re-made with a new id.
 */
export async function reorderMedia(input: {
  listingId: string;
  items: { kind: "photo" | "video"; id: string }[];
}): Promise<
  ActionResult<{
    photos: { id: string; path: string; position: number }[];
    videos: { id: string; position: number }[];
  }>
> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(reorderMediaSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, items } = parsed.data;

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  if (!EDITABLE.includes(listing.status)) return fail(LOCKED_MESSAGE);

  const [photoRes, videoRes] = await Promise.all([
    gate.supabase.from("listing_photos").select("id, storage_path").eq("listing_id", listingId),
    gate.supabase.from("listing_videos").select("id").eq("listing_id", listingId),
  ]);
  if (photoRes.error || videoRes.error || !photoRes.data || !videoRes.data) return fail(PHOTO_FAILED_MESSAGE);

  const photoPaths = new Map(photoRes.data.map((p) => [p.id, p.storage_path]));
  const videoIds = new Set(videoRes.data.map((v) => v.id));
  const { photos: photoOrder, videos: videoPlaces } = storedPositions(items);
  const stale =
    photoOrder.length !== photoPaths.size ||
    videoPlaces.length !== videoIds.size ||
    photoOrder.some((id) => !photoPaths.has(id)) ||
    videoPlaces.some((video) => !videoIds.has(video.id));
  if (stale) return fail("The order was out of date. Reload the page and try again.");

  const moved = await applyOrder(
    gate.supabase,
    listingId,
    photoOrder.map((id) => ({ id, path: photoPaths.get(id) ?? "" })),
  );
  if (!moved) return fail("We could not reorder the photos just now. Please try again.");

  for (const video of videoPlaces) {
    const { error } = await gate.supabase
      .from("listing_videos")
      .update({ position: video.position })
      .eq("id", video.id)
      .eq("listing_id", listingId);
    if (error) return fail("We could not reorder the videos just now. Please try again.");
  }

  const [settledPhotos, settledVideos] = await Promise.all([
    gate.supabase
      .from("listing_photos")
      .select("id, storage_path, position")
      .eq("listing_id", listingId)
      .order("position", { ascending: true }),
    gate.supabase.from("listing_videos").select("id, position").eq("listing_id", listingId),
  ]);

  refreshAgentSurfaces();
  return ok({
    photos: (settledPhotos.data ?? []).map((p) => ({ id: p.id, path: p.storage_path, position: p.position })),
    videos: (settledVideos.data ?? []).map((v) => ({ id: v.id, position: v.position })),
  });
}

/**
 * Remove an uploaded walkthrough, and its still, when no row names them. The
 * same narrow rule as `discardUnattached`: only inside this listing's own
 * folder, and never an object a `listing_videos` or `listing_photos` row
 * still points at. Best effort.
 */
async function discardUnattachedVideo(
  supabase: SupabaseClient<Database>,
  listingId: string,
  storagePath: string,
  posterPath: string | undefined,
): Promise<void> {
  const inFolder = (path: string) => {
    const parts = path.split("/");
    return parts.length === 3 && parts[1] === listingId;
  };
  try {
    if (inFolder(storagePath)) {
      const { data, error } = await supabase
        .from("listing_videos")
        .select("id")
        .eq("storage_path", storagePath)
        .limit(1);
      if (!error && (data ?? []).length === 0) await supabase.storage.from(VIDEO_BUCKET).remove([storagePath]);
    }
    if (posterPath && inFolder(posterPath)) {
      const [asPoster, asPhoto] = await Promise.all([
        supabase.from("listing_videos").select("id").eq("poster_path", posterPath).limit(1),
        supabase.from("listing_photos").select("id").eq("storage_path", posterPath).limit(1),
      ]);
      if (!asPoster.error && !asPhoto.error && (asPoster.data ?? []).length === 0 && (asPhoto.data ?? []).length === 0) {
        await supabase.storage.from(PHOTO_BUCKET).remove([posterPath]);
      }
    }
  } catch {
    /* the objects cost storage, not correctness */
  }
}

/* --------------------------------------------------------------- videos */

/**
 * Attach an uploaded walkthrough to a listing, having checked the FILE.
 *
 * This is the third of the three enforcement points named in listings-schema:
 * the browser refuses a bad file before it costs anybody data, the bucket
 * refuses it in Postgres whatever the browser believed, and this reads the
 * object's REAL size and content type back out of storage before it will write
 * a row pointing at it.
 *
 * The third one is not redundant with the second. The bucket rules apply to the
 * upload; this applies to the ATTACHMENT, and the two are separate requests. A
 * caller could upload a legitimate small mp4, then post this action a path
 * pointing at some other object already in their own folder. Reading the object
 * back is what makes the row's claim about its own file true.
 *
 * The per-listing ceiling is enforced by a trigger, under a lock on the parent
 * listing row, so two uploads arriving at once cannot both see room for one
 * more. The count here is only so the refusal is a sentence rather than a 23514.
 */
export async function addVideo(input: {
  listingId: string;
  storagePath: string;
  posterPath?: string;
  durationSeconds?: number;
}): Promise<ActionResult<{ videoId: string; position: number }>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(addVideoSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, storagePath, posterPath, durationSeconds } = parsed.data;

  if (!inListingFolder(storagePath, gate.user.id, listingId)) {
    return fail(
      "That video was not uploaded to your own folder, so we did not attach it. Choose the file again.",
    );
  }

  if (posterPath !== undefined && !inListingFolder(posterPath, gate.user.id, listingId)) {
    return fail(
      "That video's still was not uploaded to your own folder, so we did not attach it. Choose the file again.",
    );
  }

  /* Every refusal from here on takes the uploaded video, and its still, with
     it, for the reason `addPhoto` gives: the browser uploads before it
     attaches, so a refused attach left the objects behind for ever. */
  type Attached = ActionResult<{ videoId: string; position: number }>;
  const refuse = async (message: string): Promise<Attached> => {
    await discardUnattachedVideo(gate.supabase, listingId, storagePath, posterPath);
    return fail(message);
  };

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return refuse(NOT_FOUND_MESSAGE);
  if (!EDITABLE.includes(listing.status)) return refuse(LOCKED_MESSAGE);

  /*
   * What the object actually is, read from storage rather than believed.
   *
   * `list` on the containing folder is the only way to see an object's size and
   * mime type through the storage client, so the path is split and the entry is
   * found by name. An object that is not there at all is the common case worth
   * naming: the upload failed and the browser posted anyway.
   */
  const cut = storagePath.lastIndexOf("/");
  const folder = cut < 0 ? "" : storagePath.slice(0, cut);
  const fileName = cut < 0 ? storagePath : storagePath.slice(cut + 1);

  const { data: objects, error: listError } = await gate.supabase.storage
    .from(VIDEO_BUCKET)
    .list(folder, { search: fileName, limit: 100 });
  if (listError) return refuse(VIDEO_FAILED_MESSAGE);

  const object = (objects ?? []).find((entry) => entry.name === fileName);
  if (!object) {
    return refuse("That upload did not finish. Try the video again.");
  }

  const size = Number(object.metadata?.["size"] ?? 0);
  const mime = String(object.metadata?.["mimetype"] ?? "");
  if (size > MAX_UPLOAD_BYTES) {
    return refuse(
      `That video is over ${MAX_UPLOAD_LABEL}. Record a shorter clip, or export it at a lower resolution.`,
    );
  }
  if (!(VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
    return refuse("That file is not a video we can play. Use MP4, MOV or WebM.");
  }

  /*
   * THE BYTES, NOT THE LABEL. The type above is the one the uploader declared,
   * and storage records whatever it was told. `inspectStoredVideo` reads a few
   * small ranges of the object back: that it really is an MP4, MOV or WebM
   * file, that it no longer says where it was filmed (the wizard takes the
   * location out before upload; a file posted around the wizard has not had
   * that done), and how long it really is. The measured length is what is
   * stored, not the one the browser sent.
   */
  const inspected = await inspectStoredVideo(VIDEO_BUCKET, storagePath, size, MAX_UPLOAD_BYTES);
  if (!inspected.ok) {
    if (inspected.reason === "location") {
      return refuse(
        "That video still carries the place it was filmed, so we did not attach it. Add it through the listing form, which takes the location out, and try again.",
      );
    }
    if (inspected.reason === "not-a-video") {
      return refuse("That file is not a video we can play. Use MP4, MOV or WebM.");
    }
    return refuse(VIDEO_FAILED_MESSAGE);
  }
  if ((inspected.container === "webm") !== (mime === "video/webm")) {
    return refuse("That file is not a video we can play. Use MP4, MOV or WebM.");
  }
  const measuredSeconds =
    inspected.durationSeconds === null ? null : Math.max(1, Math.round(inspected.durationSeconds));
  if (measuredSeconds !== null && measuredSeconds > MAX_VIDEO_SECONDS) {
    return refuse(`A video can be up to ${MAX_VIDEO_SECONDS} seconds long. Trim it and try again.`);
  }

  /* The still lives in the PUBLIC photo bucket, so it gets the photograph's
     treatment: its format read from the bytes and any metadata stripped,
     before the row makes it reachable. The wizard draws it on a canvas, which
     carries none; a still posted around the wizard may. */
  if (posterPath !== undefined) {
    const still = await scrubPublicPhoto(PHOTO_BUCKET, posterPath);
    if (!still.ok) return refuse(SCRUB_REFUSED_MESSAGE);
  }

  const { data: existing, error: countError } = await gate.supabase
    .from("listing_videos")
    .select("id, position")
    .eq("listing_id", listingId);
  if (countError) return refuse(VIDEO_FAILED_MESSAGE);

  const held = existing ?? [];
  if (held.length >= MAX_VIDEOS) {
    return refuse(
      `A listing holds up to ${MAX_VIDEOS} walkthroughs. Remove one to add another.`,
    );
  }

  /* A video's position is its place in the listing's whole row of photos
     and videos (lib/listings/media-order.ts): a new one goes on the end. */
  const { count: photoCount, error: photoCountError } = await gate.supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if (photoCountError) return refuse(VIDEO_FAILED_MESSAGE);
  const position = Math.max(
    (photoCount ?? 0) + held.length,
    held.reduce((highest, row) => Math.max(highest, row.position + 1), 0),
  );

  const { data: created, error } = await gate.supabase
    .from("listing_videos")
    .insert({
      listing_id: listingId,
      storage_path: storagePath,
      poster_path: posterPath ?? null,
      duration_seconds: measuredSeconds ?? durationSeconds ?? null,
      position,
    })
    .select("id, position")
    .single();

  if (error || !created) {
    // 23514 is the ceiling trigger winning a race this action's own count lost.
    if (error?.code === "23514") {
      return refuse(
        `A listing holds up to ${MAX_VIDEOS} walkthroughs. Remove one to add another.`,
      );
    }
    return refuse(VIDEO_FAILED_MESSAGE);
  }

  refreshAgentSurfaces();
  return ok({ videoId: created.id, position: created.position });
}

/** Take a walkthrough off a listing, and the object with it. */
export async function removeVideo(input: {
  listingId: string;
  videoId: string;
}): Promise<ActionResult<null>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(removeVideoSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, videoId } = parsed.data;

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  if (!EDITABLE.includes(listing.status)) return fail(LOCKED_MESSAGE);

  const { data: video } = await gate.supabase
    .from("listing_videos")
    .select("id, storage_path, poster_path")
    .eq("id", videoId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!video) {
    return fail("That video is no longer on this listing. Reload the page to see what it has.");
  }

  const { error } = await gate.supabase
    .from("listing_videos")
    .delete()
    .eq("id", videoId)
    .eq("listing_id", listingId);
  if (error) return fail(VIDEO_FAILED_MESSAGE);

  // Best effort: the listing is already correct either way, and an orphaned
  // object costs storage rather than correctness.
  await gate.supabase.storage.from(VIDEO_BUCKET).remove([video.storage_path]);
  /* The still went nowhere before; it lives in the public photo bucket. */
  if (video.poster_path) await gate.supabase.storage.from(PHOTO_BUCKET).remove([video.poster_path]);

  refreshAgentSurfaces();
  return ok(null);
}

/* ------------------------------------------------------------ amenities */

/** Replace the listing's amenities with exactly the codes given. */
export async function setAmenities(input: {
  listingId: string;
  codes: string[];
}): Promise<ActionResult<null>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(setAmenitiesSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, codes } = parsed.data;

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  if (!EDITABLE.includes(listing.status)) return fail(LOCKED_MESSAGE);

  const { data: rows, error: readError } = await gate.supabase
    .from("amenities")
    .select("id, code")
    .in("code", codes.length > 0 ? codes : ["__none__"]);
  if (readError) return fail("We could not save the amenities just now. Please try again.");

  const { error: clearError } = await gate.supabase
    .from("listing_amenities")
    .delete()
    .eq("listing_id", listingId);
  if (clearError) return fail("We could not save the amenities just now. Please try again.");

  const wanted = rows ?? [];
  if (wanted.length > 0) {
    const { error: insertError } = await gate.supabase
      .from("listing_amenities")
      .insert(wanted.map((a) => ({ listing_id: listingId, amenity_id: a.id })));
    if (insertError) return fail("We could not save the amenities just now. Please try again.");
  }

  refreshAgentSurfaces();
  return ok(null);
}

/* ----------------------------------------------------------- gate access */

/**
 * How a guest actually gets in, stored where only the right people can read it.
 *
 * This is the one write in the listing flow that does NOT touch
 * `public.listings`. That table is readable by the entire internet the moment a
 * listing is PUBLISHED, so a gate code on it would be a gate code published.
 * `public.listing_access` carries the details and its select policy names three
 * readers and no others: the host, an admin, and a guest holding a CONFIRMED
 * booking on that listing.
 *
 * An upsert, because a host correcting the security number should not have to
 * delete the row and write it again. Emptying every field is a real answer and
 * clears `listings.has_estate_access` through the trigger, so the public page
 * stops promising details that no longer exist.
 */
export async function setListingAccess(
  input: ListingAccessInput,
): Promise<ActionResult<{ hasAccess: boolean }>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(listingAccessSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const value = parsed.data;

  const listing = await ownedListing(gate.supabase, gate.agentId, value.listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  /* NO `EDITABLE` CHECK HERE, ON PURPOSE. Unlike every other write in this
     file, the gate details may be corrected on a live or in-review listing:
     a changed gate code or security number is an operational fact the next
     guest needs tonight, not content for review, and it lives in its own
     table that the public page cannot read. */

  const row = {
    listing_id: value.listingId,
    estate_name: value.estateName ?? null,
    gate_directions: value.gateDirections ?? null,
    security_phone: value.securityPhone ?? null,
    access_code: value.accessCode ?? null,
  };

  const { error } = await gate.supabase
    .from("listing_access")
    .upsert(row, { onConflict: "listing_id" });

  if (error) {
    // 42501 is the policy refusing a listing that is not this host's, which
    // ownedListing should already have caught, so it means the two disagree
    // and the honest answer is the ownership one.
    if (error.code === "42501") return fail(NOT_FOUND_MESSAGE);
    return fail(SAVE_FAILED_MESSAGE);
  }

  refreshAgentSurfaces();
  revalidatePath(`/listing/${value.listingId}`);

  const hasAccess = Object.values(row).some(
    (field, index) => index > 0 && typeof field === "string" && field.trim().length > 0,
  );
  return ok({ hasAccess });
}

/* --------------------------------------------------------------- submit */

/** `submittedAt` is the stored `submitted_at`, which the wizard's chain prints. */
export type SubmitOutcome = { id: string; status: ListingStatus; submittedAt: string | null };

/**
 * Send a listing for review, but only if it clears the quality gate.
 *
 * The gate runs against what is actually stored: the row, the photo rows and
 * the amenity joins, never against anything the client asserts. Unmet
 * requirements come back as fieldErrors in the same plain language the wizard
 * checklist uses, because they are produced by the same function.
 */
export async function submitListing(input: {
  listingId: string;
}): Promise<ActionResult<SubmitOutcome>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(listingIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId } = parsed.data;

  const listing = await ownedListing(gate.supabase, gate.agentId, listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);

  if (listing.status === "SUBMITTED" || listing.status === "UNDER_REVIEW") {
    return fail(REVIEW_PENDING_MESSAGE);
  }
  /* FULL GATE (13 October 2026): the first listing sent for publishing needs a
     confirmed phone, flag on; a listing fails closed on a failed read
     (`phone-otp/core.ts`). */
  const phoneGate = await phoneGateFor(gate.supabase, gate.user.id, "listing");
  if (phoneGate) return phoneGate;
  if (!EDITABLE.includes(listing.status)) {
    return fail("This listing has already been through review. Return it to a draft to change it.");
  }

  /* V-09: a figure read from a pasted WhatsApp message is not sent for review
     until a person has looked at it. The set is kept beside the draft on the
     server, so this holds on every device, not only the one that pasted. */
  const unconfirmed = await readBroadcastMarks(gate.supabase, listingId);
  /* Fails closed: a set we could not read is treated as unchecked. */
  if (unconfirmed === null || unconfirmed.some((key) => (BROADCAST_MONEY_KEYS as readonly string[]).includes(key))) {
    return fail(getDictionary(await getLocale()).frontDoor.broadcast.unconfirmedOnServer);
  }

  const [photoRes, videoRes, amenityRes, unitShape] = await Promise.all([
    gate.supabase.from("listing_photos").select("id, position").eq("listing_id", listingId),
    gate.supabase.from("listing_videos").select("id").eq("listing_id", listingId),
    gate.supabase.from("listing_amenities").select("amenity_id").eq("listing_id", listingId),
    readUnitShape(gate.supabase, listingId),
  ]);

  /* Fail closed: a gate that could not read its own inputs does not pass. */
  if (photoRes.error || videoRes.error || amenityRes.error || unitShape === undefined) {
    return fail("We could not check this listing just now. Nothing has changed. Please try again.");
  }

  const photos = photoRes.data ?? [];
  const unmet = submitRequirements({
    title: listing.title,
    description: listing.description,
    propertyType: listing.property_type,
    stateCode: listing.state_code,
    city: listing.city,
    area: listing.area,
    intent: listing.listing_intent,
    rentMinor: listing.rent_amount_minor,
    rentPeriod: listing.rent_period,
    rateMinor: listing.rate_minor,
    ratePeriod: listing.rate_period,
    salePriceMinor: listing.sale_price_minor,
    tenure: listing.tenure,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    unitShape,
    amenityCount: (amenityRes.data ?? []).length,
    photoCount: photos.length,
    /* Walkthroughs count toward the media minimum (MIN_MEDIA) with the photos. */
    videoCount: (videoRes.data ?? []).length,
    hasCover: photos.some((p) => p.position === 0),
    moveInStatedMinor: listing.total_move_in_cost_minor,
    moveInPartsMinor: [
      listing.rent_amount_minor,
      listing.caution_deposit_minor,
      listing.service_charge_minor,
      listing.agency_fee_minor,
      listing.legal_fee_minor,
      listing.agreement_fee_minor,
    ],
  });

  if (unmet.length > 0) {
    return fail(GATE_SUMMARY_MESSAGE, gateFieldErrors(unmet));
  }

  const { data: updated, error } = await gate.supabase
    .from("listings")
    .update({ status: "SUBMITTED", submitted_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("agent_id", gate.agentId)
    .select("id, status, submitted_at")
    .single();

  if (isClosedListingRefusal(error)) return fail(CLOSED_LISTING_MESSAGE);
  /* D51: the database refuses SUBMITTED until the lister has accepted the fee
     on this price under the rate in force (listings_zz_b3_rate_agreement_gate). */
  if (isRateAgreementRefusal(error)) return fail(RATE_AGREEMENT_NEEDED_MESSAGE);
  if (error || !updated) {
    return fail("We could not send this listing for review just now. Please try again.");
  }

  refreshAgentSurfaces();
  /* The stored time, so the wizard's chain prints the day the server wrote. */
  return ok({ id: updated.id, status: updated.status, submittedAt: updated.submitted_at });
}

/* -------------------------------------------------------- state changes */

/** Take an approved or live listing off the market and back into drafts. */
export async function unpublishListing(input: {
  listingId: string;
}): Promise<ActionResult<null>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(listingIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const listing = await ownedListing(gate.supabase, gate.agentId, parsed.data.listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  if (listing.status !== "APPROVED" && listing.status !== "PUBLISHED") {
    return fail(
      "Only a listing that is approved or live can be taken back to a draft. Refresh to see where this one stands.",
    );
  }

  const { error } = await gate.supabase
    .from("listings")
    .update({ status: "DRAFT" })
    .eq("id", listing.id)
    .eq("agent_id", gate.agentId);
  if (isClosedListingRefusal(error)) return fail(CLOSED_LISTING_MESSAGE);
  if (error) return fail("We could not take this listing down just now. Please try again.");

  refreshAgentSurfaces();
  return ok(null);
}

/** Why a draft with bookings or table requests on record is kept. */
const DRAFT_KEPT_FOR_ITS_RECORDS_MESSAGE =
  "This draft has bookings or table requests on record, with their conversations, so it is kept rather than deleted. As a draft it stays hidden from everybody but you.";

/** Delete a draft outright, with its photos. Anything further along stays. */
export async function deleteListing(input: {
  listingId: string;
}): Promise<ActionResult<null>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);

  const parsed = validate(listingIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const listing = await ownedListing(gate.supabase, gate.agentId, parsed.data.listingId);
  if (!listing) return fail(NOT_FOUND_MESSAGE);
  if (listing.status !== "DRAFT") {
    return fail("Only a draft can be deleted. Take the listing back to a draft first.");
  }

  const [{ data: photos }, { data: videos }] = await Promise.all([
    gate.supabase.from("listing_photos").select("storage_path").eq("listing_id", listing.id),
    gate.supabase.from("listing_videos").select("storage_path, poster_path").eq("listing_id", listing.id),
  ]);

  const { error } = await gate.supabase
    .from("listings")
    .delete()
    .eq("id", listing.id)
    .eq("agent_id", gate.agentId);
  /* SCUML item 17: a listing that has been live, or had a mandate approved, keeps its record. */
  if (isMandateRetentionRefusal(error)) return fail(LISTING_KEPT_MESSAGE);
  if (error) {
    /* 23503: something the draft carries is on record for somebody else, a
       booking, or a table request with its conversation. Those are kept, so
       the draft is kept with them; as a draft it is hidden from everybody
       but its lister. Retrying would never help. */
    if (error.code === "23503") return fail(DRAFT_KEPT_FOR_ITS_RECORDS_MESSAGE);
    return fail("We could not delete this draft just now. Please try again.");
  }

  /* The objects go with the rows: the photos and the videos' stills from the
     public bucket (a still left behind stayed downloadable for ever), and
     the walkthroughs from the private one. Best effort: the draft is gone. */
  const paths = [
    ...(photos ?? []).map((p) => p.storage_path),
    ...(videos ?? []).flatMap((v) => (v.poster_path ? [v.poster_path] : [])),
  ];
  if (paths.length > 0) {
    await gate.supabase.storage.from(PHOTO_BUCKET).remove(paths);
  }
  const walkthroughs = (videos ?? []).map((v) => v.storage_path);
  if (walkthroughs.length > 0) {
    await gate.supabase.storage.from(VIDEO_BUCKET).remove(walkthroughs);
  }

  refreshAgentSurfaces();
  return ok(null);
}

/* ----------------------------------------------------------------- read */

/** Every listing the caller owns, in every status, with its cover photo. */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function getMyListings(
  ...args: Parameters<typeof getMyListingsInner>
): Promise<Awaited<ReturnType<typeof getMyListingsInner>>> {
  return setupExempt(() => getMyListingsInner(...args));
}

async function getMyListingsInner(): Promise<ActionResult<ListingSummary[]>> {
  const gate = await requireAgent();
  if (!gate.ok) return fail(gate.error);
  const listings = await readMyListings(gate.supabase, gate.agentId);
  if (listings === null) return fail("We could not load your listings just now. Nothing has changed. Try again in a moment.");
  return ok(listings);
}
