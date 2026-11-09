import "server-only";

import { businessNamesMatch, namesMatch } from "@/lib/identity/name-match";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Constants, type Database } from "../supabase/database.types";
import { documentMedia, type DocumentMedia } from "./documents";
import { requireAdmin } from "./guard";
import { createAdminClient } from "../supabase/admin";
import { lagosDayEnd, lagosDayStart, pickStatus, type AdminQueueFilter } from "./queue-filter";
import type { AdminRead } from "./money-queries";
import { personName, type ConsentRow } from "./member-file-rules";

/**
 * The verification review queue.
 *
 * A reviewer could see that an agent had uploaded documents and had nowhere to
 * record a decision about any individual one. Approving somebody meant
 * approving their whole application on the strength of a thumbnail. This is the
 * read half of fixing that: every document waiting, openable in place, and
 * the ladder rung it belongs to beside it.
 *
 * THE PRIVATE BUCKET IS THE POINT, AND IT IS NO LONGER SIGNED FOR A BROWSER.
 * agent-documents is private, correctly: these objects are driving licences,
 * NIN slips and CAC certificates. This file used to mint a ten minute signed
 * URL per document and hand it to the page, which opened it in a new tab on
 * `supabase.co`. It now hands out no URL at all. See the note where
 * `signDocuments` used to stand, and `app/api/documents/[id]/route.ts`.
 */

const UNAVAILABLE = { state: "unavailable" } as const;

/** A proof of address older than this is refused. The rule, stated once. */
export const ADDRESS_PROOF_MAX_AGE_DAYS = 92;

export type KycDocumentView = {
  id: string;
  /** identity, address or business. The category the ladder keys off. */
  kind: string;
  /** Which document specifically, when the uploader said. */
  subtype: string | null;
  reviewStatus: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  issuedOn: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  /**
   * How the in-app viewer should draw this one, decided from the stored path.
   *
   * THIS USED TO BE A SIGNED SUPABASE URL and the desk rendered it in an
   * anchor with `target="_blank"`, so a reviewer read somebody's NIN on
   * `supabase.co` and the signed link sat in our DOM where it could be
   * forwarded. The browser is told the document EXISTS and what shape it is;
   * the bytes come from `/api/documents/<id>` on our own origin.
   */
  media: DocumentMedia;
  /** Grade 1: how to draw the back of a two-sided ID, or null when none was filed. */
  backMedia: DocumentMedia | null;
  /** Grade 1: the ISO code of the country that issued an ID, when the flow asked. */
  issuingCountry: string | null;
  /** True when this replaces an earlier attempt. */
  isResubmission: boolean;
  /** The name as printed on an approved ID, typed by the reviewer. Null otherwise. */
  nameOnDocument: string | null;
  /** True for a selfie sent back because a reviewer asked for one holding the ID. */
  answersRequest: boolean;
  /**
   * True when a proof of address states an issue date older than the rule
   * allows, or states none at all. Computed rather than stored, because the
   * rule is about the age of the document at the moment somebody looks at it.
   */
  tooOld: boolean;
};

export type KycSubjectView = {
  userId: string | null;
  displayName: string | null;
  applicationId: string | null;
  applicationReference: string | null;
  agentId: string | null;
  /** Where they stand on the four rung ladder, 0 to 4. */
  tier: number;
  /** Rungs recorded, including the pending ones an automated check produced. */
  rungs: { kind: string; status: string; note: string | null; decidedAt: string }[];
  business: {
    name: string | null;
    registrationNumber: string | null;
    taxId: string | null;
    email: string | null;
    phone: string | null;
    establishedOn: string | null;
    address: string | null;
  } | null;
  documents: KycDocumentView[];
  /**
   * V-49: THE NIGERIAN-NAME MATCHER'S SUGGESTION FOR THE PAYOUT RUNG. The
   * bank's holder name for the agent's payout account against the name on the
   * application (and the registered business name, for a firm), by the rule in
   * `lib/identity/name-match.ts`: titles stripped, order ignored, a missing
   * middle name forgiven. A SUGGESTION for the person deciding, never a
   * decision: the rung is still passed or failed by a human. Null when there
   * is no resolved payout name or no application name to compare.
   */
  payoutNameCheck: { match: boolean; reason: string; holder: string; onRecord: string } | null;
  /**
   * The names a reviewer compares with the ID (manual verification,
   * 2 November 2026): the legal name the person gave when signing up, and the
   * name on their application, if they filed one.
   */
  namesOnRecord: { account: string | null; application: string | null };
  /** The name printed on their approved ID, once a reviewer has typed it. */
  identityName: string | null;
  /** The latest request for a selfie holding their ID, if a reviewer made one. */
  request: { status: "open" | "answered" | "closed"; message: string; requestedAt: string; answeredAt: string | null } | null;
  /**
   * The consent receipt: every agreement this person gave on `/verification`
   * (`kyc_consents`: accuracy, terms, processing), newest first. A reviewer
   * approves nothing a person did not agree to have checked, so the receipt
   * sits beside the documents. Empty for documents filed by an older path
   * that recorded no consent, which the card says in words.
   */
  consents: ConsentRow[];
  /** False when the consent read failed, so the card says so instead of "none recorded". */
  consentsRead: boolean;
};

export type KycQueue = {
  waiting: KycSubjectView[];
  decided: KycSubjectView[];
  pendingCount: number;
};

const DOCUMENT_COLUMNS =
  "id, application_id, uploader_id, kind, subtype, storage_path, back_storage_path, issuing_country, issued_on, review_status, rejection_reason, reviewed_by, reviewed_at, supersedes_id, uploaded_at";

function isTooOld(kind: string, issuedOn: string | null): boolean {
  if (kind !== "address") return false;
  if (!issuedOn) return true;
  const parsed = Date.parse(`${issuedOn}T12:00:00+01:00`);
  if (Number.isNaN(parsed)) return true;
  return Date.now() - parsed > ADDRESS_PROOF_MAX_AGE_DAYS * 86_400_000;
}

/**
 * Everything waiting on a human, grouped by the person it is about.
 *
 * Grouped rather than listed flat, because a reviewer's actual unit of work is
 * a PERSON: approving somebody's passport while their proof of address sits in
 * a different part of a long list is how one person ends up half verified for a
 * week. The subject carries their ladder and their business details, so the
 * decision is taken with everything in view.
 */
/*
 * NARROWED BY STATUS AND BY DATE, AND DELIBERATELY NOT BY FREE TEXT.
 *
 * The other queues in this console search the field an operator recognises a
 * row by. Here that field is the SUBJECT'S NAME, and the name is not on
 * `agent_documents`: it is resolved afterwards, from `profiles`, through either
 * the document's uploader or the application it was filed against, which are
 * two different paths because the older shape used the second. A search that
 * pre-resolved names would have to walk both paths to be correct, and one that
 * walked only the first would silently miss every document filed under the
 * older shape, which is exactly the kind of quiet wrongness a reviewer cannot
 * see and cannot correct for.
 *
 * Post-filtering the grouped subjects is the other option and it is the fault
 * this whole sprint item is about: it searches only what the 300-row cap
 * already returned. So this queue gets the two narrowings that can be pushed
 * into the query honestly and does not get the one that cannot. Making it
 * searchable properly means a name column on the document row or a view that
 * joins one, which is a schema question.
 */
export async function getKycQueue(filter?: AdminQueueFilter): Promise<AdminRead<KycQueue>> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return UNAVAILABLE;

  const review = pickStatus(Constants.public.Enums.document_review_status, filter?.status);

  try {
    let select = access.supabase.from("agent_documents").select(DOCUMENT_COLUMNS);
    if (review) select = select.eq("review_status", review);
    if (filter?.from) select = select.gte("uploaded_at", lagosDayStart(filter.from));
    if (filter?.to) select = select.lte("uploaded_at", lagosDayEnd(filter.to));

    const { data: docs, error } = await select
      .order("uploaded_at", { ascending: false })
      .limit(300);
    if (error) return UNAVAILABLE;

    const documents = docs ?? [];
    if (documents.length === 0) {
      return { state: "ok", data: { waiting: [], decided: [], pendingCount: 0 } };
    }

    /* Who each document is about. Either stated on the row, or reached through
       the application it was filed against, which is the older shape. */
    const applicationIds = [
      ...new Set(documents.map((d) => d.application_id).filter((id): id is string => Boolean(id))),
    ];
    const applications = new Map<
      string,
      {
        user_id: string;
        reference: string;
        business_name: string | null;
        full_name: string | null;
        business_rc: string | null;
        business_tax_id: string | null;
        business_email: string | null;
        business_phone: string | null;
        business_established_on: string | null;
        business_address: string | null;
      }
    >();
    if (applicationIds.length > 0) {
      const { data } = await access.supabase
        .from("agent_applications")
        .select(
          "id, user_id, reference, full_name, business_name, business_rc, business_tax_id, business_email, business_phone, business_established_on, business_address",
        )
        .in("id", applicationIds);
      for (const row of data ?? []) applications.set(row.id, row);
    }

    const ownerOf = (doc: (typeof documents)[number]): string | null =>
      doc.uploader_id ??
      (doc.application_id ? (applications.get(doc.application_id)?.user_id ?? null) : null);

    const userIds = [
      ...new Set(documents.map(ownerOf).filter((id): id is string => Boolean(id))),
    ];

    const [names, agents] = await Promise.all([
      displayNames(access.supabase, [
        ...userIds,
        ...documents.map((d) => d.reviewed_by).filter((id): id is string => Boolean(id)),
      ]),
      agentsFor(access.supabase, userIds),
    ]);

    const [ladders, payoutNames, consents] = await Promise.all([
      laddersFor(
        access.supabase,
        [...agents.values()].map((a) => a.id),
      ),
      payoutHoldersFor(
        access.supabase,
        [...agents.values()].map((a) => a.id),
      ),
      consentsFor(access.supabase, userIds),
    ]);

    const [legalNames, idNames, requests, answering] = await Promise.all([
      legalNamesFor(access.supabase, userIds),
      namesOnDocuments(
        access.supabase,
        documents.filter((d) => d.kind === "identity").map((d) => d.id),
      ),
      requestsFor(userIds),
      answeringDocuments(
        access.supabase,
        documents.filter((d) => d.kind === "selfie").map((d) => d.id),
      ),
    ]);

    const bySubject = new Map<string, KycSubjectView>();
    for (const doc of documents) {
      const owner = ownerOf(doc);
      const key = owner ?? `orphan:${doc.id}`;
      const application = doc.application_id ? applications.get(doc.application_id) : undefined;
      const agent = owner ? agents.get(owner) : undefined;

      let subject = bySubject.get(key);
      if (!subject) {
        subject = {
          userId: owner,
          displayName: owner ? (names.get(owner) ?? null) : null,
          applicationId: doc.application_id,
          applicationReference: application?.reference ?? null,
          agentId: agent?.id ?? null,
          tier: agent?.tier ?? 0,
          rungs: agent ? (ladders.get(agent.id) ?? []) : [],
          business:
            application && application.business_name
              ? {
                  name: application.business_name,
                  registrationNumber: application.business_rc,
                  taxId: application.business_tax_id,
                  email: application.business_email,
                  phone: application.business_phone,
                  establishedOn: application.business_established_on,
                  address: application.business_address,
                }
              : null,
          documents: [],
          payoutNameCheck: payoutSuggestion(
            agent ? payoutNames.get(agent.id) : undefined,
            /* The name printed on the approved ID wins: it is the identity the
               bank account has to belong to. */
            idNameFor(documents, idNames, owner) ?? application?.full_name ?? (owner ? (legalNames.get(owner) ?? null) : null),
            application?.business_name ?? null,
          ),
          namesOnRecord: {
            account: owner ? (legalNames.get(owner) ?? null) : null,
            application: application?.full_name?.trim() || null,
          },
          identityName: idNameFor(documents, idNames, owner),
          request: owner ? (requests.get(owner) ?? null) : null,
          consents: owner ? (consents.rows.get(owner) ?? []) : [],
          consentsRead: consents.ok,
        };
        bySubject.set(key, subject);
      }

      subject.documents.push({
        id: doc.id,
        kind: doc.kind,
        subtype: doc.subtype,
        reviewStatus: doc.review_status,
        rejectionReason: doc.rejection_reason,
        issuedOn: doc.issued_on,
        uploadedAt: doc.uploaded_at,
        reviewedAt: doc.reviewed_at,
        reviewedByName: doc.reviewed_by ? (names.get(doc.reviewed_by) ?? null) : null,
        media: documentMedia(doc.storage_path),
        backMedia: doc.back_storage_path ? documentMedia(doc.back_storage_path) : null,
        issuingCountry: doc.issuing_country ?? null,
        isResubmission: doc.supersedes_id !== null,
        tooOld: isTooOld(doc.kind, doc.issued_on),
        nameOnDocument: idNames.get(doc.id) ?? null,
        answersRequest: answering.has(doc.id),
      });
    }

    const subjects = [...bySubject.values()];
    const waiting = subjects.filter((s) =>
      s.documents.some((d) => d.reviewStatus === "pending"),
    );
    const decided = subjects
      .filter((s) => !s.documents.some((d) => d.reviewStatus === "pending"))
      .slice(0, 20);

    return {
      state: "ok",
      data: {
        waiting,
        decided,
        pendingCount: documents.filter((d) => d.review_status === "pending").length,
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}

/* ------------------------------------------- the names a reviewer compares */

type LooseRead = {
  from: (t: string) => {
    select: (c: string) => {
      in: (c: string, v: string[]) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
};

/** First name and surname as the person gave them at sign-up, by user id. */
async function legalNamesFor(supabase: SupabaseClient<Database>, userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const { data, error } = await (supabase as unknown as LooseRead)
    .from("profiles")
    .select("id, first_name, surname")
    .in("id", userIds);
  if (error || !Array.isArray(data)) return out;
  for (const row of data as { id: string; first_name: string | null; surname: string | null }[]) {
    const name = [row.first_name, row.surname].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
    if (name) out.set(row.id, name);
  }
  return out;
}

/** The reviewer-typed name on each identity document, by document id. */
async function namesOnDocuments(supabase: SupabaseClient<Database>, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await (supabase as unknown as LooseRead)
    .from("agent_documents")
    .select("id, name_on_document")
    .in("id", ids);
  if (error || !Array.isArray(data)) return out;
  for (const row of data as { id: string; name_on_document: string | null }[]) {
    if (row.name_on_document?.trim()) out.set(row.id, row.name_on_document.trim());
  }
  return out;
}

/** Which selfies answer a reviewer's request (a selfie holding the ID). */
async function answeringDocuments(supabase: SupabaseClient<Database>, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (ids.length === 0) return out;
  const { data, error } = await (supabase as unknown as LooseRead)
    .from("agent_documents")
    .select("id, request_id")
    .in("id", ids);
  if (error || !Array.isArray(data)) return out;
  for (const row of data as { id: string; request_id: string | null }[]) if (row.request_id) out.add(row.id);
  return out;
}

/**
 * The newest request for a selfie holding the ID, per person. The table's
 * policy lets a person read only their own, so the desk reads it with the
 * service role, behind the `kyc_review` door `getKycQueue` already passed.
 */
async function requestsFor(userIds: string[]): Promise<Map<string, NonNullable<KycSubjectView["request"]>>> {
  const out = new Map<string, NonNullable<KycSubjectView["request"]>>();
  if (userIds.length === 0) return out;
  try {
    const { data, error } = await (createAdminClient() as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (c: string, v: string[]) => {
            order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
          };
        };
      };
    })
      .from("verification_requests")
      .select("subject_id, status, message, requested_at, answered_at")
      .in("subject_id", userIds)
      .order("requested_at", { ascending: false });
    if (error || !Array.isArray(data)) return out;
    for (const row of data as { subject_id: string; status: "open" | "answered" | "closed"; message: string; requested_at: string; answered_at: string | null }[]) {
      if (out.has(row.subject_id)) continue;
      out.set(row.subject_id, { status: row.status, message: row.message, requestedAt: row.requested_at, answeredAt: row.answered_at });
    }
  } catch {
    /* No request read: the card offers to ask, and the database refuses a second open one. */
  }
  return out;
}

/** The newest approved ID's name for one person, or null. */
function idNameFor(
  documents: readonly { id: string; kind: string; uploader_id: string | null; review_status: string; reviewed_at: string | null }[],
  idNames: Map<string, string>,
  owner: string | null,
): string | null {
  if (!owner) return null;
  const approved = documents
    .filter((d) => d.kind === "identity" && d.uploader_id === owner && d.review_status === "approved" && idNames.has(d.id))
    .sort((a, b) => (b.reviewed_at ?? "").localeCompare(a.reviewed_at ?? ""));
  return approved[0] ? (idNames.get(approved[0].id) ?? null) : null;
}

/* ------------------------------------------------ V-49 payout suggestion */

async function payoutHoldersFor(
  supabase: SupabaseClient<Database>,
  agentIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (agentIds.length === 0) return out;
  const { data } = await supabase
    .from("payout_accounts")
    .select("agent_id, resolved_account_name, is_default")
    .in("agent_id", agentIds);
  for (const row of data ?? []) {
    const name = row.resolved_account_name?.trim();
    if (!name) continue;
    /* The default account's name wins; otherwise the first resolved one. */
    if (row.is_default || !out.has(row.agent_id)) out.set(row.agent_id, name);
  }
  return out;
}

/** The desk's suggestion, from the pure matcher. Exported for its spec. */
export function payoutSuggestion(
  holder: string | undefined,
  fullName: string | null,
  businessName: string | null,
): KycSubjectView["payoutNameCheck"] {
  if (!holder) return null;
  const person = fullName?.trim() ? namesMatch(holder, fullName) : null;
  const firm = businessName?.trim() ? businessNamesMatch(holder, businessName) : null;
  const hit = [person, firm].find((r) => r?.match) ?? person ?? firm;
  if (!hit) return null;
  const onRecord = hit === firm && businessName ? businessName : (fullName ?? businessName ?? "");
  return { match: hit.match, reason: hit.reason, holder, onRecord };
}

/* ---------------------------------------------------------- consent receipt */

/*
 * `kyc_consents` is not in the generated types yet, so it is read through a
 * narrow shape. The admin RLS client reads it under `kyc_consents_select_admin`;
 * a kyc_review staff member arrives with the service client the door handed
 * out after the scope check.
 */
async function consentsFor(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<{ ok: boolean; rows: Map<string, ConsentRow[]> }> {
  const rows = new Map<string, ConsentRow[]>();
  if (userIds.length === 0) return { ok: true, rows };
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (c: string, v: string[]) => {
          order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
        };
      };
    };
  })
    .from("kyc_consents")
    .select("user_id, consent, consented_at")
    .in("user_id", userIds)
    .order("consented_at", { ascending: false });
  if (error || !Array.isArray(data)) return { ok: false, rows };
  for (const row of data as { user_id: string; consent: string; consented_at: string }[]) {
    rows.set(row.user_id, [...(rows.get(row.user_id) ?? []), { consent: row.consent, consentedAt: row.consented_at }]);
  }
  return { ok: true, rows };
}

/* ------------------------------------------------------------------ shared */

async function displayNames(
  supabase: SupabaseClient<Database>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  /* The registered first name and surname stand in for a missing display
     name: somebody who verifies from `/verification` before choosing one
     otherwise reached the queue as "No display name". */
  const { data } = await supabase.from("profiles").select("id, display_name, first_name, surname").in("id", unique);
  for (const row of data ?? []) {
    const name = personName(row);
    if (name) out.set(row.id, name);
  }
  return out;
}

async function agentsFor(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, { id: string; tier: number }>> {
  const out = new Map<string, { id: string; tier: number }>();
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from("agents")
    .select("id, user_id, verification_tier")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    out.set(row.user_id, { id: row.id, tier: row.verification_tier ?? 0 });
  }
  return out;
}

async function laddersFor(
  supabase: SupabaseClient<Database>,
  agentIds: string[],
): Promise<Map<string, { kind: string; status: string; note: string | null; decidedAt: string }[]>> {
  const out = new Map<
    string,
    { kind: string; status: string; note: string | null; decidedAt: string }[]
  >();
  if (agentIds.length === 0) return out;
  const { data } = await supabase
    .from("agent_verification_checks")
    .select("agent_id, kind, status, note, decided_at")
    .in("agent_id", agentIds);
  for (const row of data ?? []) {
    const list = out.get(row.agent_id) ?? [];
    /* Pending rungs are kept, unlike in the agent's own view of the ladder.
       A rung sitting pending is precisely what this queue exists to surface:
       it means an automated check ran and produced something a person has to
       look at, and the note carries what. */
    list.push({
      kind: row.kind,
      status: row.status,
      note: row.note,
      decidedAt: row.decided_at,
    });
    out.set(row.agent_id, list);
  }
  return out;
}

/*
 * `signDocuments` STOOD HERE AND IT IS GONE ON PURPOSE.
 *
 * It minted a ten minute signed Supabase Storage URL per document and handed
 * it to the page, which rendered it in an anchor with `target="_blank"`. A
 * reviewer therefore read somebody's NIN or passport on `supabase.co`, in a
 * tab outside our chrome, outside our content security policy and outside the
 * audit trail, and the live signed URL sat in our DOM where anything on the
 * page could read it and anybody could forward it for the next ten minutes.
 *
 * Nothing signs for a browser any more. The queue says a document exists and
 * what shape it is; `/api/documents/<id>` streams the bytes from our own
 * origin behind `requireAdmin`, uncached, with an audit row per view.
 */
