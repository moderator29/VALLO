"use server";

/**
 * Becoming a host: the writes behind the wizard.
 *
 * ONE ROW IS THE APPLICATION. `public.businesses` is created as DRAFT at the
 * second step and everything after writes onto it, so there is no separate
 * application table to fall out of step with the business it becomes
 * (docs/research/HOST_ONBOARDING_RESEARCH.md section 3.2). Submission is a
 * status change on that same row, which is what puts it in the reviewer's
 * queue.
 *
 * EVERY WRITE IS THE CALLER'S OWN. `businesses_owner_all` pins the row to
 * `owner_id`, and the child tables scope through `private.owns_business` and
 * `private.owns_accommodation`, so the database decides whose application
 * this is. The service role appears nowhere in this file: a host application
 * written as the service role would bypass the ownership check that is the
 * entire point.
 *
 * NOTHING TYPED IS EVER LOST. Every save is an upsert of whatever the person
 * has filled in so far, and no save refuses a half-filled form: what must be
 * PRESENT is decided once, at submission, by `missingFrom`, which prints
 * exactly what is absent rather than saying "complete all required fields".
 *
 * DOCUMENTS. The wizard uploads straight into the private `host-documents`
 * bucket under `<uid>/<batch>/...`, which storage RLS restricts to that
 * person's own folder, and hands this action the path. Nothing here trusts
 * that string: a path outside the caller's own prefix is refused before any
 * write, exactly as `lib/agent/application.ts` does it, so a crafted path
 * cannot claim somebody else's object.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withBusinessPrivate } from "../supabase/private-fields";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { phoneGateFor } from "../phone-otp/gate";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import type { Database } from "../supabase/database.types";
import { SCRUB_REFUSED_MESSAGE, scrubPublicPhoto } from "../images/scrub";
import { wrongBranch } from "./branch-guard";
import { HOST_TYPE_DEFINITIONS, branchFor, documentPathBelongsTo, missingFrom, type HostType } from "./onboarding";
import { HOST_PHOTO_BUCKET, MAX_BUSINESS_PHOTOS, nextPhotoPosition } from "./photos";
import { MAX_NIGHTS_IN_ONE_ACT, nightsBetween } from "../stays/inventory";
import { readMyHostDraft } from "./queries";
import { orderFacilities } from "./facilities";
import {
  accommodationDraftSchema,
  accommodationFacilitiesSchema,
  accommodationPhotoIdSchema,
  accommodationPhotoSchema,
  businessPhotoIdSchema,
  businessPhotoSchema,
  hostDocumentSchema,
  hostDraftSchema,
  ratePlanDraftSchema,
  restaurantProfileDraftSchema,
  openingHoursDraftSchema,
  roomNightsSchema,
  roomTypeDraftSchema,
  serviceWindowDraftSchema,
  shortletPlaceDraftSchema,
} from "./schema";
import { SHORTLET_RATE_NAME, bedsArray, placeTypeUnavailable } from "./stays-setup";
import { HOST_AGREEMENT_VERSION, PAY_ON_VALLO_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "../legal/versions";
import { countOf } from "@vallo/i18n/core";
import { fill, hostRefusals } from "./refusals";

type BusinessKind = Database["public"]["Enums"]["business_kind"];

/* What the host is told when an action refuses, in the host's language
   (`experienceHost.refusals.application`), read per call. */
type Words = Awaited<ReturnType<typeof hostRefusals>>["application"];
const words = async (): Promise<Words> => (await hostRefusals()).application;
/* What a field says beside the box when its value is the wrong shape
   (`experienceHost.refusals.schema`), in the same request's language. */
const schemaWords = async () => (await hostRefusals()).schema;

/** The statuses in which a host may still edit their own application. */
const EDITABLE: readonly Database["public"]["Enums"]["listing_status"][] = [
  "DRAFT",
  "MORE_INFO_REQUIRED",
  /* A refused application is edited and sent again, as on Airbnb and
     Booking.com, on the same business row. `private.guard_owner_write` has
     always let an owner edit a REJECTED row and move it to SUBMITTED; the app
     now does too. */
  "REJECTED",
];

/** The statuses whose row is the caller's application, newest first. */
const APPLICATION_STATUSES = ["DRAFT", "MORE_INFO_REQUIRED", "SUBMITTED", "REJECTED"] as const;

function refreshHostSurfaces(): void {
  revalidatePath("/host");
  revalidatePath("/host/apply");
}

/**
 * The surfaces a photograph changes: the owner's own manager, and every guest
 * surface that draws the venue. The shelf and the detail page are ordinary
 * dynamic routes, so this is belt and braces rather than the only thing
 * keeping them current.
 */
function refreshVenueSurfaces(): void {
  revalidatePath("/host");
  revalidatePath("/host/photos");
  revalidatePath("/restaurants");
}

/**
 * The surfaces a photograph of a PROPERTY changes: the owner's own manager,
 * the application it is still part of, and the guest surfaces that draw the
 * stay. `/host/apply` is on this list and `/restaurants` is not, because an
 * accommodation photograph is a submission requirement while it is being
 * gathered, which is exactly when the review step must stop saying it is
 * missing.
 */
/**
 * The surfaces a night on sale changes: the host's own room console, and the
 * stays shelf, where `stays_search` reads the nights directly.
 */
function refreshRoomSurfaces(): void {
  revalidatePath("/host");
  revalidatePath("/host/rooms");
  revalidatePath("/stays");
}

function refreshPropertySurfaces(): void {
  revalidatePath("/host");
  revalidatePath("/host/apply");
  revalidatePath("/host/photos");
  revalidatePath("/stays");
}

/** A URL-safe slug from a name, with a short suffix so two hosts may share one. */
function slugFor(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const stem = base.length >= 2 ? base : "host";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stem}-${suffix}`;
}

/* -------------------------------------------------------------- the draft */

export type HostDraftSaved = { businessId: string; status: string };

/**
 * Save whatever the wizard has so far, creating the DRAFT row on first call.
 *
 * The kind is validated against the enum here rather than in the schema,
 * because the schema is client-safe and the enum is generated: a value the
 * column would refuse is told apart from one it would accept, in one place.
 */
export async function saveHostDraft(input: unknown): Promise<ActionResult<HostDraftSaved>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(hostDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;

  const { data: existingPublic, error: readError } = await session.supabase
    .from("businesses")
    .select("id, status, name, kind, host_type")
    .eq("owner_id", session.user.id)
    .in("status", [...APPLICATION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) return fail((await words()).serviceDown);
  /* Consents are private to the owner, read through the definer. A draft
     whose consents cannot be read is not saved, so they are never
     overwritten with blanks. */
  let existing: (typeof existingPublic & { consents: unknown }) | null = null;
  if (existingPublic) {
    try {
      const [merged] = await withBusinessPrivate(session.supabase, [existingPublic], ["consents"] as const);
      existing = merged ?? null;
    } catch {
      return fail((await words()).serviceDown);
    }
  }
  if (existing && !EDITABLE.includes(existing.status)) return fail((await words()).notEditable);

  /* A restaurant host runs a restaurant, and a restaurant business is what the
     reservation trigger and the admin chip both key on, so the branch answer
     decides the kind rather than sitting beside it. */
  const kindFromType: Partial<Record<HostType, BusinessKind>> = { restaurant: "restaurant" };
  /* A host type changed without a kind keeps the stored kind only when the
     new type offers it; otherwise it takes the new type's first kind, so a
     restaurant that became a shortlet host is never left a restaurant. */
  const storedKind = (existing?.kind as BusinessKind | null | undefined) ?? null;
  const switchedKind =
    data.hostType && !data.kind && storedKind && !HOST_TYPE_DEFINITIONS[data.hostType].kinds.includes(storedKind)
      ? HOST_TYPE_DEFINITIONS[data.hostType].kinds[0]
      : undefined;
  const kind: BusinessKind | undefined =
    (data.hostType ? kindFromType[data.hostType] : undefined) ??
    (data.kind as BusinessKind | undefined) ??
    switchedKind;
  /* The kind has to be one the host type offers: an individual is never a
     hotel, and only the restaurant branch is a restaurant. */
  const typeForKind = (data.hostType ?? (existing?.host_type as HostType | null | undefined)) ?? null;
  if (kind && typeForKind && !HOST_TYPE_DEFINITIONS[typeForKind].kinds.includes(kind)) {
    return fail("That kind of business does not match the kind of host you chose. Pick it again on the first step.");
  }

  const now = new Date().toISOString();
  const consents: Record<string, unknown> = {
    ...((existing?.consents as Record<string, unknown> | null) ?? {}),
  };
  for (const id of data.consents ?? []) consents[id] = now;
  /*
   * A CONSENT UNTICKED IS A CONSENT WITHDRAWN. Its timestamp goes, so
   * `missingFrom` (here and at submission) asks for it again, and the
   * withdrawal is appended to `consents.withdrawals` with its moment, so the
   * record shows it was given and then taken back rather than never given.
   * Only a consent that was actually on record is withdrawn.
   */
  const withdrawn = (data.withdrawConsents ?? []).filter((id) => typeof consents[id] === "string");
  if (withdrawn.length > 0) {
    const history = Array.isArray(consents.withdrawals) ? consents.withdrawals : [];
    for (const id of withdrawn) delete consents[id];
    consents.withdrawals = [...history, ...withdrawn.map((id) => ({ id, at: now }))];
  }
  /*
   * THE HOST'S AGREEMENT (founder decision B): the Terms, the Privacy policy
   * and the Host Agreement, each with its version and the moment, appended to
   * `consents.agreements`. Agreeing to the Terms and Privacy policy here is
   * also the wizard's "terms" consent, so it is stamped too.
   */
  if (data.agreeToHostTerms) {
    const record = Array.isArray(consents.agreements) ? consents.agreements : [];
    consents.agreements = [
      ...record,
      { document: "terms", version: TERMS_VERSION, at: now },
      { document: "privacy", version: PRIVACY_VERSION, at: now },
      { document: "host_agreement", version: HOST_AGREEMENT_VERSION, at: now },
    ];
    consents.terms = now;
  }
  /* Ruling 6: the pay-on-Vallo statement, appended the same way. */
  if (data.agreeToPayOnVallo) {
    const record = Array.isArray(consents.agreements) ? consents.agreements : [];
    consents.agreements = [...record, { document: "pay_on_vallo", version: PAY_ON_VALLO_VERSION, at: now }];
  }
  const consentsChanged =
    Boolean(data.consents) || withdrawn.length > 0 || Boolean(data.agreeToHostTerms) || Boolean(data.agreeToPayOnVallo);

  const fields = {
    ...(data.hostType ? { host_type: data.hostType } : {}),
    ...(kind ? { kind } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
    ...(data.email !== undefined ? { email: data.email || null } : {}),
    ...(data.address !== undefined ? { address: data.address || null } : {}),
    ...(data.area !== undefined ? { area: data.area || null } : {}),
    ...(data.city !== undefined ? { city: data.city || null } : {}),
    ...(data.stateCode !== undefined ? { state_code: data.stateCode || null } : {}),
    ...(data.registeredName !== undefined
      ? { registered_name: data.registeredName || null }
      : {}),
    ...(data.cacNumber !== undefined ? { cac_number: data.cacNumber || null } : {}),
    ...(data.tin !== undefined ? { tin: data.tin || null } : {}),
    ...(data.representativeName !== undefined
      ? { representative_name: data.representativeName || null }
      : {}),
    ...(data.representativePhone !== undefined
      ? { representative_phone: data.representativePhone || null }
      : {}),
    ...(consentsChanged ? { consents: consents as Database["public"]["Tables"]["businesses"]["Update"]["consents"] } : {}),
    /* An attestation is a dated fact somebody stated, so unticking it removes
       the date rather than leaving a claim nobody is making any more. */
    ...(data.hygieneAttested !== undefined
      ? { hygiene_attested_at: data.hygieneAttested ? now : null }
      : {}),
    ...(data.licenceAttested !== undefined
      ? { licence_attested_at: data.licenceAttested ? now : null }
      : {}),
  };

  if (existing) {
    if (Object.keys(fields).length === 0) {
      return ok({ businessId: existing.id, status: existing.status });
    }
    const { error } = await session.supabase
      .from("businesses")
      .update(fields)
      .eq("id", existing.id);
    if (error) return fail(saveRefusal(await words(), error.message, error.code));
    refreshHostSurfaces();
    return ok({ businessId: existing.id, status: existing.status });
  }

  // First save. Nothing is created for a host who has not agreed to the
  // Terms, the Privacy policy and the Host Agreement (founder decision B).
  if (!data.agreeToHostTerms) {
    return fail("Agree to the Terms of service, the Privacy policy and the Host Agreement first, then continue.", {
      agreeToHostTerms: "Tick this to continue.",
    });
  }

  // A row needs a name and a kind, which are step one and step two's
  // answers; without them there is nothing honest to create yet.
  const name = (data.name ?? "").trim();
  if (name.length < 2) {
    const w = await words();
    return fail(w.nameFirst, { name: w.nameField });
  }
  if (!kind) {
    const w = await words();
    return fail(w.kindFirst, { kind: w.kindField });
  }

  const { data: created, error } = await session.supabase
    .from("businesses")
    .insert({
      owner_id: session.user.id,
      source: "first_party",
      status: "DRAFT",
      kind,
      name,
      slug: slugFor(name),
      ...fields,
    })
    .select("id, status")
    .single();
  if (error || !created) return fail(saveRefusal(await words(), error?.message ?? "", error?.code));

  refreshHostSurfaces();
  return ok({ businessId: created.id, status: created.status });
}

/**
 * A database refusal, as a sentence.
 *
 * Only the ones a person can act on are told apart. Everything else is one
 * honest failure: the constraint's name belongs in a log, not in front of
 * somebody filling in a form.
 */
function saveRefusal(w: Words, raw: string, code?: string): string {
  if (code === "23505") return w.slugTaken;
  if (raw.includes("businesses_phone_check")) return w.phoneBad;
  if (raw.includes("businesses_email_check")) return w.emailBad;
  if (raw.includes("cac_number")) return w.cacBad;
  if (raw.includes("row-level security")) return w.notYours;
  return w.serviceDown;
}

/* ----------------------------------------------------------- the documents */

/**
 * Record a document the wizard has already uploaded to the private bucket.
 *
 * Two checks before any write, and the first is the one that matters: the
 * path must sit under the caller's own uid prefix. Storage RLS enforces the
 * same rule on the upload itself, so a path that fails here was never written
 * by this person and has no business being recorded against their
 * application. The insert policy re-checks both the prefix and the ownership
 * of the application, so this is the third place the rule holds and the first
 * place somebody is told about it in words.
 */
export async function uploadHostDocumentPath(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(hostDocumentSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  if (!documentPathBelongsTo(session.user.id, parsed.data.storagePath)) {
    return fail((await words()).uploadNotYoursFile);
  }

  const { data, error } = await session.supabase
    .from("business_documents")
    .insert({
      business_id: parsed.data.businessId,
      kind: parsed.data.kind,
      storage_path: parsed.data.storagePath,
      uploaded_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "42501") return fail((await words()).notYours);
    return fail((await words()).documentNotAttached);
  }

  refreshHostSurfaces();
  return ok({ id: data.id });
}

/* --------------------------------------------------------------- submission */

/**
 * Send the application to the review queue.
 *
 * DRAFT (or MORE_INFO_REQUIRED, for a host answering a reviewer) to SUBMITTED,
 * and only when `missingFrom` is empty. The list it returns is handed back
 * verbatim in `fieldErrors` so the review screen prints exactly what is
 * absent, which is the whole reason that function returns a list.
 */
export async function submitHostApplication(): Promise<ActionResult<{ businessId: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const read = await readMyHostDraft();
  if (read.state === "unavailable") return fail((await words()).serviceDown);
  const draft = read.draft;
  if (!draft.businessId) return fail((await words()).noDraft);
  if (draft.status === "SUBMITTED") {
    return fail((await words()).alreadyWithTeam);
  }
  if (draft.status !== null && !EDITABLE.includes(draft.status)) return fail((await words()).notEditable);

  /* FULL GATE (13 October 2026): the first hotel, shortlet or restaurant sent for publishing needs a
     confirmed phone, flag on; a listing fails closed on a failed read
     (`phone-otp/core.ts`). */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "listing");
  if (phoneGate) return phoneGate;

  const missing = missingFrom(draft);
  if (missing.length > 0) {
    return fail(
      countOf(missing.length, "thingsMissing").replace("{item}", missing[0] ?? ""),
      Object.fromEntries(missing.map((item, index) => [`missing.${index}`, item])),
    );
  }

  const { error, count } = await session.supabase
    .from("businesses")
    .update(
      { status: "SUBMITTED", submitted_at: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("id", draft.businessId)
    .eq("owner_id", session.user.id)
    .in("status", [...EDITABLE]);
  if (error) return fail((await words()).serviceDown);
  // Nothing moved: somebody submitted it in another tab, or a reviewer picked
  // it up between the read above and this write.
  if (count === 0) {
    return fail((await words()).alreadySent);
  }

  refreshHostSurfaces();
  return ok({ businessId: draft.businessId });
}

/* ------------------------------------------------------ the property halves */

/** The caller's editable application, or the sentence that says why not. */
async function editableBusiness(): Promise<
  | { ok: false; result: ActionResult<never> }
  | { ok: true; businessId: string; userId: string; kind: string | null }
> {
  const session = await resolveSession();
  if (session.state === "unconfigured") {
    return { ok: false, result: fail(NOT_CONFIGURED_MESSAGE) };
  }
  if (session.state === "signed-out") return { ok: false, result: fail(SIGNED_OUT_MESSAGE) };

  const { data, error } = await session.supabase
    .from("businesses")
    .select("id, status, kind")
    .eq("owner_id", session.user.id)
    .in("status", [...APPLICATION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, result: fail((await words()).serviceDown) };
  if (!data) return { ok: false, result: fail((await words()).noDraft) };
  if (!EDITABLE.includes(data.status)) return { ok: false, result: fail((await words()).notEditable) };
  return { ok: true, businessId: data.id, userId: session.user.id, kind: (data as { kind?: string | null }).kind ?? null };
}



/**
 * Create or update the property this business lets.
 *
 * One accommodation per application in the wizard: a host with a second
 * property adds it from their own console once the first is live, which is a
 * different surface with a different question. The row is created DRAFT and
 * the publish gate is the reviewer's, never this action's.
 */
export async function addAccommodationDraft(
  input: unknown,
): Promise<ActionResult<{ accommodationId: string }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "stay");
  if (branchRefusal) return branchRefusal;

  const parsed = validate(accommodationDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const fields = {
    name: data.name,
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.starRating !== undefined ? { star_rating: data.starRating } : {}),
    ...(data.checkInFrom !== undefined ? { check_in_from: data.checkInFrom } : {}),
    ...(data.checkOutBy !== undefined ? { check_out_by: data.checkOutBy } : {}),
    ...(data.houseRules !== undefined ? { house_rules: data.houseRules || null } : {}),
    ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
    ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
    ...(data.cancellationPolicyId !== undefined
      ? { cancellation_policy_id: data.cancellationPolicyId }
      : {}),
  };

  const { data: existing } = await session.supabase
    .from("accommodations")
    .select("id")
    .eq("business_id", guarded.businessId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await session.supabase
      .from("accommodations")
      .update(fields)
      .eq("id", existing.id);
    if (error) return fail((await words()).serviceDown);
    refreshHostSurfaces();
    return ok({ accommodationId: existing.id });
  }

  const { data: created, error } = await session.supabase
    .from("accommodations")
    .insert({
      business_id: guarded.businessId,
      slug: slugFor(data.name),
      status: "DRAFT",
      ...fields,
    })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      return fail((await words()).propertySlugTaken);
    }
    if (error?.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  refreshHostSurfaces();
  return ok({ accommodationId: created.id });
}

/** Add one room type to the property. At least one is a publish gate. */
export async function addRoomTypeDraft(
  input: unknown,
): Promise<ActionResult<{ roomTypeId: string }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "stay");
  if (branchRefusal) return branchRefusal;

  const parsed = validate(roomTypeDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { data: created, error } = await session.supabase
    .from("room_types")
    .insert({
      accommodation_id: data.accommodationId,
      name: data.name,
      category: data.category,
      ...(data.description ? { description: data.description } : {}),
      sleeps: data.sleeps,
      units_total: data.unitsTotal,
      base_rate_minor: data.baseRateMinor,
      ...(data.sizeSqm !== undefined ? { size_sqm: data.sizeSqm } : {}),
      status: "DRAFT",
    })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      const w = await words();
      return fail(w.roomTypeNameTaken, { name: w.differentName });
    }
    if (error?.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  refreshHostSurfaces();
  return ok({ roomTypeId: created.id });
}

/**
 * Add one rate plan to a room type.
 *
 * A cancellation policy is required by the column, not by this action, and
 * that is the point: a bookable room whose cancellation terms nobody chose is
 * the thing the publish gate exists to prevent.
 */
export async function addRatePlanDraft(
  input: unknown,
): Promise<ActionResult<{ ratePlanId: string }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "stay");
  if (branchRefusal) return branchRefusal;

  const parsed = validate(ratePlanDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { data: created, error } = await session.supabase
    .from("rate_plans")
    .insert({
      room_type_id: data.roomTypeId,
      name: data.name,
      ...(data.mealPlan ? { meal_plan: data.mealPlan } : {}),
      cancellation_policy_id: data.cancellationPolicyId,
      rate_minor: data.rateMinor,
      ...(data.minStayNights !== undefined ? { min_stay_nights: data.minStayNights } : {}),
      ...(data.maxStayNights !== undefined ? { max_stay_nights: data.maxStayNights } : {}),
    })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      const w = await words();
      return fail(w.ratePlanNameTaken, { name: w.differentName });
    }
    if (error?.code === "23503") {
      const w = await words();
      return fail(w.policyFromList, { cancellationPolicyId: w.policyField });
    }
    if (error?.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  refreshHostSurfaces();
  return ok({ ratePlanId: created.id });
}

/** Add one service window to a restaurant. At least one is a publish gate. */
export async function addServiceWindowDraft(
  input: unknown,
): Promise<ActionResult<{ serviceWindowId: string }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "restaurant");
  if (branchRefusal) return branchRefusal;

  const parsed = validate(serviceWindowDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { data: created, error } = await session.supabase
    .from("service_windows")
    .insert({
      business_id: guarded.businessId,
      weekday: data.weekday,
      opens: data.opens,
      last_seating: data.lastSeating,
      closes: data.closes,
      covers: data.covers,
    })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      return fail((await words()).serviceClash);
    }
    if (error?.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  refreshHostSurfaces();
  return ok({ serviceWindowId: created.id });
}

/**
 * The restaurant's own facts: cuisines, a price band, and the Nigerian
 * columns that matter. A BAND, never a made-up average price.
 */
export async function setRestaurantProfileDraft(
  input: unknown,
): Promise<ActionResult<{ rulesKept: boolean }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "restaurant");
  if (branchRefusal) return branchRefusal;

  const parsed = validate(restaurantProfileDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { error } = await session.supabase.from("restaurant_profiles").upsert(
    {
      business_id: guarded.businessId,
      ...(data.cuisines !== undefined ? { cuisines: data.cuisines } : {}),
      ...(data.priceBand !== undefined ? { price_band: data.priceBand } : {}),
      ...(data.menuUrl !== undefined ? { menu_url: data.menuUrl || null } : {}),
      ...(data.dressCode !== undefined ? { dress_code: data.dressCode || null } : {}),
      ...(data.parking !== undefined ? { parking: data.parking } : {}),
      ...(data.powerBackup !== undefined ? { power_backup: data.powerBackup } : {}),
      ...(data.outdoor !== undefined ? { outdoor: data.outdoor } : {}),
    },
    { onConflict: "business_id" },
  );
  if (error) {
    if (error.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  /*
   * THE TABLE RULES, IN THEIR OWN WRITE. The three columns arrive with
   * `20261013090200_...`; on an estate where it has not run, PostgREST
   * answers an unknown column with PGRST204 (or Postgres with 42703). That
   * one refusal is not allowed to undo the profile saved above, so it is
   * reported back as "not kept" and the screen says so. Any other refusal
   * is a real fault.
   */
  const rules = {
    ...(data.sittingMinutes !== undefined ? { sitting_minutes: data.sittingMinutes } : {}),
    ...(data.holdMinutes !== undefined ? { hold_minutes: data.holdMinutes } : {}),
    ...(data.cancelNoticeHours !== undefined ? { cancel_notice_hours: data.cancelNoticeHours } : {}),
  };
  let rulesKept = true;
  if (Object.keys(rules).length > 0) {
    const { error: rulesError } = await session.supabase
      .from("restaurant_profiles")
      .update(rules as Database["public"]["Tables"]["restaurant_profiles"]["Update"])
      .eq("business_id", guarded.businessId);
    if (rulesError) {
      if (rulesError.code === "PGRST204" || rulesError.code === "42703") rulesKept = false;
      else if (rulesError.code === "42501") return fail((await words()).notYours);
      else return fail((await words()).serviceDown);
    }
  }

  refreshHostSurfaces();
  return ok({ rulesKept });
}

/* --------------------------------------------------------- photographs */

/**
 * The caller's own business, at ANY status, or the sentence that says why not.
 *
 * Deliberately not `editableBusiness`. That helper refuses once an application
 * has been sent, which is right for an answer on a form and wrong for a
 * photograph: the onboarding script promises an owner they can go live the day
 * they sign and send their pictures during the week, so the moment a venue is
 * APPROVED or PUBLISHED is exactly when its photographs arrive. Ownership is
 * still the gate, and RLS re-checks it on the write through
 * `private.owns_business`.
 */
async function ownedBusiness(
  businessId: string,
): Promise<
  { ok: false; result: ActionResult<never> } | { ok: true; userId: string }
> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { ok: false, result: fail(NOT_CONFIGURED_MESSAGE) };
  if (session.state === "signed-out") return { ok: false, result: fail(SIGNED_OUT_MESSAGE) };

  const { data, error } = await session.supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", session.user.id)
    .maybeSingle();
  if (error) return { ok: false, result: fail((await words()).serviceDown) };
  if (!data) return { ok: false, result: fail((await words()).notYours) };
  return { ok: true, userId: session.user.id };
}

/**
 * Record a photograph the browser has already put in the public bucket.
 *
 * THE POSITION IS DECIDED HERE, not by the caller, and it is the lowest free
 * one. `position` is unique per business and 0 is the cover everywhere that
 * reads these rows, so letting a form post a number would let two photographs
 * race for the cover and one of them would fail on the unique index with a
 * refusal nobody could act on. Uploading in order therefore means the FIRST
 * photograph is the cover, which is what the surface tells the owner.
 *
 * The path is checked against the caller's own uid prefix before any write,
 * exactly as `uploadHostDocumentPath` does it: storage RLS enforces the same
 * rule on the upload itself, so a path that fails here was never written by
 * this person.
 */
export async function addBusinessPhoto(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = validate(businessPhotoSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const guarded = await ownedBusiness(parsed.data.businessId);
  if (!guarded.ok) return guarded.result;

  if (!documentPathBelongsTo(guarded.userId, parsed.data.storagePath)) {
    return fail((await words()).uploadNotYoursPhoto);
  }

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { data: taken, error: readError } = await session.supabase
    .from("business_photos")
    .select("position")
    .eq("business_id", parsed.data.businessId)
    .order("position", { ascending: true });
  if (readError) return fail((await words()).serviceDown);

  const position = nextPhotoPosition((taken ?? []).map((row) => row.position));
  if (position === null) {
    return fail(
      fill((await words()).venuePhotosFull, { max: MAX_BUSINESS_PHOTOS }),
    );
  }

  /* SEC-04: the object is public the moment a row points at it, so its
     metadata (GPS included) is stripped here, on the server, first. */
  const scrubbed = await scrubPublicPhoto(HOST_PHOTO_BUCKET, parsed.data.storagePath);
  if (!scrubbed.ok) return fail(SCRUB_REFUSED_MESSAGE);

  const { data, error } = await session.supabase
    .from("business_photos")
    .insert({
      business_id: parsed.data.businessId,
      storage_path: parsed.data.storagePath,
      position,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "42501") return fail((await words()).notYours);
    if (error?.code === "23505") {
      return fail((await words()).photoRace);
    }
    return fail((await words()).photoNotAttached);
  }

  refreshVenueSurfaces();
  return ok({ id: data.id });
}

/**
 * Take one photograph down.
 *
 * The row goes and the object stays: the bucket is swept by the account
 * deletion purge, and deleting a public object from under a page that may
 * still be rendering it is how a live venue ends up with a broken image. What
 * a guest sees is decided by the rows, and the row is gone.
 *
 * Removing the cover promotes the next photograph, because every reader orders
 * by position and takes the first. Nothing is renumbered, so nothing else
 * moves.
 */
export async function removeBusinessPhoto(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(businessPhotoIdSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  /* The delete is scoped by RLS (`business_photos_write` admits the owner and
     an admin), so a photograph on somebody else's venue simply does not move
     and the count says so rather than the policy being restated here. */
  const { error, count } = await session.supabase
    .from("business_photos")
    .delete({ count: "exact" })
    .eq("id", parsed.data.photoId);
  if (error) return fail((await words()).serviceDown);
  if (count === 0) return fail((await words()).notYours);

  refreshVenueSurfaces();
  return ok(null);
}

/* ------------------------------------------ photographs of a property */

/**
 * The caller's own accommodation, at ANY status, or the sentence that says
 * why not.
 *
 * The same argument as `ownedBusiness` above, one spine over. Photographs are
 * not an answer on a form: they arrive while the application is with our team
 * and they are replaced for years afterwards, so `editableBusiness`, which
 * shuts on SUBMITTED, is the wrong gate for them. Ownership is the gate, and
 * `accommodation_photos_write` re-checks it through
 * `private.owns_accommodation` on the write itself.
 *
 * The read walks `accommodations` to `businesses` because ownership lives on
 * the business row: `accommodations_owner_all` already scopes this select, so
 * a property on somebody else's account simply does not come back.
 */
async function ownedAccommodation(
  accommodationId: string,
): Promise<
  { ok: false; result: ActionResult<never> } | { ok: true; userId: string }
> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { ok: false, result: fail(NOT_CONFIGURED_MESSAGE) };
  if (session.state === "signed-out") return { ok: false, result: fail(SIGNED_OUT_MESSAGE) };

  const { data, error } = await session.supabase
    .from("accommodations")
    .select("id, businesses!inner(owner_id)")
    .eq("id", accommodationId)
    .eq("businesses.owner_id", session.user.id)
    .maybeSingle();
  if (error) return { ok: false, result: fail((await words()).serviceDown) };
  if (!data) return { ok: false, result: fail((await words()).notYours) };
  return { ok: true, userId: session.user.id };
}

/**
 * Record a photograph of a property the browser has already put in the bucket.
 *
 * THIS IS THE ACTION THAT WAS MISSING, and its absence was the hardest dead
 * end in the product: `missingFrom` blocks submission when an accommodation
 * carries no photograph, and until now nothing anywhere in the application
 * could put one there. Every hotel and every shortlet stopped at the review
 * step with a requirement the product offered no way to meet.
 *
 * The rules are `addBusinessPhoto`'s, because a second pattern for the same
 * act on a neighbouring table is how the two come to disagree. The position is
 * decided here and is the lowest free one, so the first photograph is the
 * cover and taking the cover down promotes the next. The path is checked
 * against the caller's own uid prefix before any write; storage RLS enforces
 * the same rule on the upload, so a path that fails here was never written by
 * this person.
 */
export async function addAccommodationPhoto(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = validate(accommodationPhotoSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const guarded = await ownedAccommodation(parsed.data.accommodationId);
  if (!guarded.ok) return guarded.result;

  if (!documentPathBelongsTo(guarded.userId, parsed.data.storagePath)) {
    return fail((await words()).uploadNotYoursPhoto);
  }

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { data: taken, error: readError } = await session.supabase
    .from("accommodation_photos")
    .select("position")
    .eq("accommodation_id", parsed.data.accommodationId)
    .order("position", { ascending: true });
  if (readError) return fail((await words()).serviceDown);

  const position = nextPhotoPosition((taken ?? []).map((row) => row.position));
  if (position === null) {
    return fail(
      fill((await words()).propertyPhotosFull, { max: MAX_BUSINESS_PHOTOS }),
    );
  }

  /* SEC-04: stripped on the server before any row makes it public. */
  const scrubbed = await scrubPublicPhoto(HOST_PHOTO_BUCKET, parsed.data.storagePath);
  if (!scrubbed.ok) return fail(SCRUB_REFUSED_MESSAGE);

  const { data, error } = await session.supabase
    .from("accommodation_photos")
    .insert({
      accommodation_id: parsed.data.accommodationId,
      storage_path: parsed.data.storagePath,
      position,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "42501") return fail((await words()).notYours);
    if (error?.code === "23505") {
      return fail((await words()).photoRace);
    }
    return fail((await words()).photoNotAttached);
  }

  refreshPropertySurfaces();
  return ok({ id: data.id });
}

/**
 * Take one photograph of a property down.
 *
 * The row goes and the object stays, for `removeBusinessPhoto`'s reason: the
 * bucket is swept by the account deletion purge, and deleting a public object
 * from under a page that may still be rendering it is how a live property ends
 * up with a broken image. What a guest sees is decided by the rows.
 */
export async function removeAccommodationPhoto(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(accommodationPhotoIdSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  /* Scoped by RLS (`accommodation_photos_write` admits the owner and an
     admin), so a photograph on somebody else's property simply does not move
     and the count says so rather than the policy being restated here. */
  const { error, count } = await session.supabase
    .from("accommodation_photos")
    .delete({ count: "exact" })
    .eq("id", parsed.data.photoId);
  if (error) return fail((await words()).serviceDown);
  if (count === 0) return fail((await words()).notYours);

  refreshPropertySurfaces();
  return ok(null);
}

/* ------------------------------------------------ the order of photographs */

const reorderSchema = z.object({
  subjectId: z.uuid(),
  photoIds: z.array(z.uuid()).min(1).max(10),
});

const REORDER_FAILED = "We could not save the new order just now. Please try again in a moment.";

async function reorderPhotos(
  fn: "reorder_accommodation_photos" | "reorder_business_photos",
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = validate(reorderSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  if (new Set(parsed.data.photoIds).size !== parsed.data.photoIds.length) return fail(REORDER_FAILED);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  /* One statement inside the caller's own RLS (the function is security
     invoker and the positions' unique is deferred), so another host's
     photographs do not move and a half-applied order cannot be saved. */
  const rpc = session.supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: unknown }>;
  const { error } = await rpc.call(session.supabase, fn, {
    ...(fn === "reorder_business_photos" ? { p_business: parsed.data.subjectId } : { p_accommodation: parsed.data.subjectId }),
    p_ids: parsed.data.photoIds,
  });
  if (error) return fail(REORDER_FAILED);

  if (fn === "reorder_business_photos") refreshVenueSurfaces();
  else refreshPropertySurfaces();
  return ok(null);
}

/** Save the order of a property's photographs; the first is the cover. */
export async function reorderAccommodationPhotos(input: unknown): Promise<ActionResult<null>> {
  return reorderPhotos("reorder_accommodation_photos", input);
}

/** Save the order of a venue's photographs; the first is the cover. */
export async function reorderBusinessPhotos(input: unknown): Promise<ActionResult<null>> {
  return reorderPhotos("reorder_business_photos", input);
}

/* ------------------------------------------------------ nightly inventory */

/**
 * The caller's own room type, or the sentence that says why not.
 *
 * Walks room type to accommodation to business, because ownership lives on
 * the business row. `room_types_owner_all` already scopes this select and
 * `room_inventory_owner_write` re-checks the same thing through
 * `private.owns_room_type` on the write itself, so this read is the polite
 * refusal rather than the security boundary.
 */
async function ownedRoomType(
  roomTypeId: string,
): Promise<
  | { ok: false; result: ActionResult<never> }
  | { ok: true; unitsTotal: number; name: string }
> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { ok: false, result: fail(NOT_CONFIGURED_MESSAGE) };
  if (session.state === "signed-out") return { ok: false, result: fail(SIGNED_OUT_MESSAGE) };

  const { data, error } = await session.supabase
    .from("room_types")
    .select("id, name, units_total, accommodations!inner(businesses!inner(owner_id))")
    .eq("id", roomTypeId)
    .eq("accommodations.businesses.owner_id", session.user.id)
    .maybeSingle();
  if (error) return { ok: false, result: fail((await words()).serviceDown) };
  if (!data) return { ok: false, result: fail((await words()).notYours) };
  return { ok: true, unitsTotal: data.units_total, name: data.name };
}

/**
 * Set how many of one room type are on sale across a run of nights.
 *
 * THE WRITE THAT NOTHING PERFORMED. `room_inventory` was created in M5 with
 * its oversell lock and its RLS, and the only two mentions of the table in the
 * whole of `apps/web/src` were comments. `stays_search` treats a missing night
 * as NOT OFFERED, so a hotel with no rows could not be found by anybody who
 * typed dates. This is the surface's half of closing that; the other half is
 * the horizon opened when a property is published.
 *
 * ZERO IS A CLOSURE, NOT AN ABSENCE, and that distinction is the reason this
 * is an upsert rather than a delete. A row saying none are open tonight is the
 * host's decision, recorded and visible to them. A missing row is silence, and
 * silence and refusal look the same to a search but not to a person.
 *
 * WHAT THE DATABASE REFUSES AND THIS DOES NOT RESTATE: more rooms than the
 * type holds (`private.room_inventory_within_total`), and fewer open than are
 * already sold (`units_booked <= units_open`). Both come back as check
 * violations and are turned into the sentence the host needs, because the
 * second one means a guest has booked that night and the host is looking at
 * the wrong number, not at a bug.
 */
export async function setRoomNights(input: unknown): Promise<ActionResult<{ nights: number }>> {
  const parsed = validate(roomNightsSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { roomTypeId, from, to, unitsOpen } = parsed.data;

  const guarded = await ownedRoomType(roomTypeId);
  if (!guarded.ok) return guarded.result;

  if (unitsOpen > guarded.unitsTotal) {
    const w = await words();
    return fail(fill(w.roomsOverTotal, { total: guarded.unitsTotal, open: unitsOpen }), {
      unitsOpen: fill(w.atMost, { total: guarded.unitsTotal }),
    });
  }

  const dates = nightsBetween(from, to);
  if (dates.length === 0) return fail((await words()).lastBeforeFirst);
  if (dates.length > MAX_NIGHTS_IN_ONE_ACT) {
    return fail(fill((await words()).tooManyNights, { count: dates.length, max: MAX_NIGHTS_IN_ONE_ACT }));
  }

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { error } = await session.supabase.from("room_inventory").upsert(
    dates.map((date) => ({ room_type_id: roomTypeId, date, units_open: unitsOpen })),
    { onConflict: "room_type_id,date" },
  );
  if (error) {
    if (error.code === "42501") return fail((await words()).notYours);
    if (error.code === "23514") {
      /* TWO TRIGGERS RAISE THIS CODE AND THEY MEAN DIFFERENT THINGS, so the
         one sentence a host reads is chosen by which of them spoke.
         `private.room_inventory_within_total` refuses more rooms than the type
         holds, which the check above normally catches and which can still
         arrive if the room type shrank between the two. The column's own CHECK
         refuses leaving fewer open than are already sold, which means a guest
         has booked that night and the host is looking at the wrong number
         rather than at a fault. */
      if (/cannot be offered/i.test(error.message ?? "")) {
        const w = await words();
        return fail(w.moreRoomsThanType, { unitsOpen: w.moreThanTypeHolds });
      }
      return fail((await words()).bookedOverOpen);
    }
    return fail((await words()).serviceDown);
  }

  refreshRoomSurfaces();
  return ok({ nights: dates.length });
}

/* --------------------------------------------------------- the facilities */

/**
 * Replace what a property offers with exactly the facilities given.
 *
 * THE FOURTH TABLE WITH NO WRITER. `accommodation_amenities` has had its owner
 * helper and its RLS since M3, the stay detail page reads it, the catalogue
 * projection folds it into `catalogue_entries.amenity_codes`, and the stays
 * filter lets a guest ask for wifi, parking and air conditioning by name. No
 * application code ever wrote a row, so every facility filter on the stays
 * shelf returned nothing for every hotel, and no stay's page has ever named a
 * single facility.
 *
 * A REPLACEMENT RATHER THAN A DIFFERENCE, on `setAmenities`'s model one spine
 * over: a facilities screen posts the whole set because that is what the
 * person sees, and a difference computed on the client is a difference that
 * can be wrong. Clearing everything is a real answer, which is why an empty
 * list is accepted and not treated as a mistake.
 *
 * Codes are turned into ids by the database, so a code the `amenities` table
 * does not carry cannot be recorded. The schema refuses those in words first,
 * because a facility that is silently dropped is worse than one that is
 * refused: the host sees the box ticked and believes it.
 */
export async function setAccommodationFacilities(
  input: unknown,
): Promise<ActionResult<{ codes: string[] }>> {
  const parsed = validate(accommodationFacilitiesSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { accommodationId } = parsed.data;
  const codes = orderFacilities(parsed.data.codes);

  const guarded = await ownedAccommodation(accommodationId);
  if (!guarded.ok) return guarded.result;

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { data: rows, error: readError } = await session.supabase
    .from("amenities")
    .select("id, code")
    .in("code", codes.length > 0 ? codes : ["__none__"]);
  if (readError) return fail((await words()).serviceDown);

  const { error: clearError } = await session.supabase
    .from("accommodation_amenities")
    .delete()
    .eq("accommodation_id", accommodationId);
  if (clearError) {
    if (clearError.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  const wanted = rows ?? [];
  if (wanted.length > 0) {
    const { error: insertError } = await session.supabase
      .from("accommodation_amenities")
      .insert(
        wanted.map((amenity) => ({
          accommodation_id: accommodationId,
          amenity_id: amenity.id,
        })),
      );
    if (insertError) {
      if (insertError.code === "42501") return fail((await words()).notYours);
      return fail((await words()).serviceDown);
    }
  }

  refreshPropertySurfaces();
  return ok({ codes });
}

/* -------------------------------------------------- the drawn stays set-up */

/**
 * THE SHORTLET'S PLACE, saved as the one bookable unit it is.
 * `GOVERNING-11` screen one.
 *
 * CREATE OR UPDATE, AND THAT IS THE POINT. `addRoomTypeDraft` only inserts,
 * which is right for a hotel adding its fourth room type and wrong for a
 * shortlet: a host who corrects the bed count on their own flat must not end
 * up with two flats. So this finds the property's existing unit and writes
 * onto it, and only creates one when there is none.
 *
 * THE RATE RIDES WITH IT. The nightly price is `base_rate_minor` on the unit
 * itself, in integer kobo, never a naira float and never printed here.
 *
 * WHY A REFUSAL FROM POSTGRES IS READ RATHER THAN SWALLOWED. The three place
 * types are `room_category` values that
 * `20260922190000_imgc_a_shortlet_is_not_a_hotel_room.sql` adds and that this
 * estate's database does not have yet, because the project is INACTIVE and
 * unreachable. Postgres answers an unknown enum label with `22P02`. Turning
 * that one code into a sentence naming the migration is the difference between
 * an operator reading "something went wrong" and an operator knowing exactly
 * what to run. Every other code is a real fault and is reported as one.
 */
export async function setShortletPlaceDraft(
  input: unknown,
): Promise<ActionResult<{ roomTypeId: string }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "stay");
  if (branchRefusal) return branchRefusal;

  const parsed = validate(shortletPlaceDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const fields = {
    name: data.name,
    /* The cast is the point of this action: the label is one the generated
       types do not carry yet, and the database is the thing that decides. */
    category: data.placeType as Database["public"]["Enums"]["room_category"],
    sleeps: data.maxGuests,
    /* A shortlet operator lets this place, not fifty of it. The render asks
       for bedrooms, beds and guests and never for a count of the unit. */
    units_total: 1,
    base_rate_minor: data.nightlyRateMinor,
    /*
     * AN ARRAY, BECAUSE THE COLUMN IS ONE AND THE DATABASE SAYS SO.
     *
     * This line wrote `{bedrooms, beds}`, an object, against
     * `room_types_beds_check (jsonb_typeof(beds) = ''array'')`, which has been
     * on the column since it was created. Every real save would have failed
     * with `23514`, on the one screen this whole feature exists for. It was
     * written from a comment in `queries.ts` claiming the column had no shape
     * constraint; the comment was inherited and false, and the probe that
     * should have caught it asserted the round trip BECAUSE of the comment.
     */
    beds: bedsArray(data.beds),
    /*
     * A BEDROOM IS NOT A BED, so it has its own column rather than a fake
     * entry in the array above. Added by
     * `20260922200000_imgc_a_bedroom_is_not_a_bed.sql`.
     */
    bedrooms: data.bedrooms,
  };

  const { data: existing } = await session.supabase
    .from("room_types")
    .select("id")
    .eq("accommodation_id", data.accommodationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  /*
   * TWO NARROW CASTS, AND THEY ARE DELIBERATE RATHER THAN CONVENIENT.
   *
   * `bedrooms` and the three place-type labels are both added by migrations
   * that this box cannot apply, so `database.types.ts`, which is GENERATED
   * from the live schema, does not carry either yet. The honest choices were a
   * cast here or hand-editing the generated file, and hand-editing it would
   * make the type system assert a schema that may not exist: an invisible
   * claim of exactly the kind that caused the `beds` fault. A cast is visible.
   *
   * BOTH CASTS DISAPPEAR the moment somebody regenerates the types against an
   * estate where the two migrations have run.
   */
  const row = fields as unknown as Database["public"]["Tables"]["room_types"]["Update"];

  const written = existing
    ? await session.supabase
        .from("room_types")
        .update(row)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await session.supabase
        .from("room_types")
        .insert({
          accommodation_id: data.accommodationId,
          status: "DRAFT",
          ...row,
        } as Database["public"]["Tables"]["room_types"]["Insert"])
        .select("id")
        .single();

  if (written.error || !written.data) {
    if (placeTypeUnavailable(written.error?.code)) {
      return fail((await words()).placeTypeMissing);
    }
    if (written.error?.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  refreshHostSurfaces();
  return ok({ roomTypeId: written.data.id });
}

/**
 * THE PROPERTY'S CANCELLATION POLICY ON EVERY RATE IT SELLS, AND THE
 * SHORTLET'S ONE RATE.
 *
 * A booking is made against a `rate_plans` row and reads ITS price and ITS
 * cancellation policy. Two things went wrong because of that:
 *
 *  - A SHORTLET COULD NEVER BE SENT. Its two screens ask for a nightly price
 *    (`room_types.base_rate_minor`) and a policy (`accommodations.
 *    cancellation_policy_id`), and nothing anywhere wrote a rate plan, while
 *    `missingFrom` refuses "A rate with a cancellation policy" and the publish
 *    gate refuses a property with no room carrying a rate. Every shortlet
 *    application stopped at the review step with a requirement no step could
 *    meet. The rate is written here from the host's own two answers: room
 *    only, at the nightly price they typed, on the policy they chose.
 *  - A HOTEL'S RATES KEPT THE POLICY THEY WERE BORN WITH. The rates screen
 *    says the policy is the property's and applies to every room, and a rate
 *    added before a policy was chosen was given the first policy on the list.
 *    Choosing or changing the property's policy now puts it on every rate.
 *
 * Only while the application is editable (`editableBusiness`), so nothing on
 * the shelf or under a booking moves. With no policy chosen yet it does
 * nothing and says so with a zero, because the screens call it after every
 * save that could change either answer.
 */
export async function syncPropertyRatesDraft(): Promise<ActionResult<{ rates: number }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "stay");
  if (branchRefusal) return branchRefusal;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const [{ data: business, error: businessError }, { data: property, error: propertyError }] =
    await Promise.all([
      session.supabase.from("businesses").select("kind").eq("id", guarded.businessId).maybeSingle(),
      session.supabase
        .from("accommodations")
        .select("id, cancellation_policy_id, room_types(id, created_at, base_rate_minor, rate_plans(id, name))")
        .eq("business_id", guarded.businessId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
  if (businessError || propertyError || !business) return fail((await words()).serviceDown);
  if (!property || !property.cancellation_policy_id) return ok({ rates: 0 });
  const policyId = property.cancellation_policy_id;
  const rooms = [...property.room_types].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const existing = rooms.flatMap((room) => room.rate_plans.map((plan) => plan.id));
  if (existing.length > 0) {
    const { error } = await session.supabase
      .from("rate_plans")
      .update({ cancellation_policy_id: policyId })
      .in("id", existing);
    if (error) {
      if (error.code === "42501") return fail((await words()).notYours);
      return fail((await words()).serviceDown);
    }
  }

  let written = existing.length;
  const unit = rooms[0];
  if (branchFor(business.kind) === "shortlet" && unit) {
    const { error } = await session.supabase.from("rate_plans").upsert(
      {
        room_type_id: unit.id,
        name: SHORTLET_RATE_NAME,
        meal_plan: "room_only",
        cancellation_policy_id: policyId,
        rate_minor: unit.base_rate_minor,
      },
      { onConflict: "room_type_id,name" },
    );
    if (error) {
      if (error.code === "42501") return fail((await words()).notYours);
      return fail((await words()).serviceDown);
    }
    if (!unit.rate_plans.some((plan) => plan.name === SHORTLET_RATE_NAME)) written += 1;
  }

  refreshHostSurfaces();
  return ok({ rates: written });
}

/**
 * THE WEEK, set in one act. `GOVERNING-11` screen four.
 *
 * REPLACE, NOT ADD. The render's day rows have switches, and a switch that can
 * only ever turn on is not a switch: closing on Sunday has to delete Sunday's
 * window. So the whole week is written at once, which also means the covers
 * arrived at from the table steppers land on every open day together rather
 * than seven times with six chances to half-fail.
 *
 * THE DELETE IS SCOPED TO THIS BUSINESS AND RE-SCOPED BY RLS.
 * `service_windows_owner_all` pins the rows to the owner through
 * `private.owns_business`, so a crafted business id cannot reach another
 * restaurant's week even though this action never trusts one: the id comes
 * from `editableBusiness`, which read it from the session.
 */
export async function setOpeningHoursDraft(
  input: unknown,
): Promise<ActionResult<{ days: number }>> {
  const guarded = await editableBusiness();
  if (!guarded.ok) return guarded.result;
  const branchRefusal = wrongBranch(guarded.kind, "restaurant");
  if (branchRefusal) return branchRefusal;

  const parsed = validate(openingHoursDraftSchema(await schemaWords()), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const data = parsed.data;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { error: clearError } = await session.supabase
    .from("service_windows")
    .delete()
    .eq("business_id", guarded.businessId);
  if (clearError) {
    if (clearError.code === "42501") return fail((await words()).notYours);
    return fail((await words()).serviceDown);
  }

  if (data.days.length > 0) {
    const { error } = await session.supabase.from("service_windows").insert(
      data.days.map((day) => ({
        business_id: guarded.businessId,
        weekday: day.weekday,
        opens: day.opens,
        /*
         * THE LAST SEATING IS THE CLOSING TIME AND THE SCREEN SAYS SO.
         * `service_windows.last_seating` is NOT NULL and the render's day row
         * draws one pair of times, not two. Taking the close as the last
         * seating is the only reading that invents nothing: it says a table
         * may be taken up to closing, which is what a host who set those two
         * times has actually told us. A separate last seating is a question
         * this screen does not ask, so this screen does not answer it.
         */
        last_seating: day.closes,
        closes: day.closes,
        covers: data.covers,
      })),
    );
    if (error) {
      if (error.code === "42501") return fail((await words()).notYours);
      return fail((await words()).serviceDown);
    }
  }

  refreshHostSurfaces();
  return ok({ days: data.days.length });
}
