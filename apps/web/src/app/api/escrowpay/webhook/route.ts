import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { escrowPayConfig } from "@/lib/payments/providers/escrowpay/config";
import {
  ESCROWPAY_SIGNATURE_HEADER,
  parseEscrowPayWebhook,
  verifyEscrowPaySignature,
} from "@/lib/payments/providers/escrowpay/webhooks";
import { ROUTE_FAILURE_LIMITS, countRouteFailure } from "@/lib/security/money-limits";
import { recordAlert } from "@/lib/alerts";
import { adminDb } from "@/lib/money/member-wallet";
import { applyProtectedWebhook, protectedRailDeps } from "@/lib/money/protected-rail";

/**
 * THE PROTECTED RAIL'S WEBHOOK (EscrowPay; BUILD section 5 phase 3, built
 * switched off). The pipeline:
 *
 *   signature  ->  raw event stored  ->  idempotency  ->  processing  ->  answer
 *
 *  - The signature is checked before any database work. Its header and
 *    algorithm are not documented to Vallo yet, so today EVERY delivery is
 *    refused (401) and nothing is written.
 *  - A signed delivery is stored raw first, unique on (provider, key), so a
 *    redelivery changes nothing.
 *  - Arrival order is not trusted; the status in the body is, and the
 *    database refuses a step backwards.
 *  - An unknown status is acknowledged and recorded, and moves nothing.
 *  - Recording is never gated by the founder's switch: money already held is
 *    always recorded.
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

  const config = escrowPayConfig(process.env);
  if (!config || !config.webhookSecret) return answer({ received: false, reason: "not_configured" }, 503);

  const header = ESCROWPAY_SIGNATURE_HEADER ? request.headers.get(ESCROWPAY_SIGNATURE_HEADER) : null;
  if (!verifyEscrowPaySignature(rawBody, header, config.webhookSecret)) {
    const spray = await countRouteFailure(ROUTE_FAILURE_LIMITS.webhookBadSignature, request.headers);
    if (!spray.allowed) {
      return NextResponse.json(
        { received: false, reason: "too_many_failures" },
        { status: 429, headers: { "retry-after": String(spray.retryAfterSeconds) } },
      );
    }
    await recordAlert({ kind: "webhook.escrowpay.signature_invalid", severity: "warning", detail: { http_status: 401 } });
    return answer({ received: false, reason: "signature_invalid" }, 401);
  }

  const db = adminDb();
  if (!db) return answer({ received: false, reason: "store_unavailable" }, 503);

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }
  const event = parseEscrowPayWebhook(body);
  const eventKey = event?.key ?? `malformed:${createHash("sha256").update(rawBody).digest("hex")}`;

  const inserted = await db
    .from("provider_webhook_events")
    .insert({
      provider: "escrowpay",
      event_key: eventKey,
      event_type: event?.event ?? "malformed",
      environment: config.environment,
      payload: body ?? { raw: rawBody.slice(0, 10_000) },
      signature_valid: true,
    })
    .select("id")
    .maybeSingle();

  let rowId: number | null = (inserted.data as { id: number } | null)?.id ?? null;
  if (inserted.error) {
    const { data: prior } = await db
      .from("provider_webhook_events")
      .select("id, processing_status, retry_count")
      .eq("provider", "escrowpay")
      .eq("event_key", eventKey)
      .maybeSingle();
    const p = prior as { id: number; processing_status: string; retry_count: number } | null;
    if (!p) return answer({ received: false, reason: "store_failed" }, 500);
    if (p.processing_status !== "received" && p.processing_status !== "failed") return answer({ received: true, duplicate: true });
    rowId = p.id;
    await db.from("provider_webhook_events").update({ retry_count: p.retry_count + 1 }).eq("id", p.id);
  }

  const finish = async (status: "processed" | "ignored" | "rejected" | "failed", error: string | null = null) => {
    if (rowId !== null) {
      await db.from("provider_webhook_events").update({ processing_status: status, processed_at: new Date().toISOString(), error }).eq("id", rowId);
    }
  };

  if (!event) {
    await finish("rejected", "malformed");
    return answer({ received: true, ignored: "malformed" });
  }
  try {
    const verdict = await applyProtectedWebhook(
      protectedRailDeps(db, async (kind, detail) => {
        await recordAlert({ kind, severity: "critical", detail });
      }),
      event,
    );
    if (verdict === "error") throw new Error("arrangement_observe_failed");
    if (verdict === "unmapped" || verdict === "unknown_arrangement" || verdict === "malformed") await finish("ignored", verdict);
    else await finish("processed", verdict === "changed" || verdict === "same" ? null : verdict);
    return answer({ received: true, outcome: verdict });
  } catch (error) {
    await finish("failed", error instanceof Error ? error.message.slice(0, 200) : "processing_failed");
    return answer({ received: false, reason: "processing_failed" }, 500);
  }
}
