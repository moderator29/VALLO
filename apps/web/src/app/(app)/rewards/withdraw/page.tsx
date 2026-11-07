import type { Metadata } from "next";
import { formatMoney, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { RewardsState } from "@/components/app/referral/RewardsState";
import { RewardsPayoutForm } from "@/components/app/referral/RewardsPayoutForm";
import { RewardsPauseNotice } from "@/components/app/referral/RewardsPauseNotice";
import { fill, REWARDS_PAUSED_EARNED_LINE } from "@/components/app/referral/money-words";
import { REWARDS_PAID_FROM, REWARDS_WITHDRAW_NOT_OPEN } from "@/lib/money/copy";
import { isPaystackConfigured, listBanks, type PaystackBank } from "@/lib/payments/paystack";
import { pausedProgramme, withdrawGate } from "@/lib/referral/rewards";
import { withdrawRewards } from "@/lib/referral/withdraw-action";
import { INVITE_HREF, REWARDS_HREFS, rewardsScreen, signInHref } from "../screen";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceRewards.withdraw.title, robots: { index: false, follow: false } };
}

/** The banks Paystack pays out to; empty when it has no key or does not answer, which the form says. */
async function payoutBanks(): Promise<PaystackBank[]> {
  if (!isPaystackConfigured()) return [];
  try {
    return await listBanks();
  } catch {
    return [];
  }
}

/**
 * /rewards/withdraw: from the Rewards Balance to the member's bank (D51, D85).
 *
 * Three honest states, in this order (`withdrawGate`):
 *
 *   not-open       `referral_policy.payouts_enabled` is off (no separate
 *                  marketing-float account yet): "Withdrawals are not open
 *                  yet", and that every reward earned is recorded and stays
 *                  the member's. No date, because none is decided
 *   below-minimum  Available has not reached the withdrawal minimum, said
 *                  with the minimum from the read
 *   open           the payout form: a bank and ten digits, through the
 *                  existing payout path (`requestRewardsPayout`), which pays
 *                  the whole Available balance in whole referrals
 *
 * PAUSED (D64): withdrawing what is already earned carries on exactly as
 * before; the pause is said above it so nobody reads it as a freeze.
 */
export default async function RewardsWithdrawPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.experienceRewards;
  const w = copy.withdraw;
  const screen = await rewardsScreen();

  if (screen.kind === "state") {
    return (
      <PageFrame title={w.title} subtitle={w.lede} fallback="/rewards" width="narrow">
        <RewardsState read={screen.read} copy={copy.states} signInHref={signInHref("/rewards/withdraw")} inviteHref={INVITE_HREF} />
      </PageFrame>
    );
  }

  const { snapshot, words } = screen;
  const gate = withdrawGate(snapshot);
  const back = (
    <ButtonLink href="/rewards" variant="secondary" size="lg">
      {w.back}
    </ButtonLink>
  );

  const paused = pausedProgramme({ state: "ready", snapshot });

  return (
    <PageFrame title={w.title} subtitle={w.lede} fallback="/rewards" width="narrow">
      {paused ? <RewardsPauseNotice programme={paused} copy={copy.pause} earned={REWARDS_PAUSED_EARNED_LINE} locale={locale} /> : null}
      {gate === "open" ? (
        <div className="grid gap-sm" data-testid="rewards-withdraw-open">
          <p className="nf-rewards-note">{fill(words.minimum, { minimum: formatMoney(snapshot.policy.withdrawMinimumMinor, locale) })}</p>
          <RewardsPayoutForm
            availableMinor={snapshot.balance.availableMinor}
            banks={await payoutBanks()}
            copy={w}
            locale={locale}
            action={withdrawRewards}
            historyHref={REWARDS_HREFS.history}
          />
          <p className="nf-rewards-note">{REWARDS_PAID_FROM}</p>
        </div>
      ) : gate === "below-minimum" ? (
        <EmptyState
          icon="gift"
          art={false}
          title={w.belowMinimumTitle}
          body={fill(words.minimum, { minimum: formatMoney(snapshot.policy.withdrawMinimumMinor, locale) })}
          action={back}
          data-testid="rewards-withdraw-below-minimum"
        />
      ) : (
        <EmptyState
          icon="gift"
          art={false}
          title={w.notOpenTitle}
          body={REWARDS_WITHDRAW_NOT_OPEN}
          action={back}
          data-testid="rewards-withdraw-not-open"
        />
      )}
    </PageFrame>
  );
}
