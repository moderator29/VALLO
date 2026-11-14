import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/site/BackButton", () => ({ BackButton: () => null }));

const { YourDesks, yourDesks } = await import("./YourDesks");

describe("YourDesks", () => {
  it("names the desks a Business Development Director's access opens, and their guide", () => {
    const html = renderToStaticMarkup(
      <YourDesks staff={{ position: "business_development_executive", scopes: ["business_development", "listing_approval"] }} />,
    );
    expect(html).toContain("Your desks: Business Development Director");
    expect(html).toContain('href="/admin/business-development"');
    expect(html).toContain('href="/admin/listings"');
    expect(html).toContain('href="/admin/my-desk"');
    expect(html).toContain('href="/admin/manual/business-development"');
  });

  it("gives the Social Media Manager their desk and their guide", () => {
    const html = renderToStaticMarkup(<YourDesks staff={{ position: "social_media_manager", scopes: ["social_media"] }} />);
    expect(html).toContain('href="/admin/social-media"');
    expect(html).toContain('href="/admin/manual/social-media"');
  });

  it("draws nothing for somebody with no access areas, and lists a shared desk once", () => {
    expect(renderToStaticMarkup(<YourDesks staff={{ position: null, scopes: [] }} />)).toBe("");
    const hrefs = yourDesks({ scopes: ["moderation", "support"] }).map((d) => d.href);
    expect(hrefs.filter((h) => h === "/admin/cases")).toHaveLength(1);
  });
});
