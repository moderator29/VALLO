/**
 * THE CALL SCREENS IN CHROMIUM: the real components, the real stylesheet, the
 * server actions replaced by staged answers (`mount-in-browser.ts` turns every
 * "use server" export into a recorded call). No media: the stage and the SDK
 * are not mounted here; `scripts/calls/ui-e2e.mjs` drives those through a
 * real call against a local media server.
 *
 *   incoming   Accept calls acceptCall and hands the call to the stage with
 *              the kind it was answered with; Decline calls declineCall and
 *              closes the screen; a failed accept says why and stays.
 *   in call    mute, camera and end call their handlers; the toggles say
 *              their state; a voice call has no camera controls.
 *   history    a missed call is the red row, a talked call shows its length,
 *              call back starts a call of the same kind with a fresh tap key.
 *   outcome    the form refuses an empty outcome, an empty summary and a
 *              follow-up with no date, and sends nothing until they are fixed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/calls.css");

const SNAP = `{
  id: "8f0c3c4e-1d1b-4c5e-9a62-3e1f0b7a9c11", kind: "VIDEO", purpose: "CONVERSATION", state: "RINGING", version: 2,
  conversationId: "0e6d2a7c-5b44-4f7e-8f6c-2d9a1c3b5e77", reviewId: null, role: "CALLEE", myState: "RINGING",
  isInitiator: false, otherName: "Adaeze Okafor", otherState: "JOINED", scheduledFor: null,
  createdAt: new Date().toISOString(), ringingAt: new Date().toISOString(),
  ringExpiresAt: new Date(Date.now() + 40000).toISOString(), acceptedAt: null, connectedAt: null,
  interruptedAt: null, endedAt: null, endReason: null, durationSeconds: null, serverNow: new Date().toISOString(),
}`;

const incomingEntry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { IncomingCallScreen } from "@/components/calls/CallSurface";
  import { callState, showCall, useCallStore } from "@/components/calls/call-store";
  window.__store = callState;
  showCall(${SNAP});
  function Harness() {
    const { active } = useCallStore();
    if (!active) return <p data-testid="closed">closed</p>;
    if (active.answeredWith) return <p data-testid="answered">{active.answeredWith} {active.snapshot.state}</p>;
    return <IncomingCallScreen active={active} copy={getDictionary("en").calls} />;
  }
  mount(<Harness />);
`;

const accepted = `async ({ callId }) => ({ ok: true, data: Object.assign(${SNAP}, { id: callId, state: "ACCEPTED", version: 3, myState: "ACCEPTED" }) })`;

describe.skipIf(!hasBrowser)("the incoming call screen", () => {
  it("is a labelled full-screen dialog with focus on a control, and Accept calls acceptCall", async () => {
    const { page, close } = await mountInBrowser({ entry: incomingEntry, css: CSS, actions: { acceptCall: accepted } });
    try {
      const dialog = page.getByRole("dialog");
      await expect(dialog.getAttribute("aria-label")).resolves.toBe("Incoming video call: Adaeze Okafor");
      /* Focus is on the dialog (announced by its label); the first Tab reaches Decline. */
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("role"));
      expect(focused).toBe("dialog");
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Decline");
      await page.getByRole("button", { name: "Accept with video" }).click();
      await page.getByTestId("answered").waitFor();
      expect(await page.getByTestId("answered").textContent()).toBe("VIDEO ACCEPTED");
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.filter((c) => c[0] === "acceptCall")).toEqual([["acceptCall", { callId: "8f0c3c4e-1d1b-4c5e-9a62-3e1f0b7a9c11" }]]);
    } finally {
      await close();
    }
  });

  it("answers a video call with voice only when asked", async () => {
    const { page, close } = await mountInBrowser({ entry: incomingEntry, css: CSS, actions: { acceptCall: accepted } });
    try {
      await page.getByRole("button", { name: "Accept with voice" }).click();
      await page.getByTestId("answered").waitFor();
      expect(await page.getByTestId("answered").textContent()).toBe("AUDIO ACCEPTED");
    } finally {
      await close();
    }
  });

  it("Decline calls declineCall and closes the screen", async () => {
    const { page, close } = await mountInBrowser({
      entry: incomingEntry,
      css: CSS,
      actions: { declineCall: `async ({ callId }) => ({ ok: true, data: Object.assign(${SNAP}, { id: callId, state: "DECLINED", version: 3 }) })` },
    });
    try {
      await page.getByRole("button", { name: "Decline" }).click();
      await page.getByTestId("closed").waitFor();
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.some((c) => c[0] === "declineCall")).toBe(true);
      expect(calls.some((c) => c[0] === "acceptCall")).toBe(false);
    } finally {
      await close();
    }
  });

  it("a refused accept says why and keeps the screen", async () => {
    const { page, close } = await mountInBrowser({
      entry: incomingEntry,
      css: CSS,
      actions: { acceptCall: `async () => ({ ok: false, error: "This call is no longer ringing." })` },
    });
    try {
      await page.getByRole("button", { name: "Accept with video" }).click();
      await page.getByRole("alert").waitFor();
      expect(await page.getByRole("alert").textContent()).toBe("This call is no longer ringing.");
      expect(await page.getByRole("dialog").count()).toBe(1);
    } finally {
      await close();
    }
  });
});

const inCallEntry = (kind: "VIDEO" | "AUDIO") => `
  import { useState } from "react";
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { InCallView } from "@/components/calls/views";
  window.__events = [];
  function Harness() {
    const [mic, setMic] = useState(true);
    const [cam, setCam] = useState(true);
    return (
      <InCallView
        copy={getDictionary("en").calls}
        name="Adaeze Okafor"
        kind="${kind}"
        clock="4:12"
        quality={3}
        banner={null}
        remoteVideoOn={false}
        remoteMicMuted={false}
        micOn={mic}
        cameraOn={cam}
        canCamera={${kind === "VIDEO"}}
        canSwitchCamera={true}
        canChooseOutput={false}
        onToggleMic={() => { window.__events.push("mic"); setMic((v) => !v); }}
        onToggleCamera={() => { window.__events.push("camera"); setCam((v) => !v); }}
        onSwitchCamera={() => window.__events.push("switch")}
        onNextOutput={() => window.__events.push("output")}
        onEnd={() => window.__events.push("end")}
      />
    );
  }
  mount(<Harness />);
`;

describe.skipIf(!hasBrowser)("the in-call controls", () => {
  it("mute, camera and end call their handlers and say their state", async () => {
    const { page, close } = await mountInBrowser({ entry: inCallEntry("VIDEO"), css: CSS });
    try {
      const mic = page.getByTestId("call-mic");
      expect(await mic.getAttribute("aria-pressed")).toBe("false");
      expect(await mic.getAttribute("aria-label")).toBe("Mute microphone");
      await mic.click();
      expect(await mic.getAttribute("aria-pressed")).toBe("true");
      expect(await mic.getAttribute("aria-label")).toBe("Unmute microphone");

      const cam = page.getByTestId("call-camera");
      await cam.click();
      expect(await cam.getAttribute("aria-pressed")).toBe("true");
      expect(await cam.getAttribute("aria-label")).toBe("Turn camera on");
      /* The switch only shows while the camera is on. */
      expect(await page.getByTestId("call-switch").count()).toBe(0);
      await cam.click();
      await page.getByTestId("call-more").click();
      await page.getByTestId("call-switch").waitFor({ state: "visible" });
      await page.getByTestId("call-switch").click();

      await page.getByRole("button", { name: "End call" }).click();
      const events = await page.evaluate(() => (window as unknown as { __events: string[] }).__events);
      expect(events).toEqual(["mic", "camera", "camera", "switch", "end"]);

      /* Controls are 56px or more, and the end button is the larger one. */
      const sizes = await page.evaluate(() =>
        [...document.querySelectorAll(".nf-call__controls .nf-call-btn")].map((b) => Math.round(b.getBoundingClientRect().width)),
      );
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(56);
      expect(Math.max(...sizes)).toBe(64);
    } finally {
      await close();
    }
  });

  it("the self view moves between corners from the keyboard", async () => {
    const { page, close } = await mountInBrowser({ entry: inCallEntry("VIDEO"), css: CSS });
    try {
      const self = page.getByTestId("call-self-view");
      expect(await self.getAttribute("data-corner")).toBe("tr");
      await self.focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowLeft");
      expect(await self.getAttribute("data-corner")).toBe("bl");
    } finally {
      await close();
    }
  });

  it("a voice call draws no camera, switch or self view", async () => {
    const { page, close } = await mountInBrowser({ entry: inCallEntry("AUDIO"), css: CSS });
    try {
      expect(await page.getByTestId("call-camera").count()).toBe(0);
      expect(await page.getByTestId("call-switch").count()).toBe(0);
      expect(await page.getByTestId("call-self-view").count()).toBe(0);
      expect(await page.getByTestId("call-mic").count()).toBe(1);
    } finally {
      await close();
    }
  });
});

const historyEntry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { CallHistoryRow } from "@/components/calls/CallHistoryRow";
  import { placeCall } from "@/components/calls/place-call";
  import { callMarkerView } from "@/lib/calls/screen";
  const words = getDictionary("en").chatPolish.calls;
  const missed = callMarkerView({ body: "Voice call, missed", mine: false });
  const talked = callMarkerView({ body: "Video call, 4 min 12 s", mine: true });
  mount(
    <div>
      <CallHistoryRow view={missed} name="Nora" timeLabel="15:40" words={words} onCallBack={() => placeCall({ conversationId: "0e6d2a7c-5b44-4f7e-8f6c-2d9a1c3b5e77", kind: missed.kind })} />
      <CallHistoryRow view={talked} name="Nora" timeLabel="13:02" words={words} />
    </div>,
  );
`;

describe.skipIf(!hasBrowser)("call rows in a thread", () => {
  it("draws missed and talked calls as compact centred pills that say who, and call back starts a call of the same kind", async () => {
    const { page, close } = await mountInBrowser({
      entry: historyEntry,
      css: CSS,
      actions: { startCall: `async () => ({ ok: false, error: "Calls are not available right now. You can keep messaging in the meantime." })` },
    });
    try {
      const rows = page.getByTestId("call-history-row");
      expect(await rows.count()).toBe(2);
      expect(await rows.nth(0).getAttribute("data-missed")).toBe("");
      expect(await rows.nth(0).getAttribute("aria-label")).toBe("Voice call. Missed voice call from Nora. 15:40");
      expect(await rows.nth(0).textContent()).toBe("Missed voice call\u00b7 15:40Call back");
      expect(await rows.nth(1).getAttribute("data-missed")).toBeNull();
      expect(await rows.nth(1).getAttribute("aria-label")).toBe("Video call. Video call with Nora, 4 min. 13:02");
      expect(await rows.nth(1).textContent()).toBe("Video call ended, 4 min\u00b7 13:02");
      /* A quiet line, not a pill or a card: no box, slim, centred in its row. */
      const geometry = await rows.nth(1).evaluate((el) => {
        const box = el.getBoundingClientRect();
        const row = el.parentElement!.getBoundingClientRect();
        return { height: box.height, width: box.width, off: Math.abs(box.left + box.width / 2 - (row.left + row.width / 2)) };
      });
      expect(geometry.height).toBeLessThan(28);
      const box = await rows.nth(1).evaluate((el) => {
        const st = getComputedStyle(el);
        return { bg: st.backgroundColor, border: st.borderTopWidth };
      });
      expect(box.bg).toMatch(/, 0\)$|^transparent$/);
      expect(box.border).toBe("0px");
      expect(geometry.width).toBeLessThan(330);
      expect(geometry.off).toBeLessThan(1);
      /* The missed one is the red one. */
      const ink = (index: number) => rows.nth(index).locator(".nf-call-event__line").evaluate((el) => getComputedStyle(el).color);
      expect(await ink(0)).not.toBe(await ink(1));
      /* Only the first row was given a call back: a text action, 44px tall, not a filled button. */
      expect(await page.getByTestId("call-history-callback").count()).toBe(1);
      expect(await page.getByTestId("call-history-callback").evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/, 0\)$|^transparent$/);
      const target = await page.getByTestId("call-history-callback").boundingBox();
      expect(target!.height).toBeGreaterThanOrEqual(44);
      await page.getByRole("button", { name: "Call Nora back, voice call" }).click();
      await page.waitForFunction(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).length > 0);
      const calls = await page.evaluate(() => (window as unknown as { __calls: [string, Record<string, unknown>][] }).__calls);
      expect(calls[0]![0]).toBe("startCall");
      expect(calls[0]![1]).toMatchObject({ conversationId: "0e6d2a7c-5b44-4f7e-8f6c-2d9a1c3b5e77", kind: "AUDIO" });
      expect(String(calls[0]![1].tapKey)).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      await close();
    }
  });
});

const outcomeEntry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ReviewOutcomeForm } from "@/components/calls/admin/ReviewOutcomeForm";
  window.__done = 0;
  mount(<ReviewOutcomeForm reviewId="5a2f9b7e-3c1d-4e8a-b6f2-9d0c1e2a3b44" copy={getDictionary("en").calls} onDone={() => { window.__done += 1; }} />);
`;

describe.skipIf(!hasBrowser)("the review outcome form", () => {
  it("refuses an empty outcome and summary, and a follow-up without a date, before sending", async () => {
    const { page, close } = await mountInBrowser({
      entry: outcomeEntry,
      css: CSS,
      actions: { completeReviewCall: `async (input) => ({ ok: true, data: { id: input.reviewId } })` },
    });
    try {
      const sent = () => page.evaluate(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).filter((c) => c[0] === "completeReviewCall"));
      await page.getByTestId("review-outcome-submit").click();
      await expect(page.getByText("Choose an outcome.").count()).resolves.toBeGreaterThanOrEqual(1);
      await expect(page.getByText("Write a short summary.").count()).resolves.toBeGreaterThanOrEqual(1);
      expect(await sent()).toEqual([]);

      await page.getByTestId("review-outcome-FOLLOW_UP_REQUIRED").check();
      await page.getByTestId("review-outcome-summary").fill("Needs the firm's CAC certificate.");
      await page.getByTestId("review-outcome-submit").click();
      await expect(page.getByText("A follow-up needs a due date.").count()).resolves.toBeGreaterThanOrEqual(1);
      expect(await sent()).toEqual([]);

      await page.getByTestId("review-outcome-due").fill("2030-01-15T10:00");
      await page.getByTestId("review-outcome-submit").click();
      await page.waitForFunction(() => (window as unknown as { __done: number }).__done === 1);
      const calls = (await sent()) as [string, Record<string, unknown>][];
      expect(calls).toHaveLength(1);
      expect(calls[0]![1]).toEqual({
        reviewId: "5a2f9b7e-3c1d-4e8a-b6f2-9d0c1e2a3b44",
        outcome: "FOLLOW_UP_REQUIRED",
        summary: "Needs the firm's CAC certificate.",
        followUpDueAt: "2030-01-15T09:00:00.000Z",
      });
    } finally {
      await close();
    }
  });
});
