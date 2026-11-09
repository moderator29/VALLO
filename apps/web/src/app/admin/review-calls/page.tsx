import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { reviewCallsOn } from "@/lib/calls/flags";
import { listStaffReviews } from "@/lib/calls/review-reads";
import { CalmNote, PageHead } from "../_components/panels";
import { RequestReviewCall } from "@/components/calls/admin/RequestReviewCall";
import { ReviewTable } from "@/components/calls/admin/ReviewTable";
import "@/app/css/calls.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.calls.staff.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /admin/review-calls: the review calls this staff member may see.
 *
 * Read under their own session: `call_reviews` row level security shows only
 * case kinds in their scope (KYC review: applications, businesses, identity
 * checks; listing approval: listings; support: support requests; admins see
 * all). The request form here is for a case kind with no desk of its own
 * (an identity check); every other desk carries "Request a review call" on
 * the case itself. While either switch is off this is the calm "not
 * available yet", and the database refuses every review function anyway.
 */
export default async function ReviewCallsPage() {
  const t = getDictionary(await getLocale());
  const c = t.calls;
  if (!(await reviewCallsOn())) {
    return (
      <div className="nf-console" data-testid="review-calls-off">
        <CalmNote title={c.notAvailable.reviewTitle} fills={c.notAvailable.reviewBody} />
      </div>
    );
  }
  const session = await resolveSession();
  const reviews = session.state === "signed-in" ? await listStaffReviews(session.supabase) : null;

  return (
    <div className="nf-console grid gap-md" data-testid="review-calls-list">
      <PageHead title={c.staff.title} lede={c.staff.lede} />
      <p className="nf-review-call__disclaimer">{c.review.notVerificationStaff}</p>
      <RequestReviewCall copy={c} />
      <ReviewTable reviews={reviews ?? []} copy={c} />
    </div>
  );
}
