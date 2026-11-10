"use client";

import { useActionState, useId } from "react";
import { restoreWithCodeAction } from "@/lib/account-deletion/actions";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/lib/actions/envelope";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { useActionBanner } from "@/components/ui/use-action-banner";

/**
 * The way back, from a browser, with no session.
 *
 * An account inside its grace window is banned at the auth server, so the
 * person cannot sign in to change their mind. The code in the confirmation
 * email is the route that does not need a session, and this is the only place
 * on the public web that takes it. The only thing the code can do is cancel a
 * deletion, so a guessed one fails in the direction where an account survives.
 */
export function RestoreForm() {
  const fieldId = useId();
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    restoreWithCodeAction,
    null,
  );
  /* Said by the one banner at the top of the screen (founder, 7 November
     2026). A refusal about the code is said by the code field itself. */
  const codeProblem = state && !state.ok ? state.fieldErrors?.restoreCode : undefined;
  useActionBanner(codeProblem ? null : state, { ok: "Welcome back, your account is restored." });

  if (state?.ok) {
    return (
      <p
        className="mt-sm rounded-[var(--nf-container-radius)] border border-[color-mix(in_oklab,var(--nf-state-success)_45%,transparent)] px-md py-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-state-success)]"
        data-testid="restore-done"
      >
        Your account is back and nothing was destroyed. You can sign in again now.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-sm">
      <label htmlFor={fieldId} className="nf-label mb-2xs block">
        Your restore code
      </label>
      <input
        id={fieldId}
        name="restoreCode"
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="characters"
        className="nf-field"
        data-testid="restore-code"
        aria-invalid={codeProblem ? true : undefined}
        aria-describedby={codeProblem ? `${fieldId}-problem` : undefined}
      />
      <FieldProblem id={`${fieldId}-problem`} message={codeProblem} when={state} />
      <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
        It is in the email we sent when the deletion was requested. Upper or lower case, with or
        without the dash.
      </p>


      <div className="mt-md">
        <Button type="submit" variant="primary" loading={pending} data-testid="restore-submit">
          Stop the deletion
        </Button>
      </div>
    </form>
  );
}
