"use client";

import { Switch } from "@/components/ui/Switch";
import { FieldProblem } from "@/components/ui/FieldProblem";
import {
  MAX_BACKUP_HOURS,
  POWER_BACKUP_CHOICES,
  POWER_GRID_CHOICES,
  WATER_SUPPLY_CHOICES,
} from "@/lib/agent/listings-model";
import { BACKUP_GLYPH, Choice, GRID_GLYPH, Stepper, WATER_GLYPH } from "./parts";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";

/**
 * LIGHT AND WATER: the grid, the backup and its hours, the water source and
 * the prepaid meter. Each choice is a card with the line that says what the
 * word means, because a tooltip is invisible on a phone.
 */
export function SupplyStep({ ctx }: { ctx: StepCtx }) {
  const { values, set, copy, errors, asks, mark, counterAria } = ctx;
  const supply = copy.drawn.supply;
  const backupHours = Number(values.powerBackupHours) || 0;
  return (
    <>
      {asks("power") ? (
        <>
          <fieldset>
            <legend className="nf-label mb-inline">
              {supply.power}
              {mark("powerGrid")}
            </legend>
            <div className="nf-lw-choices">
              {POWER_GRID_CHOICES.map((choice) => (
                <Choice
                  key={choice.value}
                  name={choice.label}
                  sub={choice.blurb}
                  glyph={GRID_GLYPH[choice.value]}
                  chosen={values.powerGrid === choice.value}
                  onClick={() => set("powerGrid", values.powerGrid === choice.value ? "" : choice.value)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="nf-label mb-inline">
              {supply.backup}
              {mark("powerBackup")}
            </legend>
            <div className="nf-lw-choices">
              {POWER_BACKUP_CHOICES.map((choice) => (
                <Choice
                  key={choice.value}
                  name={choice.label}
                  glyph={BACKUP_GLYPH[choice.value]}
                  chosen={values.powerBackup === choice.value}
                  onClick={() => {
                    const next = values.powerBackup === choice.value ? "" : choice.value;
                    set("powerBackup", next);
                    /* Hours against a backup that does not exist is refused by
                       the database, so "no backup" clears them here rather
                       than letting the save bounce. */
                    if (next === "NONE" || next === "") set("powerBackupHours", "");
                  }}
                />
              ))}
            </div>
          </fieldset>
          {values.powerBackup !== "" && values.powerBackup !== "NONE" ? (
            <div>
              <span className="nf-label">{supply.backupHours}</span>
              <Stepper
                value={backupHours}
                min={0}
                max={MAX_BACKUP_HOURS}
                label={supply.backupHours}
                fewerLabel={counterAria("fewer", supply.backupHours)}
                moreLabel={counterAria("more", supply.backupHours)}
                onChange={(v) => set("powerBackupHours", String(v))}
              />
              <FieldProblem id="wizard-powerBackupHours-problem" message={errors.powerBackupHours} />
              <span className="nf-body-sm mt-inline-tight block text-[var(--nf-content-muted)]">
                {WIZARD_WORDS.supply.hoursNote}
              </span>
            </div>
          ) : null}
        </>
      ) : null}
      {asks("water") ? (
        <fieldset>
          <legend className="nf-label mb-inline">
            {supply.water}
            {mark("waterSupply")}
          </legend>
          <div className="nf-lw-choices">
            {WATER_SUPPLY_CHOICES.map((choice) => (
              <Choice
                key={choice.value}
                name={choice.label}
                sub={choice.blurb}
                glyph={WATER_GLYPH[choice.value]}
                chosen={values.waterSupply === choice.value}
                onClick={() => set("waterSupply", values.waterSupply === choice.value ? "" : choice.value)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
      {asks("power") ? (
        <>
          <Switch
            label={supply.prepaid}
            description={supply.prepaidBody}
            checked={values.prepaidMeter}
            onCheckedChange={(v) => set("prepaidMeter", v)}
          />
          {mark("prepaidMeter")}
        </>
      ) : null}
    </>
  );
}
