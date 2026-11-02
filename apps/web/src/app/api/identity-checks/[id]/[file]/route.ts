import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";

/**
 * GET /api/identity-checks/[id]/[file]
 *
 * A selfie, ID image or Dojah report from one identity check, streamed from
 * our origin to a KYC reviewer, on the same four rules as
 * `/api/documents/[id]`: staff first, an allowlisted type with nosniff, no
 * cache and no signed URL, one audit row per view without the path or any
 * number on the document.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILES = new Set(["selfie", "idFront", "idBack", "report"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

function refuse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; file: string }> }): Promise<Response> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return refuse(403, "This file is for the Vallo operations team.");

  const { id, file } = await context.params;
  if (!UUID.test(id) || !FILES.has(file)) return refuse(404, "No such file.");

  const admin = createAdminClient();
  const { data } = await (admin as unknown as {
    from(t: string): { select(c: string): { eq(c: string, v: string): { maybeSingle(): Promise<{ data: { files?: Record<string, string> } | null }> } } };
  })
    .from("identity_checks")
    .select("files")
    .eq("id", id)
    .maybeSingle();
  const path = data?.files?.[file];
  if (typeof path !== "string" || path.includes("..")) return refuse(404, "No such file.");
  const type = TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? null;

  const download = await admin.storage.from("identity-checks").download(path);
  if (download.error || !download.data) return refuse(502, "The file could not be reached just now.");

  await writeAudit(admin, { actorId: access.user.id, action: "identity_check.file_viewed", entityType: "identity_checks", entityId: id });

  const body = await download.data.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": type ?? "application/octet-stream",
      "content-disposition": type ? "inline" : `attachment; filename="${id}-${file}"`,
      "content-length": String(body.byteLength),
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
