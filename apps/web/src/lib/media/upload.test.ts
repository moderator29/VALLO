import { describe, expect, it, vi } from "vitest";
import { withTimeout } from "./upload";

describe("withTimeout", () => {
  it("rejects when the work never settles", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => {}), 1000);
    const caught = pending.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await caught).toBe("timeout");
    vi.useRealTimers();
  });
  it("passes the value through when the work settles in time", async () => {
    expect(await withTimeout(Promise.resolve(7), 1000)).toBe(7);
  });
});

describe("uploadToStorage with a signed token", () => {
  it("sends the storage client's own signed PUT and needs no session", async () => {
    const calls: { method: string; url: string; headers: Record<string, string>; body: unknown }[] = [];
    class FakeRequest {
      status = 200;
      upload: { onprogress?: (e: unknown) => void } = {};
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      rec = { method: "", url: "", headers: {} as Record<string, string>, body: undefined as unknown };
      open(method: string, url: string) {
        this.rec.method = method;
        this.rec.url = url;
      }
      setRequestHeader(k: string, v: string) {
        this.rec.headers[k.toLowerCase()] = v;
      }
      abort() {}
      send(body: unknown) {
        this.rec.body = body;
        calls.push(this.rec);
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeRequest);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("navigator", { onLine: true });
    const { uploadToStorage } = await import("./upload");
    const supabase = {
      auth: {
        getSession: async () => {
          throw new Error("a signed upload needs no session");
        },
      },
    } as never;
    const result = await uploadToStorage({
      supabase,
      bucket: "inspection-photos",
      path: "a/b c.jpg",
      body: new Blob(["x"], { type: "image/jpeg" }),
      contentType: "image/jpeg",
      signedToken: "tok123",
    });
    vi.unstubAllGlobals();
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toContain("/storage/v1/object/upload/sign/inspection-photos/a/b%20c.jpg?token=tok123");
    expect(calls[0]!.headers["x-upsert"]).toBe("false");
    expect(calls[0]!.headers["content-type"]).toBeUndefined();
    expect(calls[0]!.body).toBeInstanceOf(FormData);
  });
});
