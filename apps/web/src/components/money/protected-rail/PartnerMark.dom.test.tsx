import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* The provider's asset arriving is `partnerMarkReady` turning true in
   protected-wording.ts; the founder's presentation choice is the flag. */
const ready = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/money/protected-wording", async (load) => {
  const real = await load<typeof import("@/lib/money/protected-wording")>();
  return {
    ...real,
    get partnerMarkReady() {
      return ready.value;
    },
  };
});

const { PartnerMark } = await import("./PartnerMark");
const { partnerMarkOn } = await import("@/lib/money/protected-read");

describe("the partner mark beside the pay button", () => {
  it("draws nothing today: the provider has not supplied the mark, whatever the flag says", async () => {
    ready.value = false;
    expect(renderToStaticMarkup(<PartnerMark on />)).toBe("");
    expect(await partnerMarkOn(async () => true)).toBe(false);
  });

  it("draws nothing when the founder's flag is off, even with the mark supplied (full white label)", async () => {
    ready.value = true;
    expect(renderToStaticMarkup(<PartnerMark on={false} />)).toBe("");
    expect(await partnerMarkOn(async () => false)).toBe(false);
    expect(await partnerMarkOn(async () => Promise.reject(new Error("flag read failed")))).toBe(false);
  });

  it("draws one quiet line only when both are true", async () => {
    ready.value = true;
    const out = renderToStaticMarkup(<PartnerMark on />);
    expect(out).toContain('data-testid="pp-partner-mark"');
    expect(out.replace(/<[^>]+>/g, "")).toMatch(/^Secured by /);
    expect(await partnerMarkOn(async () => true)).toBe(true);
  });
});
