"use client";

import { useActionState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Check";
import type { ActionResult } from "@/lib/actions/envelope";
import { overrideRiskClass } from "@/lib/compliance/risk-actions";
import { useActionBanner } from "@/components/ui/use-action-banner";
import { FieldProblem } from "@/components/ui/FieldProblem";

/** SCUML item 15: staff set a person's risk class by hand, with a reason. Staff only. */
export function RiskOverrideForm({ copy }: { copy: Dictionary["complianceRisk"]["lane"] }) {
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(overrideRiskClass, null);
  /* Saved or refused, said by the one banner at the top of the screen (founder, 7 November 2026). */
  useActionBanner(state, { ok: copy.saved });
  const err = state && !state.ok ? state : null;
  return (
    <form action={action} className="grid gap-sm" data-testid="risk-override-form">
      <p className="nf-caption text-[var(--nf-content-muted)]">{copy.overrideHelp}</p>
      <div>
        <label htmlFor="risk-person" className="nf-label block">
          {copy.person}
        </label>
        <input
          id="risk-person"
          name="person"
          required
          autoComplete="off"
          className="nf-field mt-xs min-h-[44px] w-full"
          aria-invalid={err?.fieldErrors?.person ? true : undefined}
          aria-describedby={err?.fieldErrors?.person ? "risk-person-problem" : undefined}
        />
        <FieldProblem id="risk-person-problem" message={err?.fieldErrors?.person} when={state} />
      </div>
      <fieldset>
        <legend className="sr-only">{copy.overrideTitle}</legend>
        <div className="flex flex-wrap gap-xs">
          {(["high", "medium", "low"] as const).map((value) => (
            <Radio key={value} name="riskClass" value={value} required>
              {copy.class[value]}
            </Radio>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="risk-reason" className="nf-label block">
          {copy.reason}
        </label>
        <textarea autoCapitalize="sentences" enterKeyHint="enter"
          id="risk-reason"
          name="reason"
          required
          minLength={10}
          maxLength={600}
          rows={3}
          aria-describedby="risk-reason-help"
          className="nf-field mt-xs w-full"
        />
        <p id="risk-reason-help" className="nf-caption mt-2xs text-[var(--nf-content-muted)]">
          {copy.reasonHelp}
        </p>
      </div>
      <Button type="submit" variant="primary" loading={pending}>
        {copy.set}
      </Button>
    </form>
  );
}
