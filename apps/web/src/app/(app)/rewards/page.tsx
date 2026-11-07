import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site";
import { PageFrame } from "@/components/app/PageFrame";
import { RewardsDashboard } from "@/components/app/referral/RewardsDashboard";
import { RewardsState } from "@/components/app/referral/RewardsState";
import { REWARDS_PAUSED_EARNED_LINE } from "@/components/app/referral/money-words";
import { myInviteCode } from "@/lib/referral/server";
import { invitePath } from "@/lib/referral/code";
import { INVITE_HREF, REWARDS_HREFS, rewardsScreen, signInHref } from "./screen";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceRewards.title, robots: { index: false, follow: false } };
}

/**
 * /rewards: THE REWARDS BALANCE, MEMBER SIDE (D51, Round 3 R3 C3).
 *
 * One subject, the balance, with the invite link and two inner pages (the
 * referral list, the history) and the withdraw flow behind it (D25).
 *
 * LINKED, AND HONEST ABOUT WHAT IS BEHIND THE LINK. It was kept out of member
 * navigation while the referral engine and its read did not exist (R-C3-1 to
 * Session 2), and the founder could not find it. It is a row in the member
 * navigation, the settings hub and the invite hub now (7 October 2026), and
 * until the read is live this route draws the honest not-live state and sends
 * the member to the invite link, which works today. No balance is invented.
 * The dashboard itself is built and seen with fixture data at
 * `/preview/rewards`. When the read is live and the money sentences are in
 * `lib/money/copy.ts`, this page draws it with no change here.
 *
 * PAUSED (D64): the dashboard draws the pause and offers no invite link, so
 * the member's code is not even read while the programme is paused.
 */
export default async function RewardsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.experienceRewards;
  const screen = await rewardsScreen();

  if (screen.kind === "state") {
    return (
      <PageFrame title={copy.title} subtitle={copy.lede} fallback="/settings" width="narrow" testId="rewards-page">
        <RewardsState read={screen.read} copy={copy.states} signInHref={signInHref("/rewards")} inviteHref={INVITE_HREF} />
      </PageFrame>
    );
  }

  const code = screen.snapshot.programme.state === "paused" ? null : await myInviteCode();
  const invite = code ? { code, url: `${siteUrl().replace(/\/+$/, "")}${invitePath(code)}` } : null;

  return (
    <PageFrame title={copy.title} subtitle={copy.lede} fallback="/settings" width="narrow" testId="rewards-page">
      <RewardsDashboard
        snapshot={screen.snapshot}
        invite={invite}
        copy={copy}
        money={screen.words}
        pausedEarned={REWARDS_PAUSED_EARNED_LINE}
        locale={locale}
        hrefs={REWARDS_HREFS}
        dismissLabel={t.experienceUi.notNow}
        now={new Date().getTime()}
        phoneLine={t.fixesV2.referral.countsOnPhone}
      />
    </PageFrame>
  );
}
