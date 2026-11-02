import { randomUUID } from "node:crypto";
import { dojahClient, type DojahClient } from "./dojah/client";
import { dojahConfig } from "./dojah/config";

/**
 * THE IDENTITY AGGREGATOR (V-49), AS AN INTERFACE.
 *
 * NIMC's virtual NIN is exposed by several licensed aggregators (Dojah,
 * Youverify, Prembly, QoreID, VerifyMe, Smile ID). Which one holds Vallo's
 * users' identity checks is founder question 4, so the product is built
 * against this interface and ships with:
 *
 *   unconfigured  the production default until a contract is signed: it
 *                 verifies nothing and says so, and `vnin_identity` stays off.
 *   stub          for tests: answers from a fixture table keyed by token.
 *
 * THE ONE SWAP. Implement `IdentityProvider` for the chosen aggregator (the
 * vNIN lookup), return it from
 * `identityProvider()` when its key is present, set VALLO_NIN_HMAC_KEY, and
 * turn the flag on.
 *
 * NO SELFIE, SO NO LIVENESS. No screen captures one, so the interface does
 * not pretend to carry a score; a face match is a later addition with its own
 * capture step.
 *
 * WHAT A PROVIDER RETURNS AND WHAT HAPPENS TO IT. The NIN comes back so it can
 * be HMACed at once (`nin.ts`) and then dropped: it is never stored, logged or
 * returned to a screen. The legal name is kept, because the name is what the
 * rung, the payout match and the account check compare with.
 */

export type VninAnswer =
  | {
      ok: true;
      nin: string;
      legalName: string;
      /** The aggregator's own reference for this check, for the audit trail. */
      reference: string;
    }
  | { ok: false; reason: "unconfigured" | "not_found" | "expired" | "failed" };

export interface IdentityProvider {
  readonly name: string;
  verifyVnin(input: { vnin: string }): Promise<VninAnswer>;
}

export const unconfiguredProvider: IdentityProvider = {
  name: "unconfigured",
  async verifyVnin() {
    return { ok: false, reason: "unconfigured" };
  },
};

export function stubProvider(fixtures: Record<string, VninAnswer>): IdentityProvider {
  return {
    name: "stub",
    async verifyVnin({ vnin }) {
      return fixtures[vnin] ?? { ok: false, reason: "not_found" };
    },
  };
}

/**
 * DOJAH (2 November 2026), the aggregator Vallo signed with: GET
 * /api/v1/kyc/vnin. Dojah returns no reference of its own for a lookup, so
 * the audit reference is ours, prefixed so the desk can tell where it came from.
 */
export function dojahVninProvider(client: Pick<DojahClient, "vnin">): IdentityProvider {
  return {
    name: "dojah",
    async verifyVnin({ vnin }) {
      const answer = await client.vnin(vnin);
      if (!answer.ok) {
        if (answer.reason === "not_found" || answer.reason === "invalid") return { ok: false, reason: "not_found" };
        return { ok: false, reason: "failed" };
      }
      const e = answer.entity;
      const nin = (e.nin ?? "").replace(/\D/g, "");
      const legalName = [e.first_name ?? e.firstname, e.middle_name ?? e.middlename, e.last_name ?? e.surname]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(" ");
      if (!/^\d{11}$/.test(nin) || legalName.length < 2) return { ok: false, reason: "failed" };
      return { ok: true, nin, legalName, reference: `dojah-vnin:${randomUUID()}` };
    },
  };
}

/** The provider this deployment uses: Dojah when its keys are present, otherwise none. */
export function identityProvider(): IdentityProvider {
  const config = dojahConfig();
  return config ? dojahVninProvider(dojahClient(config)) : unconfiguredProvider;
}
