import { z } from "zod";
import { getKycQueue } from "@/lib/admin/kyc-queries";
import { capList, clampLimit, oldestFirst, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool } from "./types";

/** The verification desk (`/admin/kyc`). Counts, kinds and ages only: never a document, a number or a photo. */

export const getKycSummary = defineTool({
  name: "get_kyc_queue",
  description:
    "Verification (KYC) desk: how many applicants wait, how many documents are pending, and the longest-waiting applicants with the kinds of document pending and how long they have waited. Never returns document images or identity numbers.",
  kind: "read",
  scopes: ["kyc_review"],
  status: "Reading the verification queue",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["kyc_review"]);
    if (!gate.ok) return refused();
    const read = await getKycQueue({});
    if (read.state !== "ok") return unreadable("The verification queue");
    const rows = read.data.waiting.map((s) => {
      const pending = s.documents.filter((d) => d.reviewStatus === "pending");
      const oldest = pending.map((d) => d.uploadedAt).sort()[0] ?? null;
      return {
        applicant: s.displayName,
        applicationReference: s.applicationReference,
        tier: s.tier,
        pendingDocumentKinds: [...new Set(pending.map((d) => d.kind))],
        pendingDocuments: pending.length,
        answersAnInfoRequest: pending.some((d) => d.answersRequest),
        oldestPendingAt: oldest,
        waitingHours: waitingHours(oldest, ctx.now),
        link: "/admin/kyc",
      };
    });
    const ordered = oldestFirst(rows, (r) => r.oldestPendingAt);
    return {
      ok: true,
      data: {
        pendingDocumentsTotal: read.data.pendingCount,
        applicantsWaiting: rows.length,
        longestWaiting: capList(ordered, clampLimit(input.limit), rows.length),
        page: "/admin/kyc",
      },
    };
  },
});

export const KYC_TOOLS = [getKycSummary];
