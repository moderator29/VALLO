import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { ReferralList } from "@/components/app/referral/ReferralList";
import { RewardsState } from "@/components/app/referral/RewardsState";
import { RewardsPauseNotice } from "@/components/app/referral/RewardsPauseNotice";
import { REWARDS_PAUSED_EARNED_LINE } from "@/components/app/referral/money-words";
import { pausedProgramme } from "@/lib/referral/rewards";
import { INVITE_HREF, rewardsScreen, signInHref } from "../screen";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceRewards.referrals.title, robots: { index: false, follow: false } };
}

/**
 * /rewards/referrals: the people a member invited and where each stands
 * (joined, pending, under review, qualified). Never a reason for a review and
 * never a second level. Draws the not-live state until R-C3-1 exists.
 *
 * PAUSED (D64): the pause is said first, every referral is still listed as it
 * stands, and the empty state no longer offers "Share your link".
 */
export default async function RewardsReferralsPage() {
  const locale = await getLocale();
  const copy = getDictionary(locale).experienceRewards;
  const screen = await rewardsScreen();

  if (screen.kind === "state") {
    return (
      <PageFrame title={copy.referrals.title} subtitle={copy.referrals.lede} fallback="/rewards" width="narrow">
        <RewardsState read={screen.read} copy={copy.states} signInHref={signInHref("/rewards/referrals")} inviteHref={INVITE_HREF} />
      </PageFrame>
    );
  }

  const paused = pausedProgramme({ state: "ready", snapshot: screen.snapshot });

  return (
    <PageFrame title={copy.referrals.title} subtitle={copy.referrals.lede} fallback="/rewards" width="narrow">
      {paused ? (
        <RewardsPauseNotice programme={paused} copy={copy.pause} earned={REWARDS_PAUSED_EARNED_LINE} locale={locale} inviteOff />
      ) : null}
      {screen.snapshot.referrals.length === 0 ? (
        <EmptyState
          icon="gift"
          art="envelope"
          title={copy.referrals.emptyTitle}
          body={copy.referrals.emptyBody}
          action={
            paused ? undefined : (
              <ButtonLink href="/rewards" variant="secondary" size="lg">
                {copy.referrals.emptyAction}
              </ButtonLink>
            )
          }
          data-testid="rewards-referrals-empty"
        />
      ) : (
        <ReferralList rows={screen.snapshot.referrals} copy={copy.referrals} locale={locale} />
      )}
    </PageFrame>
  );
}
