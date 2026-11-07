import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { reviewCallsOn } from "@/lib/calls/flags";
import { caseHref, readStaffReview } from "@/lib/calls/review-reads";
import { CalmNote, PageHead } from "../../_components/panels";
import { ReviewDesk } from "@/components/calls/admin/ReviewDesk";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.calls.staff.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /admin/review-calls/[id]: one review call's desk (`ReviewDesk`).
 *
 * Everything is read under the staff member's own session, so a review
 * outside their scope reads as not found, the same calm note as an id that
 * does not exist (never a 404 that confirms it does). Notification links for
 * "accepted", "declined" and "proposed a time" point here.
 */
export default async function ReviewCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const read =
    session.state === "signed-in" && UUID.test(id) ? await readStaffReview(session.supabase, id, session.user.id) : null;
  if (!read) {
    return (
      <div className="nf-console" data-testid="review-call-missing">
        <CalmNote
          title={c.staff.missingTitle}
          fills={c.staff.missingBody}
          action={{ href: "/admin/review-calls", label: c.staff.title }}
        />
      </div>
    );
  }
  return (
    <div className="nf-console grid gap-md">
      <PageHead title={c.staff.caseKinds[read.review.caseKind]} lede={c.staff.statuses[read.review.status]} />
      <ReviewDesk
        review={read.review}
        entries={read.entries}
        audit={read.audit}
        subjectName={read.subjectName}
        liveCallId={read.liveCallId}
        caseLink={caseHref(read.review.caseKind, read.review.caseId)}
        nowIso={requestTime()}
        copy={c}
      />
    </div>
  );
}

function requestTime(): string {
  return new Date().toISOString();
}
