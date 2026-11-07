/**
 * THE MICROPHONE THAT BECOMES SEND, AND A VOICE NOTE END TO END, ON THE REAL
 * `ThreadView` IN CHROMIUM (Platform Grade 1, P1.3; reference R58).
 *
 * The thread is mounted whole and live, with the harness standing in for the
 * server actions. The microphone and the recorder are the browser's own
 * shapes, staged: `getUserMedia` hands back a stream with one track (or
 * refuses, as a person saying no does), `MediaRecorder` records a few
 * kilobytes of bytes, and the analyser reads a moving level, so the stored
 * bars are this recording's own. The upload is the one stand-in the thread
 * takes as a prop (`uploadVoice`), because the harness's Supabase client has
 * no session to upload with. Gestures are pointer events of the shape a
 * finger delivers.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/threads.css", "app/css/grade1.css", "app/css/messages-g1.css");
const CONV = "00000000-0000-4000-8000-00000000c001";

const MESSAGES = [
  { id: "a1", mine: false, body: "Is the flat still available?", timeLabel: "10:24", imageUrl: null },
  { id: "a2", mine: true, body: "Yes, it is.", timeLabel: "10:30", imageUrl: null },
];

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
  const t = getDictionary("en");
  window.__uploads = [];
  const upload = async (input) => {
    window.__uploads.push({ path: input.path, type: input.contentType, size: input.body.size, bucket: input.bucket });
    return window.__uploadAnswer || { ok: true };
  };
  mount(
    <div style={{ height: 800, display: "flex", flexDirection: "column" }}>
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live
        conversationId="${CONV}"
        meId="00000000-0000-4000-8000-000000000001"
        counterpartName="Ada Eze"
        counterpartTier="none"
        listing={null}
        inspected={false}
        context={{ kind: "direct" }}
        threadCopy={t.threads}
        locale="en"
        messages={${JSON.stringify(MESSAGES)}}
        uploadVoice={upload}
      />
      <ToastHost />
    </div>,
  );
`;

/* The microphone, the recorder and the analyser, as the browser shapes them. */
const init = `
  window.__media = { mode: "grant", asked: 0, stopped: 0 };
  window.__buzz = [];
  navigator.vibrate = (pattern) => { window.__buzz.push(pattern); return true; };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => {
        window.__media.asked += 1;
        if (window.__media.mode === "deny") { const e = new Error("Permission denied"); e.name = "NotAllowedError"; throw e; }
        return { getTracks: () => [{ stop() { window.__media.stopped += 1; } }] };
      },
    },
  });
  class FakeRecorder {
    static isTypeSupported(type) { return type.startsWith("audio/webm"); }
    constructor(stream, opts) { this.mimeType = (opts && opts.mimeType) || "audio/webm"; this.state = "inactive"; window.__recorderType = this.mimeType; }
    start() { this.state = "recording"; }
    stop() {
      if (this.state === "inactive") return;
      this.state = "inactive";
      setTimeout(() => {
        this.ondataavailable && this.ondataavailable({ data: new Blob([new Uint8Array(3000)], { type: this.mimeType }) });
        this.onstop && this.onstop();
      }, 10);
    }
  }
  window.MediaRecorder = FakeRecorder;
  let phase = 0;
  window.AudioContext = class {
    createAnalyser() {
      return { fftSize: 256, getByteTimeDomainData(a) { phase += 1; const amp = 40 + (phase % 50); for (let i = 0; i < a.length; i++) a[i] = 128 + Math.round(amp * Math.sin(i / 4)); } };
    }
    createMediaStreamSource() { return { connect() {} }; }
    close() { return Promise.resolve(); }
  };
`;

type Win = {
  __uploads: { path: string; type: string; size: number; bucket: string }[];
  __calls?: unknown[][];
  __media: { mode: string; asked: number; stopped: number };
  __buzz: unknown[];
  __uploadAnswer?: unknown;
  __recorderType?: string;
};

/** A finger on the round button: down, an optional slide, held, then up. */
async function hold(page: Page, opts: { ms: number; slideTo?: number }) {
  await page.evaluate(
    ({ ms, slideTo }) =>
      new Promise<void>((resolve) => {
        const button = document.querySelector<HTMLElement>('[data-testid="composer-action"]')!;
        const box = button.getBoundingClientRect();
        const x0 = box.left + box.width / 2;
        const y0 = box.top + box.height / 2;
        const fire = (kind: string, dx: number) =>
          button.dispatchEvent(
            new PointerEvent(kind, { bubbles: true, cancelable: true, pointerId: 9, pointerType: "touch", isPrimary: true, button: 0, clientX: x0 + dx, clientY: y0 }),
          );
        fire("pointerdown", 0);
        window.setTimeout(() => {
          if (slideTo !== undefined) for (let i = 1; i <= 8; i += 1) fire("pointermove", Math.round((slideTo * i) / 8));
          window.setTimeout(() => {
            fire("pointerup", slideTo ?? 0);
            resolve();
          }, ms / 2);
        }, ms / 2);
      }),
    opts,
  );
}

const calls = (page: Page, name: string) =>
  page.evaluate((n) => ((window as unknown as Win).__calls ?? []).filter((c) => c[0] === n).map((c) => c[1]), name);

const actionLabel = (page: Page) => page.getByTestId("composer-action").getAttribute("aria-label");

describe.skipIf(!hasBrowser && !process.env.CI)("the microphone that becomes Send", () => {
  it("is the microphone with the field empty and Send with words, crossing over in place", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init });
    try {
      const button = page.getByTestId("composer-action");
      expect(await actionLabel(page)).toBe("Record a voice note");
      expect(await button.getAttribute("data-mode")).toBe("mic");
      expect(await button.getAttribute("type")).toBe("button");
      const before = await button.boundingBox();

      await page.locator("#thread-input").fill("Can I see it on Saturday?");
      expect(await actionLabel(page)).toBe("Send message");
      expect(await button.getAttribute("data-mode")).toBe("send");
      expect(await button.getAttribute("type")).toBe("submit");
      /* The two glyphs swap by opacity in one place: the button did not move. */
      expect(await button.boundingBox()).toEqual(before);
      const shown = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".nf-composer__glyph")].map((g) => getComputedStyle(g).opacity),
      );
      expect(shown).toHaveLength(2);

      await page.locator("#thread-input").fill("   ");
      expect(await actionLabel(page)).toBe("Record a voice note");
      /* Nothing was asked of the microphone just by being here. */
      expect(await page.evaluate(() => (window as unknown as Win).__media.asked)).toBe(0);
    } finally {
      await close();
    }
  });

  it("answers a tap with the hint, and records nothing", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init });
    try {
      await hold(page, { ms: 60 });
      await expect.poll(() => page.getByText("Hold the microphone to record a voice note.").count()).toBe(1);
      expect(await page.getByTestId("voice-note").count()).toBe(0);
      expect(await calls(page, "attachVoice")).toEqual([]);
    } finally {
      await close();
    }
  });

  it("throws the recording away when the finger slides left, with one light tap", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init });
    try {
      await page.evaluate(() => {
        const button = document.querySelector<HTMLElement>('[data-testid="composer-action"]')!;
        const box = button.getBoundingClientRect();
        (window as unknown as { __at: number[] }).__at = [box.left + box.width / 2, box.top + box.height / 2];
        button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 9, pointerType: "touch", isPrimary: true, button: 0, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
      });
      await page.getByTestId("voice-recording").waitFor();
      expect(await page.getByText("Slide to cancel").count()).toBe(1);
      await expect.poll(() => page.getByTestId("voice-recording-time").textContent()).toMatch(/^0:0\d$/);
      /* Part of the way: still recording, the words following the finger. */
      await page.evaluate(() => {
        const [x, y] = (window as unknown as { __at: number[] }).__at;
        const button = document.querySelector<HTMLElement>('[data-testid="composer-action"]')!;
        button.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 9, pointerType: "touch", clientX: x! - 50, clientY: y! }));
      });
      expect(await page.getByTestId("voice-recording").count()).toBe(1);
      expect(await page.getByTestId("voice-slide").evaluate((el) => (el as HTMLElement).style.transform)).toMatch(/translateX\(-\d+px\)/);
      /* Past the line: gone. */
      await page.evaluate(() => {
        const [x, y] = (window as unknown as { __at: number[] }).__at;
        const button = document.querySelector<HTMLElement>('[data-testid="composer-action"]')!;
        button.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 9, pointerType: "touch", clientX: x! - 140, clientY: y! }));
        button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 9, pointerType: "touch", clientX: x! - 140, clientY: y! }));
      });
      await expect.poll(() => page.getByTestId("voice-recording").count()).toBe(0);
      expect(await page.evaluate(() => (window as unknown as Win).__buzz.length)).toBe(1);
      expect(await page.evaluate(() => (window as unknown as Win).__media.stopped)).toBe(1);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => (window as unknown as Win).__uploads.length)).toBe(0);
      expect(await calls(page, "attachVoice")).toEqual([]);
      expect(await page.getByTestId("voice-note").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("sends on release: Sending until the server answers, then sent, with its own length and bars", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      init,
      actions: {
        attachVoice: `() => new Promise((resolve) => { window.__answer = () => resolve({ ok: true, data: { messageId: "00000000-0000-4000-8000-0000000000f1", attachmentId: "x", createdAt: new Date().toISOString() } }); })`,
      },
    });
    try {
      await hold(page, { ms: 900 });
      const note = page.getByTestId("voice-note");
      await note.waitFor();
      /* Drawn at once, and honestly not sent yet. */
      await expect.poll(() => page.getByTestId("msg-status").last().textContent()).toBe("Sending");
      await expect.poll(() => calls(page, "attachVoice").then((c) => c.length)).toBe(1);

      const [args] = (await calls(page, "attachVoice")) as {
        conversationId: string;
        storagePath: string;
        durationMs: number;
        peaks: number[] | null;
        replyToId: string | null;
      }[];
      const uploads = await page.evaluate(() => (window as unknown as Win).__uploads);
      expect(uploads).toHaveLength(1);
      expect(uploads[0]!.bucket).toBe("message-attachments");
      expect(uploads[0]!.type).toBe("audio/webm");
      expect(uploads[0]!.size).toBe(3000);
      expect(uploads[0]!.path).toMatch(new RegExp(`^${CONV}/[0-9a-f-]{36}\\.webm$`));
      expect(args!.storagePath).toBe(uploads[0]!.path);
      expect(args!.conversationId).toBe(CONV);
      expect(args!.durationMs).toBeGreaterThanOrEqual(800);
      expect(args!.durationMs).toBeLessThan(5000);
      expect(args!.peaks).toHaveLength(40);
      expect(Math.max(...args!.peaks!)).toBe(1);
      expect(await page.evaluate(() => (window as unknown as Win).__recorderType)).toBe("audio/webm;codecs=opus");
      /* The bubble carries the bars it was sent with. */
      expect(await page.getByTestId("voice-bars").locator(".nf-voice__bar").count()).toBe(40);

      await page.evaluate(() => (window as unknown as { __answer: () => void }).__answer());
      await expect.poll(() => page.getByTestId("msg-status").last().textContent()).toMatch(/^\d{2}:\d{2}/);
      expect(await page.locator('[data-msg-id="00000000-0000-4000-8000-0000000000f1"]').count()).toBe(1);
      /* Its words are not drawn under the player. */
      expect(await page.getByText("\u{1F3A4} Voice note").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("says a refusal in the banner, and Try again records the file already uploaded", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      init,
      actions: {
        attachVoice: `async () => {
          window.__tries = (window.__tries || 0) + 1;
          return window.__tries === 1
            ? { ok: false, error: "Your voice note did not send. Tap Try again to send it." }
            : { ok: true, data: { messageId: "00000000-0000-4000-8000-0000000000f2", attachmentId: "x", createdAt: new Date().toISOString() } };
        }`,
      },
    });
    try {
      await hold(page, { ms: 800 });
      await page.getByText("Not sent.").waitFor();
      await expect.poll(() => page.getByText("Your voice note did not send. Tap Try again to send it.").count()).toBe(1);
      await page.getByTestId("bubble-retry").click();
      await expect.poll(() => page.locator('[data-msg-id="00000000-0000-4000-8000-0000000000f2"]').count()).toBe(1);
      expect(await page.getByText("Not sent.").count()).toBe(0);
      expect(await page.evaluate(() => (window as unknown as Win).__uploads.length)).toBe(1);
      expect((await calls(page, "attachVoice")).length).toBe(2);
    } finally {
      await close();
    }
  });

  it("says plainly when the bucket will not take voice notes yet", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init: `${init}; window.__uploadAnswer = { ok: false, reason: "failed", status: 415 };` });
    try {
      await hold(page, { ms: 800 });
      await page.getByText("Not sent.").waitFor();
      await expect.poll(() => page.getByText("Voice notes aren't switched on yet. Write a message instead.").count()).toBe(1);
      expect(await calls(page, "attachVoice")).toEqual([]);
    } finally {
      await close();
    }
  });

  it("explains how to allow the microphone when it was refused", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init: `${init}; window.__media.mode = "deny";` });
    try {
      await hold(page, { ms: 600 });
      await expect
        .poll(() => page.getByText(/Microphone access is off\. Turn it on for Vallo in your phone's Settings/).count())
        .toBe(1);
      expect(await page.getByTestId("voice-recording").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
