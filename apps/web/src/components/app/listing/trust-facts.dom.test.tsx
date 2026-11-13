/**
 * Session 3, Stage 5: the space detail's trust facts and infrastructure rows,
 * rendered for real.
 *
 *   - a trust fact is a DATE, never a tick, and a check with no date is not a
 *     row at all, so a null never reads as a negative;
 *   - an example row (D24) draws exactly what an unchecked real row draws;
 *   - the power, water and meter rows are marked with the real Tier A object
 *     only for what the agent stated, and the meter is no longer a tick.
 */
import { getDictionary } from "@vallo/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, back: () => undefined, replace: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/listing/x",
  useSearchParams: () => new URLSearchParams(),
}));

const { TrustFacts } = await import("./TrustFacts");
const { ListingUtilities } = await import("./ListingUtilities");
const { earnedTrust } = await import("./earned-trust");
const { proofDate } = await import("@/lib/trust/proof-strip");
const proofStrip = await import("@/lib/trust/proof-strip");
const checksModel = await import("@/lib/trust/checks");
const { PersonReasons } = await import("@/components/app/trust/PersonReasons");

const t = getDictionary("en");
const real = {
  isDemo: false,
  verified: true,
  inspectedAt: "2026-09-12T10:00:00Z",
  addressVerifiedAt: "2026-08-03T09:00:00Z",
  rating: 0,
  reviewCount: 0,
};

describe("TrustFacts", () => {
  it("prints each check as its date, with no tick glyph", () => {
    const html = renderToStaticMarkup(
      <TrustFacts listingId="x" trust={earnedTrust(real)} strip={null} proofCount={0} locale="en" t={t} />,
    );
    expect(html).toContain('data-testid="trust-check-inspected"');
    expect(html).toMatch(/datetime="2026-09-12T10:00:00Z"/i);
    expect(html).toContain(proofDate("2026-09-12T10:00:00Z", "en"));
    expect(html).toContain('data-testid="trust-check-address"');
    expect(html).toContain('href="/listing/x/trust"');
  });

  it("draws an example row exactly as an unchecked real row: the quiet lede, nothing negative", () => {
    const example = renderToStaticMarkup(
      <TrustFacts listingId="x" trust={earnedTrust({ ...real, isDemo: true })} strip={null} proofCount={0} locale="en" t={t} />,
    );
    const unchecked = renderToStaticMarkup(
      <TrustFacts
        listingId="x"
        trust={earnedTrust({ ...real, inspectedAt: undefined, addressVerifiedAt: undefined })}
        strip={null}
        proofCount={0}
        locale="en"
        t={t}
      />,
    );
    expect(example).toBe(unchecked);
    expect(example).toContain('data-testid="trust-none"');
    expect(example.toLowerCase()).not.toMatch(/example|not verified|unverified|not inspected/);
  });
});

describe("TrustFacts, the full page", () => {
  const { proofLines } = proofStrip;
  const lines = proofLines({
    isDemo: false,
    identitySeenAt: "2026-08-14T09:00:00Z",
    mandateVerifiedAt: "2026-08-20T09:00:00Z",
  });

  it("draws the dated checks in two groups, each row a button with its date", () => {
    const html = renderToStaticMarkup(
      <TrustFacts listingId="x" trust={earnedTrust(real)} strip={null} proofCount={lines.length} lines={lines} locale="en" t={t} variant="full" />,
    );
    expect(html).toContain('data-testid="trust-checks-space"');
    expect(html).toContain('data-testid="trust-checks-lister"');
    expect(html).toContain(t.trustReasons.space.spaceGroup);
    expect(html).toContain(t.trustReasons.space.listerGroup);
    for (const kind of ["mandate", "inspected", "address", "identity"]) {
      expect(html).toMatch(new RegExp(`<button[^>]*data-testid="trust-check-${kind}"`));
    }
    expect(html).toContain(proofStrip.proofDate("2026-08-14T09:00:00Z", "en"));
    expect(html).not.toContain('data-testid="trust-none"');
    /* The explainer is there, closed, under the dated rows. */
    expect(html).toContain(t.trustReasons.space.earnMore);
  });

  it("with nothing dated: says so, offers the lister, and explains how a space earns each check", () => {
    const html = renderToStaticMarkup(
      <TrustFacts
        listingId="x"
        trust={earnedTrust({ ...real, inspectedAt: undefined, addressVerifiedAt: undefined })}
        strip={null}
        proofCount={0}
        lines={[]}
        locale="en"
        t={t}
        variant="full"
        askHref="/messages/new?listing=x"
      />,
    );
    expect(html).toContain('data-testid="trust-none"');
    expect(html).toContain(t.trustReasons.space.emptyTitle);
    expect(html).toContain('href="/messages/new?listing=x"');
    expect(html).toContain(t.trustReasons.space.earnTitle);
    expect(html).toContain('data-testid="trust-explainer"');
    /* The explainer's rows carry no date: nothing in them is about this space. */
    const explainer = html.slice(html.indexOf('data-testid="trust-explainer"'));
    expect(explainer).not.toContain("<time");
    expect(html.toLowerCase()).not.toMatch(/not verified|unverified|not inspected/);
  });

  it("an example row has nobody to ask, so the action is not drawn", () => {
    const html = renderToStaticMarkup(
      <TrustFacts listingId="x" trust={earnedTrust({ ...real, isDemo: true })} strip={null} proofCount={0} lines={[]} locale="en" t={t} variant="full" askHref={null} />,
    );
    expect(html).toContain('data-testid="trust-none"');
    expect(html).not.toContain('data-testid="trust-ask"');
    expect(html.toLowerCase()).not.toContain("example");
  });
});

describe("PersonReasons", () => {
  const copy = t.trustReasons;
  it("is absent with nothing dated and fewer than two numbers", () => {
    const html = renderToStaticMarkup(
      <PersonReasons
        title="Reasons to trust Sophia"
        lede={copy.person.lede}
        stats={checksModel.personStats({ memberSince: "2026-11-12T00:00:00Z" }, copy, "en")}
        checks={[]}
        labels={copy.sheet}
      />,
    );
    expect(html).toBe("");
  });

  it("draws the numbers and each dated check as a row that opens", () => {
    const html = renderToStaticMarkup(
      <PersonReasons
        title="Reasons to trust Sophia"
        lede={copy.person.lede}
        stats={checksModel.personStats({ reviewCount: 8, averageRating: 4.5, memberSince: "2026-03-02T00:00:00Z" }, copy, "en")}
        checks={checksModel.personChecks(
          { identitySeenAt: "2026-11-03T08:00:00Z", identityMethod: "seen", phoneConfirmedAt: "2026-11-12T08:00:00Z" },
          copy,
          "en",
        )}
        labels={copy.sheet}
      />,
    );
    expect(html).toContain("Reasons to trust Sophia");
    expect(html).toContain('data-testid="person-reasons-stat-reviews"');
    expect(html).toContain('data-testid="person-reasons-stat-since"');
    expect(html).toMatch(/<button[^>]*data-testid="trust-check-personIdentity"/);
    expect(html).toMatch(/<button[^>]*data-testid="trust-check-phone"/);
    expect(html).not.toContain('data-testid="trust-check-email"');
    /* Nothing private can be in the markup: the model has no field for it. */
    expect(html).not.toMatch(/\+234|@/);
  });
});

describe("ListingUtilities, drawn in the page's one icon family", () => {
  /* Until 13 November 2026 each row carried a 3D object (data-object). The
     founder asked the listing page for one icon family, so the rows are line
     glyphs on the page's plate now; these pin that, and that a row nobody
     answered is still not invented. */
  const rows = (html: string) => (html.match(/<dt\b/g) ?? []).length;
  it("draws stated backup, meter and water as rows with line glyphs, never the 3D objects", () => {
    const html = renderToStaticMarkup(
      <ListingUtilities
        utilities={{ powerGrid: "PATCHY", powerBackup: "GENERATOR", waterSupply: "BOREHOLE", prepaidMeter: true, hasEstateAccess: false }}
        access={null}
        bookingConfirmed={false}
      />,
    );
    expect(html).not.toContain("data-object=");
    expect(html).not.toMatch(/<img\b/);
    expect(html).toMatch(/<svg\b/);
  });

  it("draws no meter row for a listing that did not state one", () => {
    const withMeter = renderToStaticMarkup(
      <ListingUtilities utilities={{ waterSupply: "TANKER", prepaidMeter: true, hasEstateAccess: false }} access={null} bookingConfirmed={false} />,
    );
    const without = renderToStaticMarkup(
      <ListingUtilities utilities={{ waterSupply: "TANKER", hasEstateAccess: false }} access={null} bookingConfirmed={false} />,
    );
    expect(rows(withMeter)).toBe(rows(without) + 1);
    expect(without).not.toContain("data-object=");
  });
});
