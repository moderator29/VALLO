"use client";

import type { Dictionary } from "@vallo/i18n/core";
import { useHostCopy } from "@/components/host/host-copy";
import { Button } from "@/components/ui/Button";
import {
  ArrivalChargesFields,
  answersFrom,
  initialRows,
  openKeys,
} from "@/components/stays/ArrivalChargesForm";
import { declareArrivalCharges } from "@/lib/stays/arrival-actions";
import { branchFor } from "@/lib/host/stays-setup";
import { differs, useGuard, useHeld } from "../wizard-memory";
import { StaysNote } from "./StaysParts";
import type { StaysStepProps } from "./types";

/**
 * EXTRA CHARGES. Every charge a guest could be asked for at the door (V-57):
 * a caution deposit, power, cleaning, an extra guest and a visitor, each an
 * amount with its unit or none.
 *
 * WHY IT IS A STEP. The publish gate (`publishAccommodation`) refuses a stay
 * whose five charges are not all answered, and nothing in the application
 * asked for them: an approved hotel or shortlet could not go live until the
 * reviewer chased the host to a screen the host had never been shown. Guests
 * read the same answers before they book, as Booking.com and Airbnb require.
 *
 * The questions are the `/host/arrival` form's own (`ArrivalChargesFields`),
 * held in the wizard so Back does not lose them, and saved through the same
 * `declareArrivalCharges`.
 */
export function ExtraChargesStep({
  draft,
  pending,
  runAsync,
  advance,
  goTo,
  copy,
}: StaysStepProps & { copy?: Dictionary["afterTheGate"]["arrival"] }) {
  const w = useHostCopy().stays;
  const saved = initialRows(draft.arrivalCharges);
  const [rows, setRows] = useHeld("rows", saved);
  const open = openKeys(rows);
  const accommodationId = draft.accommodation?.id ?? null;

  const save = () =>
    accommodationId
      ? runAsync(() => declareArrivalCharges({ accommodationId, answers: answersFrom(rows) }))
      : Promise.resolve(false);
  useGuard("rows", differs(rows, saved), save);

  if (!accommodationId || !copy) {
    return (
      <>
        <StaysNote>{w.extra.saveFirst}</StaysNote>
        <Button
          variant="primary"
          size="lg"
          full
          leadingIcon="arrow-left"
          onClick={() => goTo(branchFor(draft.kind) === "shortlet" ? "place" : "hotel")}
        >
          {w.common.openProperty}
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="grid gap-md" data-testid="extra-charges">
        <ArrivalChargesFields rows={rows} onRows={setRows} copy={copy} />
      </div>
      <Button
        variant="primary"
        size="lg"
        full
        trailingIcon="chevron-right"
        loading={pending}
        disabled={pending || open.length > 0}
        onClick={async () => {
          if (!differs(rows, saved) || (await save())) advance();
        }}
      >
        {w.common.continue}
      </Button>
      <StaysNote>
        {w.extra.note}
      </StaysNote>
    </>
  );
}
