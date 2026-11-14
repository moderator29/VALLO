import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentToast, dismissToast } from "@/lib/ui/toast";
import { COPY_WORDS, copyAndSay } from "@/lib/ui/copy-and-say";

vi.mock("@/lib/ui/feedback", () => ({ feedback: vi.fn() }));
vi.mock("@/lib/native/device", () => ({ nativeShare: async () => "unhandled" }));

function stubBrowser(clipboard: unknown, exec: () => boolean) {
  const field = { value: "", style: {} as Record<string, string>, setAttribute: vi.fn(), select: vi.fn() };
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { clipboard });
  vi.stubGlobal("document", {
    createElement: () => field,
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
    execCommand: exec,
  });
  return field;
}

beforeEach(() => dismissToast());
afterEach(() => {
  vi.unstubAllGlobals();
  dismissToast();
});

describe("copyAndSay", () => {
  it("copies with the async clipboard and says what it copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubBrowser({ writeText }, () => false);
    expect(await copyAndSay("https://x.test/l/1", "link")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://x.test/l/1");
    expect(currentToast()?.message).toBe(COPY_WORDS.link);
    /* The confirmation is the QUICK PILL (founder, 14 November 2026): short,
       near the hand, gone by itself, never an action. */
    expect(currentToast()?.quick).toBe(true);
    expect(currentToast()?.action).toBeUndefined();
  });

  it("falls back to a textarea when there is no async clipboard", async () => {
    const field = stubBrowser(undefined, () => true);
    expect(await copyAndSay("REF-1", "code", "Reference copied")).toBe(true);
    expect(field.value).toBe("REF-1");
    expect(currentToast()?.message).toBe("Reference copied");
  });

  it("says it could not copy when both paths fail", async () => {
    stubBrowser({ writeText: vi.fn().mockRejectedValue(new Error("no")) }, () => false);
    expect(await copyAndSay("x", "text")).toBe(false);
    expect(currentToast()?.message).toBe(COPY_WORDS.failed);
    expect(currentToast()?.tone).toBe("error");
    /* A failure needs reading time: the top banner, never the pill. */
    expect(currentToast()?.quick).toBeUndefined();
  });
});
