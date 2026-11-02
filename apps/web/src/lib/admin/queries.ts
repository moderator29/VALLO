import "server-only";
import { reportReadError } from "@/lib/observability/read-error";
import { COMPOUND_COLUMNS, readCompound, type Compound, type CompoundRow } from "@/lib/listings/compound";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { Constants, type Database } from "../supabase/database.types";
import { documentMedia, type DocumentMedia } from "./documents";
import { countReferralWork } from "./reads/referrals";
import { requireAdmin, requireConsole } from "./guard";
import type { StaffScope } from "./guard";
import { qualityChecks, type QualityCheck } from "./listing-checks";
import {
  lagosDayEnd,
  lagosDayStart,
  orSafe,
  pageRange,
  pickStatus,
  takePage,
  type AdminQueueFilter,
} from "./queue-filter";
import {
  headlinePeriod,
  headlinePrice,
  moveInParts,
  moveInTotal,
  purchaseParts,
  purchaseTotal,
  type MoveInPart,
  type PricePeriod,
} from "../listings/pricing";

/**
 * The console's read layer.
 *
 * Reads run through the service-role client, but only ever after requireAdmin
 * has passed inside this very module, so there is no path where a caller can
 * borrow the privileged client by forgetting a check. Every function returns
 * either data or an explicit "unavailable", never a silently empty list: an
 * empty queue and an unreachable database look identical on screen otherwise,
 * and a queue that claims to be clear when it is not is the one lie an
 * operations surface cannot afford.
 */
export type AdminRead<T> = { state: "ok"; data: T } | { state: "unavailable" };

const UNAVAILABLE = { state: "unavailable" } as const;

async function adminClient(scope?: StaffScope): Promise<SupabaseClient<Database> | null> {
  const access = await requireAdmin(scope);
  if (access.state !== "admin") return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * Who may count which queue. An admin reads everything on the service role;
 * a staff member who has acknowledged the handbook reads on the service role
 * too, but only the queues their scopes open (`may`).
 */
async function queueReach(): Promise<{
  db: SupabaseClient<Database>;
  may: (scope: StaffScope) => boolean;
  /** An admin or super admin, as opposed to a scoped staff member. The referral desk is the first queue only an admin counts. */
  isAdmin: boolean;
} | null> {
  const access = await requireAdmin();
  const console = access.state === "admin" ? null : await requireConsole();
  let may: (scope: StaffScope) => boolean;
  if (access.state === "admin") may = () => true;
  else if (console?.state === "console" && console.staff.handbookAcknowledged && console.staff.scopes.length > 0) {
    const held = new Set(console.staff.scopes);
    may = (scope) => held.has(scope);
  } else return null;
  try {
    return { db: createAdminClient(), may, isAdmin: access.state === "admin" };
  } catch {
    return null;
  }
}

/** ------------------------------------------------------------ queue counts */

export type QueueCounts = {
  flags: number;
  alerts: number;
  applications: number;
  listings: number;
  reports: number;
  tickets: number;
  /**
   * Everything the safety scan is holding: posts, stories, story comments and
   * bios, in one number. Four tables, because four things can be held, and one
   * tile, because clearing them is one job.
   */
  moderation: number;
  /** Track A: agreements both parties confirmed, waiting for review before payment opens. */
  agreements: number;
  /** Track A: Guarantee claims waiting for a decision. */
  claims: number;
  /** The referral desk: referrals sent to a person (status under_review). Admins only. */
  referrals: number;
  /** The referral desk: reward payouts sent to a person (status under_review). Admins only. */
  payouts: number;
  /** The verification desk: ID, selfie, address and business documents nobody has decided yet. */
  verification?: number;
};

/**
 * The queue counts, read ONCE PER REQUEST (R1 finding A37, F6 fault 11).
 *
 * THE FAULT. `app/admin/layout.tsx` called this to badge the rail and the
 * phone header, and `app/admin/page.tsx` called it again to count the tabs.
 * Two calls, two moments, eleven `count: exact` reads each. A row landing
 * between them put two different numbers on one screen: the header badge said
 * 41 and the tab beneath it said "All (42)" in the same shot. On an operations
 * console that is the invented-count rule failing on the one surface where a
 * number has to be trusted, and an operator who has caught the console lying
 * about a count once will not believe the next one.
 *
 * THE FIX IS ONE READ. A layout and a page are separate server components and
 * cannot hand each other a value, so "delete the second read and pass the
 * first down" is spelled here instead: React's `cache` memoises the call for
 * the life of one request, so the second caller gets the first caller's
 * result rather than a second look at a table that has moved. Nothing is
 * cached across requests and nothing is stale: the next navigation reads
 * again, which is what a queue count must do.
 *
 * WHY NOT `lib/cache/memo.ts`. That memo holds one value at module scope for a
 * TTL, which is right for a reference table and exactly wrong for a count of
 * work waiting: it would go on saying 41 to every operator for as long as the
 * TTL ran, which is a worse lie than the one this fixes.
 *
 * THE TWO NUMBERS ARE STILL DIFFERENT QUESTIONS, and that is deliberate. The
 * phone header's badge sums every destination that carries one, so a shut
 * control answers "is there work anywhere"; the overview's "All" tab sums the
 * five queues its table actually folds in. So the badge is greater than the
 * tab exactly when something is held in moderation or an alert is open, which
 * is true rather than inconsistent. `AdminNav.tsx` names the badge so it
 * cannot be read as the tab's number.
 */
export const getQueueCounts = cache(async (): Promise<AdminRead<QueueCounts>> => {
  /* An admin counts every queue. A staff member counts the queues their
     scopes open and reads zero for the rest, so their overview works instead
     of saying "unavailable" because one count was not theirs. */
  const reach = await queueReach();
  if (!reach) return UNAVAILABLE;
  const { db: admin, may, isAdmin } = reach;
  const none = Promise.resolve({ count: 0 });

  try {
    const [
      flags,
      alerts,
      applications,
      listings,
      reports,
      tickets,
      heldPosts,
      heldStories,
      heldComments,
      heldBios,
      heldEvents,
      agreements,
      claims,
      referralWork,
      verification,
    ] = await Promise.all([
      !may("moderation") ? none : admin.from("message_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
      !may("operations") ? none : admin.from("risk_alerts").select("id", { count: "exact", head: true }).eq("status", "open"),
      !may("kyc_review") ? none : admin
        .from("agent_applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["SUBMITTED", "UNDER_REVIEW"]),
      !may("listing_approval") ? none : admin
        .from("listings")
        .select("id", { count: "exact", head: true })
        .in("status", ["SUBMITTED", "UNDER_REVIEW", "APPROVED"]),
      !may("moderation") ? none : admin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "reviewing"]),
      !may("support") ? none : admin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "pending"]),
      !may("moderation") ? none : admin.from("posts").select("id", { count: "exact", head: true }).eq("status", "HELD"),
      !may("moderation") ? none : admin.from("stories").select("id", { count: "exact", head: true }).eq("status", "HELD"),
      !may("moderation") ? none : admin
        .from("story_comments")
        .select("id", { count: "exact", head: true })
        .eq("status", "HELD"),
      !may("moderation") ? none : admin
        .from("social_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("bio_status", "HELD"),
      /* V-88 review: the Held lane lists held events too, so it counts them. */
      !may("moderation") ? none : admin.from("events").select("id", { count: "exact", head: true }).eq("status", "HELD"),
      !may("agreements") ? none : admin.from("deal_agreements").select("id", { count: "exact", head: true }).eq("status", "in_review"),
      !may("guarantee") ? none : admin.from("guarantee_claims").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      /* The referral desk's two queues. The deciding functions need an admin role, so a scoped staff member counts zero. */
      !isAdmin ? Promise.resolve(null) : countReferralWork(admin),
      !may("kyc_review") ? none : admin
        .from("agent_documents")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "pending")
        .in("kind", ["identity", "selfie", "address", "business"]),
    ]);

    return {
      state: "ok",
      data: {
        flags: flags.count ?? 0,
        alerts: alerts.count ?? 0,
        applications: applications.count ?? 0,
        listings: listings.count ?? 0,
        reports: reports.count ?? 0,
        tickets: tickets.count ?? 0,
        moderation:
          (heldPosts.count ?? 0) +
          (heldStories.count ?? 0) +
          (heldComments.count ?? 0) +
          (heldBios.count ?? 0) +
          (heldEvents.count ?? 0),
        agreements: agreements.count ?? 0,
        claims: claims.count ?? 0,
        /* An unreadable referral count is 0 on the badge, never a number made up; the desk itself says when it cannot read. */
        referrals: referralWork?.referrals ?? 0,
        payouts: referralWork?.payouts ?? 0,
        verification: verification.count ?? 0,
      },
    };
  } catch {
    return UNAVAILABLE;
  }
});

/** ------------------------------------------------------------ message flags */

export type PartyRole = "guest" | "agent" | "unknown";

export type FlagContextLine = {
  id: string;
  body: string;
  role: PartyRole;
  createdAt: string;
  flagged: boolean;
};

export type FlagView = {
  id: string;
  reason: Database["public"]["Enums"]["message_flag_reason"];
  matched: string;
  status: Database["public"]["Enums"]["message_flag_status"];
  createdAt: string;
  messageId: string;
  conversationId: string;
  senderRole: PartyRole;
  body: string;
  context: FlagContextLine[];
};

/**
 * Message flags, narrowed by the console's shared queue frame.
 *
 * The search is over `matched`, which is the fragment the safety scan actually
 * caught - an account number, a payment word - because that is what an operator
 * is chasing when they come back to this queue a second time.
 *
 * `full` is computed BEFORE the null-message rows are dropped. A flag whose
 * message has since been deleted is a row the database returned and the page
 * cannot draw; counting it towards the page is what keeps Next honest, because
 * the next page really does start after it.
 */
export async function getMessageFlags(
  filter?: AdminQueueFilter,
): Promise<AdminRead<{ rows: FlagView[]; full: boolean }>> {
  const admin = await adminClient("moderation");
  if (!admin) return UNAVAILABLE;

  const term = (filter?.q ?? "").trim();
  const status = pickStatus(Constants.public.Enums.message_flag_status, filter?.status);
  const page = pageRange(filter);

  try {
    let select = admin
      .from("message_flags")
      .select(
        "id, reason, matched, status, created_at, message_id, messages ( id, body, sender_id, conversation_id, created_at )",
      );
    if (term.length > 0) select = select.ilike("matched", `%${term}%`);
    if (status) select = select.eq("status", status);
    if (filter?.from) select = select.gte("created_at", lagosDayStart(filter.from));
    if (filter?.to) select = select.lte("created_at", lagosDayEnd(filter.to));

    const { data, error } = await select
      .order("created_at", { ascending: false })
      .range(page.from, page.to);
    await reportReadError("read.admin.getMessageFlags", error);
    if (error) return UNAVAILABLE;

    const { rows: page1, full } = takePage(data ?? []);
    const rows = page1.filter((row) => row.messages !== null);
    if (rows.length === 0) return { state: "ok", data: { rows: [], full } };

    const conversationIds = [...new Set(rows.map((row) => row.messages!.conversation_id))];

    const [{ data: parties }, { data: lines }] = await Promise.all([
      admin.from("conversations").select("id, guest_id, agent_id").in("id", conversationIds),
      admin
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: true })
        .limit(400),
    ]);

    const roleOf = new Map<string, { guest: string; agent: string }>();
    for (const party of parties ?? []) {
      roleOf.set(party.id, { guest: party.guest_id, agent: party.agent_id });
    }

    const role = (conversationId: string, senderId: string): PartyRole => {
      const pair = roleOf.get(conversationId);
      if (!pair) return "unknown";
      if (pair.guest === senderId) return "guest";
      if (pair.agent === senderId) return "agent";
      return "unknown";
    };

    const byConversation = new Map<string, typeof lines>();
    for (const line of lines ?? []) {
      const bucket = byConversation.get(line.conversation_id) ?? [];
      bucket.push(line);
      byConversation.set(line.conversation_id, bucket);
    }

    const views: FlagView[] = rows.map((row) => {
      const message = row.messages!;
      const thread = byConversation.get(message.conversation_id) ?? [];
      const index = thread.findIndex((line) => line.id === message.id);
      // Three lines of run-up plus the flagged line itself: enough to read the
      // intent without turning the queue into a full inbox.
      const slice = index >= 0 ? thread.slice(Math.max(0, index - 3), index + 1) : [];

      return {
        id: row.id,
        reason: row.reason,
        matched: row.matched,
        status: row.status,
        createdAt: row.created_at,
        messageId: message.id,
        conversationId: message.conversation_id,
        senderRole: role(message.conversation_id, message.sender_id),
        body: message.body,
        context: slice.map((line) => ({
          id: line.id,
          body: line.body,
          role: role(line.conversation_id, line.sender_id),
          createdAt: line.created_at,
          flagged: line.id === message.id,
        })),
      };
    });

    return { state: "ok", data: { rows: views, full } };
  } catch {
    return UNAVAILABLE;
  }
}

/** -------------------------------------------------------------- risk alerts */

export type AlertView = {
  id: string;
  severity: Database["public"]["Enums"]["alert_severity"];
  status: Database["public"]["Enums"]["alert_status"];
  title: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /**
   * The name of the admin who closed it, null while the alert is open and null
   * again only if that account has since been deleted. A resolved row that
   * cannot say who resolved it is how accountability quietly disappears.
   */
  resolvedByName: string | null;
  /**
   * C13: who took the alert ("I have this"), and when. Undefined on reads that
   * do not carry acknowledgements (the drift section, the previews), and
   * `acknowledgementsAvailable` false when they could not be read, which is
   * what keeps the button off a desk that cannot store it.
   */
  acknowledgedAt?: string | null;
  acknowledgedByName?: string | null;
  acknowledgementsAvailable?: boolean;
};

type Acknowledgement = { at: string | null; by: string | null };

/**
 * C13: the acknowledgement columns for these alerts (supabase/migrations/
 * 20260930122539_c13_alert_acknowledged_by_and_skipped_runs.sql, applied
 * 30 September 2026). A separate best-effort read, so the queue itself never
 * fails on it: null when the read fails, and the card then draws no button.
 */
async function readAcknowledgements(
  db: SupabaseClient<Database>,
  ids: string[],
): Promise<Map<string, Acknowledgement> | null> {
  if (ids.length === 0) return new Map();
  try {
    const { data, error } = await db
      .from("risk_alerts")
      .select("id, acknowledged_by, acknowledged_at")
      .in("id", ids);
    await reportReadError("read.admin.readAcknowledgements", error);
    if (error || !data) return null;
    const out = new Map<string, Acknowledgement>();
    for (const row of data) out.set(row.id, { at: row.acknowledged_at, by: row.acknowledged_by });
    return out;
  } catch {
    return null;
  }
}

/**
 * Risk alerts, narrowed by the console's shared queue frame.
 *
 * Same change as `getReports` and for the same reason: this read the newest
 * fifty and printed all of them, so the fifty-first alert did not exist as far
 * as an operator was concerned, and there was no way to ask the screen for the
 * open high-severity ones. The search is over `title`, which is the sentence an
 * alert is recognised by.
 */
export async function getRiskAlerts(
  filter?: AdminQueueFilter,
): Promise<AdminRead<{ rows: AlertView[]; full: boolean }>> {
  const admin = await adminClient("operations");
  if (!admin) return UNAVAILABLE;

  const term = (filter?.q ?? "").trim();
  const status = pickStatus(Constants.public.Enums.alert_status, filter?.status);
  const page = pageRange(filter);

  try {
    let select = admin
      .from("risk_alerts")
      .select(
        "id, severity, status, title, description, entity_type, entity_id, created_at, resolved_at, resolved_by",
      );
    if (term.length > 0) select = select.ilike("title", `%${term}%`);
    if (status) select = select.eq("status", status);
    if (filter?.from) select = select.gte("created_at", lagosDayStart(filter.from));
    if (filter?.to) select = select.lte("created_at", lagosDayEnd(filter.to));

    const { data, error } = await select
      .order("created_at", { ascending: false })
      .range(page.from, page.to);
    await reportReadError("read.admin.getRiskAlerts", error);
    if (error) return UNAVAILABLE;

    const { rows, full } = takePage(data ?? []);
    const acknowledgements = await readAcknowledgements(
      admin,
      rows.map((row) => row.id),
    );

    // One extra read for every distinct resolver (and acknowledger), not one
    // per row. The list is capped at fifty, so this is at most one small IN query.
    const resolverIds = [
      ...new Set(
        [...rows.map((row) => row.resolved_by), ...[...(acknowledgements?.values() ?? [])].map((a) => a.by)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const resolvers = new Map<string, string>();
    if (resolverIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", resolverIds);
      for (const profile of profiles ?? []) {
        if (profile.display_name) resolvers.set(profile.id, profile.display_name);
      }
    }

    return {
      state: "ok",
      data: {
        full,
        rows: rows.map((row) => ({
          id: row.id,
          severity: row.severity,
          status: row.status,
          title: row.title,
          description: row.description,
          entityType: row.entity_type,
          entityId: row.entity_id,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
          resolvedByName: row.resolved_by ? (resolvers.get(row.resolved_by) ?? null) : null,
          ...acknowledgementView(acknowledgements, row.id, resolvers),
        })),
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}

function acknowledgementView(
  acknowledgements: Map<string, Acknowledgement> | null,
  id: string,
  names: Map<string, string>,
): Pick<AlertView, "acknowledgedAt" | "acknowledgedByName" | "acknowledgementsAvailable"> {
  if (!acknowledgements) return { acknowledgementsAvailable: false };
  const ack = acknowledgements.get(id);
  return {
    acknowledgementsAvailable: true,
    acknowledgedAt: ack?.at ?? null,
    acknowledgedByName: ack?.by ? (names.get(ack.by) ?? null) : null,
  };
}

/** ------------------------------------------------------------------ reports */

export type ReportView = {
  id: string;
  reporterName: string;
  targetType: string;
  targetId: string;
  /**
   * The structured triage signal, or null on a row written before categories
   * existed. Free text is what the reporter said; this is what they said it
   * was, and it is what makes the queue sortable.
   */
  category: string | null;
  reason: string;
  status: Database["public"]["Enums"]["report_status"];
  createdAt: string;
  resolvedAt: string | null;
  /** The admin who last moved it, so a closed report is somebody's decision. */
  resolvedByName: string | null;
};

/**
 * Reports, narrowed by the console's shared queue frame.
 *
 * ---------------------------------------------------------------------------
 * THIS QUEUE COULD NOT BE SEARCHED, FILTERED OR PAGED THROUGH.
 *
 * It read the newest fifty rows and printed all of them, which is fine at zero
 * rows and is the whole of the console's problem at a thousand: a reviewer
 * asked "what did we do about the payment reports last Tuesday" had no way to
 * ask the screen that, and the fifty-first report did not exist as far as the
 * console was concerned. The narrowing is in the query rather than over the
 * rows it returned, so the page cap applies to what matched.
 *
 * The search is over `reason`, which is the reporter's own words, because that
 * is the field a reviewer remembers a report by. Not the id: an id is how you
 * find a row you already have, and a reviewer looking for a row does not.
 */
export async function getReports(
  filter?: AdminQueueFilter,
): Promise<AdminRead<{ rows: ReportView[]; full: boolean }>> {
  const admin = await adminClient("moderation");
  if (!admin) return UNAVAILABLE;

  const term = (filter?.q ?? "").trim();
  const status = pickStatus(Constants.public.Enums.report_status, filter?.status);
  const page = pageRange(filter);

  try {
    let select = admin
      .from("reports")
      .select(
        "id, reporter_id, target_type, target_id, category, reason, status, created_at, resolved_at, resolved_by",
      );
    if (term.length > 0) select = select.ilike("reason", `%${term}%`);
    if (status) select = select.eq("status", status);
    if (filter?.from) select = select.gte("created_at", lagosDayStart(filter.from));
    if (filter?.to) select = select.lte("created_at", lagosDayEnd(filter.to));

    const { data, error } = await select
      .order("created_at", { ascending: false })
      .range(page.from, page.to);
    await reportReadError("read.admin.getReports", error);
    if (error) return UNAVAILABLE;

    const { rows, full } = takePage(data ?? []);
    // Reporters and resolvers in one read: both are display names off the same
    // table, and two round trips for one map would be two round trips wasted.
    const peopleIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.reporter_id, row.resolved_by])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const names = new Map<string, string>();
    if (peopleIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", peopleIds);
      for (const profile of profiles ?? []) {
        if (profile.display_name) names.set(profile.id, profile.display_name);
      }
    }

    return {
      state: "ok",
      data: {
        full,
        rows: rows.map((row) => ({
          id: row.id,
          reporterName: names.get(row.reporter_id) ?? "A Vallo member",
          targetType: row.target_type,
          targetId: row.target_id,
          category: row.category,
          reason: row.reason,
          status: row.status,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
          resolvedByName: row.resolved_by ? (names.get(row.resolved_by) ?? null) : null,
        })),
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}

/** ------------------------------------------------------- agent applications */

export type ApplicationView = {
  id: string;
  reference: string;
  status: Database["public"]["Enums"]["agent_application_status"];
  type: Database["public"]["Enums"]["agent_type"];
  fullName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  stateCode: string | null;
  city: string | null;
  idType: string | null;
  idNumber: string | null;
  businessName: string | null;
  businessRc: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  agreedTerms: boolean;
  documentCount: number;
  /**
   * The uploaded documents, each with a short-lived signed URL.
   *
   * The bucket is private, so there is no public URL to fall back on and a
   * reviewer who cannot open the file cannot do the job. `url` is null when the
   * signature could not be minted, which the console says out loud rather than
   * rendering a link that leads nowhere.
   */
  documents: { id: string; kind: string; media: DocumentMedia }[];
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  /** SUP-05: the applicant's answer to a MORE_INFO_REQUIRED note. */
  applicantResponse: string | null;
  createdAt: string;
  /**
   * WHAT THE THREE REGISTRATION FORMS ASK, WHICH THIS DESK NEVER READ.
   *
   * `supply_role` says which door the person came through (owner, agent or
   * firm; null for the older six step form). The owner's one question is what
   * they hold on the property, and the agent's are how long they have done
   * this and what they charge. None of it was selected, so a reviewer
   * deciding an owner saw "Individual agent" and no ownership answer, and
   * deciding an agent never saw the fees the form exists to publish.
   */
  supplyRole: string | null;
  ownershipDocument: string | null;
  area: string | null;
  yearsExperience: string | null;
  agencyFeeBps: number | null;
  legalFeeBps: number | null;
};

const APPLICATION_COLUMNS =
  "id, reference, status, type, full_name, phone, email, residential_address, state_code, city, id_type, id_number, business_name, business_rc, bank_name, account_number, account_name, agree_terms, submitted_at, reviewed_at, review_notes, applicant_response, created_at, supply_role, ownership_document, area, years_experience, agency_fee_bps, legal_fee_bps, agent_documents ( id, kind, storage_path )";

type ApplicationRow = {
  id: string;
  reference: string;
  status: Database["public"]["Enums"]["agent_application_status"];
  type: Database["public"]["Enums"]["agent_type"];
  full_name: string | null;
  phone: string | null;
  email: string | null;
  residential_address: string | null;
  state_code: string | null;
  city: string | null;
  id_type: string | null;
  id_number: string | null;
  business_name: string | null;
  business_rc: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  agree_terms: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  applicant_response: string | null;
  created_at: string;
  supply_role: string | null;
  ownership_document: string | null;
  area: string | null;
  years_experience: string | null;
  agency_fee_bps: number | null;
  legal_fee_bps: number | null;
  agent_documents: { id: string; kind: string; storage_path: string }[];
};

/**
 * Describe each uploaded document, WITHOUT minting a URL for the browser.
 *
 * This used to mint a ten minute signed Supabase Storage URL per document and
 * the desk rendered each one as a chip with `target="_blank"`, so an operator
 * read a NIN slip or a passport on `supabase.co`: another company's origin,
 * another company's tab, outside our content security policy and outside the
 * audit trail, with the live signed link sitting in our DOM where anything
 * could read it and anybody could forward it.
 *
 * No signature reaches a browser now. All this returns is that the document
 * exists and what shape it is, which is what the in-app viewer needs to
 * choose how to draw it. The bytes come from `/api/documents/<id>` on our own
 * origin, behind `requireAdmin`, uncached, one audit row per view.
 *
 * It no longer touches storage, so it cannot fail, so there is nothing left
 * to swallow.
 */
/** How long a reviewer's link to a walkthrough video stays valid. */
const SIGNED_MEDIA_TTL_SECONDS = 600;

function describeDocuments(
  rows: { id: string; kind: string; storage_path: string }[],
): ApplicationView["documents"] {
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    media: documentMedia(row.storage_path),
  }));
}

function toApplicationView(
  row: ApplicationRow,
  documents: ApplicationView["documents"] = [],
): ApplicationView {
  return {
    documents,
    id: row.id,
    reference: row.reference,
    status: row.status,
    type: row.type,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.residential_address,
    stateCode: row.state_code,
    city: row.city,
    idType: row.id_type,
    idNumber: row.id_number,
    businessName: row.business_name,
    businessRc: row.business_rc,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountName: row.account_name,
    agreedTerms: row.agree_terms,
    documentCount: row.agent_documents.length,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    applicantResponse: row.applicant_response,
    createdAt: row.created_at,
    supplyRole: row.supply_role,
    ownershipDocument: row.ownership_document,
    area: row.area,
    yearsExperience: row.years_experience,
    agencyFeeBps: row.agency_fee_bps,
    legalFeeBps: row.legal_fee_bps,
  };
}

export type ApplicationQueue = { waiting: ApplicationView[]; decided: ApplicationView[] };

/**
 * Agent applications, narrowed by the console's shared queue frame.
 *
 * ---------------------------------------------------------------------------
 * TWO BUCKETS, ONE TABLE, AND NO PAGER. THAT IS DELIBERATE.
 *
 * "Waiting on us" and "recently decided" are not two pages of one list, they
 * are two questions, ordered by two different columns (`submitted_at` and
 * `reviewed_at`) and capped at thirty and ten on purpose. A single cursor
 * cannot walk two independently-ordered reads, and offering Next would have to
 * mean "next page of whichever one you were looking at", which is a control
 * that does a different thing depending on where the reader's eye was. So this
 * queue gets the search, the status chips and the date range, which is what an
 * operator asked for, and does not get a pager, which would be a lie about what
 * the read knows.
 *
 * THE SEARCH IS OVER THE NAMES A REVIEWER HAS. `full_name` and `business_name`,
 * joined with `.or()`. Not the email, because an application's email is on the
 * auth user rather than on this row, and not the id, because an id is how you
 * find a row you already have.
 *
 * THE STATUS CHIP NARROWS BOTH BUCKETS, and one of them always empties, because
 * every value of `agent_application_status` belongs to exactly one bucket. That
 * reads correctly: choosing REJECTED empties "waiting" and leaves the rejected
 * ones under "recently decided". The page suppresses the per-section empty
 * copy when a filter is on, so nothing says "nothing is waiting" to somebody
 * who has just asked to see decided rows.
 */
export async function getAgentApplications(
  filter?: AdminQueueFilter,
): Promise<AdminRead<ApplicationQueue>> {
  const admin = await adminClient("kyc_review");
  if (!admin) return UNAVAILABLE;

  /* Stripped of the characters PostgREST's `or` grammar reads as structure: a
     comma would split one condition into two and a bracket would open a group,
     so an unsanitised name with a comma in it produces a filter the database
     rejects rather than a search. */
  const term = (filter?.q ?? "").replace(/[,()*"\\]/g, "").trim();
  const status = pickStatus(Constants.public.Enums.agent_application_status, filter?.status);
  type ApplicationStatus = Database["public"]["Enums"]["agent_application_status"];

  const waitingStatuses = ["SUBMITTED", "UNDER_REVIEW", "MORE_INFO_REQUIRED"] as const;
  const decidedStatuses = ["APPROVED", "REJECTED", "SUSPENDED"] as const;
  /* Generic over the literal union so the `.in()` below keeps its type: a
     `string[]` here would force a cast at the call site and throw away the one
     check that stops a bucket naming a status the column does not have. */
  const inBucket = <T extends ApplicationStatus>(bucket: readonly T[]): T[] =>
    status ? bucket.filter((value) => value === status) : [...bucket];

  try {
    const narrow = <T extends { or: (f: string) => T; gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(
      builder: T,
    ): T => {
      let next = builder;
      if (term.length > 0) {
        next = next.or(`full_name.ilike.${orSafe(`%${term}%`)},business_name.ilike.${orSafe(`%${term}%`)}`);
      }
      if (filter?.from) next = next.gte("created_at", lagosDayStart(filter.from));
      if (filter?.to) next = next.lte("created_at", lagosDayEnd(filter.to));
      return next;
    };

    const [waiting, decided] = await Promise.all([
      narrow(
        admin
          .from("agent_applications")
          .select(APPLICATION_COLUMNS)
          .in("status", inBucket(waitingStatuses)),
      )
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(30),
      narrow(
        admin
          .from("agent_applications")
          .select(APPLICATION_COLUMNS)
          .in("status", inBucket(decidedStatuses)),
      )
        .order("reviewed_at", { ascending: false, nullsFirst: false })
        .limit(10),
    ]);
    await reportReadError("read.admin.getAgentApplications", waiting.error, decided.error);
    if (waiting.error || decided.error) return UNAVAILABLE;

    /* Described rather than signed: nothing here touches storage any more, so
       there is no per-application failure left to isolate and no await. */
    const withDocuments = (rows: ApplicationRow[]): ApplicationView[] =>
      rows.map((row) => toApplicationView(row, describeDocuments(row.agent_documents)));

    return {
      state: "ok",
      data: {
        waiting: withDocuments(waiting.data ?? []),
        decided: withDocuments(decided.data ?? []),
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}

/** ----------------------------------------------------------------- listings */

export type { QualityCheck } from "./listing-checks";

export type ListingReviewView = {
  id: string;
  /**
   * The code a person reads out. Null until the listing is published, because
   * the database issues it at that moment and not before.
   */
  reference: string | null;
  title: string;
  status: Database["public"]["Enums"]["listing_status"];
  propertyType: Database["public"]["Enums"]["property_type"];
  /** To let, or for sale. Decides which money block the reviewer is shown. */
  intent: Database["public"]["Enums"]["listing_intent"];
  /** The unit the headline figure is quoted in, or "sale" for an asking price. */
  pricePeriod: PricePeriod | "sale";
  priceMinor: number;
  /** The rent breakdown, present only on a tenancy that stated any of it. */
  moveIn: { parts: MoveInPart[]; totalMinor: number; totalStated: boolean } | null;
  /**
   * What a buyer actually pays, present only on a sale that stated any of it.
   *
   * The reviewer approving a sale listing is the last person who can catch an
   * asking price with twenty million naira of consent, stamp duty and agency
   * hiding behind it.
   */
  purchase: { parts: MoveInPart[]; totalMinor: number; totalStated: boolean } | null;
  /** The title being transferred, present only on a sale. */
  tenure: Database["public"]["Enums"]["land_tenure"] | null;
  saleStatus: Database["public"]["Enums"]["sale_status"] | null;
  city: string | null;
  area: string | null;
  stateCode: string | null;
  address: string | null;
  description: string | null;
  bedrooms: number;
  bathrooms: number;
  agentName: string | null;
  photos: string[];
  /**
   * THE WALKTHROUGHS, SIGNED.
   *
   * `listing-videos` is a private bucket, so a reviewer cannot watch one from
   * a public URL. The signing is batched for the whole queue in one storage
   * call, the same shape the agent document read already uses.
   */
  videos: { url: string | null; posterUrl: string | null; durationSeconds: number | null; position?: number }[];
  /**
   * WHAT THE LISTER ACTUALLY ANSWERED ABOUT LIGHT AND WATER.
   *
   * The pipeline audit section 2.4: this read named neither the power nor the
   * water columns, so a reviewer was approving "Band A, eighteen hours of
   * generator" without ever being shown it, on a market where the utilities
   * are the part that decides whether anybody wants the place.
   */
  utilities: {
    powerGrid: Database["public"]["Enums"]["power_grid"] | null;
    powerBackup: Database["public"]["Enums"]["power_backup"] | null;
    powerBackupHours: number | null;
    waterSupply: Database["public"]["Enums"]["water_supply"] | null;
    prepaidMeter: boolean | null;
  };
  /**
   * The physical facts. `sizeSqm` is the whole specification of a plot of
   * land, so a land submission cannot be judged without it.
   */
  facts: {
    sizeSqm: number | null;
    toilets: number | null;
    parkingSpaces: number | null;
    floor: number | null;
    totalFloors: number | null;
    condition: Database["public"]["Enums"]["build_condition"] | null;
    yearBuilt: number | null;
    furnished: Database["public"]["Enums"]["furnishing"] | null;
  };
  /**
   * The gate, which a lister fills in privately and which never reaches a
   * public page. The reviewer sees THAT it was answered and not WHAT was
   * answered: the security desk number and the access code are the keys to
   * somebody's home, and a console does not need them to judge a listing.
   */
  access: { estateName: string | null; answered: number };
  amenityCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** The FIRST time it went live (kept across a re-publish); null when it never has. Dates the status track's Live step. */
  publishedAt?: string | null;
  reviewNotes: string | null;
  createdAt: string;
  checks: QualityCheck[];
  /** V-28: the compound's five answers, read on their own. Null: none, or unreadable. */
  compound?: Compound | null;
};

const LISTING_COLUMNS =
  "id, reference, title, status, property_type, listing_intent, rent_amount_minor, rent_period, rate_minor, rate_period, sale_price_minor, tenure, sale_status, caution_deposit_minor, service_charge_minor, service_charge_period, agency_fee_minor, legal_fee_minor, agreement_fee_minor, total_move_in_cost_minor, city, area, state_code, address, description, bedrooms, bathrooms, submitted_at, reviewed_at, published_at, review_notes, created_at, sale_agency_fee_minor, sale_legal_fee_minor, governors_consent_fee_minor, stamp_duty_minor, survey_registration_fee_minor, total_purchase_cost_minor, power_grid, power_backup, power_backup_hours, water_supply, prepaid_meter, size_sqm, toilets, parking_spaces, floor, total_floors, condition, year_built, furnished, agents!listings_agent_id_fkey( display_name ), listing_photos ( storage_path, position ), listing_videos ( storage_path, poster_path, duration_seconds, position ), listing_amenities ( amenity_id ), listing_access ( estate_name, gate_directions, security_phone, access_code )";

type ListingRow = {
  id: string;
  reference: string | null;
  title: string;
  status: Database["public"]["Enums"]["listing_status"];
  property_type: Database["public"]["Enums"]["property_type"];
  listing_intent: Database["public"]["Enums"]["listing_intent"];
  rent_amount_minor: number | null;
  rent_period: Database["public"]["Enums"]["rent_period"] | null;
  rate_minor: number;
  rate_period: Database["public"]["Enums"]["rate_period"] | null;
  sale_price_minor: number | null;
  tenure: Database["public"]["Enums"]["land_tenure"] | null;
  sale_status: Database["public"]["Enums"]["sale_status"] | null;
  caution_deposit_minor: number | null;
  service_charge_minor: number | null;
  service_charge_period: Database["public"]["Enums"]["rent_period"] | null;
  agency_fee_minor: number | null;
  legal_fee_minor: number | null;
  agreement_fee_minor: number | null;
  total_move_in_cost_minor: number | null;
  city: string | null;
  area: string | null;
  state_code: string | null;
  address: string | null;
  description: string | null;
  bedrooms: number;
  bathrooms: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  review_notes: string | null;
  created_at: string;
  sale_agency_fee_minor: number | null;
  sale_legal_fee_minor: number | null;
  governors_consent_fee_minor: number | null;
  stamp_duty_minor: number | null;
  survey_registration_fee_minor: number | null;
  total_purchase_cost_minor: number | null;
  power_grid: Database["public"]["Enums"]["power_grid"] | null;
  power_backup: Database["public"]["Enums"]["power_backup"] | null;
  power_backup_hours: number | null;
  water_supply: Database["public"]["Enums"]["water_supply"] | null;
  prepaid_meter: boolean | null;
  size_sqm: number | null;
  toilets: number | null;
  parking_spaces: number | null;
  floor: number | null;
  total_floors: number | null;
  condition: Database["public"]["Enums"]["build_condition"] | null;
  year_built: number | null;
  furnished: Database["public"]["Enums"]["furnishing"] | null;
  agents: { display_name: string } | null;
  listing_photos: { storage_path: string; position: number }[];
  listing_videos: {
    storage_path: string;
    poster_path: string | null;
    duration_seconds: number | null;
    position: number;
  }[];
  listing_amenities: { amenity_id: string }[];
  listing_access: {
    estate_name: string | null;
    gate_directions: string | null;
    security_phone: string | null;
    access_code: string | null;
  } | null;
};

/* The admission checklist lives in `./listing-checks`, measured the way the
   lister's own submit gate measured the submission. */

function photoUrl(admin: SupabaseClient<Database>, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return admin.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
}

/**
 * The walkthroughs for a whole queue, signed in one storage call.
 *
 * `listing-videos` is private and the reviewer is the first human in the
 * product who can watch one, so this is where the signing starts. A failure to
 * sign resolves to a null url rather than to an error: a queue that cannot be
 * worked because storage was slow is worse than a card that says the
 * walkthrough could not be loaded.
 */
async function signListingVideos(
  admin: SupabaseClient<Database>,
  rows: ListingRow[],
): Promise<Map<string, string>> {
  const paths = [...new Set(rows.flatMap((row) => row.listing_videos.map((v) => v.storage_path)))];
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  try {
    const { data } = await admin.storage
      .from("listing-videos")
      .createSignedUrls(paths, SIGNED_MEDIA_TTL_SECONDS);
    paths.forEach((path, index) => {
      const url = data?.[index]?.signedUrl;
      if (url) signed.set(path, url);
    });
  } catch {
    /* Nothing signed, every card says so in words. */
  }
  return signed;
}

function toListingView(
  admin: SupabaseClient<Database>,
  row: ListingRow,
  signedVideos: Map<string, string>,
): ListingReviewView {
  const headline = headlinePrice(row);
  const parts = moveInParts(row);
  const total = moveInTotal(row);
  const buying = purchaseParts(row);
  const buyingTotal = purchaseTotal(row);
  const photos = [...row.listing_photos]
    .sort((a, b) => a.position - b.position)
    .map((photo) => photoUrl(admin, photo.storage_path));

  const videos = [...row.listing_videos]
    .sort((a, b) => a.position - b.position)
    .map((video) => ({
      url: signedVideos.get(video.storage_path) ?? null,
      /* The poster lives in the PUBLIC photo bucket, so it needs no signature
         and keeps working after the video URL expires. */
      posterUrl: video.poster_path ? photoUrl(admin, video.poster_path) : null,
      durationSeconds: video.duration_seconds,
      position: video.position,
    }));

  const access = row.listing_access;
  const answered = [
    access?.estate_name,
    access?.gate_directions,
    access?.security_phone,
    access?.access_code,
  ].filter((value) => Boolean(value && value.trim())).length;

  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    propertyType: row.property_type,
    intent: row.listing_intent,
    pricePeriod: headlinePeriod(headline),
    priceMinor: headline.minor,
    moveIn:
      row.listing_intent === "sale" || parts.length === 0
        ? null
        : { parts, totalMinor: total.minor, totalStated: total.stated },
    /* The mirror image: only on a sale, and only when something was stated.
       A sale that named nothing but its price draws nothing rather than a
       breakdown of one row. */
    purchase:
      row.listing_intent !== "sale" || buying.length < 2
        ? null
        : { parts: buying, totalMinor: buyingTotal.minor, totalStated: buyingTotal.stated },
    tenure: row.tenure,
    saleStatus: row.sale_status,
    city: row.city,
    area: row.area,
    stateCode: row.state_code,
    address: row.address,
    description: row.description,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    agentName: row.agents?.display_name ?? null,
    photos,
    videos,
    utilities: {
      powerGrid: row.power_grid,
      powerBackup: row.power_backup,
      powerBackupHours: row.power_backup_hours,
      waterSupply: row.water_supply,
      prepaidMeter: row.prepaid_meter,
    },
    facts: {
      sizeSqm: row.size_sqm,
      toilets: row.toilets,
      parkingSpaces: row.parking_spaces,
      floor: row.floor,
      totalFloors: row.total_floors,
      condition: row.condition,
      yearBuilt: row.year_built,
      furnished: row.furnished,
    },
    /* The estate NAME is a public-shaped fact and the other three are keys to
       a home. Only the name and a count of what was answered cross into the
       console. */
    access: { estateName: access?.estate_name ?? null, answered },
    amenityCount: row.listing_amenities.length,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    checks: qualityChecks(row),
  };
}

export type ListingQueue = {
  waiting: ListingReviewView[];
  decided: ListingReviewView[];
  /**
   * True when there is another page of WAITING work behind this one.
   *
   * Only the waiting bucket pages, and the note above `getListingSubmissions`
   * says why the other one does not.
   */
  full: boolean;
};

/**
 * Listing submissions, narrowed by the console's shared queue frame.
 *
 * The same two-bucket shape as `getAgentApplications`: a search, a status chip
 * row and a date range.
 *
 * ONLY THE WAITING BUCKET PAGES, AND IT HAD TO START. This read was capped at
 * thirty waiting rows with no pager at all, so at the thirty-first submitted
 * listing one became invisible to the reviewer, with nothing on the screen to
 * say a row had been dropped. That is the worst shape a queue can have: a
 * console that is wrong about how much work is waiting is worse than one that
 * does not say.
 *
 * The old note argued there could be no pager because the two buckets are
 * ordered by two different columns and one cursor cannot walk both. That is
 * true of walking BOTH, and it was the wrong conclusion. "Recently decided" is
 * a glance backwards and ten rows is all it was ever meant to be; "waiting on
 * us" is the work, and the work is what has to be reachable. So one offset
 * walks the waiting bucket and the decided list stays exactly as it was.
 *
 * The search is over the title and the city, which is how a reviewer describes
 * a listing to a colleague: "the Lekki three-bed". Not the address, which is
 * the one field on this row that identifies somebody's home rather than a
 * property, and putting it behind a free-text search on an operator console is
 * a wider exposure than a queue needs.
 */
export async function getListingSubmissions(
  filter?: AdminQueueFilter,
): Promise<AdminRead<ListingQueue>> {
  const admin = await adminClient("listing_approval");
  if (!admin) return UNAVAILABLE;

  const term = (filter?.q ?? "").replace(/[,()*"\\]/g, "").trim();
  const status = pickStatus(Constants.public.Enums.listing_status, filter?.status);
  const page = pageRange(filter);
  type ListingStatus = Database["public"]["Enums"]["listing_status"];
  const inBucket = <T extends ListingStatus>(bucket: readonly T[]): T[] =>
    status ? bucket.filter((value) => value === status) : [...bucket];

  const waitingStatuses = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "MORE_INFO_REQUIRED",
  ] as const;
  const decidedStatuses = ["PUBLISHED", "REJECTED", "SUSPENDED"] as const;

  try {
    const narrow = <T extends { or: (f: string) => T; gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(
      builder: T,
    ): T => {
      let next = builder;
      if (term.length > 0) next = next.or(`title.ilike.${orSafe(`%${term}%`)},city.ilike.${orSafe(`%${term}%`)}`);
      if (filter?.from) next = next.gte("created_at", lagosDayStart(filter.from));
      if (filter?.to) next = next.lte("created_at", lagosDayEnd(filter.to));
      return next;
    };

    const [waiting, decided] = await Promise.all([
      narrow(
        admin.from("listings").select(LISTING_COLUMNS).in("status", inBucket(waitingStatuses)),
      )
        .order("submitted_at", { ascending: false, nullsFirst: false })
        /* One row more than the page, so `takePage` can tell "there is another
           page" from "this is the last one" with no second count query. */
        .range(page.from, page.to),
      (() => {
        const decidedQuery = narrow(
          admin.from("listings").select(LISTING_COLUMNS).in("status", inBucket(decidedStatuses)),
        );
        /* V-48: a closed listing is SUSPENDED underneath and is neither a
           suspension nor a reviewer's decision, so the decided list (the
           Suspended tab and the All tab's "recently decided" alike) leaves it
           out in the query itself, before the limit, never after it. */
        return decidedQuery
          .is("closed_at", null)
          .order("reviewed_at", { ascending: false, nullsFirst: false })
          .limit(10);
      })(),
    ]);
    await reportReadError("read.admin.getListingSubmissions", waiting.error, decided.error);
    if (waiting.error || decided.error) return UNAVAILABLE;

    const waitingPage = takePage((waiting.data ?? []) as ListingRow[]);
    const rows = [...waitingPage.rows, ...((decided.data ?? []) as ListingRow[])];
    const [signedVideos, compounds] = await Promise.all([
      signListingVideos(admin, rows),
      readCompounds(admin, rows.map((row) => row.id)),
    ]);
    /* V-28 review: the reviewer sees the compound answers the renter will. */
    const view = (row: ListingRow) => ({
      ...toListingView(admin, row, signedVideos),
      compound: compounds.get(row.id) ?? null,
    });

    return {
      state: "ok",
      data: {
        waiting: waitingPage.rows.map(view),
        decided: ((decided.data ?? []) as ListingRow[]).map(view),
        full: waitingPage.full,
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * The compound answers for a page of listings (V-28), by their own read so a
 * database without migration `20260924150200` still loads the queue.
 */
async function readCompounds(admin: SupabaseClient<Database>, ids: string[]): Promise<Map<string, Compound>> {
  const out = new Map<string, Compound>();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await admin.from("listings").select(`id, ${COMPOUND_COLUMNS}`).in("id", ids);
    await reportReadError("read.admin.readCompounds", error);
    if (error || !data) return out;
    for (const row of data as unknown as (CompoundRow & { id: string })[]) {
      const compound = readCompound(row);
      if (compound) out.set(row.id, compound);
    }
  } catch {
    /* No answers shown is the honest result of a read that failed. */
  }
  return out;
}

/** ---------------------------------------------------------- support tickets */

export type TicketMessageView = {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
};

export type TicketView = {
  id: string;
  reference: string;
  name: string;
  email: string;
  topic: string | null;
  body: string;
  status: Database["public"]["Enums"]["support_ticket_status"];
  hasAccount: boolean;
  /** The member's account, when the ticket came from one (for internal notes). */
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
};

/**
 * Support tickets, narrowed by the console's shared queue frame.
 *
 * The search is over the reference and the email address, joined with `.or()`,
 * because those are the two things a person on the phone can read out. The term
 * is stripped of the characters PostgREST's `or` grammar treats as structure -
 * a comma would split one condition into two, a bracket would open a group -
 * before it is interpolated, so a search for "a,b" looks for "ab" rather than
 * producing a filter the database rejects.
 */
export async function getSupportTickets(
  filter?: AdminQueueFilter,
): Promise<AdminRead<{ rows: TicketView[]; full: boolean }>> {
  const admin = await adminClient("support");
  if (!admin) return UNAVAILABLE;

  const term = (filter?.q ?? "").replace(/[,()*"\\]/g, "").trim();
  const status = pickStatus(Constants.public.Enums.support_ticket_status, filter?.status);
  const page = pageRange(filter);

  try {
    let select = admin
      .from("support_tickets")
      .select(
        "id, reference, name, email, topic, body, status, user_id, created_at, updated_at, support_ticket_messages ( id )",
      );
    if (term.length > 0) {
      select = select.or(`reference.ilike.${orSafe(`%${term}%`)},email.ilike.${orSafe(`%${term}%`)}`);
    }
    if (status) select = select.eq("status", status);
    if (filter?.from) select = select.gte("created_at", lagosDayStart(filter.from));
    if (filter?.to) select = select.lte("created_at", lagosDayEnd(filter.to));

    /* DB2: queue_at is generated as coalesce(last_member_reply_at, created_at),
       so a ticket rises when it is filed or its member replies (trigger
       support_ticket_messages_member_replied) and never because the desk
       edited it; created_at breaks ties. */
    const { data, error } = await select
      .order("queue_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(page.from, page.to);
    await reportReadError("read.admin.getSupportTickets", error);
    if (error) return UNAVAILABLE;

    const { rows, full } = takePage(data ?? []);

    return {
      state: "ok",
      data: {
        full,
        rows: rows.map((row) => ({
          id: row.id,
          reference: row.reference,
          name: row.name,
          email: row.email,
          topic: row.topic,
          body: row.body,
          status: row.status,
          hasAccount: row.user_id !== null,
          userId: row.user_id ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          replyCount: row.support_ticket_messages.length,
        })),
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}

export async function getTicketThread(
  ticketId: string,
): Promise<AdminRead<TicketMessageView[]>> {
  const admin = await adminClient("support");
  if (!admin) return UNAVAILABLE;

  try {
    const { data, error } = await admin
      .from("support_ticket_messages")
      .select("id, sender_role, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(100);
    await reportReadError("read.admin.getTicketThread", error);
    if (error) return UNAVAILABLE;

    return {
      state: "ok",
      data: (data ?? []).map((row) => ({
        id: row.id,
        senderRole: row.sender_role,
        body: row.body,
        createdAt: row.created_at,
      })),
    };
  } catch {
    return UNAVAILABLE;
  }
}

/** ------------------------------------------------------------ kill switches */

export type SwitchView = {
  key: string;
  enabled: boolean;
  note: string | null;
  updatedAt: string;
};

export async function getFeatureFlags(): Promise<AdminRead<SwitchView[]>> {
  const admin = await adminClient();
  if (!admin) return UNAVAILABLE;

  try {
    const { data, error } = await admin
      .from("feature_flags")
      .select("key, enabled, note, updated_at")
      .order("key", { ascending: true });
    await reportReadError("read.admin.getFeatureFlags", error);
    if (error) return UNAVAILABLE;

    return {
      state: "ok",
      data: (data ?? []).map((row) => ({
        key: row.key,
        enabled: row.enabled,
        note: row.note,
        updatedAt: row.updated_at,
      })),
    };
  } catch {
    return UNAVAILABLE;
  }
}

/** ------------------------------------------------------- inventory drift */

/**
 * Is this alert the nightly drift sweep's?
 *
 * `risk_alerts` carries no `kind` column. The alerts writer in `lib/alerts`
 * (BC's, per the ledger's cron alerting contract) files a job's kind on
 * `entity_type`, and this is the one place the console reads it back, so if
 * the writer ever spells it differently this predicate is the whole of the
 * change. The title fallback covers a row written by hand while the writer
 * was still landing.
 */
export function isInventoryDriftAlert(row: {
  entityType: string | null;
  title: string;
}): boolean {
  if ((row.entityType ?? "").trim().toLowerCase() === "inventory_drift") return true;
  return /\binventory\s+drift\b/i.test(row.title);
}

export type DriftAlerts = {
  /** Open drift findings, oldest first: the one that has waited longest is first. */
  open: AlertView[];
  /** Everything else the sweep has ever filed, newest first, one page. */
  resolvedCount: number;
};

const DRIFT_LIMIT = 40;

/**
 * The inventory drift findings, on their own, above the general queue.
 *
 * A drift row is a room-night the calendar and the bookings disagree about,
 * and it is the one alert kind that gets worse by the hour: every hour it
 * sits, another guest can book a night that is not there. So the alerts
 * desk shows them first, with the ids the sweep wrote, whatever the general
 * queue is narrowed to.
 */
export async function getInventoryDriftAlerts(): Promise<AdminRead<DriftAlerts>> {
  const admin = await adminClient("operations");
  if (!admin) return UNAVAILABLE;

  try {
    const [openRes, resolvedRes] = await Promise.all([
      admin
        .from("risk_alerts")
        .select(
          "id, severity, status, title, description, entity_type, entity_id, created_at, resolved_at, resolved_by",
        )
        .eq("status", "open")
        .or("entity_type.eq.inventory_drift,title.ilike.%inventory drift%")
        .order("created_at", { ascending: true })
        .limit(DRIFT_LIMIT),
      admin
        .from("risk_alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "resolved")
        .or("entity_type.eq.inventory_drift,title.ilike.%inventory drift%"),
    ]);
    await reportReadError("read.admin.getInventoryDriftAlerts", openRes.error, resolvedRes.error);
    if (openRes.error || resolvedRes.error) return UNAVAILABLE;

    const open: AlertView[] = (openRes.data ?? [])
      .map((row) => ({
        id: row.id,
        severity: row.severity,
        status: row.status,
        title: row.title,
        description: row.description,
        entityType: row.entity_type,
        entityId: row.entity_id,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        resolvedByName: null,
      }))
      .filter(isInventoryDriftAlert);

    return { state: "ok", data: { open, resolvedCount: resolvedRes.count ?? 0 } };
  } catch {
    return UNAVAILABLE;
  }
}

/** ----------------------------------------------------------- user lookup */

/** How an operator identified a person. */
export type SubjectLookupKind = "handle" | "email" | "id";

export type AdminSubject = {
  userId: string;
  handle: string | null;
  displayName: string | null;
};

export type SubjectLookup =
  | { state: "found"; by: SubjectLookupKind; subject: AdminSubject }
  | { state: "none"; by: SubjectLookupKind }
  /*
   * Email lookup needs `public.admin_user_id_by_email`, a B7 migration the
   * lead applies. Until it is applied the console says so rather than
   * answering "nobody has that address", which would be a lie about a person.
   */
  | { state: "email-unavailable" };

/**
 * What kind of thing the operator typed. Exported for its test.
 *
 * An `@` in the middle is an address; a leading `@` or a bare word is a
 * handle; a uuid is an id. Handles are lower-cased the way the platform
 * stores them, addresses the way GoTrue matches them.
 */
export function classifySubjectTerm(
  raw: string,
): { by: SubjectLookupKind; value: string } | null {
  const term = raw.trim();
  if (term.length === 0) return null;
  if (UUID_RE.test(term)) return { by: "id", value: term.toLowerCase() };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(term)) return { by: "email", value: term.toLowerCase() };
  const handle = term.replace(/^@/, "").toLowerCase();
  if (/^[a-z0-9_.-]{2,40}$/.test(handle)) return { by: "handle", value: handle };
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcCaller = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string | null; code?: string | null } | null }>;
};

/**
 * A person, from a handle, an email address or an id.
 *
 * profiles carries no email by design, so an address resolves through the
 * SECURITY DEFINER function the B7 migration adds, which re-proves the admin
 * role at its own boundary and returns an id or nothing. Called with the
 * operator's own client, so a revoked role is a refusal.
 */
export async function findAdminSubject(raw: string): Promise<AdminRead<SubjectLookup | null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return UNAVAILABLE;

  const classified = classifySubjectTerm(raw);
  if (!classified) return { state: "ok", data: null };
  const { by, value } = classified;

  let admin: SupabaseClient<Database>;
  try {
    admin = createAdminClient();
  } catch {
    return UNAVAILABLE;
  }

  try {
    let userId: string | null = null;

    if (by === "id") {
      userId = value;
    } else if (by === "handle") {
      const { data, error } = await admin
        .from("social_profiles")
        .select("user_id")
        .eq("handle", value)
        .maybeSingle();
      await reportReadError("read.admin.findAdminSubject", error);
      if (error) return UNAVAILABLE;
      userId = data?.user_id ?? null;
    } else {
      const caller = access.supabase as unknown as RpcCaller;
      const { data, error } = await caller.rpc("admin_user_id_by_email", { p_email: value });
      /* 42883 is "function does not exist": the migration has not been applied. */
      if (error) {
        if (error.code === "42883" || error.code === "PGRST202") {
          return { state: "ok", data: { state: "email-unavailable" } };
        }
        /* The pending migration above is expected and said on screen; anything else is a fault. */
        await reportReadError("read.admin.findAdminSubject", error);
        return UNAVAILABLE;
      }
      userId = typeof data === "string" && UUID_RE.test(data) ? data : null;
    }

    if (!userId) return { state: "ok", data: { state: "none", by } };

    const [profileRes, socialRes] = await Promise.all([
      admin.from("profiles").select("id, display_name").eq("id", userId).maybeSingle(),
      admin.from("social_profiles").select("handle").eq("user_id", userId).maybeSingle(),
    ]);
    await reportReadError("read.admin.findAdminSubject", profileRes.error);
    if (profileRes.error) return UNAVAILABLE;
    if (!profileRes.data) return { state: "ok", data: { state: "none", by } };

    return {
      state: "ok",
      data: {
        state: "found",
        by,
        subject: {
          userId,
          handle: socialRes.data?.handle ?? null,
          displayName: profileRes.data.display_name,
        },
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}
