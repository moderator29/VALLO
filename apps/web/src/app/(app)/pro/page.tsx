import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SUBSCRIPTIONS_OPEN } from "@/lib/subscriptions/open";
import { getDictionary } from "@vallo/i18n";
import { resolveSession } from "@/lib/actions/session";
import { getLocale } from "@/lib/locale";
import { withNext } from "@/lib/auth/next-link";
import { SUBSCRIPTIONS_CHECKOUT_FLAG, flagIsOn } from "@/lib/flags/read";
import { isPaystackConfigured } from "@/lib/payments/paystack";
import { providerEnabled } from "@/lib/payments/providers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isServiceConfigured } from "@/lib/supabase/service";
import {
  SUBSCRIPTION_COLUMNS,
  subscriptionViewFrom,
  type SubscriptionRow,
  type SubscriptionView,
} from "@/lib/subscriptions/state";
import { presentEntitlement } from "@/components/app/pro/pro-entitlement";
import { PRO_COPY } from "./pro-copy";
import { ProSurface } from "./ProSurface";
import {
  paidPlansFrom,
  planClock,
  planStateFrom,
  trialDaysFrom,
  type MemberPlanRow,
  type PaidPlan,
  type PlanFeatureRow,
  type PlanRow,
  type ProPlanState,
} from "./pro-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PRO_COPY.metaTitle,
  robots: { index: false, follow: false },
};

/* The plan tables are newer than the generated types, so the reads are typed
   here by hand (`pro-state.ts`) rather than by `Database`. */
type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{ data: unknown; error: unknown }> & {
      eq: (column: string, value: unknown) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/**
 * /pro: THE PLANS, WHAT EACH INCLUDES, AND WHERE THE MEMBER STANDS (P6,
 * 7 October 2026; D83, the founder's rulings of 8 October).
 *
 * THE HONEST STATE. The plans are rows: Vallo Pro and Vallo Business, each
 * with its monthly price, its promotion quotas and what else it includes, and
 * the free trial's length as one settings value. The page reads them for
 * everybody (the plan tables are public), so a visitor sees the same prices a
 * member does. A read that fails shows no plan at all rather than a
 * remembered figure.
 *
 * PAYING IS OPEN behind `subscriptions_checkout` (a missing row reads off): a
 * signed-in member can start the free trial (no card, once ever) or subscribe
 * through Paystack, and a member holding a plan through a subscription sees
 * its status, the trial's end or the next charge, and can cancel. The member's
 * own `member_subscriptions` rows are read here under RLS; a failed read
 * offers nothing rather than a trial they may already have had. Paying also
 * needs Paystack configured, not switched off, and the service role (the
 * checkout is opened with it).
 *
 * THE SWITCH IS NOT HERE. A.11: the Pro switch exists only for somebody who
 * has paid, and it lives in the workspace it deepens (`ProSwitch` in the agent
 * and host shells). A member who holds a plan is told where the switch is,
 * never shown a second one.
 */
export default async function ProPage() {
  /* Plans are not offered (`lib/subscriptions/open.ts`): App Review 3.1.1. */
  if (!SUBSCRIPTIONS_OPEN) redirect("/home");
  const [session, locale] = await Promise.all([resolveSession(), getLocale()]);
  const now = planClock();

  let state: ProPlanState = { kind: "signed-out" };
  let plans: PaidPlan[] = [];
  let trialDays: number | null = null;
  let switchReady = false;
  let subscriptions: SubscriptionView | null = null;
  const [trialOpen, paystackOn] = await Promise.all([
    flagIsOn(SUBSCRIPTIONS_CHECKOUT_FLAG),
    providerEnabled("paystack").catch(() => false),
  ]);
  const payOpen = trialOpen && paystackOn && isPaystackConfigured() && isServiceConfigured();

  let db: LooseDb | null = null;
  if (session.state === "signed-in") {
    db = session.supabase as unknown as LooseDb;
  } else if (session.state === "signed-out" && isSupabaseConfigured()) {
    try {
      db = (await createClient()) as unknown as LooseDb;
    } catch {
      db = null;
    }
  } else if (session.state === "unconfigured") {
    state = { kind: "unknown" };
  }

  if (db) {
    const [planRead, featureRead, settingsRead, mine, subs] = await Promise.all([
      db.from("entitlement_plans").select("*"),
      db.from("entitlement_plan_features").select("plan_id, feature_key, granted, quota"),
      db.from("subscription_settings").select("trial_days").eq("id", 1).maybeSingle(),
      session.state === "signed-in"
        ? db.from("member_entitlement_plans").select("effective_from, effective_to, plan:entitlement_plans(plan_key, name, is_default)")
        : Promise.resolve({ data: null, error: null }),
      session.state === "signed-in"
        ? db.from("member_subscriptions").select(SUBSCRIPTION_COLUMNS)
        : Promise.resolve({ data: null, error: null }),
    ]);
    const planRows = planRead.error ? null : ((planRead.data as PlanRow[] | null) ?? []);
    const featureRows = featureRead.error ? null : ((featureRead.data as PlanFeatureRow[] | null) ?? []);
    plans = featureRows ? paidPlansFrom(planRows, featureRows, now) : [];
    trialDays = settingsRead.error ? null : trialDaysFrom(settingsRead.data);

    if (session.state === "signed-in") {
      const mineRows = mine.error ? null : ((mine.data as MemberPlanRow[] | null) ?? []);
      state = planStateFrom(mineRows, planRows, now);
      subscriptions = subscriptionViewFrom(subs.error ? null : ((subs.data as SubscriptionRow[] | null) ?? []), now);
      /* A plan row is the database's word that a plan is held. Whether its
         switch is drawn yet is the entitlement check's word (fail closed), so
         the page only points at the switch when the check agrees. */
      if (state.kind === "held") {
        const [host, agent] = await Promise.all([presentEntitlement("host"), presentEntitlement("agent")]);
        switchReady = Boolean(host ?? agent);
      }
    }
  }

  return (
    <ProSurface
      state={state}
      plans={plans}
      trialDays={trialDays}
      switchReady={switchReady}
      locale={locale}
      signInHref={withNext("/sign-in", "/pro")}
      subscriptions={subscriptions}
      trialOpen={trialOpen}
      payOpen={payOpen}
      copy={getDictionary(locale).subscriptions}
    />
  );
}
