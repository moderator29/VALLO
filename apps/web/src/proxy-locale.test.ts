import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A10: LANGUAGES YOU CAN LINK TO, THROUGH THE REAL `proxy()`.
 *
 * `/ha/about` is served as `/about` with the locale on a request header;
 * `/ha/home` (not a public page) goes to `/home`; a bare public page is sent
 * to its language address for somebody who reads Hausa, Yoruba or Igbo, and
 * left alone for everybody else, crawlers included.
 */
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}));

async function visit(path: string, headers: Record<string, string> = {}) {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  const { proxy } = await import("./proxy");
  return proxy(
    new NextRequest(new URL(path, "https://www.vallospaces.com"), {
      headers: { "x-forwarded-for": "203.0.113.9", "sec-fetch-dest": "document", ...headers },
    }),
  );
}

const forwarded = (response: Response, name: string) => response.headers.get(`x-middleware-request-${name}`);

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("a language address", () => {
  it("serves the bare public page with the locale on the request", async () => {
    const response = await visit("/ha/about");
    expect(response.status).toBe(200);
    expect(new URL(response.headers.get("x-middleware-rewrite") ?? "").pathname).toBe("/about");
    expect(forwarded(response, "x-vallo-url-locale")).toBe("ha");
    expect(forwarded(response, "x-vallo-url-path")).toBe("/ha/about");
  });

  it("serves the landing page at /yo", async () => {
    const response = await visit("/yo");
    expect(new URL(response.headers.get("x-middleware-rewrite") ?? "").pathname).toBe("/");
    expect(forwarded(response, "x-vallo-url-locale")).toBe("yo");
  });

  it("sends a page that is not public to its bare address, where Settings decides", async () => {
    const response = await visit("/ig/home");
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/home");
  });

  it("does not let a client choose the locale header for itself", async () => {
    const response = await visit("/about", { "x-vallo-url-locale": "ig", "accept-language": "en-GB" });
    expect(forwarded(response, "x-vallo-url-locale")).toBeNull();
  });

  it("names every language in an hreflang Link header", async () => {
    const link = (await visit("/ha/sign-in")).headers.get("link") ?? "";
    for (const lang of ["en", "ha", "yo", "ig", "x-default"]) expect(link).toContain(`hreflang="${lang}"`);
    expect(link).toContain("<https://www.vallospaces.com/ig/sign-in>");
  });

  it("sends no hreflang set for a page whose body is English in every language", async () => {
    expect((await visit("/ha/terms")).headers.get("link")).toBeNull();
    expect((await visit("/terms")).headers.get("link")).toBeNull();
  });

  it("stores the language for a first-time visitor, and never overrides a choice", async () => {
    const fresh = await visit("/ha/about");
    expect(fresh.headers.get("set-cookie") ?? "").toContain("nf_locale=ha");
    const member = await visit("/ha/about", { cookie: "nf_locale=en" });
    expect(member.headers.get("set-cookie") ?? "").not.toContain("nf_locale=ha");
  });
});

describe("a bare public page", () => {
  it("is sent to the reader's language address", async () => {
    const byCookie = await visit("/about", { cookie: "nf_locale=yo" });
    expect(byCookie.status).toBe(307);
    expect(new URL(byCookie.headers.get("location") ?? "").pathname).toBe("/yo/about");
    const byBrowser = await visit("/", { "accept-language": "ha-NG,ha;q=0.9" });
    expect(new URL(byBrowser.headers.get("location") ?? "").pathname).toBe("/ha");
  });

  it("stays English for English readers and for crawlers that send no language", async () => {
    expect((await visit("/about", { "accept-language": "en-US" })).status).toBe(200);
    expect((await visit("/about")).status).toBe(200);
    expect((await visit("/about", { cookie: "nf_locale=en", "accept-language": "yo" })).status).toBe(200);
  });

  it("leaves the signed-in app alone", async () => {
    const response = await visit("/home", { cookie: "nf_locale=ha" });
    /* A stranger is sent to sign in, as ever; nothing adds a language to it. */
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/sign-in");
  });
});
