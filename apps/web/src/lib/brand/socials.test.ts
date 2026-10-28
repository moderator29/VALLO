import { describe, expect, it } from "vitest";
import { SOCIAL_ACCOUNTS, liveSocials } from "./socials";

describe("Vallo's social accounts", () => {
  it("draws Facebook, Instagram and TikTok, each at the address the founder gave", () => {
    const live = liveSocials();
    expect(live.map((a) => a.key)).toEqual(["facebook", "instagram", "tiktok"]);
    expect(live.find((a) => a.key === "instagram")?.url).toBe("https://www.instagram.com/vallospaces");
    expect(live.find((a) => a.key === "tiktok")?.url).toBe("https://www.tiktok.com/@vallo.spaces");
  });

  it("never draws a network with no address, and LinkedIn waits for its real one", () => {
    expect(SOCIAL_ACCOUNTS.find((a) => a.key === "linkedin")?.url).toBeNull();
    expect(liveSocials().some((a) => a.key === "linkedin")).toBe(false);
    expect(liveSocials([{ key: "linkedin", label: "LinkedIn", url: "http://insecure.example", handle: null }])).toEqual([]);
  });
});
