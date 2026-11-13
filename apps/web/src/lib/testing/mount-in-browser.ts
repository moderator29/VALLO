import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type Plugin } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";

/**
 * MOUNT A CLIENT COMPONENT IN A REAL CHROMIUM, INTERACTIVELY. Test-only.
 *
 * `render-client.ts` renders to a string, which is enough to read markup and
 * not enough to click a button, watch focus move or ask what a reduced-motion
 * reader is shown. This bundles an entry for the BROWSER with esbuild and
 * mounts it with `createRoot`, so a test drives the real component.
 *
 * WHAT IS REPLACED, and nothing else:
 *   - `next/navigation`, `next/link`, `next/image`: inert stand-ins. Router
 *     calls are recorded on `window.__router` for a test to read.
 *   - EVERY `"use server"` MODULE: a proxy whose exports call
 *     `window.__actions[name](...args)`. The test hands in each action's
 *     behaviour as function source, which is how "the server answered ok",
 *     "pending" and "refused" are staged without a server or a database.
 *   - `@/lib/supabase/client`, `server-only` and stylesheet imports: empty.
 *
 * The entry is TSX source importing from `@/...` and calling `mount(<X />)`
 * from `@/lib/testing/browser-root`, which wraps the tree in the same
 * `ClientCopyProvider` the root layout renders.
 */
const WEB_SRC = join(__dirname, "..", "..");

const CHROMIUM = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].find((path) => existsSync(path));

export const hasBrowser = Boolean(CHROMIUM);

const STUBS: Record<string, string> = {
  "next/navigation": `
    const calls = (window.__router = window.__router || { calls: [] });
    const record = (name) => (...args) => { calls.calls.push([name, ...args]); };
    const router = { push: record("push"), replace: record("replace"), refresh: record("refresh"), back: record("back"), prefetch() {} };
    export const useRouter = () => router;
    export const usePathname = () => window.__pathname ?? window.location.pathname;
    export const useSearchParams = () => new URLSearchParams(window.location.search);
    export const useParams = () => ({});
    export const redirect = () => { throw new Error("redirect"); };
    export const notFound = () => { throw new Error("notFound"); };
  `,
  "next/link": `
    import { createElement, forwardRef } from "react";
    const Link = forwardRef(function Link({ href, prefetch, replace, scroll, ...rest }, ref) {
      return createElement("a", { ...rest, ref, href: typeof href === "string" ? href : String(href?.pathname ?? "") });
    });
    export default Link;
  `,
  "next/image": `
    import { createElement } from "react";
    export default function Image({ fill, priority, sizes, ...rest }) { return createElement("img", rest); }
  `,
  "@/lib/supabase/client": `export const createClient = () => ({ storage: { from: () => ({}) }, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} });`,
  "server-only": `export {};`,
};

function harnessPlugin(dir: string): Plugin {
  return {
    name: "vallo-browser-harness",
    setup(b) {
      for (const [spec, source] of Object.entries(STUBS)) {
        const file = join(dir, `${spec.replace(/[^a-z0-9]/gi, "_")}.jsx`);
        writeFileSync(file, source);
        const filter = new RegExp(`^${spec.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`);
        b.onResolve({ filter }, () => ({ path: file }));
      }
      b.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
      /* A "use server" module never reaches the browser: its exports become
         calls into the test's staged answers. */
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const source = readFileSync(args.path, "utf8");
        if (!/^\s*["']use server["'];?/.test(source)) return undefined;
        const names = new Set<string>();
        for (const m of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) names.add(m[1]!);
        for (const m of source.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) names.add(m[1]!);
        const contents = [...names]
          .map(
            (name) =>
              `export const ${name} = (...args) => { const fn = (window.__actions || {})[${JSON.stringify(name)}]; window.__calls = window.__calls || []; window.__calls.push([${JSON.stringify(name)}, ...args]); return fn ? fn(...args) : new Promise(() => {}); };`,
          )
          .join("\n");
        return { contents, loader: "js" };
      });
    },
  };
}

let browser: Browser | null = null;

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = null;
}

/**
 * Launch the shared browser before the first mount. Call it from `beforeAll`,
 * whose budget is the hook timeout, so the first test of a file does not pay
 * the Chromium start inside its own test timeout.
 */
export async function warmBrowser(): Promise<void> {
  if (!CHROMIUM) return;
  browser ??= await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
}

/**
 * The budget a browser test needs: a mount may wait 30 s for its bundle
 * (below), and a test then waits up to 15 s for what it asserts, so the
 * suite-wide 30 s test timeout is too small by construction.
 */
export const BROWSER_TEST_TIMEOUT = 75_000;

export type Mounted = { page: Page; close: () => Promise<void> };

export async function mountInBrowser(opts: {
  /** TSX source; imports from `@/...` and calls `mount(<X />)`. */
  entry: string;
  /** Server action name to function source, e.g. `async () => ({ ok: true, data: null })`. */
  actions?: Record<string, string>;
  reducedMotion?: boolean;
  /** The app's own motion setting, as the root attribute carries it. */
  motion?: "calm" | "off";
  /** Extra CSS, e.g. the product stylesheet a test needs. */
  css?: string;
  url?: string;
  /** Script run in the page before the component mounts (seed storage, stub an API). */
  init?: string;
  /** The window size; a phone (390 by 844) unless a test needs another. */
  viewport?: { width: number; height: number };
  /**
   * A touch screen rather than a mouse. Chromium then answers
   * `(pointer: coarse)` and `(hover: none)`, which is the test the product
   * CSS uses to tell a thumb from a pointer-and-keyboard machine, and the
   * only way to measure a rule written inside that query.
   */
  touch?: boolean;
}): Promise<Mounted> {
  if (!CHROMIUM) throw new Error("no Chromium binary for the browser mount");
  const dir = mkdtempSync(join(tmpdir(), "nf-mount-"));
  let bundle: string;
  try {
    writeFileSync(join(dir, "entry.tsx"), opts.entry);
    const out = join(dir, "out.js");
    await build({
      entryPoints: [join(dir, "entry.tsx")],
      bundle: true,
      platform: "browser",
      format: "iife",
      outfile: out,
      jsx: "automatic",
      logLevel: "silent",
      alias: { "@": WEB_SRC },
      nodePaths: [join(WEB_SRC, "..", "node_modules"), join(WEB_SRC, "..", "..", "..", "node_modules")],
      define: { "process.env.NODE_ENV": '"production"' },
      banner: { js: "window.process = window.process || { env: { NODE_ENV: 'production' } };" },
      plugins: [harnessPlugin(dir)],
    });
    bundle = readFileSync(out, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  browser ??= await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 390, height: 844 },
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    ...(opts.touch ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await context.newPage();
  const actions = Object.entries(opts.actions ?? {})
    .map(([name, fn]) => `${JSON.stringify(name)}: (${fn})`)
    .join(",");
  await page.addInitScript(`window.__actions = { ${actions} };`);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"${opts.motion ? ` data-motion="${opts.motion}"` : ""}><head><style>${opts.css ?? ""}</style></head><body><div id="root"></div></body></html>`,
    }),
  );
  await page.goto(opts.url ?? "http://vallo.test/");
  if (opts.init) await page.evaluate(opts.init);
  await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => (window as unknown as { __mounted?: boolean }).__mounted === true, null, {
    /* Generous: a bundle of a whole checkout mounts slowly on a busy box. */
    timeout: 30_000,
  }).catch(() => {
    throw new Error(`the entry did not mount: ${errors.join(" | ")}`);
  });
  return { page, close: () => context.close() };
}
