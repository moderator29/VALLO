import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chooseBack, parentOf } from "@/lib/nav/resolve";

/**
 * `/profile/setup` in its four states declares a parent in
 * `route-parents.ts` and drew no back control, so Android back closed the app.
 * The chooser mounts the shared `BackButton` with the declared parent. The two
 * registration forms draw ONE back control, their own (25 September 2026: the
 * page's arrow stood a row above the form's, so the screen opened with two):
 * it steps back through the form, and from the first screen it leaves to the
 * same declared parent.
 */
const SRC = join(process.cwd(), "src");
const SETUP = join(SRC, "app/(app)/profile/setup");

const PAGES: [string, string, string][] = [
  ["/profile/setup", "page.tsx", "/profile"],
  ["/profile/setup/agent", "agent/page.tsx", "/profile/setup"],
  ["/profile/setup/owner", "owner/page.tsx", "/profile/setup"],
];

describe("profile setup: one back control to the declared parent", () => {
  for (const [route, , parent] of PAGES) {
    it(`${route} resolves to ${parent}`, () => {
      const target = parentOf(route);
      expect(target.kind).toBe("parent");
      expect(target.kind === "parent" ? target.href : null).toBe(parent);
    });
  }

  it("the chooser mounts the BackButton with its parent", () => {
    const source = readFileSync(join(SETUP, "page.tsx"), "utf8");
    expect(source).toMatch(/import \{ BackButton \} from "@\/components\/site\/BackButton"/);
    expect(source).toContain(`parentOf("/profile/setup")`);
    expect(source).toMatch(/<BackButton fallback=\{BACK\.kind === "parent" \? BACK\.href : "\/profile"\}(?: surface="round")? \/>/);
  });

  const FORMS: [string, string, string][] = [
    ["/profile/setup/owner", "owner/page.tsx", "OwnerRegisterForm"],
    ["/profile/setup/agent", "agent/page.tsx", "AgentRegisterForm"],
  ];
  for (const [route, file, form] of FORMS) {
    it(`${route} draws one back control, the form's, and its first screen leaves to the parent`, () => {
      const page = readFileSync(join(SETUP, file), "utf8");
      expect(page).not.toContain("<BackButton");
      expect(page).toContain(`<${form} `);
      const shell = readFileSync(join(SRC, "components/supply/RegisterShell.tsx"), "utf8");
      /* Round 3 (SW5): the shell is the platform's StepFrame, whose ONE back
         control is the form's `onBack`; no second arrow is drawn. */
      expect(shell).not.toContain("<BackControl");
      expect(shell.match(/<StepFrame\b/g)?.length).toBe(1);
      expect(shell).toMatch(/onBack=\{onBack\}\s+backLabel=\{backLabel\}/);
      const source = readFileSync(join(SRC, `components/supply/${form}.tsx`), "utf8");
      /* The first screen leaves through the shared back (history to the
         chooser when that is where the person came from, else the declared
         parent), never by pushing a second chooser. */
      expect(source).toContain('const leave = useBack("/profile/setup");');
      expect(source).toMatch(/if \(step === 0\) \{[\s\S]*?leave\(\);\s*return;/);
      expect(source).not.toContain('router.push("/profile/setup")');
    });
  }

  it("on Android with no in-app history, back goes to the parent and never exits", () => {
    for (const [route, , parent] of PAGES) {
      const decision = chooseBack({
        path: route,
        fallback: "/home",
        previousPath: null,
        previousIsInApp: false,
        surface: "android",
      });
      expect(decision.action).not.toBe("exit");
      expect("href" in decision ? decision.href : null).toBe(parent);
    }
  });
});

describe("the firm door is closed until approval can make a firm (SUP-10)", () => {
  it("sends /profile/setup/firm to the agent form and draws nothing of its own", () => {
    /* The redirect-only page was consolidated into next.config (SW13), so the
       door is now a config redirect rather than a page.tsx that calls
       `redirect()`; it still lands on the agent form and renders nothing. */
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toMatch(/source:\s*"\/profile\/setup\/firm",\s*destination:\s*"\/profile\/setup\/agent"/);
    expect(existsSync(join(SETUP, "firm/page.tsx"))).toBe(false);
  });
});
