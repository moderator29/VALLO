import "server-only";

import { createHmac } from "node:crypto";

import { bvnHmac, isNin, ninHmac } from "../nin";
import type { IdNumberKind } from "./formats";

/**
 * AN ID NUMBER, COMPARED WITHOUT BEING KEPT (15 November 2026).
 *
 * The same rule as `lib/identity/nin.ts`: the number a reviewer types from a
 * document is turned into an HMAC under the server-held key
 * (`VALLO_NIN_HMAC_KEY`) and only that is stored, so a second account showing
 * the same number is recognised and nobody holding the database can get the
 * number back. An 11-digit number is short enough to guess by trying every
 * one, which is why this is a keyed hash and never a plain one.
 *
 * A NIN and a BVN go through the existing `ninHmac` and `bvnHmac`, so a number
 * typed here matches the same number recorded by the vNIN and selfie-check
 * routes if they are ever switched on. The other documents get their own
 * prefix, so a passport number and a licence number can never collide.
 */

export const MIN_HMAC_KEY_LENGTH = 32;

/** The key, or null when this server has none fit to use. */
export function idNumberKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.VALLO_NIN_HMAC_KEY ?? "";
  return key.length >= MIN_HMAC_KEY_LENGTH ? key : null;
}

/** The keyed hash of a normalised ID number, hex. Throws on a key too short to be a secret. */
export function idNumberHmac(kind: IdNumberKind, normalised: string, key: string): string {
  if (key.length < MIN_HMAC_KEY_LENGTH) throw new Error("ID number HMAC key missing or too short");
  if (normalised === "") throw new Error("no ID number");
  if (kind === "nin" && isNin(normalised)) return ninHmac(normalised, key);
  if (kind === "bvn" && /^\d{11}$/.test(normalised)) return bvnHmac(normalised, key);
  return createHmac("sha256", key).update(`${kind}:${normalised}`).digest("hex");
}
