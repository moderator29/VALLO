import { describe, expect, it } from "vitest";
import { intentPrefetchHref } from "./intent-prefetch";

const O = "https://www.vallospaces.com";
const ID = "ed000000-0000-4000-8000-00000000000d";

describe("intentPrefetchHref", () => {
  it("fetches the catalogue's detail pages whole, query kept", () => {
    expect(intentPrefetchHref(`${O}/listing/${ID}`, O)).toBe(`/listing/${ID}`);
    expect(intentPrefetchHref(`/stay/${ID}?checkIn=2026-12-01`, O)).toBe(`/stay/${ID}?checkIn=2026-12-01`);
    expect(intentPrefetchHref(`/restaurant/${ID}`, O)).toBe(`/restaurant/${ID}`);
  });

  it("leaves everything else to the router", () => {
    expect(intentPrefetchHref(`/listing/${ID}/offer`, O)).toBeNull();
    expect(intentPrefetchHref("/messages", O)).toBeNull();
    expect(intentPrefetchHref("/listing/not-a-uuid", O)).toBeNull();
    expect(intentPrefetchHref(`https://evil.example/listing/${ID}`, O)).toBeNull();
    expect(intentPrefetchHref("javascript:alert(1)", O)).toBeNull();
  });
});
