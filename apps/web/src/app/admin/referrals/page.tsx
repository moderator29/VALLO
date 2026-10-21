import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { readReferralQuery, type ReferralQuery } from "@/lib/admin/reads/referrals-model";
import {
  getFraudView,
  getPayoutQueue,
  getReferralDesk,
  getReferralGraph,
  getReviewQueue,
} from "@/lib/admin/reads/referrals";
import { ReferralDesk, type ReferralTabData } from "./ReferralDesk";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.referralDesk.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Referrals (`/admin/referrals`): what Vallo owes in rewards, the monthly
 * budget, the live campaign, and the referrals and payouts waiting on a
 * decision.
 *
 * The door is `requireAdmin()`: an admin or a super admin whose session has
 * proved its security key, and nobody else. A staff scope is not enough, on
 * purpose: the seven functions behind this desk check `is_staff()` from the
 * caller's own session and are not granted to the service role. Anybody else
 * gets the site's ordinary 404, as the visits desk does.
 *
 * Only the section the address asks for is read (`?tab=review|fraud|payouts`,
 * and `?member=` for the invitation graph), after the top of the desk.
 */
export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAdmin();
  if (access.state !== "admin") notFound();

  const locale = await getLocale();
  const t = getDictionary(locale);
  const query = readReferralQuery(await searchParams);
  const now = requestTime();

  const [desk, tab] = await Promise.all([getReferralDesk(now), readTab(query)]);

  return <ReferralDesk query={query} locale={locale} copy={t.referralDesk} desk={desk} tab={tab} now={now} />;
}

async function readTab(query: ReferralQuery): Promise<ReferralTabData> {
  if (query.tab === "review") return { review: await getReviewQueue() };
  if (query.tab === "payouts") return { payouts: await getPayoutQueue() };

  const fraud = await getFraudView();
  /* With no member in the address, draw the group with the most at stake: the page earns its keep on arrival. */
  const top = fraud.state === "ok" ? fraud.data.groups[0]?.referrerId : undefined;
  const member = query.member ?? top ?? null;
  const read = member ? await getReferralGraph(member) : null;
  return { fraud, graph: { member, usingDefault: !query.member && member !== null, read } };
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
