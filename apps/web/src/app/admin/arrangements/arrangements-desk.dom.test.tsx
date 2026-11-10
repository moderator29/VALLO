import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import { fakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * THE ARRANGEMENT OPERATIONS DESK (BUILD 7.11) IS READ-ONLY. Pinned: the
 * door is finance; the read selects and never writes; the review filter
 * keeps requires_review only; each row shows the provider's words beside
 * Vallo's state, the last webhook, the last reconcile and the review
 * reason; and the desk draws no button that moves money.
 */
const state = vi.hoisted(() => ({ access: { state: "admin" } as unknown, service: null as unknown }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: async () => state.access }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.service }));
afterAll(closeAxe);

const { readArrangementOps, readArrangementFilter, toOpsRow } = await import("./read");
const { ArrangementsDesk } = await import("./ArrangementsDesk");

const raw = {
  id: "a1",
  reference: "VAL-PP-7Q2K9M",
  provider: "escrowpay",
  status: "requires_review",
  status_source: "provider_readback",
  status_observed_at: "2026-11-10T09:00:00Z",
  provider_state: "HELD",
  provider_status: "MISMATCH",
  amount_minor: 180_000_00,
  last_webhook_at: "2026-11-10T08:58:00Z",
  last_reconcile_at: "2026-11-10T09:00:00Z",
  last_reconcile_result: "amount differs",
  review_reason: "amount_mismatch received_minor=170000000",
  created_at: "2026-11-10T08:00:00Z",
};

describe("the read", () => {
  it("refuses anyone the finance door refuses", async () => {
    state.access = { state: "not-admin" };
    expect(await readArrangementOps("all")).toEqual({ state: "forbidden" });
  });

  it("selects only, and the review filter keeps requires_review", async () => {
    state.access = { state: "admin" };
    const db = fakeSupabase({ provider_arrangements: { select: { data: [raw], count: 1 } } });
    state.service = db.client;
    const read = await readArrangementOps("review");
    expect(read.state).toBe("ok");
    expect(db.wrote()).toBe(false);
    expect(db.of("provider_arrangements", "select")[0]?.filters).toContainEqual(["eq", "status", "requires_review"]);
    expect(readArrangementFilter("review")).toBe("review");
    expect(readArrangementFilter("anything")).toBe("all");
  });

  it("reads a row without any pending column", () => {
    expect(toOpsRow({ id: "a2", reference: "R", provider: "escrowpay", status: "protected", amount_minor: 100 })).toMatchObject({
      lastWebhookAt: null,
      lastReconcileAt: null,
      reviewReason: null,
    });
  });
});

describe("the desk", () => {
  const row = toOpsRow(raw)!;
  const out = renderToStaticMarkup(<ArrangementsDesk read={{ state: "ok", rows: [row], total: 1, review: 1 }} filter="all" locale="en" />);
  const text = out.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("shows the provider's words beside Vallo's state, the last webhook, the reconcile and the review reason", () => {
    expect(text).toContain("Provider said HELD / MISMATCH");
    expect(text).toContain("requires review");
    expect(text).toContain("Last webhook");
    expect(text).toContain("amount differs");
    expect(text).toContain("amount_mismatch received_minor=170000000");
    expect(out).toContain('href="/admin/arrangements?show=review"');
  });

  it("offers no money action at all", () => {
    expect(out).not.toMatch(/<button|<form/);
    expect(text).not.toMatch(/\b(Release|Refund|Approve|Pay out)\b/);
  });

  it.skipIf(!hasBrowser && !process.env.CI)("has no axe violations", async () => {
    expect(await axe(out)).toEqual([]);
  });
});
