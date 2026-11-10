// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dismissToast, subscribeToast } from "@/lib/ui/toast";
import { COPY_WORDS, CopyButton, CopyValue } from "./CopyButton";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let shown: string[] = [];
let root: Root | null = null;
let host: HTMLElement | null = null;

function render(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
}
const button = () => host!.querySelector("button") as HTMLButtonElement;
const click = async () => {
  await act(async () => {
    button().click();
  });
};
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
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  it("has an accessible name", () => {
    render(<CopyButton value="x" label="Copy booking reference" />);
    expect(button().getAttribute("aria-label")).toBe("Copy booking reference");
  });

  it("copies with the async clipboard and says so in the banner", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="https://example.test/l/1" kind="link" />);
    await click();
    expect(writeText).toHaveBeenCalledWith("https://example.test/l/1");
    expect(shown).toContain(COPY_WORDS.link);
    expect(button().getAttribute("data-copied")).toBe("");
  });

  it("falls back to a textarea when there is no async clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    render(<CopyButton value="REF-1" message="Reference copied" />);
    await click();
    expect(exec).toHaveBeenCalledWith("copy");
    expect(shown).toContain("Reference copied");
  });

  it("says it could not copy when both paths fail", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn().mockReturnValue(false);
    render(<CopyButton value="x" />);
    await click();
    expect(shown).toContain(COPY_WORDS.failed);
  });

  it("CopyValue shows the value beside its button", () => {
    render(<CopyValue value="VL-2026-0042" label="Copy reference" />);
    expect(host!.textContent).toContain("VL-2026-0042");
    expect(button().getAttribute("aria-label")).toBe("Copy reference");
  });
});
