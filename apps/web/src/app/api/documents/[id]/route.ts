import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import {
  isDocumentId,
  locateDocument,
  servableType,
} from "@/lib/admin/documents";

/**
 * GET /api/documents/[id]
 *
 * One uploaded identity or business document, streamed from OUR origin to a
 * reviewer who has proved they are staff.
 *
 * WHY THIS EXISTS. The three review desks used to render a signed Supabase
 * Storage URL in an anchor with `target="_blank"`. A person's NIN opened on
 * `supabase.co`, in a tab outside our chrome, outside our content security
 * policy and outside the audit trail, and the signed URL sat in the DOM where
 * it could be copied out and used by anyone for the next ten minutes. Nobody
 * leaves Vallo, and a document somebody trusted us with least of all.
 *
 * FOUR THINGS THIS FILE IS CAREFUL ABOUT, IN ORDER OF HOW BADLY THEY GO WRONG.
 *
 *   1. WHO. `requireAdmin` is the console's single door and it runs first,
 *      before the id is even looked at. The service role client is created
 *      only after it passes, so an unauthorised caller never causes a
 *      privileged read of anything.
 *
 *   2. WHAT TYPE. The bytes were chosen by the person who uploaded them. An
 *      allowlisted type from the stored extension, plus `nosniff`, plus an
 *      attachment disposition for anything unrecognised, is what stops an
 *      uploaded document being served back as script on our own origin. See
 *      `lib/admin/documents.ts`.
 *
 *   3. WHAT IS KEPT. `private, no-store` on the way out and no signed URL on
 *      the way in. Nothing lands in a shared cache, and nothing outlives the
 *      view, which is the whole difference between this and a signed link a
 *      reviewer can paste into a message.
 *
 *   4. WHAT IS WRITTEN DOWN. One audit row per view, carrying who looked and
 *      which row they looked at, and NOT the storage path, the file name, the
 *      subject's name or any number on the document. Rule 16. The trail
 *      answers "who read this person's passport, and when", which is exactly
 *      what a third party tab could never answer.
 *
 * A refusal is a plain sentence, not JSON, because the only caller is an image
 * element or a frame inside the viewer and neither reads a body.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function refuse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  /* WHICH DESKS. The KYC desk (`kyc_review`) opens every identity and
     business document. The listing desk (`listing_approval`) opens only an
     ownership or mandate proof filed against a listing, never an identity,
     address, selfie, business or association document that happens to name
     one; that is checked below once the row is found. Admins pass either way. */
  const kyc = await requireAdmin("kyc_review");
  const access = kyc.state === "admin" ? kyc : await requireAdmin("listing_approval");
  const listingOnly = kyc.state !== "admin";
  if (access.state !== "admin") {
    /* Signed out and not staff are answered the same way on purpose: a
       stranger probing this route learns nothing about whether they merely
       need to sign in to get somewhere. */
    return refuse(403, "This document is for the Vallo operations team.");
  }

  const { id } = await context.params;
  if (!isDocumentId(id)) return refuse(404, "No such document.");

  const admin = createAdminClient();
  /* Grade 1: `?side=back` is the back of a two-sided ID on the same row,
     behind the same desk check and written to the same audit. */
  const side = new URL(request.url).searchParams.get("side") === "back" ? "back" : "front";
  const located = await locateDocument(admin, id, side);
  if (!located) return refuse(404, "No such document.");
  if (listingOnly) {
    const row =
      located.source === "agent"
        ? await admin.from("agent_documents").select("kind, listing_id").eq("id", id).maybeSingle()
        : null;
    const kind = row?.data?.kind;
    if (!row?.data?.listing_id || (kind !== "ownership" && kind !== "mandate")) {
      return refuse(403, "This document is for the Vallo operations team.");
    }
  }

  const type = servableType(located.path);

  const download = await admin.storage.from(located.bucket).download(located.path);
  if (download.error || !download.data) {
    /* The row exists and the object does not, or storage is unreachable. The
       desk renders the row and says the file could not be reached, which is
       what it already did when a signature failed. */
    return refuse(502, "The file could not be reached just now.");
  }

  await writeAudit(admin, {
    actorId: access.user.id,
    action: "document.viewed",
    entityType: located.source === "agent" ? "agent_documents" : "business_documents",
    entityId: id,
    ...(side === "back" ? { detail: { side: "back" } } : {}),
  });

  const body = await download.data.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": type ?? "application/octet-stream",
      /* Unrecognised means we will not draw it, so it is offered as a file
         rather than rendered. The name is the row's id: the stored path can
         carry a subject's own file name and that is not ours to repeat. */
      "content-disposition": type ? "inline" : `attachment; filename="${id}"`,
      "content-length": String(body.byteLength),
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      /* Nothing on this route is for anyone else's page. */
      "referrer-policy": "no-referrer",
    },
  });
}
