import { afterEach, describe, expect, it, vi } from "vitest";
import { seedTabs } from "./page-cache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("seedTabs (fast-start plan item 3)", () => {
  it("does nothing, and says so, where no worker controls the page", () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: null } });
    expect(seedTabs(["/home", "/search"])).toBe(false);
  });

  it("asks the controlling worker once, with only same-origin paths, at most six", () => {
    const post = vi.fn();
    vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage: post } } });
    const ok = seedTabs(["/home", "https://evil.example/x", "//evil.example/y", "/search", "/messages", "/profile", "/around", "/a", "/b"]);
    expect(ok).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    const message = post.mock.calls[0]![0] as { type: string; paths: string[] };
    expect(message.type).toBe("vallo:seed");
    expect(message.paths).toEqual(["/home", "/search", "/messages", "/profile", "/around", "/a"]);
  });

  it("never throws when the worker's postMessage does", () => {
    vi.stubGlobal("navigator", {
      serviceWorker: {
        controller: {
          postMessage: () => {
            throw new Error("detached");
          },
        },
      },
    });
    expect(seedTabs(["/home"])).toBe(false);
  });
});
