import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * WHO SIGNED UP WITH YOUR LINK: one list, at `/rewards/referrals` (D85).
 *
 * This route drew an "unavailable" state while no function let a member read
 * their own referrals (R-W6-1, R-W6-2). `public.my_referral_progress()` now
 * answers, so the hub's row keeps its address and hands on to the one list
 * that says where each person stands (signed up, waiting for email
 * confirmation, finishing sign-up, in review until a date, earned, not
 * eligible). Two copies of the list would drift; one does not.
 *
 * Kept as a declared route (not a next.config redirect) because the invite
 * hub links this address and the honesty guard holds it to handing on here.
 */
export default function InviteReferralsPage(): never {
  redirect("/rewards/referrals");
}
