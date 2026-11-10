import { z } from "zod";
import { getListingSubmissions, type ListingReviewView } from "@/lib/admin/queries";
import { getListingReviewTimes, getListingStatusCounts } from "@/lib/admin/reads/listings";
import { UUID_RE, capList, clampLimit, oldestFirst, recheck, refused, unreadable, waitingHours } from "./common";
import { defineTool } from "./types";

/** The listing review desk (`/admin/listings`), through the desk's own reads. */

const link = (id: string) => `/admin/listings/${id}`;

const row = (l: ListingReviewView, now: number) => ({
  id: l.id,
  title: l.title || "Untitled listing",
  status: l.status,
  propertyType: l.propertyType,
  intent: l.intent,
  where: [l.area, l.city].filter(Boolean).join(", ") || null,
  submittedAt: l.submittedAt,
  waitingHours: waitingHours(l.submittedAt, now),
  link: link(l.id),
});

export const getListingQueue = defineTool({
  name: "get_listing_queue",
  description:
    "Listing review desk: how many listings wait for a decision by status, the review time this week against last week, and the oldest waiting listings with ids and links.",
  kind: "read",
  scopes: ["listing_approval"],
  status: "Reading the listing queue",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["listing_approval"]);
    if (!gate.ok) return refused();
    const [queue, counts, times] = await Promise.all([getListingSubmissions({}), getListingStatusCounts(), getListingReviewTimes(ctx.now)]);
    if (queue.state !== "ok") return unreadable("The listing queue");
    const waiting = oldestFirst(queue.data.waiting, (l) => l.submittedAt);
    const real = counts.state === "ok" ? counts.data.real : null;
    return {
      ok: true,
      data: {
        waitingTotal: waiting.length,
        moreWaitingThanRead: queue.data.full,
        byStatus: real
          ? { SUBMITTED: real.SUBMITTED, UNDER_REVIEW: real.UNDER_REVIEW, MORE_INFO_REQUIRED: real.MORE_INFO_REQUIRED, APPROVED: real.APPROVED }
          : null,
        reviewTimes: times.state === "ok" ? times.data : null,
        oldestWaiting: capList(waiting.map((l) => row(l, ctx.now)), clampLimit(input.limit), waiting.length),
        page: "/admin/listings",
      },
    };
  },
});

export const getListingReview = defineTool({
  name: "get_listing_review",
  description:
    "The review facts for one listing in the queue by id: status, type, price, location, bedrooms, photo and video counts and the quality checklist (pass or fail with detail). It does not return photos or the street address.",
  kind: "read",
  scopes: ["listing_approval"],
  status: "Reading the listing",
  input: z.object({ id: z.string().regex(UUID_RE) }),
  handler: async (input, ctx) => {
    const gate = await recheck(ctx, ["listing_approval"]);
    if (!gate.ok) return refused();
    const queue = await getListingSubmissions({});
    if (queue.state !== "ok") return unreadable("The listing queue");
    const found = [...queue.data.waiting, ...queue.data.decided].find((l) => l.id === input.id);
    if (!found) return { ok: false, error: "That listing is not in the review queue pages the desk reads. Link them to the listing desk instead." };
    return {
      ok: true,
      data: {
        ...row(found, ctx.now),
        reference: found.reference,
        priceMinor: found.priceMinor,
        pricePeriod: found.pricePeriod,
        state: found.stateCode,
        bedrooms: found.bedrooms,
        bathrooms: found.bathrooms,
        listedBy: found.agentName,
        photos: found.photos.length,
        videos: found.videos.length,
        reviewNotes: found.reviewNotes,
        checks: found.checks,
      },
    };
  },
});

export const LISTING_TOOLS = [getListingQueue, getListingReview];
