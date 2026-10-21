import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_COOKIE_OPTIONS } from "@supabase/ssr";
// The library's own storage layer, which decides chunks and removals; the adapter only writes.
import { createStorageFromOptions } from "@supabase/ssr/dist/main/cookies.js";
import { AUTH_COOKIE_MAX_AGE_SECONDS, browserCookieMethods, serverCookiesSecure, withAuthCookiePolicy } from "./cookie-policy";

/** A browser-like cookie jar: document.cookie writes one cookie; Max-Age=0 deletes it. */
function jar() {
  const store = new Map<string, { value: string; attrs: string }>();
  const doc = {
    get cookie() {
      return [...store].map(([n, c]) => `${n}=${c.value}`).join("; ");
    },
    set cookie(line: string) {
      const [pair = "", ...attrs] = line.split("; ");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      if (attrs.some((a) => /^Max-Age=0$/i.test(a))) store.delete(name);
      else store.set(name, { value: pair.slice(eq + 1), attrs: attrs.join("; ") });
    },
  };
  return { doc, store };
}

/**
 * SEC-07: the session cookies are Secure on HTTPS and live 30 days, sliding,
 * not 400. The library's own defaults are the "before": it writes 400 days
 * and no Secure even when handed cookieOptions, which is why the policy is
 * applied where the cookie is written.
 */
describe("the auth cookie policy", () => {
  it("starts from a library default that is the problem (the before)", () => {
    expect(DEFAULT_COOKIE_OPTIONS.maxAge).toBe(400 * 24 * 60 * 60);
    expect(DEFAULT_COOKIE_OPTIONS.secure).not.toBe(true);
  });

  it("caps the lifetime at 30 days, adds Secure, keeps a removal a removal", () => {
    expect(withAuthCookiePolicy({ maxAge: 400 * 86_400, sameSite: "lax", path: "/" }, true)).toMatchObject({
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(withAuthCookiePolicy({ maxAge: 0 }, true).maxAge).toBe(0);
    expect(withAuthCookiePolicy(undefined, false).secure).toBe(false);
  });

  it("is applied by every writer of the session cookies: server client, proxy, browser client", () => {
    const src = (p: string) => readFileSync(join(__dirname, p), "utf8");
    for (const file of ["server.ts", "../../proxy.ts"]) {
      /* Two cookies the proxy writes are not session cookies and keep their
         own lifetimes: the locale (the URL's language, /ha /yo /ig, a year)
         and the first-run mark (`vallo_first_run`, set as the slides are
         served, 16 October 2026). Every other write is the session's. */
      const notSession = ["LOCALE_COOKIE,", "FIRST_RUN_COOKIE,"];
      const writes = [...src(file).matchAll(/\b(?:cookieStore|response\.cookies)\.set\(([^;]*)\);/g)]
        .map((m) => m[1] ?? "")
        .filter((w) => !notSession.some((name) => w.trimStart().startsWith(name)));
      expect(writes.length, file).toBeGreaterThan(0);
      for (const w of writes) expect(w, file).toContain("withAuthCookiePolicy(");
    }
    expect(src("client.ts")).toMatch(/cookies:\s*browserCookieMethods\(\)/);
  });

  it("writes Secure and 30 days from the browser on https, and reads back what it wrote", () => {
    const doc = { cookie: "" };
    const jar = browserCookieMethods(() => ({ doc, https: true }));
    jar.setAll([{ name: "sb-x-auth-token", value: "v", options: { ...DEFAULT_COOKIE_OPTIONS } }]);
    expect(doc.cookie).toContain("Secure");
    expect(doc.cookie).toContain(`Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`);
    expect(doc.cookie).not.toContain(`Max-Age=${400 * 86_400}`);
    expect(jar.getAll()[0]).toMatchObject({ name: "sb-x-auth-token", value: "v" });
  });

  it("leaves Secure off on a plain-http development page", () => {
    const doc = { cookie: "" };
    browserCookieMethods(() => ({ doc, https: false })).setAll([
      { name: "a", value: "b", options: { ...DEFAULT_COOKIE_OPTIONS } },
    ]);
    expect(doc.cookie).not.toContain("Secure");
  });

  it("decides Secure from the request's protocol, falling back to production only when it is unknown", () => {
    expect(serverCookiesSecure("https")).toBe(true);
    expect(serverCookiesSecure("https:")).toBe(true);
    expect(serverCookiesSecure("https,http")).toBe(true);
    expect(serverCookiesSecure("http:")).toBe(false);
    expect(serverCookiesSecure(null)).toBe(process.env.NODE_ENV === "production");
    const src = (p: string) => readFileSync(join(__dirname, p), "utf8");
    expect(src("../../proxy.ts")).toContain("serverCookiesSecure(request.nextUrl.protocol)");
    expect(src("server.ts")).toMatch(/serverCookiesSecure\(await visitorProtocol\(\)\)/);
  });

  it("chunks a large session, leaves no stale chunk behind, and sign-out empties the jar", async () => {
    const { doc, store } = jar();
    const { storage } = createStorageFromOptions(
      { cookieEncoding: "base64url", cookies: browserCookieMethods(() => ({ doc, https: true })) },
      false,
    );
    const key = "sb-project-auth-token";
    const big = JSON.stringify({ access_token: "a".repeat(6000), refresh_token: "r" });
    await storage.setItem(key, big);
    const chunks = [...store.keys()].sort();
    expect(chunks).toEqual([`${key}.0`, `${key}.1`, `${key}.2`]);
    for (const c of store.values()) {
      expect(c.attrs).toContain("Secure");
      expect(c.attrs).toContain(`Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`);
    }
    expect(await storage.getItem(key)).toBe(big);

    const small = JSON.stringify({ access_token: "a", refresh_token: "r" });
    await storage.setItem(key, small);
    expect([...store.keys()]).toEqual([key]);
    expect(await storage.getItem(key)).toBe(small);

    await storage.setItem(key, big);
    await storage.removeItem(key);
    expect(store.size).toBe(0);
  });
});
