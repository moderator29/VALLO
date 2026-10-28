import { describe, expect, it } from "vitest";
import { liveSocials } from "./socials";

describe("Vallo's social accounts", () => {
  it("draws Facebook, Instagram, TikTok and LinkedIn, each at the address the founder gave", () => {
    const live = liveSocials();
    expect(live.map((a) => a.key)).toEqual(["facebook", "instagram", "tiktok", "linkedin"]);
    expect(live.find((a) => a.key === "instagram")?.url).toBe("https://www.instagram.com/vallospaces");
    expect(live.find((a) => a.key === "tiktok")?.url).toBe("https://www.tiktok.com/@vallo.spaces");
  });

  it("never draws a network with no address or a non-https one", () => {
    expect(liveSocials([{ key: "linkedin", label: "LinkedIn", url: null, handle: null }])).toEqual([]);
    expect(liveSocials([{ key: "linkedin", label: "LinkedIn", url: "http://insecure.example", handle: null }])).toEqual([]);
  });
});
