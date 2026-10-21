import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney, getDictionary } from "@vallo/i18n";
import type { ArrivalCharges } from "@/lib/stays/arrival-charges";

/**
 * THE ALL-IN TOTAL AT CHECKOUT (HANDOFF section 6 item 3, product rule 2).
 * The checkout screen draws every charge at the door worked out for the
 * booked nights and party, and the price plus every countable charge as one
 * figure, above the pay action. A failed read says so there rather than
 * leaving a gap that reads as "nothing at the door".
 */

const reads = vi.hoisted(() => ({
  snapshot: null as { charges: ArrivalCharges | null } | null | undefined,
  declaration: null as ArrivalCharges | null | undefined,
}));
vi.mock("@/lib/stays/arrival-queries", () => ({
  readBookingSnapshot: async () => reads.snapshot,
  readDeclaration: async () => reads.declaration,
}));

const { ArrivalChargesLine } = await import("./ArrivalChargesLine");
const copy = getDictionary("en").afterTheGate.arrival;

const declared: ArrivalCharges = {
  caution: { minor: 5_000_000, per: "stay" },
  power: { minor: 20_000, per: "unit" },
  cleaning: { minor: 500_000, per: "night" },
  extra_guest: { minor: 1_000_000, per: "guest" },
  visitor: { none: true },
};

async function html(props: Parameters<typeof ArrivalChargesLine>[0]): Promise<string> {
  const node = await ArrivalChargesLine(props);
  return node ? renderToStaticMarkup(node) : "";
}

const BOOKING = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  reads.snapshot = null;
  reads.declaration = null;
});

describe("ArrivalChargesLine at checkout", () => {
  it("draws the all-in total: the stay plus every countable door charge for these nights and guests", async () => {
    reads.declaration = declared;
    const out = await html({
      listingId: "listing-1",
      bookingId: BOOKING,
      locale: "en",
      stay: { nights: 3, guests: 2, priceMinor: 30_000_000 },
    });
    expect(out).toContain('data-testid="stay-all-in"');
    expect(out).toContain(copy.keys.caution);
    expect(out).toContain(copy.keys.cleaning);
    expect(out).toContain(copy.keys.extra_guest);
    expect(out).toContain(copy.keys.power);
    expect(out).toContain(copy.asUsed);
    /* 300,000 + 50,000 caution + 3 x 5,000 cleaning + 2 x 10,000 extra guest; power as used. */
    expect(out).toContain(formatMoney(38_500_000, "en"));
  });

  it("prices a paid booking from what was frozen at payment, not the host's later edit", async () => {
    reads.snapshot = { charges: { ...declared, cleaning: { none: true }, extra_guest: { none: true } } };
    reads.declaration = declared;
    const out = await html({
      listingId: "listing-1",
      bookingId: BOOKING,
      locale: "en",
      stay: { nights: 3, guests: 2, priceMinor: 30_000_000 },
    });
    expect(out).toContain(formatMoney(35_000_000, "en"));
    expect(out).not.toContain(copy.keys.cleaning);
  });

  it("says when nothing is owed at the door", async () => {
    reads.declaration = {
      caution: { none: true },
      power: { none: true },
      cleaning: { none: true },
      extra_guest: { none: true },
      visitor: { none: true },
    };
    const out = await html({ listingId: "listing-1", locale: "en", stay: { nights: 1, guests: 1, priceMinor: 1_000_000 } });
    expect(out).toContain(copy.guestNothing);
  });

  it("says the charges could not be read rather than drawing nothing above the pay button", async () => {
    reads.declaration = undefined;
    const out = await html({ listingId: "listing-1", locale: "en", stay: { nights: 2, guests: 1, priceMinor: 1_000_000 } });
    expect(out).toContain('data-testid="arrival-charges-unread"');
    expect(out).toContain(copy.readFailed.replace("'", "&#x27;"));
  });

  it("away from checkout a failed read still draws nothing", async () => {
    reads.snapshot = undefined;
    expect(await html({ listingId: "listing-1", bookingId: BOOKING, locale: "en" })).toBe("");
  });
});

describe("the checkout page", () => {
  const source = readFileSync(join(__dirname, "..", "..", "app", "(app)", "checkout", "[bookingId]", "page.tsx"), "utf8");

  it("hands the booked nights, party and stored total to the door block, above the pay panel", () => {
    const door = source.indexOf("<ArrivalChargesLine");
    const pay = source.indexOf("<PayPanel");
    expect(door).toBeGreaterThan(-1);
    expect(pay).toBeGreaterThan(door);
    expect(source.slice(door, pay)).toMatch(/stay=\{\{\s*nights: view\.nights, guests: view\.guests, priceMinor: view\.totalMinor\s*\}\}/);
  });
});
