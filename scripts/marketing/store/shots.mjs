/**
 * The store images, in store order (the first three matter most). The
 * layouts are in shots/premium.mjs (the 35-image set) and shots/v2.mjs (the
 * 10-image set, STORE_SET=v2); each shot has a number, a slug (the file
 * name), the capture(s) it shows (docs/marketing/screens/<id>-ios.png and
 * -android.png) and a layout that draws it for either store.
 *
 * Copy follows scripts/marketing/DESIGN.md section 2: no em dashes,
 * "verified" only about people, no promise or valuation words, no invented
 * numbers, and an Example chip on every card that shows a booking, a table,
 * a payment or an inspection.
 */
import { SHOTS as SHOTS_35, FEATURE as FEATURE_35, GROUND } from "./shots/premium.mjs";
import { SHOTS_V2 } from "./shots/v2.mjs";
import { SHOTS_V3 } from "./shots/v3.mjs";

export const SHOTS = process.env.STORE_SET === "v3" ? SHOTS_V3 : process.env.STORE_SET === "v2" ? SHOTS_V2 : SHOTS_35;
export const FEATURE = FEATURE_35;
export { GROUND };

export const pad = (n) => String(n).padStart(2, "0");
export const shotName = (s) => `${pad(s.n)}-${s.slug}`;
