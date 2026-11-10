import { z } from "zod";
import { readAgreementQueue } from "@/lib/admin/reads/agreements";
import { capList, clampLimit, oldestFirst, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool } from "./types";

/** The agreements desk (`/admin/agreements`): what is waiting for a review decision, oldest first. */

export const getAgreementsQueue = defineTool({
  name: "get_agreements_queue",
  description:
    "Agreements desk: how many agreements both parties confirmed are waiting for review, the oldest ones (kind, listing, dates, whether a mandate is attached, photo count) and what was decided recently. Decisions are made by the human on the agreements desk.",
  kind: "read",
  scopes: ["agreements"],
  status: "Reading the agreements queue",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["agreements"]);
    if (!gate.ok) return refused();
    const read = await readAgreementQueue(gate.door.supabase);
    if (read.state !== "ok") return unreadable("The agreements queue");
    const waiting = oldestFirst(read.waiting, (a) => a.submittedAt).map((a) => ({
      id: a.id,
      kind: a.kind,
      listing: a.listingTitle,
      startsOn: a.startsOn,
      endsOn: a.endsOn,
      handoverOn: a.handoverOn,
      hasMandate: a.mandate,
      photos: a.photos,
      waitingHours: waitingHours(a.submittedAt, ctx.now),
      link: "/admin/agreements",
    }));
    const decidedByStatus: Record<string, number> = {};
    for (const d of read.decided) decidedByStatus[d.status] = (decidedByStatus[d.status] ?? 0) + 1;
    return {
      ok: true,
      data: { waitingTotal: waiting.length, oldestWaiting: capList(waiting, clampLimit(input.limit), waiting.length), recentlyDecidedByStatus: decidedByStatus, page: "/admin/agreements" },
    };
  },
});

export const AGREEMENT_TOOLS = [getAgreementsQueue];
