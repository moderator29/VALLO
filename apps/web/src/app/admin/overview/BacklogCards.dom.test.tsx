import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BacklogCards } from "./BacklogCards";
import type { BacklogCard, CooBacklog } from "@/lib/admin/overview/reads";

const UNAVAILABLE: BacklogCard = { state: "unavailable" };

function card(count: number, capped = false): BacklogCard {
  return {
    state: "ok",
    count,
    capped,
    items: [{ id: "x1", title: "A waiting item", createdAt: "2026-11-01T00:00:00Z", href: "/admin/listings/x1" }],
  };
}

describe("BacklogCards", () => {
  it("links each real waiting item straight to its desk, and the oldest-few count", () => {
    const backlog: CooBacklog = {
      listings: card(3),
      moderation: UNAVAILABLE,
      support: card(1, true),
      agreements: card(0),
      operations: card(2),
    };
    const html = renderToStaticMarkup(<BacklogCards backlog={backlog} />);
    expect(html).toContain("3 waiting");
    expect(html).toContain("1 waiting (the oldest we can read; there may be more)");
    expect(html).toContain('href="/admin/listings/x1"');
    expect(html).toContain("Could not be read just now");
    expect(html).toContain('href="/admin/listings"');
    expect(html).toContain('href="/admin/support"');
  });
});
