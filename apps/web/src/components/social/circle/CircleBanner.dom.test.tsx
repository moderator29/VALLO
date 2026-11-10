import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CircleBanner } from "./CircleVisuals";

const stats = (over: Partial<{ members: number; posts: number; active: number; communities: number }> = {}) => ({ members: 120, posts: 480, active: 31, communities: 9, ...over });
const html = (props: Parameters<typeof CircleBanner>[0]) => renderToStaticMarkup(<CircleBanner {...props} />);

describe("the Circle hero", () => {
  it("shows the real figures and draws its own artwork", () => {
    const out = html({ stats: stats(), signedIn: true });
    expect(out).toContain('data-testid="circle-figures"');
    expect(out).toContain("480");
    expect(out).toContain("<svg");
    expect(out).not.toContain("<img");
  });
  it("hides a figure that is zero, and every figure when the read is not live", () => {
    expect(html({ stats: stats({ posts: 0, active: 0 }), signedIn: true })).not.toContain("active this week");
    expect(html({ stats: null, signedIn: true })).not.toContain('data-testid="circle-figures"');
  });
  it("points the button at sign-up, the list of communities, or asking, by who is looking", () => {
    expect(html({ stats: stats(), signedIn: false })).toContain("/sign-up?next=%2Fcircle");
    expect(html({ stats: stats(), signedIn: true, hasCommunities: false })).toContain('href="#circle-communities"');
    expect(html({ stats: stats(), signedIn: true, hasCommunities: true })).toContain('href="/circle/ask"');
  });
});
