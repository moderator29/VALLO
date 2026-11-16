import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./rail-live", () => ({ protectedRailLive: vi.fn(async () => false) }));

import { ESCROW_PROMPT_OFF, ESCROW_PROMPT_ON, escrowPromptLine, escrowPromptLineFor } from "./escrow-prompt";
import { PROTECTED_FUNDS_WORDING_FULL } from "./protected-wording";
import { protectedRailLive } from "./rail-live";

/* The founder, 16 November 2026: the assistant told a member Vallo "doesn't
   use escrow at all". Vallo is built on escrow; it is switched off today. */
describe("what every Vallo AI says about escrow", () => {
  it("switched off: Vallo uses escrow, it is not on yet, and it is never offered", () => {
    expect(ESCROW_PROMPT_OFF).toMatch(/Vallo is built on escrow/);
    expect(ESCROW_PROMPT_OFF).toMatch(/not switched on yet/);
    expect(ESCROW_PROMPT_OFF).toMatch(/never tell anybody they can pay by escrow today/);
    expect(ESCROW_PROMPT_OFF).toMatch(/never say Vallo does not use or offer escrow/);
    expect(ESCROW_PROMPT_OFF).not.toMatch(/EscrowPay|Rubies/);
  });

  it("switched on: the provider's own funds wording, unaltered", () => {
    expect(ESCROW_PROMPT_ON).toContain(PROTECTED_FUNDS_WORDING_FULL);
    expect(ESCROW_PROMPT_ON).toMatch(/Vallo itself never holds the money/);
  });

  it("follows the live switch, and a failed read is off", async () => {
    expect(escrowPromptLineFor(true)).toBe(ESCROW_PROMPT_ON);
    expect(escrowPromptLineFor(false)).toBe(ESCROW_PROMPT_OFF);
    vi.mocked(protectedRailLive).mockResolvedValueOnce(true);
    expect(await escrowPromptLine()).toBe(ESCROW_PROMPT_ON);
    vi.mocked(protectedRailLive).mockRejectedValueOnce(new Error("down"));
    expect(await escrowPromptLine()).toBe(ESCROW_PROMPT_OFF);
  });
});
