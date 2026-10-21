"use client";

import type { Locale } from "@vallo/i18n/core";
import { offeredPolicies, policyFootLines, refundLines } from "@/lib/host/cancellation-presets";
import { useHostCopy } from "@/components/host/host-copy";
import { StaysPlate, StaysTile, StaysTiles } from "./StaysParts";
import type { StaysStepProps } from "./types";

/**
 * THE CANCELLATION POLICY, CHOSEN FROM THE PRESETS.
 *
 * Flexible, Moderate, Firm and Strict, the model Airbnb and Booking.com use,
 * each with its refund rules printed in plain words under the tiles from the
 * policy's own tiers (`refundLines`), so the host reads exactly what a guest
 * will read on the stay page and at checkout. Where the estate carries no
 * presets yet, every published policy is offered instead.
 *
 * One control for both branches: the shortlet's house rules screen and the
 * hotel's rates screen. The policy is the property's and is put on every rate
 * it sells (`syncPropertyRatesDraft`).
 */
export function PolicyPicker({
  policies,
  chosen,
  onChoose,
  locale,
  label,
  disabled = false,
  checkInFrom = null,
}: {
  /** The property's stated check-in time, which the deadlines count from. */
  checkInFrom?: string | null;
  policies: StaysStepProps["policies"];
  chosen: string;
  onChoose: (id: string) => void;
  locale: Locale;
  label: string;
  disabled?: boolean;
}) {
  const words = useHostCopy().cancellation;
  const offered = offeredPolicies(policies);
  const picked = offered.find((policy) => policy.id === chosen) ?? null;

  if (offered.length === 0) {
    return (
      <StaysPlate
        label={label}
        note={words.noPolicies}
      >
        <span />
      </StaysPlate>
    );
  }

  return (
    <StaysPlate label={label}>
      <StaysTiles label={label} columns={offered.length >= 4 ? 2 : Math.min(3, offered.length)}>
        {offered.map((policy) => (
          <StaysTile
            key={policy.id}
            title={policy.name}
            selected={chosen === policy.id}
            onSelect={() => {
              if (!disabled) onChoose(policy.id);
            }}
            variant="text"
          />
        ))}
      </StaysTiles>
      {picked ? (
        <ul className="mt-[var(--nf-space-sm)] grid gap-[var(--nf-space-2xs)]" data-testid="policy-lines">
          {refundLines(picked, words, locale).map((line) => (
            <li key={line} className="nf-stays-plate__note mt-0">
              {line}
            </li>
          ))}
          {policyFootLines(checkInFrom, words, locale).map((line) => (
            <li key={line} className="nf-stays-plate__note mt-0">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="nf-stays-plate__note">
          {words.pickOne}
        </p>
      )}
    </StaysPlate>
  );
}
