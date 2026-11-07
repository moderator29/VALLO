import { afterAll, beforeAll, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { readFileSync } from "node:fs";
vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);
const src = readFileSync(__dirname + "/ComposerVoice.dom.test.tsx", "utf8");
const entry = eval("`" + src.split("const entry = `")[1]!.split("`;\n")[0]!.replace(/\$\{CONV\}/g, "00000000-0000-4000-8000-00000000c001").replace(/\$\{JSON.stringify\(MESSAGES\)\}/, "[]") + "`");
const init = src.split("const init = `")[1]!.split("`;\n")[0]!;
it("debug", async () => {
  const { page, close } = await mountInBrowser({ entry, init, actions: { attachVoice: `async () => ({ ok: true, data: { messageId: "m9", attachmentId: "x", createdAt: new Date().toISOString() } })` } });
  page.on("console", (m) => require('fs').appendFileSync('/tmp/claude-0/-home-user-VALLO/e7b336c3-9b6d-51b6-85b5-a6082123dea2/scratchpad/dbg.txt', '\nCONSOLE ' + m.text()));
  page.on("pageerror", (e) => require('fs').appendFileSync('/tmp/claude-0/-home-user-VALLO/e7b336c3-9b6d-51b6-85b5-a6082123dea2/scratchpad/dbg.txt', '\nPAGEERR ' + e.message));
  await page.evaluate(() => new Promise<void>((resolve) => {
    const b = document.querySelector<HTMLElement>('[data-testid="composer-action"]')!;
    const r = b.getBoundingClientRect();
    const f = (k: string) => b.dispatchEvent(new PointerEvent(k, { bubbles: true, cancelable: true, pointerId: 9, pointerType: "touch", isPrimary: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 }));
    f("pointerdown");
    setTimeout(() => { console.log("rec?", !!document.querySelector('[data-testid="voice-recording"]')); f("pointerup"); setTimeout(resolve, 1500); }, 900);
  }));
  require('fs').appendFileSync('/tmp/claude-0/-home-user-VALLO/e7b336c3-9b6d-51b6-85b5-a6082123dea2/scratchpad/dbg.txt', '\nBODY ' + await page.evaluate(() => document.body.innerText.slice(-600)));
  require('fs').appendFileSync('/tmp/claude-0/-home-user-VALLO/e7b336c3-9b6d-51b6-85b5-a6082123dea2/scratchpad/dbg.txt', '\nCALLS ' + JSON.stringify(await page.evaluate(() => (window as any).__calls)));
  await close();
});
