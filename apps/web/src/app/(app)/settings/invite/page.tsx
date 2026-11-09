import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { RowLink, RowValue, SettingsGroup } from "@/components/app/account/rows";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { InviteTicket } from "@/components/app/account/InviteTicket";
import { InviteReadyPill } from "@/components/money/InviteReadyPill";
import { INVITE_SEEN_COOKIE } from "@/components/app/account/invite-cookie";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import { resolveSession } from "@/lib/actions/session";
import { myInviteCode } from "@/lib/referral/server";
import { invitePath } from "@/lib/referral/code";
import { inviteRewards } from "@/lib/referral/rewards";
import { readMyRewards } from "@/lib/referral/rewards-read";
import { RewardsPauseNotice } from "@/components/app/referral/RewardsPauseNotice";
import { REWARDS_PAUSED_EARNED_LINE } from "@/components/app/referral/money-words";
import { InviteRewardLines } from "@/components/app/referral/InviteRewardLines";
import { InviteEarnings } from "@/components/app/referral/EarnSummary";
import { rewardsDoorSub } from "@/components/app/referral/rewards-door";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).publicDoors.invite.rowTitle };
}

/**
 * THE REFERRAL HUB (A5, rebuilt by W6). The member's own invite code, made on
 * first visit, revealed as a gift: a sealed gift, then a dashed ticket that
 * unfolds with the code on it (`InviteTicket`).
 *
 * WHAT IS ON IT. The code and the link are real, and so is everything about a
 * reward: D85 (the founder, 8 October 2026) pays the live campaign's reward
 * for each friend who signs up fully, and the member reads their own figures
 * and referrals through `my_rewards_summary` and `my_referral_progress`. No
 * investment framing, no downline, no passive-income language: the
 * how-it-works page says what is and is not recorded.
 *
 * WHAT IT SAYS ABOUT A REWARD follows the rewards read, the one gate every
 * rewards surface uses (`inviteRewards`; there is no feature flag for it):
 *
 *   running   under the ticket, the earnings card (the reward per friend who
 *             signs up fully, Available, Pending, Paid out and Earned in
 *             total, every figure from the read, and the door to the
 *             earnings dashboard at `/rewards`), then what the invited person
 *             gets, what the member earns and when, and the monthly budget,
 *             every money sentence from `lib/money/copy.ts`
 *   not-live  (the read cannot answer yet) and unknown (signed out, or the read
 *             failed): nothing about a reward either way. The old "There is
 *             no reward for inviting" line is gone
 *
 * It is a hub with inner pages (D25), and it links every one of them:
 * `/settings/invite/how-it-works`; `/settings/invite/referrals`, which hands
 * on to the one referrals list at `/rewards/referrals` (where each person
 * stands, D85); and `/rewards`, the earnings dashboard. The Rewards row says
 * what that page will say, from the same read (`rewardsDoorSub`): the pause
 * while paused, and the Rewards Balance row while it runs.
 *
 * PAUSED (D64). Once the rewards programme is live and the month's platform
 * budget is reached, this hub stops inviting: the ticket (copy, share sheet,
 * WhatsApp) and the link row are not drawn, the invite's first run is not
 * shown, and the pause notice stands in their place.
 */
export default async function InviteSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const door = t.publicDoors.invite;
  const copy = t.experienceAccount.invite;
  const lede = t.experienceAccount.settings.lede;

  /* THE INVITE'S FIRST RUN (north star 14.1, D11): once, for a signed-in
     member, before anything is read. This page has no signed-out screen of its
     own (a signed-out visit falls to the "unavailable" state below), so the
     check is made here, and a visitor who is not signed in is never sent to a
     first run. The gate fails towards drawing the page. */
  const read = await readMyRewards();
  const rewards = inviteRewards(read);
  const snapshot = read.state === "ready" ? read.snapshot : null;
  const paused = rewards.state === "paused" ? rewards.programme : null;

  /* The hub's two other inner pages, linked in every state the hub draws. */
  const referralsRow = (
    <RowLink
      href="/settings/invite/referrals"
      icon="users"
      label={copy.referralsTitle}
      sub={copy.referrals.lede}
      testId="invite-referrals-row"
    />
  );
  const rewardsDoor =
    rewards.state === "running" ? (
      <RowLink
        href="/rewards"
        icon="hand-coins"
        label={t.experienceRewards.inviteHub.balanceRow}
        sub={t.experienceRewards.inviteHub.balanceRowSub}
        testId="invite-rewards-row"
      />
    ) : (
      <RowLink
        href="/rewards"
        icon="hand-coins"
        label={t.experienceRewards.title}
        sub={rewardsDoorSub(rewards, t.experienceRewards)}
        testId="invite-rewards-door"
      />
    );
  if (!paused && (await resolveSession()).state === "signed-in") {
    await gateFirstRun("invite", "/settings/invite", await searchParams);
  }

  if (paused) {
    return (
      <PageFrame title={t.experienceShell.navInvite} subtitle={door.rowSub} fallback="/home" width="narrow">
        <div>
        <SettingsLede label={lede.what} what={lede.invite.what} who={lede.invite.who} />
        <div className="space-y-block">
          <RewardsPauseNotice
            programme={paused}
            copy={t.experienceRewards.pause}
            earned={REWARDS_PAUSED_EARNED_LINE}
            locale={locale}
            inviteOff
          />
          <SettingsGroup label={copy.groupLabel}>
            <RowLink
              href="/settings/invite/how-it-works"
              icon="info"
              label={copy.howTitle}
              sub={copy.howSub}
              testId="invite-how-row"
            />
            {referralsRow}
            {rewardsDoor}
            {/* D78: the Leaderboard opens from Referral, not from the side nav. */}
            <RowLink
              href="/leaderboard"
              icon="trending-up"
              label={t.experienceShell.navLeaderboard}
              testId="invite-leaderboard-row"
            />
          </SettingsGroup>
        </div>
        </div>
      </PageFrame>
    );
  }

  const code = await myInviteCode();
  const url = code ? `${siteUrl().replace(/\/+$/, "")}${invitePath(code)}` : null;
  const seen = code ? (await cookies()).get(INVITE_SEEN_COOKIE)?.value === code : true;

  return (
    <PageFrame title={t.experienceShell.navInvite} subtitle={door.rowSub} fallback="/home" width="narrow">
      {/* One child: the lede keeps its 16px foot above the ticket. */}
      <div>
      <SettingsLede label={lede.what} what={lede.invite.what} who={lede.invite.who} />

      {code && url ? (
        <div className="space-y-block">
          <InviteReadyPill label="Your invite is ready" url={url} shareText={door.shareText.replace("{url}", url)} shareAria={copy.shareAria} />
          <InviteTicket
            copy={copy}
            code={code}
            url={url}
            shareText={door.shareText.replace("{url}", url)}
            whatsappLabel={door.whatsapp}
            dismissLabel={t.experienceUi.notNow}
            autoplay={!seen}
          />
          {rewards.state === "running" && snapshot ? (
            <InviteEarnings snapshot={snapshot} copy={t.experienceRewards} locale={locale} href="/rewards" />
          ) : null}
          {rewards.state === "running" ? (
            <InviteRewardLines policy={rewards.policy} t={t} locale={locale} testId="invite-rewards-running" />
          ) : null}

          <SettingsGroup label={copy.groupLabel}>
            <RowValue
              icon="link"
              label={copy.linkLabel}
              value={<span className="nf-numeric break-all">{url.replace(/^https?:\/\//, "")}</span>}
              testId="invite-url"
            />
            <RowLink
              href="/settings/invite/how-it-works"
              icon="info"
              label={copy.howTitle}
              sub={copy.howSub}
              testId="invite-how-row"
            />
            {referralsRow}
            {rewardsDoor}
            <RowLink
              href="/leaderboard"
              icon="trending-up"
              label={t.experienceShell.navLeaderboard}
              testId="invite-leaderboard-row"
            />
          </SettingsGroup>
        </div>
      ) : (
        <EmptyState icon="gift" title={door.rowTitle} body={door.unavailable} data-testid="invite-unavailable" />
      )}
      </div>
    </PageFrame>
  );
}
