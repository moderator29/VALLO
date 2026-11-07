import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { TYPE } from "@/components/app/Screen";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import "@/components/app/account/referral.css";
import { RewardsPauseNotice } from "@/components/app/referral/RewardsPauseNotice";
import { REWARDS_PAUSED_EARNED_LINE } from "@/components/app/referral/money-words";
import { runningInviteLines } from "@/components/app/referral/invite-rewards";
import { REWARDS_NOT_HELD } from "@/lib/money/copy";
import { inviteRewards } from "@/lib/referral/rewards";
import { readMyRewards } from "@/lib/referral/rewards-read";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceAccount.invite.howTitle };
}

/**
 * HOW INVITES WORK: the inner page that answers one question completely
 * (D25): what an invite does and does not do. Every line is a fact the code
 * can back today. The code is made once and is the member's alone; whoever
 * opens the link sees a first name (`referral_door` returns nothing more); a
 * sign-up through it is recorded as the member's (`raw_user_meta_data`).
 *
 * It is deliberately plain: this is the page somebody reads to decide whether
 * this is a scheme, so it states the negatives (nothing to pay in, one level
 * only) as plainly as the positives.
 *
 * WHAT IT SAYS ABOUT A REWARD follows the rewards read (`inviteRewards`, the
 * one gate every rewards surface uses), one state at a time:
 *
 *   not-live  says nothing about a reward (the old "no reward for inviting"
 *             line is gone: the founder, 8 October 2026)
 *   running   adds what the invited person gets, what the member earns and
 *             when, and the monthly budget (`runningInviteLines`: the reward
 *             from the read's policy, every money sentence from
 *             `lib/money/copy.ts`), and closes on what a Rewards Balance is
 *   paused    D64: closes on the pause notice, so the page never says "no
 *             reward" about a programme that exists and is paused
 *   unknown   (signed out, or the read failed) says nothing either way
 */
export default async function InviteHowItWorksPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const rewards = inviteRewards(await readMyRewards());
  const copy = t.experienceAccount.invite;
  const how = copy.how;
  const running = rewards.state === "running" ? runningInviteLines(rewards.policy, t, locale) : null;
  const line = (key: string) => running?.filter((item) => item.key === key) ?? [];
  const items: { icon: UiIconName; title: string; body: string }[] = [
    { icon: "key", title: how.codeTitle, body: how.codeBody },
    ...line("they-get"),
    { icon: "eye", title: how.seenTitle, body: how.seenBody },
    { icon: "file-check", title: how.recordedTitle, body: how.recordedBody },
    ...line("earn"),
    ...line("pending"),
    ...line("budget"),
    { icon: "shield-check", title: how.notTitle, body: how.notBody },
  ];

  return (
    <PageFrame title={copy.howTitle} subtitle={how.lede} fallback="/settings/invite" width="narrow" testId="invite-how">
      <ol className="nf-panel nf-panel--card nf-how">
        {items.map((item) => (
          <li key={item.title} className="nf-how__item">
            <IconPlate shape="round" size="sm" tone="brand">
              <UiIcon name={item.icon} size={20} />
            </IconPlate>
            <div className="nf-how__text">
              <h2 className="nf-how__title">{item.title}</h2>
              <p className="nf-how__body">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {rewards.state === "paused" ? (
        <RewardsPauseNotice programme={rewards.programme} copy={t.experienceRewards.pause} earned={REWARDS_PAUSED_EARNED_LINE} locale={locale} />
      ) : null}
      {rewards.state === "running" ? (
        <p className={`${TYPE.caption} text-center`} data-testid="invite-rewards-not-held">
          {REWARDS_NOT_HELD}
        </p>
      ) : null}
    </PageFrame>
  );
}
