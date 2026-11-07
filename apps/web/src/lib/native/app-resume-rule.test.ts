import { describe, expect, it } from "vitest";
import { isTyping, RESUME_REFRESH_AFTER_MS, shouldRefreshOnResume } from "./app-resume-rule";

describe("coming back to the app (Grade 1, P0.5)", () => {
  it("refreshes only after a real absence, online, and not while typing", () => {
    const base = { awayMs: RESUME_REFRESH_AFTER_MS, typing: false, online: true };
    expect(shouldRefreshOnResume(base)).toBe(true);
    expect(shouldRefreshOnResume({ ...base, awayMs: 5_000 })).toBe(false);
    expect(shouldRefreshOnResume({ ...base, typing: true })).toBe(false);
    expect(shouldRefreshOnResume({ ...base, online: false })).toBe(false);
  });

  it("knows a text field from a button", () => {
    const el = (tag: string, type?: string) => ({ tagName: tag, type, isContentEditable: false }) as unknown as Element;
    expect(isTyping(el("TEXTAREA"))).toBe(true);
    expect(isTyping(el("INPUT", "text"))).toBe(true);
    expect(isTyping(el("INPUT", "search"))).toBe(true);
    expect(isTyping(el("INPUT", "checkbox"))).toBe(false);
    expect(isTyping(el("BUTTON"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
