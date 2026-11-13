import { describe, expect, it } from "vitest";
import { guestKey, isBotAgent, isMissingFunction, listingIdFrom, viewRefusal, type ViewRequest } from "./record";

const CHROME = "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const APP_WEBVIEW = "Mozilla/5.0 (Linux; Android 13; TECNO KI5q Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

const base: ViewRequest = {
  userAgent: CHROME,
  origin: "https://www.vallospaces.com",
  host: "www.vallospaces.com",
  fetchSite: "same-origin",
  cookie: null,
  gpc: null,
};

describe("who may be counted", () => {
  it("counts a browser on a Vallo page, the app's web view and an iPhone", () => {
    expect(viewRefusal(base)).toBeNull();
    expect(viewRefusal({ ...base, userAgent: APP_WEBVIEW })).toBeNull();
    expect(viewRefusal({ ...base, userAgent: IPHONE, fetchSite: null })).toBeNull();
  });

  it("turns away another website and a request with no origin", () => {
    expect(viewRefusal({ ...base, fetchSite: "cross-site" })).toBe("foreign");
    expect(viewRefusal({ ...base, origin: "https://evil.example" })).toBe("foreign");
    expect(viewRefusal({ ...base, origin: null })).toBe("foreign");
    expect(viewRefusal({ ...base, host: null })).toBe("foreign");
  });

  it("turns away crawlers, previews, headless browsers and HTTP libraries", () => {
    for (const ua of [
      null,
      "",
      "curl/8.4.0",
      "python-requests/2.31",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.23.20.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)",
    ]) {
      expect(isBotAgent(ua), String(ua)).toBe(true);
    }
    expect(viewRefusal({ ...base, userAgent: "curl/8.4.0" })).toBe("bot");
  });

  it("respects a no to usage counts and Global Privacy Control, and treats no choice as no objection", () => {
    expect(viewRefusal({ ...base, cookie: "vallo_consent=1.10" })).toBe("declined");
    expect(viewRefusal({ ...base, cookie: "vallo_consent=1.00; nf_theme=dark" })).toBe("declined");
    expect(viewRefusal({ ...base, cookie: "vallo_consent=1.11" })).toBeNull();
    expect(viewRefusal({ ...base, cookie: "nf_theme=dark" })).toBeNull();
    expect(viewRefusal({ ...base, gpc: "1" })).toBe("declined");
  });
});

describe("the guest key", () => {
  it("is 64 hex characters, stable for one network and browser, and never contains the address", () => {
    const key = guestKey("102.89.34.7", CHROME);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(guestKey("102.89.34.7", CHROME)).toBe(key);
    expect(guestKey("102.89.34.8", CHROME)).not.toBe(key);
    expect(guestKey("102.89.34.7", IPHONE)).not.toBe(key);
    expect(key).not.toContain("102");
  });
});

describe("the beacon body", () => {
  it("accepts one listing id and nothing else", () => {
    expect(listingIdFrom('{"id":"7C1E9A52-3B84-4D6F-9A21-5E0D8F4B6C13"}')).toBe("7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13");
    expect(listingIdFrom('{"id":"nope"}')).toBeNull();
    expect(listingIdFrom("not json")).toBeNull();
    expect(listingIdFrom("null")).toBeNull();
    expect(listingIdFrom(`{"id":"7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13","x":"${"a".repeat(300)}"}`)).toBeNull();
  });

  it("knows a function that is not installed yet", () => {
    expect(isMissingFunction({ code: "PGRST202", message: "Could not find the function" })).toBe(true);
    expect(isMissingFunction({ code: "42883" })).toBe(true);
    expect(isMissingFunction({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingFunction(null)).toBe(false);
  });
});
