import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A root element with just the attribute calls the module makes. */
function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
    removeAttribute: (name: string) => void attrs.delete(name),
  };
}

describe("root flags", () => {
  let root: ReturnType<typeof fakeRoot>;

  beforeEach(() => {
    vi.resetModules();
    root = fakeRoot();
    vi.stubGlobal("document", { documentElement: root });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("holds the attribute until every owner has lowered it", async () => {
    const { raiseRootFlag } = await import("./root-flag");
    const a = raiseRootFlag("docked");
    const b = raiseRootFlag("docked");
    expect(root.attrs.get("data-docked")).toBe("");
    a();
    expect(root.attrs.has("data-docked")).toBe(true);
    b();
    expect(root.attrs.has("data-docked")).toBe(false);
  });

  it("lowers once however often the release is called", async () => {
    const { raiseRootFlag } = await import("./root-flag");
    const a = raiseRootFlag("toast-up");
    const b = raiseRootFlag("toast-up");
    a();
    a();
    expect(root.attrs.has("data-toast-up")).toBe(true);
    b();
    expect(root.attrs.has("data-toast-up")).toBe(false);
  });

  it("keeps separate flags apart", async () => {
    const { raiseRootFlag } = await import("./root-flag");
    const docked = raiseRootFlag("docked");
    const admin = raiseRootFlag("admin");
    docked();
    expect(root.attrs.has("data-docked")).toBe(false);
    expect(root.attrs.get("data-admin")).toBe("");
    admin();
  });
});
