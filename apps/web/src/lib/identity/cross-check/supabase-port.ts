import "server-only";

import type { IdNumberKind } from "./formats";
import type { Answer, CrossCheckPort, Fingerprint, SubjectDocument } from "./read";

/**
 * THE CROSS-CHECK READS, AGAINST SUPABASE, AS THE SERVICE ROLE.
 *
 * The caller has already passed the `kyc_review` door (`actions.ts`). The
 * service role is needed for three reasons: the keyed hashes of ID numbers
 * are withheld from every signed-in role by a column grant, the two
 * cross-check tables have no policy at all, and the private bucket has none
 * for staff.
 *
 * `kyc_document_fingerprints` and `kyc_id_number_marks` come from the pending
 * SQL of 15 November 2026. Until it has run, PostgREST answers "no such
 * table" (PGRST205, or 42P01 from Postgres), which this file turns into
 * `unavailable` so the desk can say "not available yet" instead of failing.
 *
 * The tables are not in the generated types, so the client is narrowed to
 * the few calls made here.
 */

const BUCKET = "agent-documents";
export const FINGERPRINTS = "kyc_document_fingerprints";
export const NUMBER_MARKS = "kyc_id_number_marks";

/** PostgREST's page size. `otherPictures` reads this many pages at most. */
const PAGE = 1000;
export const PICTURE_PAGES = 3;

type Result = { data: unknown; error: { code?: string | null; message?: string | null } | null };

/* A query builder is awaited after any of its filters, so each step returns
   the same shape. */
type Query = PromiseLike<Result> & {
  eq(column: string, value: unknown): Query;
  neq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  is(column: string, value: unknown): Query;
  not(column: string, operator: string, value: unknown): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(count: number): Query;
  range(from: number, to: number): Query;
  maybeSingle(): PromiseLike<Result>;
};

export type LooseClient = {
  from(table: string): {
    select(columns: string): Query;
    upsert(rows: unknown, options: { onConflict: string }): PromiseLike<Result>;
  };
  storage: { from(bucket: string): { download(path: string): Promise<{ data: Blob | null; error: unknown }> } };
};

/** True when the error says the table is not in the database yet. */
export function tableMissing(error: Result["error"]): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || /schema cache|does not exist/i.test(error.message ?? "");
}

function rows<T>(result: Result): T[] {
  if (result.error) throw new Error("read failed");
  return Array.isArray(result.data) ? (result.data as T[]) : [];
}

type DocumentRow = {
  id: string;
  kind: string;
  subtype: string | null;
  storage_path: string | null;
  back_storage_path: string | null;
  uploaded_at: string;
};

const DOCUMENT_COLUMNS = "id, kind, subtype, storage_path, back_storage_path, uploaded_at";

export type SupabasePortOptions = {
  /** The 9 by 8 grey pixels of a picture (`lib/photo-hash/hash-server`). */
  greyPixels(bytes: Buffer): Promise<ArrayLike<number>>;
};

export type NumberMark = { documentId: string; ownerId: string; kind: IdNumberKind; hmac: string; recordedBy: string };

export type SupabasePort = CrossCheckPort & {
  /** Who a document belongs to, and what kind it is. Null when there is no such document. */
  documentOwner(documentId: string): Promise<{ ownerId: string | null; kind: string } | null>;
  saveNumber(mark: NumberMark): Promise<"saved" | "unavailable" | "failed">;
};

export function supabasePort(client: LooseClient, options: SupabasePortOptions): SupabasePort {
  return {
    async documents(subjectId) {
      const own = rows<DocumentRow>(
        await client.from("agent_documents").select(DOCUMENT_COLUMNS).eq("uploader_id", subjectId).order("uploaded_at", { ascending: false }).limit(40),
      );
      /* The older shape: no uploader on the row, reached through the application. */
      const applications = rows<{ id: string }>(await client.from("agent_applications").select("id").eq("user_id", subjectId).limit(20));
      const older =
        applications.length === 0
          ? []
          : rows<DocumentRow>(
              await client
                .from("agent_documents")
                .select(DOCUMENT_COLUMNS)
                .in(
                  "application_id",
                  applications.map((a) => a.id),
                )
                .is("uploader_id", null)
                .order("uploaded_at", { ascending: false })
                .limit(40),
            );
      const seen = new Set<string>();
      const out: SubjectDocument[] = [];
      for (const row of [...own, ...older]) {
        if (seen.has(row.id) || !row.storage_path) continue;
        seen.add(row.id);
        out.push({
          id: row.id,
          kind: row.kind,
          subtype: row.subtype,
          storagePath: row.storage_path,
          backStoragePath: row.back_storage_path,
          uploadedAt: row.uploaded_at,
        });
      }
      return out;
    },

    async download(path) {
      const { data, error } = await client.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },

    greyPixels(bytes) {
      return options.greyPixels(Buffer.from(bytes));
    },

    async saveFingerprints(list: Fingerprint[]) {
      if (list.length === 0) return "saved";
      const { error } = await client.from(FINGERPRINTS).upsert(
        list.map((row) => ({
          document_id: row.documentId,
          side: row.side,
          owner_id: row.ownerId,
          kind: row.kind,
          sha256: row.sha256,
          dhash: row.dhash,
          byte_size: row.byteSize,
        })),
        { onConflict: "document_id,side" },
      );
      if (!error) return "saved";
      return tableMissing(error) ? "unavailable" : "failed";
    },

    async ownersOfFiles(sha256s, subjectId): Promise<Answer<{ sha256: string; ownerId: string }[]>> {
      if (sha256s.length === 0) return { state: "ok", value: [] };
      const result = await client.from(FINGERPRINTS).select("sha256, owner_id").in("sha256", sha256s).neq("owner_id", subjectId).limit(200);
      if (tableMissing(result.error)) return { state: "unavailable" };
      return { state: "ok", value: rows<{ sha256: string; owner_id: string }>(result).map((row) => ({ sha256: row.sha256, ownerId: row.owner_id })) };
    },

    async otherPictures(kinds, subjectId): Promise<Answer<{ ownerId: string; kind: string; dhash: string }[]>> {
      const out: { ownerId: string; kind: string; dhash: string }[] = [];
      for (let page = 0; page < PICTURE_PAGES; page += 1) {
        const result = await client
          .from(FINGERPRINTS)
          .select("owner_id, kind, dhash")
          .in("kind", kinds)
          .neq("owner_id", subjectId)
          .not("dhash", "is", null)
          .order("created_at", { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (tableMissing(result.error)) return { state: "unavailable" };
        const batch = rows<{ owner_id: string; kind: string; dhash: string }>(result);
        for (const row of batch) out.push({ ownerId: row.owner_id, kind: row.kind, dhash: row.dhash });
        if (batch.length < PAGE) break;
      }
      return { state: "ok", value: out };
    },

    async numberHashes(subjectId): Promise<Answer<string[]>> {
      const hashes = new Set<string>();
      const marks = await client.from(NUMBER_MARKS).select("number_hmac").eq("owner_id", subjectId).limit(20);
      const missing = tableMissing(marks.error);
      if (!missing) for (const row of rows<{ number_hmac: string | null }>(marks)) if (row.number_hmac) hashes.add(row.number_hmac);
      /* Numbers recorded by the vNIN and selfie-check routes, when they have run. */
      for (const table of ["identity_verifications", "identity_checks"]) {
        const result = await client.from(table).select("nin_hmac, bvn_hmac").eq("subject_id", subjectId).limit(20);
        if (result.error) continue;
        for (const row of rows<{ nin_hmac: string | null; bvn_hmac: string | null }>(result)) {
          if (row.nin_hmac) hashes.add(row.nin_hmac);
          if (row.bvn_hmac) hashes.add(row.bvn_hmac);
        }
      }
      if (hashes.size === 0 && missing) return { state: "unavailable" };
      return { state: "ok", value: [...hashes] };
    },

    async ownersOfNumbers(hashes, subjectId) {
      const owners = new Set<string>();
      if (hashes.length === 0) return [];
      let answered = 0;
      const marks = await client.from(NUMBER_MARKS).select("owner_id").in("number_hmac", hashes).neq("owner_id", subjectId).limit(50);
      if (!tableMissing(marks.error)) {
        for (const row of rows<{ owner_id: string }>(marks)) owners.add(row.owner_id);
        answered += 1;
      }
      for (const table of ["identity_verifications", "identity_checks"]) {
        for (const column of ["nin_hmac", "bvn_hmac"]) {
          const result = await client.from(table).select("subject_id").in(column, hashes).neq("subject_id", subjectId).limit(50);
          if (result.error) continue;
          for (const row of rows<{ subject_id: string }>(result)) owners.add(row.subject_id);
          answered += 1;
        }
      }
      /* "On no other account" may be said only when something was compared. */
      if (answered === 0) throw new Error("no number source answered");
      return [...owners];
    },

    async phoneConfirmed(subjectId) {
      /* Only the fact of a row: the phone number itself is never selected. */
      return rows<{ user_id: string }>(await client.from("confirmed_phones").select("user_id").eq("user_id", subjectId).limit(1)).length > 0;
    },

    async accountCreatedAt(subjectId) {
      const result = await client.from("profiles").select("created_at").eq("id", subjectId).maybeSingle();
      if (result.error) throw new Error("read failed");
      const row = result.data as { created_at?: string | null } | null;
      return row?.created_at ?? null;
    },

    async refusedBefore(subjectId) {
      return rows<{ id: string }>(
        await client.from("agent_documents").select("id").eq("uploader_id", subjectId).eq("review_status", "rejected").in("kind", ["identity", "selfie"]).limit(50),
      ).length;
    },

    async documentOwner(documentId) {
      const result = await client.from("agent_documents").select("kind, uploader_id, application_id").eq("id", documentId).maybeSingle();
      if (result.error) throw new Error("read failed");
      const row = result.data as { kind: string; uploader_id: string | null; application_id: string | null } | null;
      if (!row) return null;
      if (row.uploader_id) return { ownerId: row.uploader_id, kind: row.kind };
      if (!row.application_id) return { ownerId: null, kind: row.kind };
      const application = await client.from("agent_applications").select("user_id").eq("id", row.application_id).maybeSingle();
      if (application.error) throw new Error("read failed");
      return { ownerId: (application.data as { user_id?: string | null } | null)?.user_id ?? null, kind: row.kind };
    },

    async saveNumber(mark) {
      const { error } = await client.from(NUMBER_MARKS).upsert(
        { document_id: mark.documentId, owner_id: mark.ownerId, id_type: mark.kind, number_hmac: mark.hmac, recorded_by: mark.recordedBy },
        { onConflict: "document_id" },
      );
      if (!error) return "saved";
      return tableMissing(error) ? "unavailable" : "failed";
    },
  };
}
