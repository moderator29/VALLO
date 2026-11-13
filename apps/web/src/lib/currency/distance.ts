/**
 * DISTANCE IN THE READER'S UNIT. Client-safe, pure.
 *
 * Vallo measures in kilometres and stores kilometres. A reader who thinks in
 * miles (the UK and US diaspora) can ask to see miles. One mile is exactly
 * 1.609344 km by definition. Figures under ten are kept to one decimal, as a
 * distance across a city is read ("4.3 mi"); ten and over are whole.
 */

export const DISTANCE_UNITS = ["km", "mi"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];
export const DEFAULT_DISTANCE_UNIT: DistanceUnit = "km";

export const KM_PER_MILE = 1.609344;

export function isDistanceUnit(value: unknown): value is DistanceUnit {
  return value === "km" || value === "mi";
}

/** A stored kilometre figure in the reader's unit. */
export function distanceIn(km: number, unit: DistanceUnit): number {
  if (!Number.isFinite(km)) return Number.NaN;
  return unit === "mi" ? km / KM_PER_MILE : km;
}

const SHORT = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/** The figure alone, "4.3" or "27", for a surface that prints its own unit. */
export function distanceFigure(km: number, unit: DistanceUnit): string {
  const value = distanceIn(km, unit);
  if (!Number.isFinite(value)) return "";
  return Math.abs(value) < 10 ? SHORT.format(value) : WHOLE.format(value);
}

/** "27 km" or "17 mi". `labels` is copy so it can be translated. */
export function formatDistance(km: number, unit: DistanceUnit, labels: { km: string; mi: string }): string {
  const figure = distanceFigure(km, unit);
  return figure ? `${figure} ${unit === "mi" ? labels.mi : labels.km}` : "";
}
