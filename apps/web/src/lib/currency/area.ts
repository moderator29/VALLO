/**
 * FLOOR AREA IN THE READER'S UNIT. Client-safe, pure.
 *
 * Listers give floor area in square metres and Vallo stores square metres;
 * that does not change. A reader who thinks in square feet (much of the
 * diaspora in the UK, the US and Canada) can ask to see square feet instead.
 * The conversion is exact by definition (one foot is 0.3048 metres, so one
 * square metre is 10.7639104... square feet) and the figure is rounded to a
 * whole square foot, because nobody measures a flat to the inch.
 *
 * Unlike money, area is not a legal quantity here, so the converted figure is
 * shown as the figure, not as "about". The stored value is never touched.
 */

export const AREA_UNITS = ["sqm", "sqft"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];
export const DEFAULT_AREA_UNIT: AreaUnit = "sqm";

/** Square feet in one square metre: 1 / 0.3048^2. */
export const SQFT_PER_SQM = 1 / (0.3048 * 0.3048);

export function isAreaUnit(value: unknown): value is AreaUnit {
  return value === "sqm" || value === "sqft";
}

/** A stored square-metre figure in the reader's unit, whole numbers for feet. */
export function areaIn(sqm: number, unit: AreaUnit): number {
  if (!Number.isFinite(sqm)) return Number.NaN;
  return unit === "sqft" ? Math.round(sqm * SQFT_PER_SQM) : sqm;
}

const GROUPED = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 });

/** "120 m²" or "1,292 sq ft". `labels` is copy so it can be translated. */
export function formatArea(sqm: number, unit: AreaUnit, labels: { sqm: string; sqft: string }): string {
  const value = areaIn(sqm, unit);
  if (!Number.isFinite(value)) return "";
  return `${GROUPED.format(value)} ${unit === "sqft" ? labels.sqft : labels.sqm}`;
}
