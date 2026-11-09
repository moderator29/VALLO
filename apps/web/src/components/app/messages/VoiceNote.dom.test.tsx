/**
 * A voice note, mounted for real in Chromium on the product's own thread
 * stylesheet. The rule it keeps (north star 15.4): it is drawn only from what is
 * REAL. The length is the row's stored one, else what the audio element reports,
 * else nothing; the bars are the row's stored peaks, else computed from the
 * decoded file, else there are none and the note is a plain track. A length or a
 * waveform is never a placeholder.
 *
 * THE AUDIO is generated here, not borrowed: a two-second 8 kHz tone that swells
 * from silence, built as a WAV in memory and handed over as a data URL, so the
 * browser genuinely measures and decodes it. "Unplayable" is the stage's own
 * answer to every other request (an HTML page), which no audio element or
 * decoder can read, so a note that knows nothing is a note that knows nothing.
 *
 * The stored numbers in the fixtures are slot values for the component's two
 * inputs (a length, a handful of bars); nothing here is shown as a claim.
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
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/threads.css");

/* A real two-second recording: 8 kHz, 8-bit, mono, a tone that swells from silence. */
function toneDataUrl(): string {
  const rate = 8000;
  const seconds = 2;
  const n = rate * seconds;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + n, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(n, 40);
  const body = Buffer.alloc(n);
  for (let i = 0; i < n; i += 1) {
    const swell = i / n;
    body[i] = Math.round(128 + 120 * swell * Math.sin((2 * Math.PI * 440 * i) / rate));
  }
  return `data:audio/wav;base64,${Buffer.concat([header, body]).toString("base64")}`;
}
const TONE = toneDataUrl();
const UNPLAYABLE = "http://vallo.test/a-voice-note-slot.ogg";

type Note = { url: string; durationMs?: number | null; peaks?: readonly number[] | null };

function entry(note: Note, mine = false): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { VoiceNote } from "@/components/app/messages/VoiceNote";
    import { mount } from "@/lib/testing/browser-root";
    const copy = getDictionary("en").experienceInbox.thread.voice;
    /* How many times the file was fetched for decoding, so "decodes nothing" can be proved. */
    window.__fetches = 0;
    const realFetch = window.fetch.bind(window);
    window.fetch = (...args) => { window.__fetches += 1; return realFetch(...args); };
    mount(<div style={{ maxWidth: 360, padding: 16 }}><VoiceNote note={${JSON.stringify(note)}} mine={${mine}} copy={copy} /></div>);
  `;
}

const note = (page: Page) => page.getByTestId("voice-note");
const bars = (page: Page) => page.getByTestId("voice-bars").locator(".nf-voice__bar");
const heights = (page: Page) => bars(page).evaluateAll((els) => els.map((el) => (el as HTMLElement).style.height));
const fetches = (page: Page) => page.evaluate(() => (window as unknown as { __fetches: number }).__fetches);

/* What is drawn, in one read: bars, the plain track, the time and the seek bar. */
const drawn = (page: Page) =>
  page.evaluate(() => ({
    bars: document.querySelectorAll("[data-testid=voice-bars] .nf-voice__bar").length,
    track: document.querySelectorAll(".nf-voice__track").length,
    time: document.querySelector(".nf-voice__time")?.textContent ?? null,
    seek: document.querySelectorAll("input[type=range]").length,
    label: document.querySelector("[data-testid=voice-note]")?.getAttribute("aria-label") ?? null,
  }));

describe.skipIf(!hasBrowser && !process.env.CI)("a voice note", () => {
  it("draws no bars, no length and no seek bar when it knows nothing, only a plain track", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ url: UNPLAYABLE }), css: CSS });
    try {
      /* Give the metadata request, the decode attempt and the audio error time to land. */
      await page.waitForTimeout(800);
      expect(await drawn(page)).toEqual({ bars: 0, track: 1, time: null, seek: 0, label: "Voice note" });
      /* No placeholder length anywhere in the note. */
      expect(await note(page).innerText()).not.toMatch(/\d/);
    } finally {
      await close();
    }
  });

  it("treats an empty list of stored bars as no bars", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ url: UNPLAYABLE, peaks: [] }), css: CSS });
    try {
      await page.waitForTimeout(800);
      expect(await drawn(page)).toMatchObject({ bars: 0, track: 1, time: null, seek: 0 });
    } finally {
      await close();
    }
  });

  it("draws the stored bars alone when it has no length, and still no length or seek bar", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ url: UNPLAYABLE, peaks: [0.25, 0.5, 1, 0.5] }),
      css: CSS,
    });
    try {
      await page.waitForTimeout(800);
      expect(await drawn(page)).toEqual({ bars: 4, track: 0, time: null, seek: 0, label: "Voice note" });
      expect(await heights(page)).toEqual(["25%", "50%", "100%", "50%"]);
      /* Stored bars mean nothing is decoded. */
      expect(await fetches(page)).toBe(0);
    } finally {
      await close();
    }
  });

  it("draws the stored length alone when it has no bars: the track, the length and the seek bar", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ url: UNPLAYABLE, durationMs: 3000 }), css: CSS });
    try {
      await page.waitForTimeout(800);
      expect(await drawn(page)).toEqual({ bars: 0, track: 1, time: "0:03", seek: 1, label: "Voice note, 0:03" });
    } finally {
      await close();
    }
  });

  it("uses both stored values as given, preferring the stored length over what the file reports", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ url: TONE, durationMs: 3000, peaks: [0.25, 0.5, 1, 0.5] }),
      css: CSS,
    });
    try {
      await page.waitForTimeout(800);
      /* The file is two seconds long; the row said three, and the row wins. */
      expect(await drawn(page)).toEqual({ bars: 4, track: 0, time: "0:03", seek: 1, label: "Voice note, 0:03" });
      expect(await fetches(page)).toBe(0);
    } finally {
      await close();
    }
  });

  it("measures the real file for its length and decodes it for its bars when the row carries neither", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ url: TONE }), css: CSS });
    try {
      await page.getByTestId("voice-bars").waitFor({ timeout: 15_000 });
      const state = await drawn(page);
      /* Forty bars from the real samples; the length the audio element reported. */
      expect(state).toEqual({ bars: 40, track: 0, time: "0:02", seek: 1, label: "Voice note, 0:02" });
      const h = (await heights(page)).map((value) => parseInt(value, 10));
      /* The tone swells, so the bars swell with it: the first is the quietest drawn
         mark (the 8% floor) and the last is the loudest, full height. */
      expect(h[0]).toBe(8);
      expect(h[h.length - 1]).toBe(100);
      expect(h.every((value, i) => i === 0 || value >= h[i - 1]! - 3)).toBe(true);
      expect(await fetches(page)).toBe(1);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("names its play control, flips it on press, and never starts by itself", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ url: TONE, durationMs: 2000, peaks: [0.5, 1, 0.5] }), css: CSS });
    try {
      await page.waitForTimeout(600);
      expect(await page.locator("audio").evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
      const play = page.getByRole("button", { name: "Play voice note" });
      expect(await play.getAttribute("aria-pressed")).toBe("false");
      const box = (await play.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await play.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Pause voice note" }).waitFor();
      expect(await page.getByRole("button", { name: "Pause voice note" }).getAttribute("aria-pressed")).toBe("true");
      expect(await page.locator("audio").evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Play voice note" }).waitFor();
      expect(await page.locator("audio").evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
    } finally {
      await close();
    }
  });

  it("seeks from the keyboard and marks the bars the position has passed, in a state and not an animation", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ url: TONE, durationMs: 2000, peaks: [0.5, 1, 0.5, 1] }),
      css: CSS,
    });
    try {
      await page.waitForTimeout(600);
      const seek = page.getByRole("slider", { name: "Playback position" });
      expect(await seek.count()).toBe(1);
      expect(await page.locator(".nf-voice__bar[data-played]").count()).toBe(0);
      await seek.focus();
      /* Half way: the first two of four bars are passed. */
      await seek.evaluate((el: HTMLInputElement) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        set.call(el, "500");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(() => document.querySelectorAll(".nf-voice__bar[data-played]").length === 2);
      expect(await seek.inputValue()).toBe("500");
      /* The position reads as a time once there is one. */
      expect(await page.locator(".nf-voice__time").textContent()).toBe("0:01");
      /* Nothing moves by itself: no running animation, no transition on a bar. */
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    } finally {
      await close();
    }
  });

  it("says so, in words, when the recording cannot be played", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ url: UNPLAYABLE, durationMs: 3000 }), css: CSS });
    try {
      const alert = page.getByRole("alert");
      await alert.waitFor();
      expect(await alert.textContent()).toBe("This voice note could not be played");
    } finally {
      await close();
    }
  });

  it("passes axe with bars and with the plain track, and in the theirs and mine bubbles", async () => {
    for (const [n, mine] of [
      [{ url: UNPLAYABLE, durationMs: 3000, peaks: [0.25, 0.5, 1, 0.5] }, false],
      [{ url: UNPLAYABLE, durationMs: 3000 }, true],
    ] as const) {
      const { page, close } = await mountInBrowser({ entry: entry(n, mine), css: CSS });
      try {
        await page.waitForTimeout(600);
        expect(await note(page).getAttribute("class")).toContain(mine ? "nf-voice--mine" : "nf-voice");
        /* The unplayable file's alert is text, not the subject here. */
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    }
  });

  it("has no motion to reduce: nothing animates for a reader who asked for less either", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ url: TONE, durationMs: 2000, peaks: [0.5, 1, 0.5] }),
      css: CSS,
      reducedMotion: true,
    });
    try {
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Play voice note" }).click();
      await page.getByRole("button", { name: "Pause voice note" }).waitFor();
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      expect(
        await bars(page).evaluateAll((els) => els.every((el) => getComputedStyle(el).transitionDuration === "0s")),
      ).toBe(true);
    } finally {
      await close();
    }
  });
});

/* GRADE 1: the speed control, and (job 9) a refreshed link that never restarts a note that is playing. */
describe.skipIf(!hasBrowser && !process.env.CI)("a voice note's speed and its refreshed link", () => {
  const swapEntry = `
    import { useState } from "react";
    import { getDictionary } from "@vallo/i18n";
    import { VoiceNote } from "@/components/app/messages/VoiceNote";
    import { mount } from "@/lib/testing/browser-root";
    const copy = getDictionary("en").experienceInbox.thread.voice;
    const FIRST = ${JSON.stringify(TONE)};
    const SECOND = FIRST.replace("data:audio/wav;base64,", "data:audio/x-wav;base64,");
    function Host() {
      const [url, setUrl] = useState(FIRST);
      window.__swap = () => setUrl(SECOND);
      window.__second = SECOND;
      return <div style={{ maxWidth: 360, padding: 16 }}><VoiceNote note={{ url, durationMs: 2000, peaks: [0.2, 0.6, 1, 0.4] }} mine={false} copy={copy} /></div>;
    }
    mount(<Host />);
  `;
  type W = { __swap: () => void; __second: string };
  const audio = (page: Page) =>
    page.getByTestId("voice-audio").evaluate((el) => {
      const a = el as HTMLAudioElement;
      return { src: a.getAttribute("src") ?? "", paused: a.paused, time: a.currentTime, rate: a.playbackRate };
    });

  it("cycles 1x, 1.5x and 2x while it plays", async () => {
    const { page, close } = await mountInBrowser({ entry: swapEntry, css: CSS });
    try {
      await page.getByRole("button", { name: "Play voice note" }).click();
      await page.getByTestId("voice-rate").waitFor();
      expect(await page.getByTestId("voice-rate").textContent()).toBe("1x");
      await page.getByTestId("voice-rate").click();
      expect(await page.getByTestId("voice-rate").textContent()).toBe("1.5x");
      expect((await audio(page)).rate).toBe(1.5);
      await page.getByTestId("voice-rate").click();
      expect((await audio(page)).rate).toBe(2);
    } finally {
      await close();
    }
  });

  it("keeps playing from the old link and takes the new one on pause, where it was", async () => {
    const { page, close } = await mountInBrowser({ entry: swapEntry, css: CSS });
    try {
      await page.getByRole("button", { name: "Play voice note" }).click();
      await expect.poll(async () => (await audio(page)).time).toBeGreaterThan(0.3);
      const before = await audio(page);
      await page.evaluate(() => (window as unknown as W).__swap());
      await page.waitForTimeout(250);
      const during = await audio(page);
      /* Still the first link, still playing, still moving forward. */
      expect(during.src).toBe(before.src);
      expect(during.paused).toBe(false);
      expect(during.time).toBeGreaterThan(before.time);

      await page.getByRole("button", { name: "Pause voice note" }).click();
      const second = await page.evaluate(() => (window as unknown as W).__second);
      await expect.poll(async () => (await audio(page)).src).toBe(second);
      /* Put back where it was paused, not at the start. */
      await expect.poll(async () => (await audio(page)).time).toBeGreaterThan(0.3);
    } finally {
      await close();
    }
  });
});
