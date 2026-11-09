"use client";

import { Button } from "@/components/ui/Button";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceFields, type PlaceValues } from "@/components/app/place/PlaceFields";
import type { PickersCopy } from "@/components/app/welcome/welcome-copy";
import { banner } from "@/lib/ui/toast";
import { updatePlaceAction, type PlaceSaved } from "@/lib/places/actions";
import type { StateOption } from "@/lib/places/reference";
import type { ActionResult } from "@/lib/actions/envelope";

/**
 * Where you are, and what you do, as one save.
 *
 * The three fields move together because the database checks them together: a
 * local government has to sit inside the state on the same row, and a trigger
 * refuses the pair with SQLSTATE RM020 when it does not. Saving them one at a
 * time would make that refusal unavoidable halfway through.
 *
 * The form keeps whatever was chosen when a save is refused, so nothing has to
 * be picked twice, and it re-renders from what the database handed back rather
 * than from what the form hoped for.
 */
export function PlaceForm({
  t,
  states,
  initial,
  initialLabels,
}: {
  /* The locale is resolved on the page; the pickers below draw a dozen words
     each and none of them may be English. */
  t: PickersCopy;
  states: StateOption[];
  initial: PlaceValues;
  initialLabels: { lgaName: string; occupationName: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState<PlaceValues>(initial);
  const [state, formAction, pending] = useActionState<ActionResult<PlaceSaved> | null, FormData>(
    updatePlaceAction,
    null,
  );

  /* The outcome goes to the one banner (Grade 1); a field's own error stays
     under that field, in PlaceFields. */
  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      banner.error(state.error, { "data-testid": "place-error" });
      return;
    }
    setValues({
      stateCode: state.data.stateCode,
      lgaCode: state.data.lgaCode,
      occupationCode: state.data.occupationCode,
    });
    banner.success("Saved. Home now opens on this city.", { "data-testid": "place-saved" });
    router.refresh();
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="nf-panel nf-panel--card block p-lg sm:p-lg" data-testid="place-form">
      <PlaceFields
        t={t}
        states={states}
        value={values}
        onChange={setValues}
        fieldErrors={fieldErrors}
        initialLabels={initialLabels}
      />

      <Button type="submit" variant="primary" full disabled={pending} className="mt-md">
        {pending ? "Saving..." : "Save"}
      </Button>

      <p className="mt-sm text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
        Your state and local government decide which places home opens on. Your
        occupation is shown on your public profile only if you put it there.
      </p>
    </form>
  );
}
