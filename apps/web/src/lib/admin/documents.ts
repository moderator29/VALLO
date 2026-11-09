import "server-only";

/**
 * The one place a reviewer's document comes from.
 *
 * WHAT THIS CLOSES. Three review desks used to hand the browser a signed
 * Supabase Storage URL in an anchor with `target="_blank"`. An operator
 * opening somebody's NIN, passport or driving licence therefore read it on
 * `<project>.supabase.co`: a third party origin, in a tab that is not ours,
 * under a content security policy that is not ours, recorded in the browser's
 * own history and disc cache, and with the signed URL itself sitting in our
 * DOM where anything on the page could read it and anybody could forward it.
 *
 * Rule 16 forbids logging or pasting a NIN or a document number. A document
 * somebody trusted us with is the same rule read whole: it is not handed to a
 * new tab, and it does not leave our chrome.
 *
 * WHAT REPLACES IT. The signed URL is never minted for the browser at all.
 * The queue tells the page a document EXISTS and what shape it is; the bytes
 * come back through `/api/documents/<id>` on our own origin, with the service
 * role doing the fetch behind `requireAdmin`, and they are never cached.
 *
 * TWO TABLES, ONE DOOR. `agent_documents` in the private `agent-documents`
 * bucket is what the verification desk and the agent applications desk both
 * read. `business_documents` in `host-documents` is the stays side. The id is
 * a uuid from one table or the other, so the resolver asks each in turn and
 * the caller never has to know which desk it came from.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

export type AdminDocumentSource = "agent" | "business";

type Located = {
  source: AdminDocumentSource;
  bucket: string;
  path: string;
};

const BUCKETS: Record<AdminDocumentSource, string> = {
  agent: "agent-documents",
  business: "host-documents",
};

/**
 * How a viewer should DRAW a document, decided from its stored path.
 *
 * Deliberately not the authority on what is served: the route handler decides
 * that from the object itself and refuses anything outside its allowlist. This
 * is only the hint the sheet needs to choose between an image element and a
 * frame before the first byte has arrived, so it does not have to make a round
 * trip just to learn what it is about to render.
 */
export type DocumentMedia = "image" | "pdf" | "file";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"]);

export function documentMedia(storagePath: string | null | undefined): DocumentMedia {
  if (!storagePath) return "file";
  const dot = storagePath.lastIndexOf(".");
  if (dot < 0) return "file";
  const extension = storagePath.slice(dot + 1).toLowerCase();
  if (extension === "pdf") return "pdf";
  return IMAGE_EXTENSIONS.has(extension) ? "image" : "file";
}

/** A uuid, and nothing else, reaches a table lookup. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDocumentId(raw: string): boolean {
  return UUID.test(raw);
}

/**
 * Find a document by id in either table, or answer null.
 *
 * Null covers both "no such row" and "the row carries no path", and the caller
 * answers the same 404 to each. A reviewer with a stale id and a stranger
 * guessing uuids get the same sentence, which is the only answer that does not
 * confirm a document exists to somebody who should not know.
 */
export async function locateDocument(
  admin: SupabaseClient<Database>,
  id: string,
  /** Grade 1: the back of a two-sided ID, filed on the same row. */
  side: "front" | "back" = "front",
): Promise<Located | null> {
  const agent = await admin
    .from("agent_documents")
    .select("storage_path, back_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (side === "back") {
    const back = agent.data?.back_storage_path;
    return back ? { source: "agent", bucket: BUCKETS.agent, path: back } : null;
  }
  if (agent.data?.storage_path) {
    return { source: "agent", bucket: BUCKETS.agent, path: agent.data.storage_path };
  }

  const business = await admin
    .from("business_documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (business.data?.storage_path) {
    return { source: "business", bucket: BUCKETS.business, path: business.data.storage_path };
  }

  return null;
}

/**
 * The content types this origin will serve inline, and nothing else.
 *
 * THE REASON THIS LIST IS SHORT IS AN ATTACK. The person who uploaded the
 * object chose its bytes. Serving an uploaded file inline from our own origin
 * with a type the browser will execute would turn a KYC upload into stored
 * scripting on vallospaces.com, which is a strictly worse outcome than the
 * third party tab this route exists to remove. So the type is taken from the
 * allowlist and never from the object, `nosniff` is sent so the browser does
 * not go looking for a better guess, and anything unrecognised is served as an
 * opaque download rather than rendered.
 *
 * These are exactly the types the two uploaders accept
 * (`components/verification/kyc.ts` and `lib/host/onboarding.ts`), so nothing
 * a person can legitimately upload lands in the fallback.
 */
const SERVABLE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  pdf: "application/pdf",
};

export function servableType(storagePath: string): string | null {
  const dot = storagePath.lastIndexOf(".");
  if (dot < 0) return null;
  return SERVABLE[storagePath.slice(dot + 1).toLowerCase()] ?? null;
}
