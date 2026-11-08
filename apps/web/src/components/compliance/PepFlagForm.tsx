"use client";

import { useActionState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Check";
import type { ActionResult } from "@/lib/actions/envelope";
import { flagPepPerson } from "@/lib/compliance/pep-actions";
import { useActionBanner } from "@/components/ui/use-action-banner";
import { FieldProblem } from "@/components/ui/FieldProblem";

/** SCUML item 20: staff put a person on the PEP record, or take them off. Staff only. */
export function PepFlagForm({ copy, question }: { copy: Dictionary["compliancePep"]["lane"]; question: Dictionary["compliancePep"]["question"] }) {
  const [state, action, pending] = useActionState<ActionResult<"flagged" | "proposed"> | null, FormData>(flagPepPerson, null);
  /* Saved or refused, said by the one banner at the top of the screen (founder, 7 November 2026). */
  useActionBanner(state, { ok: state?.ok ? (state.data === "proposed" ? copy.clearProposed : copy.flagged) : undefined });
  const err = state && !state.ok ? state : null;
  return (
    <form action={action} className="grid gap-sm" data-testid="pep-flag-form">
      <p className="nf-caption text-[var(--nf-content-muted)]">{copy.flagHelp}</p>
      <div>
        <label htmlFor="pep-flag-person" className="nf-label block">
          {copy.person}
        </label>
        <input
          id="pep-flag-person"
          name="person"
          required
          autoComplete="off"
          className="nf-field mt-xs min-h-[44px] w-full"
          aria-invalid={err?.fieldErrors?.person ? true : undefined}
          aria-describedby={err?.fieldErrors?.person ? "pep-flag-person-problem" : undefined}
        />
        <FieldProblem id="pep-flag-person-problem" message={err?.fieldErrors?.person} when={state} />
      </div>
      <fieldset>
        <legend className="nf-label mb-inline">{question.who}</legend>
        <div className="flex flex-wrap gap-xs">
          {(["self", "family", "associate"] as const).map((value) => (
            <Radio key={value} name="relation" value={value}>
              {copy.relation[value]}
            </Radio>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="pep-flag-role" className="nf-label block">
          {question.role}
        </label>
        <input
          id="pep-flag-role"
          name="role"
          maxLength={200}
          className="nf-field mt-xs min-h-[44px] w-full"
          aria-invalid={err?.fieldErrors?.role ? true : undefined}
          aria-describedby={err?.fieldErrors?.role ? "pep-flag-role-problem" : undefined}
        />
        <FieldProblem id="pep-flag-role-problem" message={err?.fieldErrors?.role} when={state} />
      </div>
      <div>
        <label htmlFor="pep-flag-note" className="nf-label block">
          {copy.flagNote}
        </label>
        <input id="pep-flag-note" name="note" required minLength={2} maxLength={600} className="nf-field mt-xs min-h-[44px] w-full" />
      </div>
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" name="flagged" value="yes" variant="primary" disabled={pending}>
          {copy.flag}
        </Button>
        <Button type="submit" name="flagged" value="no" variant="secondary" disabled={pending}>
          {copy.clear}
        </Button>
      </div>
    </form>
  );
}
