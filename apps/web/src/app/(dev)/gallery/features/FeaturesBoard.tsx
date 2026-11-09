"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Credential } from "@/components/app/artefact/Credential";
import { CredentialFan, type FanItem } from "@/components/app/artefact/CredentialFan";
import { TrustTierFan, type TrustTierItem } from "@/components/app/artefact/TrustTierFan";
import { ProToggle } from "@/components/app/pro/ProToggle";
import { ProUnlock } from "@/components/app/pro/ProUnlock";
import { PlanPaywall } from "@/components/app/plans-premium/PlanPaywall";

/**
 * W7's components, mounted so they can be looked at in both themes and at
 * every width, without a session and without data that does not exist.
 *
 * STRUCTURAL ONLY, like the ported board: slot names ("The promise, one
 * line"), never a price, a count, a name or a date. The plans carry no price
 * because no plan table exists (W7-R4), and the paywall therefore draws no
 * foot, because it refuses an action without its four money sentences
 * (W7-R5): that refusal is itself what this board shows.
 */
function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="mt-section">
      <h2 className="nf-h3">{title}</h2>
      <p className="mt-xs max-w-measure-body text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        {note}
      </p>
      <div className="mt-heading grid gap-group">{children}</div>
    </section>
  );
}

export function FeaturesBoard({
  t,
  locale,
  tiers,
  trial,
}: {
  t: Dictionary;
  locale: Locale;
  tiers: TrustTierItem[];
  /** The server-rendered timeline, passed through. */
  trial: ReactNode;
}) {
  const f = t.experienceFeatures;
  const [pro, setPro] = useState(false);
  const generic: FanItem[] = [
    { id: "a", material: "navy", eyebrow: "First slot", title: "Matte navy", line: "The quiet material.", glyph: "shield-check" },
    { id: "b", material: "royal", eyebrow: "Second slot", title: "Royal", line: "One step up, the same matte finish.", glyph: "shield-check" },
    { id: "c", material: "edge", eyebrow: "Third slot", title: "Navy, warm edge", line: "The one warm line, inside the face.", glyph: "shield-check" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-md pb-section pt-lg">
      <h1 className="nf-h1">Feature onboarding, Pro, plans, artefacts</h1>
      <p className="mt-xs text-[var(--nf-content-secondary)]">
        The first runs are pages: open them at /gallery/features?run=host (and agent, verification, agreements, invite, passport, analytics).
      </p>

      <Section title="Credential fan" note="Tap, swipe or use the arrow keys. The stack is the selector; the chosen one comes forward on the spring.">
        <CredentialFan
          items={generic}
          initialId="b"
          label={f.artefact.selector}
          positionLabel={f.artefact.position}
          detail={(item) => <p className="nf-body-sm text-[var(--nf-content-secondary)]">{item.line}</p>}
        />
      </Section>

      <Section title="Trust tiers" note="The verification ladder's own four tiers and words, opened on the second as if it were held.">
        <TrustTierFan
          tiers={tiers}
          current={2}
          copy={{
            selector: f.trustTiers.selector,
            position: f.artefact.position,
            tier: f.trustTiers.tier,
            held: f.trustTiers.held,
            notYet: f.trustTiers.notYet,
          }}
        />
      </Section>

      <Section title="Pro switch and unlock" note="In the product the switch is absent unless the server says the member holds a plan. Here it is drawn on the night header ground to check it.">
        <div data-theme="dark" className="flex items-center gap-md rounded-card bg-[var(--nf-surface-canvas)] p-md">
          <ProToggle initialOn={false} label={f.pro.label} switchLabel={f.pro.switchLabel} />
          <ProToggle initialOn label={f.pro.label} switchLabel={f.pro.switchLabel} />
        </div>
        <Button variant="secondary" onClick={() => setPro((v) => !v)}>
          {pro ? "Turn the Pro surface off" : "Turn the Pro surface on"}
        </Button>
        <ProUnlock on={pro}>
          <div className="nf-panel nf-panel--card block p-panel">
            <p className="nf-body">The Pro surface, lifting 8px as its veil dissolves, then one pop.</p>
          </div>
        </ProUnlock>
      </Section>

      <Section title="Plan screen" note="No price and no foot: there is no plan table yet, and the action is refused until the four money sentences exist.">
        <PlanPaywall
          artefact={
            <div className="w-full max-w-xs">
              <Credential face={{ material: "edge", eyebrow: "The plan's artefact", title: "Plan name", glyph: "certificate" }} />
            </div>
          }
          promise="The promise, one line"
          benefits={[
            { icon: "chart-bar", text: "First benefit row" },
            { icon: "file-check", text: "Second benefit row" },
            { icon: "users", text: "Third benefit row" },
          ]}
          plans={[
            { id: "monthly", period: "monthly", priceMinor: null },
            { id: "annual", period: "annual", priceMinor: null },
          ]}
          preselectedId="annual"
          trial={trial}
          locale={locale}
          copy={{
            choose: f.plans.choose,
            monthly: f.plans.monthly,
            annual: f.plans.annual,
            perMonth: f.plans.perMonth,
            perYear: f.plans.perYear,
            recommended: f.plans.recommended,
            saving: f.plans.saving,
            benefits: f.plans.benefits,
            termsNotReady: f.plans.termsNotReady,
          }}
          action={() => null}
        />
      </Section>

    </div>
  );
}
