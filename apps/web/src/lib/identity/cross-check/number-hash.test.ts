import { describe, expect, it } from "vitest";

import { bvnHmac, ninHmac } from "../nin";
import { MIN_HMAC_KEY_LENGTH, idNumberHmac, idNumberKey } from "./number-hash";

const KEY = "k".repeat(MIN_HMAC_KEY_LENGTH);

describe("the keyed hash of an ID number", () => {
  it("is the vNIN route's own hash for a NIN and for a BVN, so the two routes recognise each other", () => {
    expect(idNumberHmac("nin", "12345678901", KEY)).toBe(ninHmac("12345678901", KEY));
    expect(idNumberHmac("bvn", "22123456789", KEY)).toBe(bvnHmac("22123456789", KEY));
  });

  it("gives the same digits a different hash on each kind of document", () => {
    const hashes = new Set([
      idNumberHmac("nin", "12345678901", KEY),
      idNumberHmac("bvn", "12345678901", KEY),
      idNumberHmac("passport", "12345678901", KEY),
      idNumberHmac("drivers_licence", "12345678901", KEY),
      idNumberHmac("voters_card", "12345678901", KEY),
    ]);
    expect(hashes.size).toBe(5);
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("still hashes a NIN of the wrong shape, so a forged number used twice is recognised", () => {
    const odd = idNumberHmac("nin", "1234567", KEY);
    expect(odd).toMatch(/^[0-9a-f]{64}$/);
    expect(odd).toBe(idNumberHmac("nin", "1234567", KEY));
    expect(odd).not.toBe(idNumberHmac("bvn", "1234567", KEY));
  });

  it("depends on the key, and refuses one too short to be a secret or an empty number", () => {
    expect(idNumberHmac("passport", "A12345678", KEY)).not.toBe(idNumberHmac("passport", "A12345678", "j".repeat(40)));
    expect(() => idNumberHmac("passport", "A12345678", "short")).toThrow();
    expect(() => idNumberHmac("passport", "", KEY)).toThrow();
  });

  it("reads the key from the server's settings, or answers null", () => {
    expect(idNumberKey({ VALLO_NIN_HMAC_KEY: KEY })).toBe(KEY);
    expect(idNumberKey({ VALLO_NIN_HMAC_KEY: "short" })).toBeNull();
    expect(idNumberKey({})).toBeNull();
  });
});
