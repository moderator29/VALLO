import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@vallo/i18n";
import { getReviewView, type ReviewRead } from "@/lib/reviews/queries";
import { withNext } from "@/lib/auth/next-link";
import { ResultScreen } from "@/components/app/ResultSheet";
import { PageHeader } from "@/components/app/PageHeader";
import { PageScene } from "@/components/app/PageScene";
import { Reveal } from "@/components/site/Reveal";
import { ReviewForm } from "./ReviewForm";
import { AlreadyReviewedPanel, ReviewSubjectPanel } from "./ReviewPanels";

export const metadata: Metadata = {
  title: "Review your stay",
  robots: { index: false, follow: false },
};

/**
 * Review a stay.
 *
 * The screen behind the stays hub's "Leave a review" control, which until now
 * led to the listing page and nothing to review with. Every state that is not
 * "ready to write" is a designed, honest screen with a way onward: no keys yet,
 * signed out, no such stay, the stay is not finished, the stay was cancelled,
 * or it has already been reviewed.
 *
 * Eligibility is decided by the database. This page explains the decision.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const locale = await getLocale();
  const plans = getDictionary(locale).shape.plans;
  const w = getDictionary(locale).memberFlows.review;
  const read: ReviewRead = await getReviewView(bookingId, locale);

  if (read.state === "unconfigured") {
    return (
      <Shell title={w.title}>
        <ResultScreen
          state="pending"
          mark="reviews"
          verdict={w.unreachableTitle}
          consequence={w.unreachableBody}
          actions={[{ label: plans.seeStays, href: "/bookings?side=stays&from=stays", tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "signed-out") {
    const words = getDictionary(locale).experienceSpeed.stayReview;
    return (
      <Shell title={w.title}>
        {/* A sign-in prompt is not good news: the neutral sign-in state, not
            the confirmed shield. The sentence promises a return here, so the
            link carries it: sign-in reads only `next` (A9). */}
        <ResultScreen
          state="sign-in"
          verdict={words.signedOutTitle}
          consequence={words.signedOutBody}
          actions={[
            {
              label: words.signIn,
              href: withNext("/sign-in", `/bookings/${encodeURIComponent(bookingId)}/review`),
              tone: "primary",
            },
          ]}
        />
      </Shell>
    );
  }

  if (read.state === "missing") {
    return (
      <Shell title={w.title}>
        {/* Rose and a cross. This said "We could not find that stay" under a
            calendar with a tick, in the pending colour. */}
        <ResultScreen
          state="missing"
          verdict={w.missingTitle}
          consequence={w.missingBody}
          actions={[{ label: plans.seeStays, href: "/bookings?side=stays&from=stays", tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "unavailable") {
    return (
      <Shell title={w.title}>
        <ResultScreen
          state="failed"
          mark="alert-triangle"
          verdict={w.failedTitle}
          consequence={w.failedBody}
          actions={[{ label: plans.seeStays, href: "/bookings?side=stays&from=stays", tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "not-eligible") {
    const n = w.notEligible;
    const copy = {
      cancelled: { title: n.cancelledTitle, description: n.cancelledBody },
      unconfirmed: { title: n.unconfirmedTitle, description: n.unconfirmedBody },
      unpaid: { title: n.unpaidTitle, description: n.unpaidBody },
      "not-finished": {
        title: n.notFinishedTitle,
        description: n.notFinishedBody.replace("{date}", read.subject.checkOutDisplay),
      },
      "no-show": { title: n.noShowTitle, description: n.noShowBody },
      tenancy: { title: n.tenancyTitle, description: n.tenancyBody },
    }[read.reason];

    return (
      <Shell title={w.title} subtitle={read.subject.title}>
        {/* A stay that cannot be reviewed YET is a window that has not opened,
            and one that was cancelled is a window that closed. Neither is a
            failure, so neither is rose. */}
        <ResultScreen
          state={read.reason === "cancelled" || read.reason === "no-show" || read.reason === "tenancy" ? "expired" : "pending"}
          mark="calendar-clock"
          verdict={copy.title}
          consequence={copy.description}
          actions={[
            { label: plans.seeStays, href: "/bookings?side=stays&from=stays", tone: "primary" },
            {
              label: w.viewStay,
              href: read.subject.href,
              tone: "quiet",
            },
          ]}
        />
      </Shell>
    );
  }

  if (read.state === "already-reviewed") {
    const { review } = read;
    return (
      <Shell title={w.title} subtitle={read.subject.title}>
        <AlreadyReviewedPanel subject={read.subject} review={review} words={w} />
      </Shell>
    );
  }

  return (
    <Shell title={w.title} subtitle={read.subject.title}>
      <ReviewSubjectPanel subject={read.subject} words={w} />

      <Reveal delay={80} className="mt-block">
        <ReviewForm
          subject={read.subject}
          plansAction={{ label: plans.seeStays, href: "/bookings?side=stays&from=stays" }}
          success={getDictionary(locale).success}
          words={w}
        />
      </Reveal>
    </Shell>
  );
}

/** The page frame, shared by every state so the chrome never jumps. */
function Shell({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle?: string;
  /** "Review your stay", in the reader's language. */
  title: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative">
        <PageScene art="calendar-check" />
        <PageHeader title={title} subtitle={subtitle} fallback="/bookings?side=stays&from=stays" />
      </div>
      {children}
    </div>
  );
}
