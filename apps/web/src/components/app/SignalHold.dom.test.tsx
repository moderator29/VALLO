/**
 * A WEAK SIGNAL NEVER DRAWS THE FAULT SCREEN (13 November 2026, the founder's
 * screenshot inside the app: "This screen did not load, Reference C-8FNWV8" on
 * a connection that was there but slow).
 *
 * Driven in Chromium: a boundary built the way Next builds one (a class that
 * catches, renders the error component with `reset`), around a screen whose
 * data request dies on a weak signal a set number of times. The boundary's
 * error component is the app's own logic (`useSignalHold`, `SignalHold`), so
 * what is proven is what the route boundaries now do: the page's shape stays,
 * the screen is tried again by itself, the calm line comes only from the second
 * try, and a real fault still reaches the fault screen.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

beforeAll(warmBrowser);
afterAll(closeBrowser);

/* The screen fails for its first \`failForMs\` milliseconds. By time, not by a
   count: React renders a failing component a second time before it hands the
   error to a boundary, so a count of renders is not a count of tries. */
const entry = (failForMs: number, message: string) => `
  import { Component, useState } from "react";
  import { useSignalHold } from "@/lib/offline/use-offline";
  import { SignalHold } from "@/components/app/SignalHold";
  import { mount } from "@/lib/testing/browser-root";

  const until = performance.now() + ${failForMs};
  function Screen() {
    if (performance.now() < until) throw new TypeError(${JSON.stringify(message)});
    return <main data-testid="screen">Your homes</main>;
  }
  function Fallback({ error, reset }) {
    const hold = useSignalHold(error, reset);
    if (hold.view === "retrying") return <SignalHold tries={hold.tries} onRetry={reset} />;
    if (hold.view) return <p data-testid="calm">Weak connection</p>;
    return <p data-testid="fault">This screen did not load</p>;
  }
  class Boundary extends Component {
    constructor(p) { super(p); this.state = { error: null, n: 0 }; }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
      if (this.state.error) return <Fallback key={this.state.n} error={this.state.error} reset={() => this.setState((s) => ({ error: null, n: s.n + 1 }))} />;
      return <Screen key={this.state.n} />;
    }
  }
  mount(<Boundary />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("a screen on a weak signal", () => {
  it(
    "a request that died once: the page's shape, then the screen by itself, and never the fault screen",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(300, "Failed to fetch"), reducedMotion: true, init: "sessionStorage.clear();" });
      try {
        await page.getByTestId("signal-hold").waitFor();
        /* The first try says nothing: it is usually over before anyone reads it. */
        expect(await page.getByTestId("signal-hold-note").count()).toBe(0);
        await page.getByTestId("screen").waitFor({ timeout: 3000 });
        expect(await page.getByTestId("fault").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a signal that stays weak: the calm line from the second try, a Try again that does not wait, and still no fault screen",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(4000, "Load failed"), reducedMotion: true, init: "sessionStorage.clear();" });
      try {
        await page.getByTestId("signal-hold-note").waitFor({ timeout: 4000 });
        expect(await page.getByTestId("signal-hold-note").textContent()).toContain("Still loading on a weak connection");
        await page.getByRole("button", { name: "Try again" }).click();
        await page.getByTestId("screen").waitFor({ timeout: 15000 });
        expect(await page.getByTestId("fault").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "the founder's screen: a navigation's answer cut part way (React #412 in production) holds and recovers, no fault, no reference",
    async () => {
      const { page, close } = await mountInBrowser({
        entry: entry(300, "Minified React error #412; visit https://react.dev/errors/412 for the full message or use the non-minified dev environment for full errors and additional helpful warnings."),
        reducedMotion: true,
        init: "sessionStorage.clear();",
      });
      try {
        await page.getByTestId("signal-hold").waitFor();
        await page.getByTestId("screen").waitFor({ timeout: 3000 });
        expect(await page.getByTestId("fault").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a real fault is still a fault",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(600_000, "Cannot read properties of undefined (reading 'id')"), reducedMotion: true, init: "sessionStorage.clear();" });
      try {
        await page.getByTestId("fault").waitFor();
        expect(await page.getByTestId("signal-hold").count()).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});
