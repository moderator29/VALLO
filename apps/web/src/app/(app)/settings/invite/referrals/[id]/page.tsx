import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * ONE REFERRAL: kept as an address, handed on to the referrals list (D85),
 * where every person's row already says where they stand. There is no
 * per-referral page because there is nothing more a member may read about one
 * person than that line (a first name and a stage; never a reason for a
 * review).
 *
 * Kept as a declared route (not a next.config redirect) so the referral list's
 * address resolves here; the honesty guard holds it to handing on to the list.
 */
export default function InviteReferralPage(): never {
  redirect("/rewards/referrals");
}
