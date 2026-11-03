/**
 * A TAP THAT FAILS ON A WEAK SIGNAL STAYS ON ITS SCREEN (3 November 2026, the
 * founder: an error page for a weak signal is a website's answer). Driven in
 * Chromium on a real button: the request dies, a short line slides up, and
 * the screen, with what was typed, is exactly where it was. A real fault
 * still reaches the error boundary.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const ENTRY = `
  import { Component } from "react";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { IdentityCheckDecision } from "@/app/admin/kyc/IdentityCheckDecision";
  class Boundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <p data-testid="error-page">Something went wrong</p> : this.props.children; }
  }
  mount(<><Boundary><IdentityCheckDecision checkId="00000000-0000-4000-8000-000000000001" canApprove /></Boundary><ToastHost /></>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("a tap on a weak signal", () => {
  it("keeps the screen and what was typed, and says it could not connect", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      actions: { decideIdentityCheck: `async () => { throw new TypeError("Failed to fetch"); }` },
    });
    try {
      await page.getByRole("button", { name: "Refuse" }).click();
      await page.locator("textarea").fill("The selfie is too dark to compare with the ID photo.");
      await page.getByRole("button", { name: "Send it back" }).click();
      await page.getByTestId("tap-failed-offline").waitFor();
      expect(await page.getByTestId("tap-failed-offline").innerText()).toContain("Couldn't connect");
      expect(await page.getByTestId("error-page").count()).toBe(0);
      expect(await page.locator("textarea").inputValue()).toBe("The selfie is too dark to compare with the ID photo.");
      expect(await page.getByRole("button", { name: "Send it back" }).isEnabled()).toBe(true);
    } finally {
      await close();
    }
  });

  it("still sends a real fault to the error boundary, so no bug is hidden", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      actions: { decideIdentityCheck: `async () => { throw new Error("Cannot read properties of undefined (reading 'status')"); }` },
    });
    try {
      await page.getByRole("button", { name: "Approve identity" }).click();
      await page.getByTestId("error-page").waitFor();
      expect(await page.getByTestId("tap-failed-offline").count()).toBe(0);
    } finally {
      await close();
    }
  });
});

describe("every transition that calls the server is guarded", () => {
  it("no async transition body is left that does not catch a weak signal", async () => {
    const ts = await import("typescript");
    const { execFileSync } = await import("node:child_process");
    const files = execFileSync("grep", ["-rlE", "start(Transition|[A-Z][A-Za-z]*)?\\(async", "src", "--include=*.tsx", "--include=*.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
    })
      .split("\n")
      .filter((f) => f && !/\.test\.|\/\(dev\)\//.test(f));
    const unguarded: string[] = [];
    for (const rel of files) {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: import("typescript").Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^start(Transition|[A-Z]\w*)?$/.test(node.expression.text)) {
          const arg = node.arguments[0];
          if (arg && ts.isArrowFunction(arg) && arg.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) && ts.isBlock(arg.body)) {
            const stmts = arg.body.statements;
            const guarded = stmts.length === 1 && ts.isTryStatement(stmts[0]!) && Boolean(stmts[0].catchClause);
            if (!guarded && stmts.length > 0) unguarded.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(unguarded).toEqual([]);
  });
});
