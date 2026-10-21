import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error: the drawing is a plain ES module in the repository's scripts folder.
import { COLOURS, markSvg, wordmarkSvg } from "../../../../../scripts/brand/logo-art.mjs";
import { MARK_ACCENT, MARK_GRADIENTS, MARK_SIDE } from "@/lib/brand/logo-geometry";

/*
 * THE LOGO SWEEP, PROVED (D81, 8 October 2026). The founder: "any single place
 * our old logo is used in our platform ... no one single place should it still
 * [have the old one]".
 *
 * Three ways the old artwork could survive, each closed here:
 *
 *   1. A FILE. Every logo file the platform shipped before the sweep is named
 *      below by its SHA-256. No file anywhere in the web app, the native
 *      projects, the shared assets, the scripts or the email templates may
 *      hash to one of them, under its old name or any other.
 *   2. A DRAWING IN CODE. The old mark and wordmark also existed as vector
 *      paths; their path data may not appear in any source file.
 *   3. A BOX FOR THE OLD SHAPE. The old mark was 614 by 587 and the old
 *      wordmark 758 by 167; a call site still declaring those boxes is a call
 *      site drawing the new art at the old aspect, or still pointing at a copy
 *      of the old art.
 *
 * And the shipped SVGs must be exactly what `scripts/brand/logo-art.mjs`
 * draws, so the files and the drawing cannot drift apart.
 */

const THIS_FILE = fileURLToPath(import.meta.url);
const WEB = join(dirname(THIS_FILE), "..", "..", "..");
const ROOT = join(WEB, "..", "..");

/** sha256 of every logo file as it stood before the sweep, with where it lived. */
const OLD_LOGO_FILES: ReadonlyArray<readonly [string, string]> = [
  ["0a9e4a10097d4f07e595a84fc55418966f529989ffbac8bb85db437ee64eda70", "apps/web/public/pwa/icon-48.png"],
  ["0c5b9b7c251ff5294ac7b663f53e6fb9d301a8bf5e9080ebfab21808c926a970", "apps/web/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png"],
  ["0db07044f9f85b94a66de594d03b77b2ad214e318c71defa21d231e49d7f0097", "apps/web/src/app/opengraph-image.jpg"],
  ["14dd228f72df54c891a85f8b8ca70c437599ba0c4e004e01220009214f5192a1", "apps/web/android/app/src/main/res/mipmap-mdpi/ic_launcher.png"],
  ["1626c6a4a34e03eb88c667c9c6383781c37724d8790904bd1807d5d53b1d837f", "apps/web/public/pwa/icon-maskable-512.png"],
  ["1a193ba4c6138d3bf5b9a6e1f74d5eb9c9117763515c75d8b7d45fa222c549d1", "apps/web/public/brand/vallo-mark-light.png"],
  ["224056201acc3309bf29cca0a4d1c812ae1eca8160c9239b4178cd8f9616a0f9", "apps/web/public/brand/vallo-wordmark-light.png"],
  ["313a464be6527fc2637da3a6f1512cd72149c7b4d5f0ec749148867c3c441520", "apps/web/assets/icon-foreground.png"],
  ["32755bb0657f6aa5e6c1e0672fe4205c8338379d44bcbee650db669620d05799", "apps/web/public/favicon.ico"],
  ["384adb9f32fcf7dd701a01673efb415aa00537a0299be6f30676df9162733903", "apps/web/public/brand/vallo-wordmark.svg"],
  ["49f170d46121b73f5f56bf977d7a2537ca8e78b6942b7bab68eea4d482d00555", "apps/web/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png"],
  ["52fb7ab7510f64109bb9c35c9a7ffa8d49cb81a316872e9e8d14c19da5109c8d", "apps/web/android/app/src/main/res/mipmap-ldpi/ic_launcher_round.png"],
  ["5382514acb7cc5a7c2754a7d2ec80c05afab2bca7402594b64b2512ea6e63a05", "apps/web/public/brand/vallo-wordmark.png"],
  ["561b286afc7c0f64d4f983eed5d1fbdb2c0024a505bef0ac1253417da49a009c", "apps/web/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png"],
  ["592cab14e08c6568aef1049c4f346e8457318c317ba2ad3f25cd4d643eac52c8", "apps/web/android/app/src/main/res/mipmap-ldpi/ic_launcher_foreground.png"],
  ["5f378efee4c0ace4e71c18efae4aedd15d156e43c0879db00ac40e7c25960a3c", "apps/web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png"],
  ["601dee756cfb7b4f14c6e48a402b2669cc87be6c84569832901fb28f1d060d84", "apps/web/public/brand/startup/vallo-mark.webp"],
  ["729850457f4e2c97ff9dc8bf19144ff303107e9ad8d3771c8c13a13d962747d4", "apps/web/assets/icon-only.png"],
  ["7a35a86b34195ce2e2bd274932505eaf5c11f3bed7240447298fbf168045d583", "apps/web/android/app/src/main/res/mipmap-ldpi/ic_launcher.png"],
  ["80d9b0f21428904c913b99ccfdb7808c4ca8bc3164bab5d417def5c10170ad14", "apps/web/public/pwa/icon-192.png"],
  ["82f4cf515d7afe0aa026d5d7fbba66d956b9554d3ba4372b54c1591046d16f59", "apps/web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"],
  ["890c9d66e1e7d7b452fe89b521b9ea3653f65d8cf7e9a41334079fe7dcb6bc6b", "apps/web/public/brand/session-b/signin/lockup.webp"],
  ["8df86c7600820838d7a3b544632636677b78d6c03aef4919b6cd5654a95af169", "apps/web/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png"],
  ["959dffffa71f3cd6aa6d9666717746e3a03dcb382cac7e73171c9bab9a07c11e", "apps/web/public/pwa/icon-16.png"],
  ["97ea0931068d70f840ea6072f1279c7314ab073a2676318baef0c711a9c7a6c6", "apps/web/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png"],
  ["a68292fdf8a24b4007819488668a90dcb1668beb08f437f77284043890965c7d", "apps/web/public/pwa/apple-touch-icon.png"],
  ["a7f44d98b1fe40341bd40cd26abbeb40afbefd1d1ce4916a4b20c849e9bf4123", "apps/web/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png"],
  ["a90b460554b3e8c3eee3446beda84398f6dd1d33e7c8e1dd1e02cbddaa633cbd", "apps/web/public/brand/vallo-mark.png"],
  ["a9ae213df289f613239b2e2539cc9af1dd21037c8c9233ab9dc5e7a7895518f1", "apps/web/public/brand/vallo-logo.png"],
  ["af4934fa135e2b8481a3fa8e287e6392b8ba4955d680baaba2834919ee69445f", "apps/web/public/brand/vallo-email-lockup.png"],
  ["b21b79527301f22086e8e654b5f7d385bda59bc79cb2465d543f4088d0467a72", "apps/web/public/brand/vallo-icon.png"],
  ["b2cdedc105447398761ccb8cee96fd168becd8af7251629c8df36a114658dc28", "apps/web/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png"],
  ["b3764680fa15e880c92c00dee5d562ec7006bbb1822182b10bc70ee0fed2d1dd", "apps/web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png"],
  ["b3f10920bf63ebfcc0c88b4f569f754047290a543a1dea0a3de6b2579c806e06", "apps/web/public/brand/vallo-mark.svg"],
  ["c5e26f40325df065f1c93c8ff6a48661b42e30ccd1a43c46ed4164530feb4de4", "apps/web/public/pwa/icon-64.png"],
  ["d944c46a1e269dd9b925d54e89f29c44c330da6761817650b88a1fdd0932f9dd", "apps/web/public/brand/startup/vallo-wordmark.webp"],
  ["e458fdf4ac83facbfa89239ee6d39d3695ab7e01b7fad69c1e3907dee5065b03", "assets/brand-sheets/vallo-wordmark-source.png"],
  ["e509fa1862f0f341c032d34a8b0b6e005452b869b8810df00c1f252a931ad025", "apps/web/android/app/src/main/res/mipmap-hdpi/ic_launcher.png"],
  ["ed6044f0d768bc5d9e3e8e4977d763208038ffd1698fff2f8ca81eb98e41f5e4", "apps/web/public/pwa/icon-512.png"],
  ["f137b83a84123286fb064ae9b4c2dc38cf39fcbc13ddaea1826c453fd7ded3e1", "apps/web/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png"],
  ["f39e37acf08918a02b3fc0c3e2d3838bea4a299af385c3003ec1e394fe273ca1", "apps/web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"],
  ["f648f0cf082b8ea6035b6aedecf56c5aa91189535af2e80feb51e605d42fd2eb", "apps/web/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png"],
  ["feae800ad5d3cb6166d209bb4da7ebb3ed5964b9fdf8e4c5eead6e7970bbb00b", "apps/web/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png"],
  /* D82: the D81 day and reverse recolourings, the welcome coin's old glass
     face (the old towers under glass) and the PWA install screenshots that
     showed the old glass mark in the header. */
  ["ec33bdccada1a04f9eb35de4a90031ae8a26e34319fdf86be638a759fe73ff51", "apps/web/public/brand/session-b/welcome/coin-face.webp"],
  ["c2d4642df1916ef04befc20e78bf50fdc9bc7372f8c34a43659495dc8cc48ec3", "apps/web/public/brand/vallo-mark-light.png (the day recolouring)"],
  ["e1d689a2874a53c75fc8b3483e32de69ac074286cccb7ec5cc07b404ac5b9782", "apps/web/public/brand/vallo-mark-light.svg (the day recolouring)"],
  ["037fb1a937dc802f7d8de0dd90f28693059a747858c4ec8ca3b2c61d3f6aa8da", "apps/web/public/brand/vallo-mark-reverse.svg"],
  ["d49913a09306dbc2a45f5f3b146c96e42f5f502991cd5f963e78461ec0bfc70b", "apps/web/public/brand/vallo-wordmark-light.png (the day recolouring)"],
  ["1187cd7d0b38e9fa4597c769a4b731de524992e6bbd572c37832f8a16374894d", "apps/web/public/brand/vallo-wordmark-light.svg (the day recolouring)"],
  ["12285119dbf6f3f7a26bdadbb6323bd6db38707304ea74673c06a6ca634bb705", "apps/web/public/brand/vallo-wordmark-reverse.svg"],
  ["2143489327beb87f731a2760fc8989434cedfc51b6ae8797a6f15a7f53b294d9", "apps/web/public/pwa/shots/narrow-home.jpg"],
  ["426823eb489132c8736d8e6c3422e079df9579798dae6028b81c8c8a57947070", "apps/web/public/pwa/shots/narrow-markets.jpg"],
  ["489d673a3f36fa7f275ec8378bac5844511c7b179def0bb99d1ccd3e1a5ad563", "apps/web/public/pwa/shots/narrow-search.jpg"],
  ["e128645f686e05ef8a4ca5e337d104f07e7ce3d9131cfd21b9570ecca4fbc02f", "apps/web/public/pwa/shots/wide-home.jpg"],
];

const OLD_PATH_DATA = [
  /* the old mark (`vallo-mark.svg`, five towers and a swoosh) */
  "M52 325 109 296V508L52 512Z",
  "M223 98 345 21V452L223 489Z",
  /* the old wordmark (`vallo-wordmark.svg`) */
  "M21 21H59L106 110 153 21H191L120 155H92Z",
  "M248.8 21H257.2L345 155H305L253 75.6 201 155H161Z",
  /* the old Android notification icon (a door in an arch) */
  "M12,2.5L3.5,9.2v11.3h5.2V13.4h6.6v7.1h5.2V9.2L12,2.5z",
];

const SKIP_DIRS = new Set(["node_modules", ".next", "test-results", "playwright-report", ".turbo"]);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico", ".svg", ".gif"]);
const SOURCE = new Set([".ts", ".tsx", ".mjs", ".js", ".css", ".html", ".svg", ".json", ".xml"]);

const SWEPT = [
  join(WEB, "public"),
  join(WEB, "src"),
  /* The packaged shell's offline card (8 October 2026): it drew the old
     towers inline until the founder saw them on TestFlight. */
  join(WEB, "native-shell"),
  join(WEB, "assets"),
  join(WEB, "android", "app", "src", "main", "res"),
  join(WEB, "ios", "App", "App", "Assets.xcassets"),
  join(ROOT, "assets"),
  join(ROOT, "packages"),
  join(ROOT, "supabase", "templates"),
  join(ROOT, "scripts"),
];

describe("the old logo is gone from the platform (D81)", () => {
  const files = SWEPT.flatMap((d) => walk(d));

  it("finds the platform's files to check", () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it("no file is a copy of an old logo file, under any name", () => {
    const old = new Map(OLD_LOGO_FILES);
    const found: string[] = [];
    for (const f of files) {
      if (!IMAGE.has(extname(f).toLowerCase())) continue;
      if (statSync(f).size > 8 * 1024 * 1024) continue;
      const hash = createHash("sha256").update(readFileSync(f)).digest("hex");
      const was = old.get(hash);
      if (was) found.push(`${relative(ROOT, f)} (the old ${was})`);
    }
    expect(found).toEqual([]);
  });

  it("no source file carries the old mark's or wordmark's path data", () => {
    const found: string[] = [];
    for (const f of files) {
      if (!SOURCE.has(extname(f).toLowerCase()) || f === THIS_FILE) continue;
      const text = readFileSync(f, "utf8");
      for (const d of OLD_PATH_DATA) if (text.includes(d)) found.push(`${relative(ROOT, f)}: ${d}`);
    }
    expect(found).toEqual([]);
  });

  it("no call site declares the old mark's or wordmark's box", () => {
    const found: string[] = [];
    for (const f of walk(join(WEB, "src"))) {
      if (!/\.(tsx?|css)$/.test(f) || f === THIS_FILE) continue;
      const text = readFileSync(f, "utf8");
      if (/\{614\}[\s\S]{0,40}\{587\}|\{758\}[\s\S]{0,40}\{167\}|\b758\s*\)\s*\/\s*167\b/.test(text)) {
        found.push(relative(ROOT, f));
      }
    }
    expect(found).toEqual([]);
  });

  it("the shipped SVGs are exactly the drawing in scripts/brand/logo-art.mjs", () => {
    const brand = join(WEB, "public", "brand");
    expect(readFileSync(join(brand, "vallo-mark.svg"), "utf8")).toBe(markSvg());
    expect(readFileSync(join(brand, "vallo-wordmark.svg"), "utf8")).toBe(wordmarkSvg());
    /* The native offline card draws the same mark from the binary. */
    expect(readFileSync(join(WEB, "native-shell", "vallo-mark.svg"), "utf8")).toBe(markSvg());
  });

  it("the new artwork has no baked ground and no baked glow", () => {
    for (const name of ["vallo-mark.svg", "vallo-wordmark.svg"]) {
      const svg = readFileSync(join(WEB, "public", "brand", name), "utf8");
      expect(svg, name).not.toMatch(/<rect\b/);
      expect(svg, name).not.toMatch(/<filter\b|feGaussianBlur/);
    }
  });
});

/*
 * ONE COLOUR SET (D82, the founder, 8 October 2026: "make the logo and the
 * text to be not change color should be same either on light mode or dark
 * mode"). The logo is the founder's own colours on every ground and in both
 * themes. These fail if a second palette, a recoloured copy, a per-theme swap
 * or a filter on the artwork comes back.
 */
describe("the logo never changes colour (D82)", () => {
  const brand = join(WEB, "public", "brand");
  /* Every colour the artwork may carry: the founder's set, and the white and
     black of its sheen and shade (used only at partial opacity). */
  // eslint-disable-next-line nf/no-raw-colour -- the sheen's white and the shade's black are part of the artwork, compared as data
  const SHEEN_AND_SHADE = ["#FFFFFF", "#000000"];
  const ALLOWED = new Set([...Object.values(COLOURS).filter((v): v is string => typeof v === "string"), ...SHEEN_AND_SHADE].map((c) => c.toUpperCase()));
  const coloursIn = (text: string) => [...text.matchAll(/(?:stop-color|fill|stroke)="(#[0-9A-Fa-f]{3,8})"/g)].map((m) => m[1]!.toUpperCase());

  it("every logo SVG on disk carries only the founder's colours", () => {
    const svgs = readdirSync(brand).filter((n) => /^vallo-.*\.svg$/.test(n));
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    for (const name of svgs) {
      const colours = coloursIn(readFileSync(join(brand, name), "utf8"));
      expect(colours.length, name).toBeGreaterThan(5);
      expect(colours.filter((c) => !ALLOWED.has(c)), name).toEqual([]);
    }
  });

  it("there is no second palette: every kept twin is byte-for-byte the one artwork", () => {
    for (const [twin, one] of [
      ["vallo-mark-light.svg", "vallo-mark.svg"],
      ["vallo-wordmark-light.svg", "vallo-wordmark.svg"],
      ["vallo-mark-light.png", "vallo-mark.png"],
      ["vallo-wordmark-light.png", "vallo-wordmark.png"],
    ] as const) {
      if (!existsSync(join(brand, twin))) continue;
      expect(readFileSync(join(brand, twin)).equals(readFileSync(join(brand, one))), twin).toBe(true);
    }
    for (const gone of ["vallo-mark-reverse.svg", "vallo-wordmark-reverse.svg"]) {
      expect(existsSync(join(brand, gone)), gone).toBe(false);
    }
  });

  it("the inline (animated) mark draws the same colours", () => {
    const colours = [
      ...MARK_GRADIENTS.flatMap((g) => g.stops.map((stop) => stop[1])),
      MARK_SIDE,
      MARK_ACCENT,
    ].map((c) => c.toUpperCase());
    expect(colours.filter((c) => !ALLOWED.has(c))).toEqual([]);
    expect(Array.isArray(MARK_GRADIENTS)).toBe(true);
  });

  it("no source picks a logo file, a palette or a class by theme", () => {
    const found: string[] = [];
    for (const f of walk(join(WEB, "src"))) {
      if (!/\.(tsx?|css)$/.test(f) || f === THIS_FILE) continue;
      const text = readFileSync(f, "utf8");
      if (/vallo-(mark|wordmark)-(light|reverse|day|night)\b/.test(text)) found.push(`${relative(ROOT, f)}: a theme twin of the logo`);
      if (/nf-logo-art--(night|day)/.test(text)) found.push(`${relative(ROOT, f)}: a per-theme logo class`);
    }
    expect(found).toEqual([]);
  });

  /* The logo's own selectors: the lockup, its art and the places that size it. */
  const LOGO = /\.nf-(logo|logo-art|logo__word|logo__text|vmark|slate-top__mark|slate-top__word|slate-focal__mark|doors__mark|passcode__mark|passcode__word|ai__word|ai__lockup|mcard__word|gs-lockup__mark|gs-lockup__word|system__icon|system__wordmark|wait__mark|assemble__mark)\b/;
  const RECOLOUR = /\b(filter|mix-blend-mode|-webkit-filter)\s*:\s*(?!none\b)|invert\(|hue-rotate\(|grayscale\(|saturate\(|brightness\(|sepia\(/;

  /** Every rule as [selector, body, enclosing at-rule preludes]. */
  function rules(css: string): Array<{ selector: string; body: string; at: string }> {
    const out: Array<{ selector: string; body: string; at: string }> = [];
    const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const stack: string[] = [];
    let buf = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (ch === "{") {
        stack.push(buf.trim());
        buf = "";
      } else if (ch === "}") {
        const prelude = stack.pop() ?? "";
        if (!prelude.startsWith("@") && buf.trim()) out.push({ selector: prelude, body: buf, at: stack.filter((x) => x.startsWith("@")).join(" ") });
        buf = "";
      } else if (ch === ";" && stack.length > 0 && !stack[stack.length - 1]!.startsWith("@")) {
        buf += ch;
      } else {
        buf += ch;
      }
    }
    return out;
  }

  /* The plates the mark stands on: each is the one white logo plate, never a
     themed surface, so the mark reads the same in both themes. */
  const PLATES = [".nf-cap__plate", ".nf-close__plate", ".nf-push-ask__mark", ".nf-pl-platinum__mark", ".nf-slate-top__plate"];

  it("every plate a mark stands on is the one logo plate, in both themes", () => {
    const found: string[] = [];
    const seen = new Set<string>();
    for (const f of walk(join(WEB, "src"))) {
      if (!f.endsWith(".css")) continue;
      for (const r of rules(readFileSync(f, "utf8"))) {
        for (const plate of PLATES) {
          if (!r.selector.split(",").some((sel) => sel.trim().endsWith(plate))) continue;
          const bg = r.body.match(/(?:^|;|\s)background(?:-color)?\s*:\s*([^;]+)/);
          if (!bg) continue;
          seen.add(plate);
          if (bg[1]!.trim() !== "var(--nf-logo-plate)") found.push(`${relative(ROOT, f)}: ${plate} stands on ${bg[1]!.trim()}`);
          if (/data-theme|prefers-color-scheme/.test(r.selector + " " + r.at)) found.push(`${relative(ROOT, f)}: ${plate} is styled per theme`);
        }
      }
    }
    expect(found).toEqual([]);
    expect([...seen].sort()).toEqual([...PLATES].sort());
  });

  it("no stylesheet recolours the logo, or styles it per theme", () => {
    const found: string[] = [];
    for (const f of walk(join(WEB, "src"))) {
      if (!f.endsWith(".css")) continue;
      for (const r of rules(readFileSync(f, "utf8"))) {
        if (!LOGO.test(r.selector)) continue;
        const where = `${relative(ROOT, f)}: ${r.selector.replace(/\s+/g, " ").slice(0, 120)}`;
        if (RECOLOUR.test(r.body)) found.push(`${where} recolours or filters the logo`);
        if (/data-theme|prefers-color-scheme/.test(r.selector + " " + r.at)) found.push(`${where} styles the logo per theme`);
      }
    }
    expect(found).toEqual([]);
  });
});

