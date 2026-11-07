import { describe, expect, it } from "vitest";
import { keptOnly } from "./recent-kept";
import type { RecentListing } from "@/lib/search/memory";

const at = (id: string, href?: string): RecentListing => ({ id, title: `Place ${id}`, place: "Yaba, Lagos", price: "₦1,200,000", href });

describe("recently viewed on the offline screen", () => {
  it("lists only the places whose page this phone kept, newest first, at most five", async () => {
    const kept = new Set([
      "https://www.vallospaces.com/listing/a",
      "https://www.vallospaces.com/stay/c",
      ...["d", "e", "f", "g", "h"].map((id) => `https://www.vallospaces.com/listing/${id}`),
    ]);
    const entries = [at("a"), at("b"), at("c", "/stay/c"), at("d"), at("e"), at("f"), at("g"), at("h")];
    const shown = await keptOnly(entries, async (url) => kept.has(url), "https://www.vallospaces.com");
    expect(shown.map((e) => e.id)).toEqual(["a", "c", "d", "e", "f"]);
  });

  it("draws nothing when nothing was kept", async () => {
    expect(await keptOnly([at("a")], async () => false, "https://www.vallospaces.com")).toEqual([]);
  });
});
