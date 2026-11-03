import { describe, expect, it } from "vitest";
import { firstRunCookieFrom, staleFirstRunCookies } from "./first-run-seen";

describe("firstRunCookieFrom: every copy of the cookie, the strongest word wins", () => {
  it("reads one copy", () => {
    expect(firstRunCookieFrom("a=1; vallo_first_run=shown; b=2")).toBe("shown");
  });

  it("agrees whichever copy the browser sends first (the loop of 29 October 2026)", () => {
    expect(firstRunCookieFrom("vallo_first_run=; vallo_first_run=seen")).toBe("seen");
    expect(firstRunCookieFrom("vallo_first_run=seen; vallo_first_run=shown")).toBe("seen");
    expect(firstRunCookieFrom("vallo_first_run=1; vallo_first_run=shown")).toBe("shown");
  });

  it("is nothing for no header or no copy", () => {
    expect(firstRunCookieFrom(null)).toBeUndefined();
    expect(firstRunCookieFrom("sb-x-auth-token=abc")).toBeUndefined();
  });
});

describe("staleFirstRunCookies", () => {
  it("expires the copies at another path and on the parent domain", () => {
    const stale = staleFirstRunCookies("www.vallospaces.com");
    expect(stale).toContain("vallo_first_run=; Path=/welcome; Max-Age=0; SameSite=Lax");
    expect(stale).toContain("vallo_first_run=; Path=/; Domain=.vallospaces.com; Max-Age=0; SameSite=Lax");
  });

  it("never names a domain for localhost or an address", () => {
    expect(staleFirstRunCookies("localhost").some((s) => s.includes("Domain"))).toBe(false);
    expect(staleFirstRunCookies("127.0.0.1").some((s) => s.includes("Domain"))).toBe(false);
  });
});
