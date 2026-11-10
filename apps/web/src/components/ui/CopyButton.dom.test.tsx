// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dismissToast, subscribeToast } from "@/lib/ui/toast";
import { COPY_WORDS, CopyButton, CopyValue } from "./CopyButton";

let shown: string[] = [];
let off: () => void = () => {};

beforeEach(() => {
  shown = [];
  off = subscribeToast((item) => {
    if (item) shown.push(item.message);
  });
});
afterEach(() => {
  off();
  dismissToast();
  cleanup();
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  it("has an accessible name", () => {
    render(<CopyButton value="x" label="Copy booking reference" />);
    expect(screen.getByRole("button", { name: "Copy booking reference" })).toBeTruthy();
  });

  it("copies with the async clipboard and says so in the banner", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="https://example.test/l/1" kind="link" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(writeText).toHaveBeenCalledWith("https://example.test/l/1");
    expect(shown).toContain(COPY_WORDS.link);
    expect(screen.getByRole("button").getAttribute("data-copied")).toBe("");
  });

  it("falls back to a textarea when there is no async clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    render(<CopyButton value="REF-1" message="Reference copied" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(exec).toHaveBeenCalledWith("copy");
    expect(shown).toContain("Reference copied");
  });

  it("says it could not copy when both paths fail", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn().mockReturnValue(false);
    render(<CopyButton value="x" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(shown).toContain(COPY_WORDS.failed);
  });

  it("CopyValue shows the value beside its button", () => {
    render(<CopyValue value="VL-2026-0042" label="Copy reference" />);
    expect(screen.getByText("VL-2026-0042")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy reference" })).toBeTruthy();
  });
});
