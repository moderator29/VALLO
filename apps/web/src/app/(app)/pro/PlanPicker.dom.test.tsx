import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/lib/subscriptions/actions", () => ({
  startSubscriptionTrial: vi.fn(),
  startSubscriptionCheckout: vi.fn(),
  subscriptionCheckoutState: vi.fn(),
  cancelSubscription: vi.fn(),
}));
vi.mock("@/components/app/payments/PaystackCheckout", () => ({ PaystackCheckout: () => null }));

import { getDictionary } from "@vallo/i18n";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import { PREVIEW_PLANS } from "@/app/(dev)/preview/pro/plans-fixture";
import type { SubscriptionView } from "@/lib/subscriptions/state";
import { PlanPicker } from "./PlanPicker";
import { ManagePlan } from "./ManagePlan";

afterAll(closeAxe);

const copy = getDictionary("en").subscriptions;
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const FRESH: SubscriptionView = { trialUsed: false, live: null };

function picker(over: Partial<Parameters<typeof PlanPicker>[0]> = {}): string {
  return renderToStaticMarkup(
    <PlanPicker
      plans={PREVIEW_PLANS}
      trialDays={4}
      locale="en"
      signedIn
      signInHref="/sign-in?next=/pro"
      subscriptions={FRESH}
      trialOpen
      payOpen
      copy={copy}
      {...over}
    />,
  );
}

describe("the /pro plan page (D83: Vallo Pro and Vallo Business)", () => {
  it("draws both plans, the first with its price from the row, the 4-day free trial and what it includes", () => {
    const html = picker();
    const text = words(html);
    expect(html).toContain('data-testid="pro-plan-pro"');
    expect(html).toContain('data-testid="pro-plan-business"');
    expect(text).toContain("Vallo Pro");
    expect(text).toContain("For an individual agent or landlord.");
    expect(text).toContain("₦9,500 a month");
    expect(text).toContain("4-day free trial");
    expect(text).toContain("4 Boosts a month");
    expect(text).toContain("Deep analytics");
    expect(text).toContain("Pro badge");
    expect(text).toContain("Priority support");
  });

  it("states the price, the trial, that it renews monthly and how to cancel before anything is charged", () => {
    const text = words(picker());
    expect(text).toContain("4 days free, no card needed.");
    /* The processor is named once, on the pay sheet, not on the plan page (9 November 2026). */
    expect(text).toContain("₦9,500 a month, paid by card.");
    expect(text).toContain("Renews every month until you cancel.");
    expect(text).toContain("Cancel any time on this page.");
    expect(text).not.toMatch(/not on sale/i);
  });

  it("offers the free trial (the orange spark) and subscribing to a member who never had a trial", () => {
    const html = picker();
    const trial = /<button[^>]*data-testid="pro-start-trial"[^>]*>/.exec(html)?.[0] ?? "";
    expect(trial).toContain("nf-btn--spark");
    expect(words(html)).toContain("Start 4-day free trial");
    expect(words(html)).toContain("Subscribe for ₦9,500 a month");
  });

  it("offers no trial once it is used, and says a subscription ends a running trial", () => {
    const used = words(picker({ subscriptions: { trialUsed: true, live: null } }));
    expect(used).not.toContain("Start 4-day free trial");
    expect(used).toContain("Subscribe for ₦9,500 a month");
    const inTrial = words(
      picker({
        subscriptions: {
          trialUsed: true,
          live: { kind: "trial", id: "00000000-0000-4000-8000-000000000001", planKey: "pro", planName: "Vallo Pro", trialEndsAt: "2026-10-12T09:00:00Z" },
        },
      }),
    );
    expect(inTrial).not.toContain("Start 4-day free trial");
    expect(inTrial).toContain("Subscribing during your free trial ends the trial and starts your first paid month today.");
  });

  it("asks a visitor to sign in, and offers nothing to buy to a member who already pays", () => {
    const out = picker({ signedIn: false, subscriptions: null });
    expect(words(out)).toContain("Sign in to start");
    expect(out).not.toContain('data-testid="pro-start-trial"');
    const paid = words(
      picker({
        subscriptions: {
          trialUsed: true,
          live: { kind: "paid", id: "00000000-0000-4000-8000-000000000002", planKey: "pro", planName: "Vallo Pro", status: "active", periodEnd: "2026-11-08T09:00:00Z", amountMinor: 950000 },
        },
      }),
    );
    expect(paid).toContain("You are subscribed to Vallo Pro.");
    expect(paid).not.toMatch(/Subscribe for|Start 4-day/);
  });

  it("offers nothing when subscriptions are closed, or when the member's rows could not be read", () => {
    const closed = words(picker({ trialOpen: false, payOpen: false }));
    expect(closed).toContain("Subscriptions are not open just now.");
    expect(closed).not.toMatch(/Subscribe for|Start 4-day/);
    const unknown = words(picker({ subscriptions: null }));
    expect(unknown).toContain("We could not check your plan just now");
    expect(unknown).not.toMatch(/Subscribe for|Start 4-day/);
  });

  it("offers the trial without subscribing when Paystack cannot take a payment here", () => {
    const text = words(picker({ payOpen: false }));
    expect(text).toContain("Start 4-day free trial");
    expect(text).not.toContain("Subscribe for");
  });

  it("says nothing about a trial when its length could not be read", () => {
    const html = picker({ trialDays: null });
    expect(html).not.toContain('data-testid="pro-plan-trial"');
    expect(words(html)).not.toMatch(/free trial|days free/i);
  });

  it("shows no plan, and no figure, when the plan rows could not be read", () => {
    const html = picker({ plans: [] });
    expect(html).toContain('data-testid="pro-plans-none"');
    expect(html).not.toContain("₦");
  });
});

describe("a plan held through a subscription", () => {
  const manage = (live: Parameters<typeof ManagePlan>[0]["live"]) =>
    words(renderToStaticMarkup(<ManagePlan live={live} locale="en" copy={copy} label="Your plan" />));

  it("shows the trial's end and that nothing is charged, with nothing to cancel", () => {
    const text = manage({ kind: "trial", id: "00000000-0000-4000-8000-000000000001", planKey: "pro", planName: "Vallo Pro", trialEndsAt: "2026-10-12T09:00:00Z" });
    expect(text).toContain("Free trial ends 12 October 2026");
    expect(text).toContain("Nothing is charged.");
    expect(text).not.toContain("Cancel subscription");
  });

  it("shows the next charge from the row and the way to cancel", () => {
    const text = manage({ kind: "paid", id: "00000000-0000-4000-8000-000000000002", planKey: "pro", planName: "Vallo Pro", status: "active", periodEnd: "2026-11-08T09:00:00Z", amountMinor: 950000 });
    expect(text).toContain("Next charge ₦9,500 on 8 November 2026");
    expect(text).toContain("Cancel subscription");
  });

  it("says a cancelled plan runs to the end of its period and will not renew", () => {
    const text = manage({ kind: "paid", id: "00000000-0000-4000-8000-000000000004", planKey: "pro", planName: "Vallo Pro", status: "non_renewing", periodEnd: "2026-11-08T09:00:00Z", amountMinor: 950000 });
    expect(text).toContain("You keep Vallo Pro until 8 November 2026. It will not renew");
    expect(text).not.toContain("Cancel subscription");
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the /pro plan page (axe)", () => {
  it("has no violations with the plans drawn, signed out, or with none", async () => {
    expect(await axe(`<h1>Vallo Pro</h1>${picker()}`)).toEqual([]);
    expect(await axe(`<h1>Vallo Pro</h1>${picker({ signedIn: false, subscriptions: null })}`)).toEqual([]);
    expect(await axe(`<h1>Vallo Pro</h1>${picker({ plans: [] })}`)).toEqual([]);
  });
});
