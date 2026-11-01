/**
 * The dock a workspace page draws (13 October 2026): the same five slots and
 * the "+" the consumer shell has, so a member in the agent, owner or host
 * workspace can reach Home, Search, Feed and Profile, with exactly one primary
 * navigation landmark.
 */
import { getDictionary } from "@vallo/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, back: () => undefined, replace: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/agent/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

const { ShellDock } = await import("./ShellDock");

const t = getDictionary("en");
const base = {
  t,
  active: "/agent/dashboard",
  signedIn: true,
  workspaces: [],
  currentProfile: { kind: "personal" as const },
};

describe("ShellDock on a workspace page", () => {
  it("offers Home, Search, the menu, Feed and Profile, and the plus", () => {
    const html = renderToStaticMarkup(<ShellDock {...base} side="property" />);
    for (const href of ["/home", "/search", "/around", "/profile"]) expect(html, href).toContain(`href="${href}"`);
    expect(html).toContain("nf-tab--switch");
    expect(html).toContain("data-dock-create");
  });

  it("is one navigation landmark, not two stacked", () => {
    const html = renderToStaticMarkup(<ShellDock {...base} side="property" />);
    expect(html.match(/<nav\b/g)?.length).toBe(1);
  });

  it("follows the Stays side for a host workspace", () => {
    const html = renderToStaticMarkup(<ShellDock {...base} active="/host" side="stays" />);
    expect(html).toContain('href="/stays"');
    expect(html).toContain('href="/stays/search"');
    expect(html).not.toContain('href="/home"');
  });

  it("lights no tab on a workspace page: nothing there is one of the dock's places", () => {
    const html = renderToStaticMarkup(<ShellDock {...base} side="property" />);
    expect(html).not.toContain('aria-current="page"');
  });
});
