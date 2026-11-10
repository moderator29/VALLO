import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { readHostReviews } from "@/lib/host/reviews";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { HostReviewsView } from "@/components/host/reviews/HostReviewsView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.screens.reviews, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/reviews (C4, 30 September 2026): what guests wrote about the host's
 * hotels, the host's one public answer to each, and a fair way to ask Vallo
 * to look at one. The agent workspace has had its reviews page for months;
 * the host workspace had none, and a hotel stay could not be reviewed at all
 * until the pending C4 migration.
 *
 * THE RATING IS THE VISIBLE REVIEWS' AVERAGE, and it is shown only once there
 * are five or more, because an average of two is a mood, not a signal. A
 * review staff hid does not count, which is the founder's recommended default
 * and what the catalogue now does too.
 */
export default async function HostReviewsPage() {
  const locale = await getLocale();
  const read = await readHostReviews();
  const t = getDictionary(locale);

  if (read.state === "signed-out") {
    return (
      <HostShell fallback="/host">
        <EmptyState
          icon="reviews"
          title={t.experienceHost.reviews.signedOutTitle}
          body={t.experienceHost.reviews.signedOutBody}
          action={
            <ButtonLink href={authHref(returnHref("/host/reviews", "", "list"), "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  return (
    /* The view's page frame carries the one way back; the bar keeps the
       host's destinations. */
    <HostShell fallback="/host" wide chromeBack={false} nav>
      <HostReviewsView read={read} locale={locale} />
    </HostShell>
  );
}
