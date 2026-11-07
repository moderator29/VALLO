import "server-only";

import { consume, subjectForUser } from "./rate-limit";

/**
 * A CEILING ON A MEMBER'S WRITES (Survey B, B-03). Holds, inspection
 * requests, viewings and briefs had no limit at all, so a script with one
 * account could hold every night of a listing or flood a lister with
 * requests. These ceilings sit well above anything a person does by hand.
 *
 * Null means go ahead; otherwise the refusal says when to try again. The
 * limiter itself fails open (`consume`), so a limiter fault never blocks a
 * real booking.
 */
export const MEMBER_WRITE_LIMITS = {
  booking_hold: { limit: 12, windowSeconds: 60 * 60, what: "bookings" },
  inspection_request: { limit: 15, windowSeconds: 60 * 60, what: "inspection requests" },
  viewing_booking: { limit: 15, windowSeconds: 60 * 60, what: "viewing bookings" },
  brief_post: { limit: 6, windowSeconds: 24 * 60 * 60, what: "briefs" },
} as const;

export type MemberWriteBucket = keyof typeof MEMBER_WRITE_LIMITS;

export async function memberWriteLimit(bucket: MemberWriteBucket, userId: string): Promise<{ ok: false; error: string } | null> {
  const rule = MEMBER_WRITE_LIMITS[bucket];
  const verdict = await consume({ bucket, subject: subjectForUser(userId), limit: rule.limit, windowSeconds: rule.windowSeconds });
  if (verdict.allowed) return null;
  return { ok: false, error: `That is a lot of ${rule.what} in a short time. Please try again ${verdict.retryIn}. Nothing has been sent.` };
}
