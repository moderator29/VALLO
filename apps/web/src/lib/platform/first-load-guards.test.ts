import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * WHAT THE PERFORMANCE AUDIT TOOK OUT OF FIRST LOAD STAYS OUT (Agent NATIVE,
 * 8 November 2026; numbers in docs/handoff/PERFORMANCE_REPORT.md, SIMULATED).
 *
 * - supabase-js (67 KB gzipped) left the member layout: the in-app banner and
 *   every realtime hook load it inside the effect that opens the channel.
 *   On the build it had been in 198 routes' first load; after, 14.
 * - libphonenumber (40 KB gzipped) left the listing and stay pages (the
 *   guest's phone field loads with "booking for someone else") and every
 *   wallet page (two pure helpers moved out of `funds.ts`): 34 routes to 21.
 */
const read = (path: string) => withoutComments(readFileSync(join(process.cwd(), "src", path), "utf8"));
const STATIC_CLIENT = /^import\s+(?!type\b)[^;]*from\s+["'](?:@\/lib\/supabase|\.\.?\/supabase)\/client["']/m;

describe("first-load guards", () => {
  it.each(["components/app/notify/NotifyBanner.tsx", "lib/messages/useRealtime.ts", "components/app/WidgetBridge.tsx"])(
    "%s (mounted by the member layout) has no static import of the Supabase client",
    (path) => {
      expect(read(path)).not.toMatch(STATIC_CLIENT);
    },
  );

  it("every realtime channel in useRealtime.ts is opened through whenLoaded", () => {
    const src = read("lib/messages/useRealtime.ts");
    const channels = src.match(/\.channel\(/g)?.length ?? 0;
    const opened = src.match(/return whenLoaded\(\(supabase\) =>/g)?.length ?? 0;
    expect(channels).toBeGreaterThan(0);
    /* One channel per hook; a hook that opened a second channel would need its own look here. */
    expect(opened).toBe(channels);
  });

  it("the reserve panel loads PhoneField only when it is drawn", () => {
    const panel = read("app/(app)/listing/[id]/ReservePanel.tsx");
    expect(panel).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+["']@\/components\/app\/PhoneField["']/m);
    expect(panel).toContain('import("@/components/app/PhoneField")');
  });

  it("no wallet screen imports a value from lib/money/funds (it carries libphonenumber)", () => {
    const dir = join(process.cwd(), "src/components/money/balance");
    const offenders = readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
      .filter((f) => /^import\s+(?!type\b)[^;]*from\s+["']@\/lib\/money\/funds["']/m.test(read(`components/money/balance/${f}`)));
    expect(offenders).toEqual([]);
  });
});

describe("whenLoaded opens a channel exactly as an eager client did", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/supabase/load-client");
    vi.resetModules();
  });

  async function withClient() {
    let resolve!: (c: unknown) => void;
    const pending = new Promise((r) => (resolve = r));
    vi.resetModules();
    vi.doMock("@/lib/supabase/load-client", () => ({ loadBrowserClient: () => pending }));
    const { whenLoaded } = await import("@/lib/messages/useRealtime");
    return { whenLoaded, resolve };
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("opens once the client arrives, and the stop removes it", async () => {
    const { whenLoaded, resolve } = await withClient();
    const close = vi.fn();
    const open = vi.fn(() => close);
    const stop = whenLoaded(open as never);
    expect(open).not.toHaveBeenCalled();
    resolve({ id: "client" });
    await flush();
    expect(open).toHaveBeenCalledWith({ id: "client" });
    stop();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("never opens a channel whose screen left before the client arrived", async () => {
    const { whenLoaded, resolve } = await withClient();
    const open = vi.fn(() => () => undefined);
    const stop = whenLoaded(open as never);
    stop();
    resolve({ id: "client" });
    await flush();
    expect(open).not.toHaveBeenCalled();
  });

  it("opens nothing when the chunk could not be fetched", async () => {
    const { whenLoaded, resolve } = await withClient();
    const open = vi.fn(() => () => undefined);
    whenLoaded(open as never);
    resolve(null);
    await flush();
    expect(open).not.toHaveBeenCalled();
  });
});
