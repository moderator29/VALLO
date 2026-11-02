import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { recordAlert } from "@/lib/alerts";
import { dojahConfig } from "@/lib/identity/dojah/config";
import { processDojahResult } from "@/lib/identity/dojah/process";
import { redactDojahPayload, verifyDojahSignature } from "@/lib/identity/dojah/webhook";
import { dojahProcessDeps } from "@/lib/identity/dojah/wiring";
import { adminDb } from "@/lib/money/member-wallet";
import { ROUTE_FAILURE_LIMITS, countRouteFailure } from "@/lib/security/money-limits";

/**
 * DOJAH WEBHOOKS (the `kyc_widget` service; docs/identity/DOJAH.md).
 *
 *   signature  ->  redacted event stored  ->  idempotency  ->  process
 *
 * The webhook, not the browser, is the result: the member's screen only
 * waits for this to land. The signature is checked over the raw bytes before
 * any database work. What is stored in `provider_webhook_events` has every
 * NIN, BVN, phone number and file link taken out. A processing failure
 * answers 500 so Dojah retries; a redelivery of a processed event is a no-op.
 *
 * Subscribe once, per environment (Developers -> Webhooks, or
 * POST /api/v1/webhook/subscribe with service "kyc_widget"):
 *   https://www.vallospaces.com/api/dojah/webhook
 */
export const runtime = "nodejs";

function answer(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return answer({ received: false, reason: "body_unreadable" }, 400);
  }

  const config = dojahConfig();
  if (!config || !config.webhookSecret) return answer({ received: false, reason: "not_configured" }, 503);

  if (!verifyDojahSignature(rawBody, request.headers.get("x-dojah-signature"), config.webhookSecret)) {
    const spray = await countRouteFailure(ROUTE_FAILURE_LIMITS.webhookBadSignature, request.headers);
    if (!spray.allowed) {
      return NextResponse.json(
        { received: false, reason: "too_many_failures" },
        { status: 429, headers: { "retry-after": String(spray.retryAfterSeconds) } },
      );
    }
    await recordAlert({ kind: "webhook.dojah.signature_invalid", severity: "warning", detail: { http_status: 401 } });
    return answer({ received: false, reason: "signature_invalid" }, 401);
  }

  const db = adminDb();
  const deps = dojahProcessDeps(config);
  if (!db || !deps) return answer({ received: false, reason: "store_unavailable" }, 503);

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }
  const top = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const reference = typeof top.reference_id === "string" ? top.reference_id : null;
  const lifecycle = typeof top.verification_status === "string" ? top.verification_status : "unknown";
  /* One row per (session, lifecycle state): Ongoing then Completed are two events. */
  const eventKey = reference
    ? `${reference}:${lifecycle}`
    : `malformed:${createHash("sha256").update(rawBody).digest("hex")}`;

  const inserted = await db
    .from("provider_webhook_events")
    .insert({
      provider: "dojah",
      event_key: eventKey,
      event_type: `kyc_widget.${lifecycle.toLowerCase()}`,
      environment: config.environment,
      payload: body ? redactDojahPayload(body) : { raw: "[unparseable]" },
      signature_valid: true,
    })
    .select("id")
    .maybeSingle();

  let rowId: number | null = (inserted.data as { id: number } | null)?.id ?? null;
  if (inserted.error) {
    const { data: prior } = await db
      .from("provider_webhook_events")
      .select("id, processing_status, retry_count")
      .eq("provider", "dojah")
      .eq("event_key", eventKey)
      .maybeSingle();
    const p = prior as { id: number; processing_status: string; retry_count: number } | null;
    if (!p) return answer({ received: false, reason: "store_failed" }, 500);
    if (p.processing_status !== "received" && p.processing_status !== "failed") {
      return answer({ received: true, duplicate: true });
    }
    rowId = p.id;
    await db.from("provider_webhook_events").update({ retry_count: p.retry_count + 1 }).eq("id", p.id);
  }

  const finish = async (status: "processed" | "ignored" | "rejected" | "failed", error: string | null = null) => {
    if (rowId !== null) {
      await db
        .from("provider_webhook_events")
        .update({ processing_status: status, processed_at: new Date().toISOString(), error })
        .eq("id", rowId);
    }
  };

  if (!body) {
    await finish("rejected", "malformed");
    return answer({ received: true, ignored: "malformed" });
  }

  try {
    const outcome = await processDojahResult(deps, body);
    if (outcome.kind === "ignored") {
      await finish("ignored", outcome.reason);
      return answer({ received: true, ignored: outcome.reason });
    }
    await finish("processed");
    return answer({ received: true, status: outcome.status });
  } catch (error) {
    await finish("failed", error instanceof Error ? error.message.slice(0, 200) : "processing_failed");
    return answer({ received: false, reason: "processing_failed" }, 500);
  }
}
