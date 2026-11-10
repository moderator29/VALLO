/**
 * The pop-out furniture of all 35 shots, merged from the batch files.
 * premium.mjs's `std()` looks each shot up by its number.
 */
import { F as A } from "./a.mjs";
import { F as B } from "./b.mjs";
import { F as C } from "./c.mjs";

export const FURNITURE = { ...A, ...B, ...C };
