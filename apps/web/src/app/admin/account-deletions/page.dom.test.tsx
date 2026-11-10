import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** THE ACCOUNT DELETIONS DESK: its door, its honest states, its rates, and notes for a super admin only. */
const h = vi.hoisted(() => ({ door: { value: {} as Record<string, unknown> }, read: vi.fn() }));
vi.mock("@/lib/admin/account-deletions/door", () => ({ requireDeletionReasonsDoor: async () => h.door.value }));
vi.mock("@/lib/admin/account-deletions/read", async () => ({ readDeletionReasons: h.read, toDeskRead: (await vi.importActual<typeof import("@/lib/admin/account-deletions/read")>("@/lib/admin/account-deletions/read")).toDeskRead }));
vi.mock("./CopyActions", () => ({ CopyActions: ({ summary, disabled }: { summary: string; disabled: boolean }) => <button data-testid="copy" disabled={disabled}>{summary}</button> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/admin/account-deletions" }));

const { default: Page } = await import("./page");
const html = async (range?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(range ? { range } : {}) }));
const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const recent = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

beforeEach(() => {
  h.door.value = { state: "admin", supabase: {}, isSuperAdmin: false };
  h.read.mockReset();
});

describe("the door", () => {
  it("refuses someone without a scope, and reads nothing", async () => {
    h.door.value = { state: "not-admin" };
    expect(text(await html())).toMatch(/Operations, Support lead and Marketing/);
    expect(h.read).not.toHaveBeenCalled();
  });
});

describe("the states", () => {
  it("says not switched on, plainly", async () => {
    h.read.mockResolvedValue({ state: "not-switched-on" });
    expect(text(await html())).toMatch(/Not switched on yet/);
  });
  it("says unavailable on a failed read, not an empty table", async () => {
    h.read.mockResolvedValue({ state: "unavailable" });
    expect(await html()).not.toContain("deletion-reasons-table");
  });
  it("has an honest empty state", async () => {
    h.read.mockResolvedValue({ state: "ok", rows: [] });
    const out = text(await html());
    expect(out).toMatch(/No deletion requests/);
  });
});

describe("the rates", () => {
  const rows = [
    { reason: "privacy", requestedAt: recent(1), restoredAt: recent(0), note: "ads" },
    { reason: "privacy", requestedAt: recent(2), restoredAt: null, note: "my own words" },
    { reason: "not_given", requestedAt: recent(3), restoredAt: null, note: null },
    { reason: "other", requestedAt: recent(40), restoredAt: null, note: null },
  ];
  it("ranks reasons with count, share and a transform bar", async () => {
    h.read.mockResolvedValue({ state: "ok", rows });
    const out = await html("30");
    expect(text(out)).toMatch(/Privacy 2 · 66\.7%/);
    expect(out).toContain("scaleX(0.667)");
    expect(text(out)).toMatch(/Restored within 30 days 1 \(33\.3%\)/);
    expect(text(out)).toMatch(/Reason not given 1 \(33\.3%\)/);
    expect(out.indexOf("deletion-reason-privacy")).toBeLessThan(out.indexOf("deletion-reason-not_given"));
  });
  it("changes with the range", async () => {
    h.read.mockResolvedValue({ state: "ok", rows });
    expect(text(await html("all"))).toMatch(/Requests, all time 4/);
  });
  it("hides notes from an admin and shows them to a super admin", async () => {
    h.read.mockResolvedValue({ state: "ok", rows });
    expect(await html()).not.toContain("my own words");
    h.door.value = { state: "admin", supabase: {}, isSuperAdmin: true };
    expect(await html()).toContain("my own words");
    expect(h.read).toHaveBeenLastCalledWith(expect.anything(), true);
  });
  it("carries the copy summary", async () => {
    h.read.mockResolvedValue({ state: "ok", rows });
    expect(text(await html())).toMatch(/Account deletion requests, 30 days: 3\./);
  });
});
