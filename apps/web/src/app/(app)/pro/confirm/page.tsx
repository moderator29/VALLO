import "../pro-page.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SUBSCRIPTIONS_OPEN } from "@/lib/subscriptions/open";
import { getDictionary } from "@vallo/i18n";
import { PageHeader } from "@/components/app/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { resolveSession } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { getLocale } from "@/lib/locale";
import { guardMoney } from "@/lib/security/money-limits";
import { confirmSubscriptionCharge, type SubscriptionChargeState } from "@/lib/subscriptions/checkout";
import { isSubscriptionReference } from "@/lib/subscriptions/events";
import { SUBSCRIPTION_COLUMNS, type SubscriptionRow } from "@/lib/subscriptions/state";
import { getAdminClient } from "@/lib/supabase/service";
import { fill, longDate, money } from "../plan-format";
import { ConfirmPoll } from "./ConfirmPoll";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const copy = getDictionary(await getLocale()).subscriptions.confirm;
  return { title: copy.metaTitle, robots: { index: false, follow: false } };
}

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/** Ask Paystack once on this render, counted like the checkout's own poll. */
async function verifyOnce(userId: string, reference: string): Promise<SubscriptionChargeState> {
  const limit = await guardMoney("subscriptionCheckoutState", userId);
  if (!limit.allowed) return "pending";
  const admin = getAdminClient();
  if (!admin) return "pending";
  return confirmSubscriptionCharge(admin, { memberId: userId, reference });
}

/**
 * /pro/confirm: WHERE PAYSTACK SENDS THE MEMBER BACK.
 *
 * The browser arriving here proves nothing, so nothing is activated because
 * of it. The page reads the member's own subscription row (RLS); while it is
 * still waiting, this server asks Paystack itself (verify by reference) and,
 * if the money is there, applies the charge under the webhook's own event key
 * (`confirmSubscriptionCharge`), so the two can never both apply it. Until
 * then it says "confirming" and a small island asks our server again on a
 * bounded backoff.
 */
export default async function ProConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /* Plans are not offered (`lib/subscriptions/open.ts`). */
  if (!SUBSCRIPTIONS_OPEN) redirect("/home");
  const [session, locale, params] = await Promise.all([resolveSession(), getLocale(), searchParams]);
  const copy = getDictionary(locale).subscriptions;
  const c = copy.confirm;
  const raw = params.reference ?? params.trxref;
  const reference = typeof raw === "string" ? raw.trim() : "";

  if (session.state === "signed-out") {
    redirect(withNext("/sign-in", reference ? `/pro/confirm?reference=${encodeURIComponent(reference)}` : "/pro"));
  }

  let row: SubscriptionRow | null = null;
  let verdict: SubscriptionChargeState | null = null;
  if (session.state === "signed-in" && isSubscriptionReference(reference)) {
    const read = async () => {
      const { data, error } = await (session.supabase as unknown as LooseDb)
        .from("member_subscriptions")
        .select(SUBSCRIPTION_COLUMNS)
        .eq("checkout_reference", reference)
        .maybeSingle();
      return error ? null : ((data as SubscriptionRow | null) ?? null);
    };
    row = await read();
    if (row && (row.status === "incomplete" || row.status === "abandoned")) {
      verdict = await verifyOnce(session.user.id, reference);
      row = (await read()) ?? row;
    }
  }

  if (row && (row.status === "cancelled" || row.status === "expired" || row.status === "converted")) redirect("/pro");

  const live = row && (row.status === "active" || row.status === "non_renewing" || row.status === "past_due");
  const waiting = row && (row.status === "incomplete" || row.status === "abandoned");
  const planName = row?.plan?.name ?? row?.plan_key ?? "";

  let title: string;
  let body: string[];
  let tone: "success" | "warning" | "danger" | "neutral" = "neutral";
  if (live && row) {
    title = fill(c.activeTitle, { plan: planName });
    const date = longDate(row.current_period_end, locale);
    body = [c.activeBody];
    if (row.status === "active" && date && typeof row.amount_minor === "number") {
      body.push(fill(copy.manage.nextCharge, { price: money(row.amount_minor, locale), date }));
    }
    tone = "success";
  } else if (row?.status === "mismatch") {
    title = c.failedTitle;
    body = [c.failedBody];
    tone = "danger";
  } else if (waiting && verdict === "failed") {
    title = c.declinedTitle;
    body = [c.declinedBody];
    tone = "warning";
  } else if (waiting) {
    title = c.title;
    body = [c.body];
  } else {
    title = c.missingTitle;
    body = [c.missingBody];
  }

  return (
    <div className="nf-pro mx-auto max-w-2xl" data-testid="pro-confirm-page">
      <PageHeader title={copy.confirm.metaTitle} fallback="/pro" />
      <section className="nf-pro-mine" data-testid="pro-confirm" data-state={live ? "active" : waiting ? (verdict === "failed" ? "declined" : "confirming") : row?.status ?? "missing"}>
        <div className="nf-pro-mine__row">
          <h2 className="nf-pro-mine__name">{title}</h2>
          {live ? <StatusPill tone={tone}>{copy.manage.active}</StatusPill> : null}
        </div>
        {body.map((line) => (
          <p key={line} className="nf-pro-mine__body nf-numeric">
            {line}
          </p>
        ))}
        {waiting && verdict !== "failed" ? (
          <ConfirmPoll reference={reference} slowTitle={c.slowTitle} slowBody={c.slowBody} />
        ) : null}
        <ButtonLink href="/pro" variant={live ? "primary" : "secondary"} full>
          {c.back}
        </ButtonLink>
      </section>
    </div>
  );
}
