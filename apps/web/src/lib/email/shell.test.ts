import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { BANNED_IN_EXAMPLE_COPY, firstBannedPhrase } from "@/lib/copy/banned-phrases";
import { COMPANY_LEGAL_NAME, COMPANY_RC_NUMBER } from "@/lib/legal/company";

import { EVERY_MESSAGE, coveredBuilders } from "./fixtures";
import * as theme from "./theme";
import { sortEmailImages } from "./images";
import { EMAIL_GLYPH_SIZE, EMAIL_OBJECT_SIZE } from "./icons";

/**
 * The email shell, checked as email rather than as code.
 *
 * `messages.test.ts` checks what each message SAYS. This file checks what every
 * message IS: a piece of HTML that has to survive Outlook's Word engine,
 * Gmail's rewriting, a phone at 360px and an inbox with images switched off,
 * and it checks the five Supabase auth templates by the same rules, because
 * those are the first email anybody ever gets and they used to be a different
 * design from everything after them.
 *
 * Every failure here has happened to a real email system:
 *
 *   a stylesheet link that the client stripped, leaving unstyled text;
 *   a flex container that Outlook rendered as one column of nothing;
 *   copy baked into an image, invisible in the half of inboxes that block them;
 *   an alt attribute repeating text that was already on the page;
 *   a hand-edited template that the generator then silently overwrote;
 *   a palette that drifted between two files nobody diffed.
 *
 * WHAT THIS CANNOT CHECK, and it is worth being blunt about it: no test here
 * proves an email looks right in Outlook 2016, or arrives at all. There is no
 * mail client and no sending key in this environment. What is provable is the
 * markup, the palette, the copy rules and the fact that the generated files
 * match their generator, and that is what is here.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");
const GENERATOR = join(REPO, "scripts", "build-auth-emails.mjs");
const TEMPLATE_DIR = join(REPO, "supabase", "templates");

const AUTH_TEMPLATES = [
  "confirmation.html",
  "email-change.html",
  "invite.html",
  "magic-link.html",
  "recovery.html",
] as const;

const authHtml = AUTH_TEMPLATES.map((name) => ({
  name,
  html: readFileSync(join(TEMPLATE_DIR, name), "utf8"),
  /** The plain-text twin, rendered from the same blocks. */
  text: readFileSync(join(TEMPLATE_DIR, name.replace(/\.html$/, ".txt")), "utf8"),
}));

/** Every rendered piece of HTML this product sends, from both generators. */
const EVERY_HTML: { name: string; html: string }[] = [
  ...EVERY_MESSAGE.map(({ name, message }) => ({ name: `message:${name}`, html: message.html })),
  ...authHtml.map(({ name, html }) => ({ name: `auth:${name}`, html })),
];

/** The catalogue alone: what `render.ts` and the welcome draw (W9's light layer). */
const CATALOGUE_HTML = EVERY_MESSAGE.map(({ name, message }) => ({ name: `message:${name}`, html: message.html }));

/** Written as escapes so this file does not contain what it forbids. */
const EM_DASH = "—";
const EN_DASH = "–";

/* ------------------------------------------------ the catalogue is covered */

describe("every message the product can send is rendered by a test", () => {
  it("has a fixture for every builder the catalogue exports", () => {
    const source = readFileSync(join(HERE, "messages.ts"), "utf8");
    const exported = (source.match(/^export function (\w+)/gm) ?? []).map((line) =>
      line.replace("export function ", ""),
    );
    const covered = coveredBuilders();
    const missing = exported.filter((name) => !covered.has(name));

    /*
     * A message with no fixture is a message no test renders, and the one that
     * ships broken is always the newest one. Adding an entry to
     * fixtures.ts is the whole fix.
     */
    expect(missing).toEqual([]);
    expect(exported.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------- email client safety */

describe("every rendered email survives a real mail client", () => {
  it.each(EVERY_HTML)("$name lays out with tables, not flex or grid", ({ html }) => {
    // Outlook on Windows renders through Word, which has no flexbox, no grid
    // and no positioning. A layout built on any of them collapses to a single
    // unstyled column there.
    expect(html).toContain('<table role="presentation"');
    expect(html).not.toMatch(/display\s*:\s*(flex|grid|inline-flex|inline-grid)/);
    expect(html).not.toMatch(/position\s*:\s*(absolute|fixed|sticky)/);
    expect(html).not.toMatch(/\bfloat\s*:/);
  });

  it.each(EVERY_HTML)("$name loads nothing from outside itself", ({ html }) => {
    // Gmail strips <link> and <script>, and a web font request that a client
    // does honour is a round trip somebody pays for on a metered connection.
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)/i);
    expect(html).toContain("-apple-system,BlinkMacSystemFont");
  });

  it.each(EVERY_HTML)("$name carries its styles inline", ({ html }) => {
    /*
     * Gmail strips <style> in some contexts, notably a forwarded message and
     * the Gmail app reading a non-Gmail account. The single <style> block this
     * shell has carries the dark override and nothing that layout or legibility
     * depends on, so the rest has to be inline. Counting is crude and it is
     * enough: it catches the refactor that moves the palette into a class.
     */
    const inline = (html.match(/style="/g) ?? []).length;
    const blocks = (html.match(/<style\b/g) ?? []).length;
    expect(inline).toBeGreaterThan(20);
    expect(blocks).toBe(1);
  });

  it.each(EVERY_HTML)("$name is at most 600px wide and fluid below that", ({ html }) => {
    expect(html).toContain(`max-width:${theme.MAX_WIDTH}px;width:100%;`);
    expect(theme.MAX_WIDTH).toBeLessThanOrEqual(600);
  });

  /*
   * D23 (6 October 2026) SUPERSEDES THE DARK-EVERYWHERE INLINE LAYER OF 29
   * SEPTEMBER, and these two tests were rewritten for it deliberately (W9):
   * "In light mode every email is a white background. No grey wash, no dark
   * card on light." The catalogue now declares both schemes, paints white in
   * the layer every client honours, and carries the product's dark scheme
   * for a reader whose mail is dark. The five auth templates are still the
   * old dark design until `scripts/build-auth-emails.mjs` is moved onto the
   * new palette (request R-24), so they keep the old assertions, by name,
   * rather than either being skipped or being failed for another owner's file.
   */
  it.each(CATALOGUE_HTML)("$name declares light and dark and re-asserts both palettes", ({ html }) => {
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain('name="supported-color-schemes" content="light dark"');
    expect(html).toContain("color-scheme: light dark;");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("@media (prefers-color-scheme: light)");
    // The dark scheme turns the shell to night and holds the sheet at paper.
    expect(html).toContain(`.rm-card { background-color: ${theme.DARK.card} !important; }`);
    expect(html).toContain(`.rm-sheet { background-color: ${theme.LIGHT.card} !important; }`);
  });

  it.each(CATALOGUE_HTML)("$name is white in light mode, in the layer every client honours", ({ html }) => {
    /*
     * The inline styles are the layer no client strips (Gmail strips the
     * style block), so they carry the light design: a white ground and a
     * white card with one hairline edge, as inline styles AND as bgcolor
     * attributes. No ground in the body is dark: the only filled colour
     * that is not white is the inset panel and the button's blue.
     */
    const afterStyle = html.slice(html.indexOf("</style>"));
    expect(afterStyle).toContain(`bgcolor="${theme.LIGHT.ground}"`);
    expect(afterStyle).toContain(`background-color:${theme.LIGHT.card};border:1px solid ${theme.LIGHT.edge};border-radius:20px;`);
    const grounds = [...afterStyle.matchAll(/bgcolor="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]!.toUpperCase());
    const allowed = new Set([theme.LIGHT.ground, theme.LIGHT.card, theme.LIGHT.panel, theme.BRAND].map((hex) => hex.toUpperCase()));
    expect(grounds.filter((hex) => !allowed.has(hex))).toEqual([]);
    // Every heading and body colour is inline beside the ground it sits on.
    expect(afterStyle).toContain(`color:${theme.LIGHT.text}`);
    expect(afterStyle).toContain(`color:${theme.LIGHT.body}`);
    // The wordmark's slogan, quiet beneath it, as live text (D1, 16.5).
    if (!afterStyle.includes("/brand/email/banners/")) expect(afterStyle).toContain(theme.SLOGAN);
    // The support and legal links are in every footer.
    expect(afterStyle).toMatch(/\/support"/);
    expect(afterStyle).toMatch(/\/legal\/privacy"/);
    expect(afterStyle).toMatch(/\/legal\/terms"/);
  });

  it.each(authHtml)("auth:$name still declares itself dark (until R-24 moves its generator)", ({ html }) => {
    expect(html).toContain('name="color-scheme" content="dark"');
    expect(html).toContain('name="supported-color-schemes" content="dark"');
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain(`.rm-card   { background-color: ${theme.DARK.card} !important;`);
    const afterStyle = html.slice(html.indexOf("</style>"));
    expect(afterStyle).toContain(`bgcolor="${theme.HEADER}"`);
    expect(afterStyle).toContain(`bgcolor="${theme.DARK.card}"`);
    expect(afterStyle).toMatch(/\/support"/);
  });

  it.each(EVERY_HTML)("$name sets a deliberate inbox line", ({ html }) => {
    // Asserted by position: what matters is that a client showing "the first
    // text in the message" shows a sentence somebody wrote rather than the
    // beginning of the layout.
    const body = html.slice(html.indexOf("<body"));
    const hidden = body.match(/<span style="display:none[^"]*">([^<]*)<\/span>/);
    expect(hidden).not.toBeNull();
    expect((hidden?.[1] ?? "").replace(/&#\d+;/g, "").trim().length).toBeGreaterThan(10);
  });
});

/* --------------------------------------------------------- images blocked */

describe("every rendered email reads completely with images blocked", () => {
  it.each(CATALOGUE_HTML)("$name carries the lockup, at most one sized object, its row glyphs, and nothing else in a picture", ({ html }) => {
    const images = sortEmailImages(html);
    /* The banner (`banners.ts`) stands in for the lockup band on a shell message. */
    expect(images.lockup !== null || images.banner.length >= 1).toBe(true);
    /*
     * The 3D object (`icons.ts`) names the message's family, so its alt
     * is that word: with images off a reader sees "Payment" or "Account" in
     * quiet type where it would be (north star 16.5, every image with alt).
     * The row glyphs sit beside a label that says the same thing, so they
     * are decorative and their alt is empty. Nothing else is a picture.
     */
    expect(images.object.length).toBeLessThanOrEqual(1);
    for (const object of images.object) {
      expect(object).toMatch(/alt="[A-Z][a-z]+"/);
      expect(object).toContain(`width="${EMAIL_OBJECT_SIZE}"`);
      expect(object).toContain(`height="${EMAIL_OBJECT_SIZE}"`);
    }
    for (const glyph of images.glyphs) {
      expect(glyph).toContain('alt=""');
      expect(glyph).toContain(`width="${EMAIL_GLYPH_SIZE}"`);
      expect(glyph).toContain(`height="${EMAIL_GLYPH_SIZE}"`);
    }
    expect(images.other).toEqual([]);

    /*
     * Explicit width and height so a blocked image reserves exactly its own box
     * rather than collapsing the lockup or, worse, expanding to a client's
     * default placeholder size and shoving the wordmark off the line.
     */
    for (const image of html.match(/<img\b[^>]*>/g) ?? []) {
      expect(image).toMatch(/\bwidth="\d+"/);
      expect(image).toMatch(/\bheight="\d+"/);
    }

    /*
     * The lockup IS the brand name, so its alt is the brand name and nothing
     * more: with images off a reader sees "Vallo" once, in its place.
     */
    if (images.lockup === null) {
      /* A banner message: the founder's picture carries the logo, with a real alt. */
      expect(images.banner.length).toBeGreaterThanOrEqual(1);
      expect(images.banner[0]).toMatch(/alt="[^"]{8,}"/);
      return;
    }
    const lockup = String(images.lockup);
    expect(lockup).toContain(theme.LOCKUP_PATH);
    expect(lockup).toContain(`alt="${theme.WORDMARK_ALT}"`);
    expect(lockup).toContain(`width="${theme.LOCKUP_WIDTH}"`);
    expect(lockup).toContain(`height="${theme.LOCKUP_HEIGHT}"`);
  });

  it.each(authHtml)("auth:$name carries the lockup and at most one sized 3D mark", ({ html }) => {
    /* The banner under the lockup is its own tier (`banners.ts`). */
    const images = (html.match(/<img\b[^>]*>/g) ?? []).filter((img) => !img.includes("/brand/email/banners/"));
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images.length).toBeLessThanOrEqual(2);
    const [lockup, mark] = images;
    if (mark) {
      expect(mark).toContain('alt=""');
      expect(mark).toContain("/brand/3d/email/");
    }
    expect(lockup).toContain(theme.LOCKUP_PATH);
    expect(lockup).toContain(`alt="${theme.WORDMARK_ALT}"`);
  });

  it.each(EVERY_HTML)("$name still shows the brand and the action as text", ({ name, html }) => {
    // Everything an <img> could have carried, removed. What is left has to be
    // the whole message.
    const blind = html.replace(/<img\b[^>]*>/g, "");
    const visible = blind
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<span style="display:none[\s\S]*?<\/span>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    expect(visible).toContain("Vallo");
    expect(visible).toContain(theme.SIGN_OFF);
    // A real message, not a stub: the shortest of these is the sign-in link.
    expect(visible.length).toBeGreaterThan(200);

    // Every link still reachable, so a stripped button is not a dead end.
    if (name.startsWith("auth:")) {
      expect(blind).toContain("If the button does not work");
    }
  });
});

/* ------------------------------------------------------------ the palette */

describe("one palette, and the auth generator has not drifted from it", () => {
  const generator = readFileSync(GENERATOR, "utf8");

  const THEME_COLOURS = [
    ...Object.values(theme.DARK),
    theme.GLOW,
    theme.ELECTRIC,
    theme.SKY,
    theme.BRAND,
  ];

  it.each(THEME_COLOURS)("the auth generator uses the theme value %s", (hex) => {
    /*
     * The generator is a plain Node script that runs outside the Next build
     * with no TypeScript loader, so it cannot import theme.ts and the values
     * are mirrored by hand. This is the check that makes that duplication safe
     * rather than merely tolerated: change a colour in theme.ts and this fails
     * until the generator is changed too.
     */
    expect(generator).toContain(hex);
  });

  it("declares no colour the theme has not sanctioned", () => {
    // Every hex the generator declares as a palette constant, as opposed to the
    // gradient stops that are composed from them.
    const declared = (generator.match(/^const [A-Z_]+ = "(#[0-9A-F]{6})";/gm) ?? []).map(
      (line) => (line.match(/#[0-9A-F]{6}/) ?? [""])[0],
    );
    const sanctioned = new Set(THEME_COLOURS.map((hex) => hex.toUpperCase()));
    expect(declared.filter((hex) => !sanctioned.has(hex.toUpperCase()))).toEqual([]);
    expect(declared.length).toBeGreaterThan(10);
  });

  /* ------------------------------------------------ the tokens, read live */

  /**
   * THE TEST THAT STOPS THE EMAIL PALETTE GOING STALE AGAIN.
   *
   * Every colour in an email is a BAKED HEX, because a mail client strips CSS
   * custom properties. So the design system's blue exists twice in this
   * repository: once in `tokens.css`, where it is maintained, and once in
   * `theme.ts`, where it is baked. Until today nothing sat between those two
   * copies, and the predictable thing happened: the accent ramp was rotated
   * onto a measured 215.2 degrees of hue on 19 September and the email
   * palette was not, so for three days every message this product sent was
   * drawn in a blue the product had retired, and no test in the suite could
   * see it. `shell.test.ts` asserted the GENERATOR matched `theme.ts`, which
   * held those two in step while both were wrong together.
   *
   * A duplicated fact with no test between the copies is a fact that WILL be
   * half updated. This is that test. It reads the token file as text, the way
   * the RC number assertion below reads `company.ts`, and it is deliberately
   * the boring kind: exact string equality on three values.
   */
  describe("the baked email blue still equals the live design token", () => {
    const tokens = readFileSync(
      join(REPO, "packages", "design-tokens", "src", "tokens.css"),
      "utf8",
    );

    /**
     * The FIRST declaration of a token wins, which is the dark default.
     * `tokens.css` redefines several of these lower down inside the light
     * theme block; `lightToken` below reads that block for the light layer.
     */
    function token(name: string): string {
      const found = tokens.match(new RegExp(`^\\s*${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`, "m"));
      const hex = found?.[1];
      expect(hex, `${name} is not declared as a literal hex in tokens.css`).toBeTruthy();
      return String(hex).toUpperCase();
    }

    it.each([
      ["GLOW", theme.GLOW, "--nf-electric-400"],
      ["ELECTRIC", theme.ELECTRIC, "--nf-electric-600"],
      ["SKY", theme.SKY, "--nf-brand-quiet"],
    ])("%s is %s, which is the live value of %s", (_name, baked, tokenName) => {
      expect(baked.toUpperCase()).toBe(token(tokenName));
    });

    /** A token's value inside the `:root[data-theme="light"]` block. */
    function lightToken(name: string): string {
      /* The light block may also name a light island inside the dark header
         (`:root[data-theme="light"] [data-theme="light"]`), so it opens with
         either its own selector or that pair. */
      const start = [
        ':root[data-theme="light"] {',
        ':root[data-theme="light"],\n:root[data-theme="light"] [data-theme="light"] {',
        /* Since the clean unified sweep the list goes on to the header and
           workspace bar on paper (spec section 16, Q1). */
        ':root[data-theme="light"],\n:root[data-theme="light"] [data-theme="light"],\n',
      ]
        .map((marker) => tokens.indexOf(marker))
        .filter((at) => at >= 0)
        .reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
      expect(start).toBeGreaterThan(0);
      const block = tokens.slice(start, tokens.indexOf("\n}", start));
      const hex = block.match(new RegExp(`^\\s*${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`, "m"))?.[1];
      expect(hex, `${name} is not declared as a literal hex in the light block`).toBeTruthy();
      return String(hex).toUpperCase();
    }

    it.each([
      ["DARK.ground", theme.DARK.ground, "--nf-ink-950"],
      ["DARK.card", theme.DARK.card, "--nf-ink-850"],
      ["DARK.panel", theme.DARK.panel, "--nf-ink-800"],
      ["DARK.text", theme.DARK.text, "--nf-mist-100"],
      ["DARK.body", theme.DARK.body, "--nf-mist-300"],
      ["DARK.muted", theme.DARK.muted, "--nf-mist-500"],
    ])("%s is %s, which is the dark theme's %s", (_name, baked, tokenName) => {
      expect(baked.toUpperCase()).toBe(token(tokenName));
    });

    it("paints the button in the product's primary blue, as the light block declares it solid", () => {
      expect(theme.BRAND.toUpperCase()).toBe(lightToken("--nf-brand-primary"));
    });

    /**
     * AND THE ONES THAT HAVE NO TOKEN OF THEIR OWN.
     *
     * The card rim, the hairline and the middle stop of the button gradient
     * are email-only values: there is no `--nf-` custom property to compare
     * them against, so the check above cannot reach them, and they are
     * exactly the values that were left behind last time. What CAN be checked
     * is the thing that went wrong, which was never the lightness. It was the
     * HUE: the whole family was thirteen degrees towards violet, and rule 8
     * forbids violet outright.
     *
     * So every blue this system paints is asserted onto the family angle, the
     * one measured off `--nf-electric-400`. The tolerance is a degree and a
     * half because eight bits per channel cannot land exactly on an arbitrary
     * angle at every lightness: the hairline is the worst case at 214.8, and
     * half a degree on a one pixel rule is not a thing anybody can see.
     */
    it("paints no blue off the family hue, including the ones with no token", () => {
      const rgb = (hex: string): [number, number, number] => [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
      ];

      /** Hue in degrees, or null for a grey, which has no hue to check. */
      function hue(hex: string): number | null {
        const [r, g, b] = rgb(hex);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        if (delta === 0) return null;
        let h: number;
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h *= 60;
        return h < 0 ? h + 360 : h;
      }

      const family = hue(token("--nf-electric-400"));
      expect(family).not.toBeNull();

      /*
       * The near-black ink rungs are excluded by the saturation-free test
       * above and by being navy rather than blue: #010118, #000030 and
       * #000040 are one or two bits off black, where hue is arithmetic noise
       * rather than a colour anybody chose. Everything with a rim's worth of
       * chroma is in.
       */
      const blues = [
        ["GLOW", theme.GLOW],
        ["ELECTRIC", theme.ELECTRIC],
        ["SKY", theme.SKY],
        ["rim", theme.DARK.rim],
        ["edge", theme.DARK.edge],
        ["BRAND", theme.BRAND],
        ...(theme.BUTTON_GRADIENT.match(/#[0-9A-Fa-f]{6}/g) ?? []).map(
          (hex, i) => [`BUTTON_GRADIENT stop ${i}`, hex] as const,
        ),
        // The gradient middle stop, dug out of the composed string.
        ...(theme.GRADIENT.match(/#[0-9A-Fa-f]{6}/g) ?? []).map(
          (hex, i) => [`GRADIENT stop ${i}`, hex] as const,
        ),
        ...(theme.GRADIENT_CAP.match(/#[0-9A-Fa-f]{6}/g) ?? []).map(
          (hex, i) => [`GRADIENT_CAP stop ${i}`, hex] as const,
        ),
      ] as const;

      for (const [name, hex] of blues) {
        const angle = hue(hex);
        expect(angle, `${name} ${hex} has no hue`).not.toBeNull();
        expect(
          Math.abs((angle as number) - (family as number)),
          `${name} ${hex} sits at ${(angle as number).toFixed(1)} degrees, and the family is at ${(family as number).toFixed(1)}. Rotate it rather than picking a new colour.`,
        ).toBeLessThan(1.5);
      }
    });
  });

  /*
   * THE PAPER PALETTE IS THE DOCUMENT TOKENS, RESOLVED (W9, D23). The light
   * inline layer is baked hex for the same reason the dark one is, so it gets
   * the same guard: each value is the live `--nf-doc-*` token, and the two
   * inks that are alphas of the document ink are that alpha over white.
   */
  describe("the paper palette still equals the live document tokens", () => {
    const tokens = readFileSync(join(REPO, "packages", "design-tokens", "src", "tokens.css"), "utf8");
    const literal = (name: string) =>
      String(tokens.match(new RegExp(`^\\s*${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`, "m"))?.[1]).toUpperCase();
    const overWhite = (name: string) => {
      const m = tokens.match(new RegExp(`^\\s*${name}:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+)\\)\\s*;`, "m"));
      expect(m, `${name} is not an rgb alpha in tokens.css`).toBeTruthy();
      const [r, g, b, a] = [Number(m![1]), Number(m![2]), Number(m![3]), Number(m![4])];
      return "#" + [r, g, b].map((c) => Math.round(255 * (1 - a) + c * a).toString(16).padStart(2, "0")).join("").toUpperCase();
    };
    it.each([
      ["LIGHT.ground", theme.LIGHT.ground, "--nf-doc-bg"],
      ["LIGHT.card", theme.LIGHT.card, "--nf-doc-bg"],
      ["LIGHT.panel", theme.LIGHT.panel, "--nf-doc-bg-inset"],
      ["LIGHT.text", theme.LIGHT.text, "--nf-doc-ink"],
      ["LINK", theme.LINK, "--nf-doc-accent"],
      ["PAPER_STATE.success", theme.PAPER_STATE.success, "--nf-doc-success"],
      ["PAPER_STATE.attention", theme.PAPER_STATE.attention, "--nf-doc-attention"],
      ["PAPER_STATE.error", theme.PAPER_STATE.error, "--nf-doc-error"],
    ])("%s is %s, which is %s", (_name, baked, token) => {
      expect(baked.toUpperCase()).toBe(literal(token));
    });
    it.each([
      ["LIGHT.body", theme.LIGHT.body, "--nf-doc-ink-muted"],
      ["LIGHT.muted", theme.LIGHT.muted, "--nf-doc-ink-faint"],
    ])("%s is %s, which is %s over white", (_name, baked, token) => {
      expect(baked.toUpperCase()).toBe(overWhite(token));
    });
    it("carries the slogan the locale files carry", () => {
      const en = readFileSync(join(REPO, "packages", "i18n", "src", "locales", "en.ts"), "utf8");
      expect(en).toContain(`slogan: "${theme.SLOGAN}"`);
    });
  });

  it("carries the slogan and the legal line the theme carries, in both generators", () => {
    /*
     * Rule 14: the brand is Vallo, and the company name appears only on legal
     * surfaces. The foot of an email is one, so the legal line is allowed
     * there and nowhere else in the message. It is mirrored by hand in the
     * generator for the same dependency-free reason as the palette, and this
     * is the check that keeps the three copies (company.ts, theme.ts, the
     * script) one fact.
     */
    expect(theme.LEGAL_LINE.startsWith(COMPANY_LEGAL_NAME)).toBe(true);
    /*
     * AND THE RC NUMBER, ONCE THERE IS ONE.
     *
     * This string exists in THREE places for a dependency-free reason that is
     * good: `company.ts` is the fact, `theme.ts` mirrors it so the renderer
     * needs no import, and the auth generator mirrors it again so it can run
     * with nothing installed. Three copies of a fact with no test between them
     * is a fact that WILL be half updated, and this is the half that would be
     * missed: the company was incorporated on 18 September, the RC reached the
     * two legal documents through COMPANY_FORMAL_NAME automatically, and the
     * email footer would have gone on saying nothing about it for ever,
     * because nothing connected them.
     *
     * Conditional on purpose. Before the certificate existed, null was the
     * correct value and a test demanding a number would have been a test
     * demanding a lie.
     */
    if (COMPANY_RC_NUMBER) {
      expect(theme.LEGAL_LINE).toContain(`RC ${COMPANY_RC_NUMBER}`);
    }
    expect(generator).toContain(`const LEGAL_LINE = "${theme.LEGAL_LINE}"`);
    expect(generator).toContain(`const SIGN_OFF = "${theme.SIGN_OFF}"`);
    for (const { name, html } of EVERY_HTML) {
      expect(html, name).toContain(theme.LEGAL_LINE);
      // The company is the footer's line and no other: a heading or a button
      // that said VALLO SPACES LTD would be the legal name used as a brand.
      expect(html.split(theme.LEGAL_LINE).length, name).toBe(2);
      expect(html.replace(theme.LEGAL_LINE, ""), name).not.toContain(COMPANY_LEGAL_NAME);
    }
  });

  it("keeps raw hex out of the shell and in the theme", () => {
    /*
     * theme.ts is the ONE place a literal colour is correct, because a mail
     * client strips CSS custom properties and a var() that resolves to nothing
     * paints text the colour of its background. render.ts must therefore carry
     * no colour of its own, or the token resolution has two homes again.
     *
     * #FFFFFF is the exception and it is deliberate: it is the text ON brand
     * blue in both schemes, so it is not a themed value and must not flip.
     */
    const render = readFileSync(join(HERE, "render.ts"), "utf8");
    const literals = (render.match(/#[0-9A-Fa-f]{6}/g) ?? []).filter(
      (hex) => hex.toUpperCase() !== "#FFFFFF",
    );
    expect(literals).toEqual([]);
  });

  it("never names a colour outside the brand family", () => {
    // Deep navy-black, dark neon blue, electric blue glow. A warm or purple
    // accent reads as a different product.
    for (const { name, html } of EVERY_HTML) {
      expect(html, name).not.toMatch(/\b(purple|violet|magenta|indigo|fuchsia|cyan|orange)\b/i);
      expect(html, name).not.toMatch(/#(7C3AED|8B5CF6|A855F7|6D28D9|9333EA|C026D3|A78BFA)/i);
    }
  });
});

/* ------------------------------------------------------- the code is the hero */

/**
 * THE VERIFICATION CODE EMAIL, CHECKED AS THE ONE THING IT IS FOR.
 *
 * This message has a single job: put six digits in front of somebody who is
 * staring at a form in another tab. Every rule below has cost a real email
 * system a support queue, and none of them is visible in a screenshot, which
 * is why they are asserted rather than eyeballed.
 *
 * The no-button rule and the code-in-the-subject rule are checked in
 * messages.test.ts, which is where what a message SAYS is checked. What is
 * here is what the code IS: live, selectable, countable text.
 */
describe("the verification code is the hero of its own email", () => {
  const CODE = "482 913";
  const codeEmail = EVERY_MESSAGE.find((m) => m.name === "verificationCode");

  it("has a fixture at all", () => {
    expect(codeEmail, "verificationCode has no fixture to check").toBeTruthy();
  });

  /** The one table cell that carries the digits. */
  function codeCell(html: string): string {
    const cell = html
      .split(/<t[dh]\b/)
      .find((chunk) => chunk.includes(CODE) && chunk.includes("letter-spacing"));
    expect(cell, "no cell in this message carries the code with tracking").toBeTruthy();
    return String(cell);
  }

  it("is live text, so it survives an inbox with images switched off", () => {
    /*
     * A code baked into an image is a code nobody can copy, nobody can hear
     * read aloud, and nobody sees at all in the large share of inboxes that
     * block images by default. This is the single most important images-off
     * rule in the system, so it is checked by deleting every image in the
     * message and looking for the digits in what is left.
     */
    const html = String(codeEmail?.message.html);
    const withoutImages = html.replace(/<img\b[^>]*>/g, "");
    expect(withoutImages).toContain(CODE);

    // And not smuggled back in through an alt attribute or a background.
    const images = html.match(/<img\b[^>]*>/g) ?? [];
    for (const img of images) expect(img).not.toContain(CODE);
    expect(html).not.toMatch(new RegExp(`background-image:[^;"]*${CODE}`));
  });

  it("is selectable, because a person has to be able to copy it", () => {
    /*
     * There is no reliable copy button in email, so the digits themselves are
     * the affordance. A table cell of live text selects in every client that
     * lets you select anything, but `user-select: none` anywhere near it, or
     * the digits split across elements for a per-character effect, would take
     * that away silently.
     */
    const html = String(codeEmail?.message.html);
    expect(html).not.toMatch(/user-select\s*:\s*none/i);
    // The digits are one contiguous run, not one element per character.
    expect(codeCell(html).split(CODE).length).toBe(2);
  });

  it("is monospaced and tracked, so a zero cannot be read as an O", () => {
    const cell = codeCell(String(codeEmail?.message.html));
    expect(cell).toContain(theme.FONT_MONO);

    const size = Number((cell.match(/font-size:(\d+)px/) ?? [])[1]);
    // 26px by the spec. The floor is what matters: this is the largest thing
    // in the message and it is read off a phone at arm's length.
    expect(size).toBeGreaterThanOrEqual(24);

    const tracking = Number((cell.match(/letter-spacing:([\d.]+)em/) ?? [])[1]);
    expect(tracking).toBeGreaterThanOrEqual(0.15);

    /*
     * AND THE INDENT THAT MATCHES THE TRACKING. Letter-spacing adds its gap
     * after the LAST glyph too, which shifts an apparently centred string to
     * the right by exactly that much. Putting the same amount back on the
     * left recentres it. It is the kind of thing a reader notices without
     * being able to say why, and the kind a refactor drops without noticing.
     */
    const indent = Number((cell.match(/text-indent:([\d.]+)em/) ?? [])[1]);
    expect(indent).toBe(tracking);
  });

  it("is the strongest ink on the inset panel, and the dark scheme repaints both", () => {
    // Ground, card, panel: the code sits on the inset panel, in the heading
    // colour, and carries the classes the dark scheme repaints it by.
    const cell = codeCell(String(codeEmail?.message.html));
    expect(cell).toContain(`background-color:${theme.LIGHT.panel}`);
    expect(cell).toContain(`color:${theme.LIGHT.text}`);
    expect(cell).toMatch(/class="[^"]*rm-panel[^"]*rm-title/);
  });

  it("stands alone on its own line in the plain text part", () => {
    // A screen reader and a text-only client get the same hero: the digits,
    // by themselves, not buried mid-sentence.
    const lines = String(codeEmail?.message.text).split("\n");
    expect(lines).toContain(CODE);
  });
});

/* ------------------------------------------------- the reset is not a dead end */

/**
 * THE PASSWORD RESET, WHICH IS THE ONE MESSAGE WHOSE BUTTON IS THE MESSAGE.
 *
 * The link is the one-tap way through: `resetPasswordForEmail` sends to the
 * callback, and `updatePassword` acts on the session that exchange creates.
 * The code beside it (when the hook has one) is the fallback, but a reader
 * who only sees the button still needs the address, and anchors do not
 * always survive: corporate gateways
 * rewrite them, some clients refuse a link in a message they score as
 * suspicious, and a reader forwarding to a desktop loses the tap.
 *
 * The defence is that the destination is also printed as selectable text.
 */
describe("the password reset always leaves a way through", () => {
  const reset = EVERY_MESSAGE.find((m) => m.name === "passwordReset");
  const RESET_URL = "https://vallospaces.com/auth/reset?token=abc";

  it("has a fixture at all", () => {
    expect(reset, "passwordReset has no fixture to check").toBeTruthy();
  });

  it("prints the destination as text, not only as a link target", () => {
    const html = String(reset?.message.html);
    expect(html).toContain("If the button does not work");

    /*
     * The real check: strip every anchor and every image, the two things a
     * client can take away, and the address must still be readable in what
     * is left. An href is not enough on its own, because an href is exactly
     * what gets rewritten.
     */
    const stripped = html
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "")
      .replace(/<img\b[^>]*>/g, "");
    expect(stripped).toContain(RESET_URL);
  });

  it("does not print the address twice in the plain text part", () => {
    /*
     * In text the button already renders as "Label:" then the URL on its own
     * line, so the HTML fallback must NOT be repeated there. A reader looking
     * at two identical long URLs cannot tell whether they differ, and a URL
     * is the one thing in this message they have to trust.
     */
    const text = String(reset?.message.text);
    expect(text.split(RESET_URL).length - 1).toBe(1);
    expect(text).not.toContain("If the button does not work");
  });

  it("is a different shape from the code email, on purpose", () => {
    // The code email teaches "Vallo never sends a button to press for a
    // code". That lesson only works if this message, which is a different
    // act, looks like a different act.
    const codeEmail = EVERY_MESSAGE.find((m) => m.name === "verificationCode");
    expect(String(codeEmail?.message.html)).not.toContain("<a href");
    // The reset has one bold text link to press (no button); the code email has none.
    expect(String(reset?.message.html)).toMatch(/font-weight:700[^"]*"><a class="rm-link" href=/);
  });
});

/* --------------------------------------------------- the two security notices */

/**
 * THE TWO MESSAGES WHOSE ABSENCE IS ONLY NOTICED AFTER AN ACCOUNT IS TAKEN.
 *
 * "Your password was changed" and "A new sign-in to your Vallo account" did
 * not exist here in any form. They are the pair a security reviewer asks about
 * first, and the pair that turns a silent takeover into a loud one: somebody
 * who phishes a password changes it at once, and if nothing leaves the
 * building at that moment the real owner finds out when they next try to sign
 * in, which can be weeks.
 */
describe("a security notice is always sent and never invents a fact", () => {
  const SECURITY = ["passwordChanged", "newDeviceSignIn:bare", "newDeviceSignIn:detailed"];
  const notices = EVERY_MESSAGE.filter((m) => SECURITY.includes(m.name));

  it("both of them exist", () => {
    expect(notices.map((m) => m.name).sort()).toEqual([...SECURITY].sort());
  });

  /** The text part wraps at 72 characters, so a phrase is asserted unwrapped. */
  const unwrapped = (value: string) => value.replace(/\s+/g, " ");

  it.each(SECURITY)("%s says plainly that it cannot be switched off", (name) => {
    /*
     * `emailMuted` exists so the settings card's promise is checkable, and
     * these two must never be given a channel. A person who switched Vallo's
     * email off switched off news about their bookings, not the only signal
     * that somebody else is inside the account holding their payment history.
     * The footer says so, so that nobody wiring a call site later has to guess
     * and nobody receiving one wonders why it arrived.
     */
    const found = EVERY_MESSAGE.find((m) => m.name === name);
    expect(unwrapped(String(found?.message.text))).toContain("cannot be switched off");
  });

  it.each(SECURITY)("%s prints no IP address", (name) => {
    /*
     * A city and a parsed device name tell a reader what they need in order to
     * recognise themselves. A raw address tells them nothing they can act on,
     * is personal data sitting in an unencrypted mailbox, and is exactly the
     * sort of thing that gets pasted into a support thread. Rule 16 is about
     * never logging or pasting a personal datum, and this is the email-shaped
     * version of it.
     */
    const found = EVERY_MESSAGE.find((m) => m.name === name);
    const body = String(found?.message.text);
    expect(body).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    // And no IPv6 either, which a naive dotted-quad check walks straight past.
    expect(body).not.toMatch(/\b(?:[0-9a-f]{1,4}:){3,}[0-9a-f]{1,4}\b/i);
  });

  it("drops the facts panel entirely when there are no facts", () => {
    /*
     * The sign-in notice takes four optional details, and a user agent parse
     * can fail. A panel of labels with nothing beside them reads as a bug, and
     * on a security email it reads worse than that: as though the answer to
     * "where from" were blank rather than unknown. Rule 15 says a fact the
     * database cannot produce is not printed, and an empty row is a printed
     * absence.
     */
    const bare = EVERY_MESSAGE.find((m) => m.name === "newDeviceSignIn:bare");
    const full = EVERY_MESSAGE.find((m) => m.name === "newDeviceSignIn:detailed");

    for (const label of ["When", "Device", "Near"]) {
      expect(String(bare?.message.text)).not.toContain(`${label}:`);
      expect(String(full?.message.text)).toContain(`${label}:`);
    }
    expect(String(bare?.message.html).length).toBeLessThan(
      String(full?.message.html).length,
    );
  });

  it.each(SECURITY)("%s leaves a way to act that does not need the account", (name) => {
    /*
     * A reader who did not make the change cannot sign in to go looking for
     * the reset screen, so the address is printed as well as linked, the same
     * rule the reset email follows and for the same reason.
     */
    const found = EVERY_MESSAGE.find((m) => m.name === name);
    const stripped = String(found?.message.html)
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "")
      .replace(/<img\b[^>]*>/g, "");
    expect(stripped).toMatch(/https:\/\/[^\s<]+/);
  });

  it.each(SECURITY)("%s never asks the reader for a secret", (name) => {
    // The message that warns about a takeover is the message a phishing copy
    // imitates, so it says what we will never ask for, and asks for nothing.
    const found = EVERY_MESSAGE.find((m) => m.name === name);
    const body = unwrapped(String(found?.message.text));
    expect(body).toMatch(/Vallo will never ask you for your password/);
    expect(body).not.toMatch(/\b(reply with|send us|enter your password below)\b/i);
  });
});

/* --------------------------------------------------------------- the copy */

describe("the copy rules hold in the markup that ships", () => {
  it.each(EVERY_HTML)("$name contains no em dash or en dash", ({ html }) => {
    expect(html).not.toContain(EM_DASH);
    expect(html).not.toContain(EN_DASH);
  });

  it.each(EVERY_HTML)("$name contains no emoji", ({ html }) => {
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html)).toBe(false);
  });

  it.each(EVERY_HTML)("$name uses the agreed word, never the banned ones", ({ html }) => {
    // "demo", "sample", "preview" and "not live" are banned by spec. "example"
    // is the agreed word. This runs against the shipped markup including its
    // comments, because a comment ships too.
    expect(firstBannedPhrase(html, BANNED_IN_EXAMPLE_COPY)).toBeNull();
  });

  it.each(EVERY_HTML)("$name makes no legal or financial promise", ({ html }) => {
    /*
     * Escrow is CBN-regulated and legal review is pending. Nothing this product
     * sends may say money is guaranteed, insured or protected, and nothing may
     * describe a listing as checked or vetted, because verification here is a
     * ladder most listers have not climbed and an email cannot be corrected
     * once it has landed.
     */
    /* "Vallo Guarantee" is a product name (Track A, 25 September 2026): a
       capped, reviewed claim on a separate reserve, never a promise that money
       is guaranteed. The name is allowed; any other use of the word is not. */
    const unnamed = html.replace(/Vallo Guarantee/g, "");
    expect(unnamed).not.toMatch(/\b(guarantee[ds]?|insured|money[- ]back|refund guarantee)\b/i);
    expect(html).not.toMatch(/\byour money is (safe|protected|guaranteed)\b/i);
    expect(html).not.toMatch(/\b(vetted|100%|fully verified|verified listing)\b/i);
  });

  it.each(EVERY_HTML)("$name offers no sign-in method this platform does not have", ({ html }) => {
    // There is no Google or Apple sign in on this platform. The only match
    // allowed is the -apple-system font stack, which every email needs.
    expect(html).not.toMatch(/\bsign in with (google|apple)\b/i);
    expect(html).not.toMatch(/\bgoogle\b/i);
    expect(html.replace(/-apple-system/g, "")).not.toMatch(/\bapple\b/i);
  });

  it.each(EVERY_HTML)("$name advertises no inventory this platform lacks", ({ html }) => {
    /*
     * NARROWED ON 19 SEPTEMBER, AND WHY, BECAUSE LOOSENING A GUARD NEEDS A
     * REASON WRITTEN DOWN.
     *
     * This assertion used to ban the bare words `restaurant` and `hotel`, on
     * the stated premise that "the restaurant and hotel reservation loops
     * exist in the schema and hold zero rows". That premise was checked
     * against the live database and it is false: `accommodations` holds 5
     * published rows and `room_types` 11, `restaurant_profiles` holds 2, and
     * `businesses` 7. The catalogue is example stock, every row flagged
     * `is_demo` -- but so are all 64 rows of `listings`, and this same email
     * has always been free to say Vallo is for renting and buying. Banning one
     * side's nouns while the other side's ran unchallenged was not a content
     * truth rule, it was an accident of which half got written first.
     *
     * What the founder's content truth sweep actually forbids is a CLAIM: a
     * count nobody can stand behind, or an assertion that a specific thing is
     * bookable right now. Naming what the product is for is not a claim.
     * "Vallo Stays is hotels, apartments, guest houses, resorts and restaurant
     * tables" is a true sentence about a built product, and leaving it out of
     * the first email anybody receives is what made a reader invited to book a
     * room read a footer that did not know their half of the platform existed.
     *
     * So the ban is now on the harm rather than on the nouns.
     */

    /*
     * Money is struck out before the count rule runs, and `stays` is not in
     * the noun list. Both are deliberate. "₦25,000 stays in your Vallo wallet"
     * is a true sentence in the withdrawal-failed email, and a naive count
     * rule reads it as "25,000 stays", an inventory boast. A real figure
     * followed by a verb is not a claim about stock, so the amounts come out
     * first and the verb-shaped noun stays out of the list.
     */
    const withoutMoney = html.replace(/₦[\d,]+(\.\d+)?/g, "");

    // 1. No quantity. An invented or unstandable count is the classic inbox
    //    lie, and an inbox has no corrective once it has landed.
    expect(withoutMoney).not.toMatch(
      /\b(thousands|hundreds|millions|dozens|countless|\d[\d,]*\+?)\s+(of\s+)?(listings?|homes?|propert(y|ies)|hotels?|restaurants?|rooms?|tables?|agents?|members?|users?)\b/i,
    );

    // 2. No availability promise. "Book a table tonight" asserts stock this
    //    product cannot vouch for in any particular city on any particular day.
    expect(html).not.toMatch(
      /\b(book|reserve|find|get)\s+(a\s+|your\s+)?(table|room|hotel|stay|apartment|shortlet)\b[^.<]{0,40}\b(tonight|today|now|instantly|in minutes|right away)\b/i,
    );

    // 3. No superlative inventory framing.
    expect(html).not.toMatch(
      /\b(every|all the|the best|widest|largest|biggest)\s+(hotels?|restaurants?|propert(y|ies)|listings?|homes?)\s+in\b/i,
    );

    // 4. Experiences stay banned outright. Unlike stays and tables there is no
    //    experiences product here at all: no table, no route, no screen.
    expect(html).not.toMatch(/\bexperiences?\b/i);
  });
});

/* ------------------------------------------- the generated files are current */

describe("the five auth templates are what the generator produces", () => {
  it("regenerates byte for byte", () => {
    /*
     * These files are committed output, and committed output rots: somebody
     * fixes a typo in the HTML, the next person runs the generator, and the fix
     * disappears with no diff to explain it. Running the generator into a
     * temporary directory and comparing is the only check that catches a hand
     * edit before it is silently overwritten.
     */
    const out = mkdtempSync(join(tmpdir(), "vallo-auth-"));
    execFileSync(process.execPath, [GENERATOR], {
      env: { ...process.env, VALLO_AUTH_EMAIL_OUT_DIR: out },
      stdio: "pipe",
    });

    for (const html of AUTH_TEMPLATES) {
      for (const name of [html, html.replace(/\.html$/, ".txt")]) {
        const committed = readFileSync(join(TEMPLATE_DIR, name), "utf8");
        const fresh = readFileSync(join(out, name), "utf8");
        expect(fresh, `${name} was hand edited, or the generator has moved on`).toBe(committed);
      }
    }
  });

  it("emits exactly the five templates Supabase asks for, each with a text twin", () => {
    const found = readdirSync(TEMPLATE_DIR)
      .filter((name) => name.endsWith(".html"))
      .sort();
    expect(found).toEqual([...AUTH_TEMPLATES].sort());
    const twins = readdirSync(TEMPLATE_DIR)
      .filter((name) => name.endsWith(".txt"))
      .sort();
    expect(twins).toEqual([...AUTH_TEMPLATES].map((name) => name.replace(/\.html$/, ".txt")).sort());
  });

  it.each(authHtml)("$name has a plain-text twin that says the same thing", ({ html, text }) => {
    /*
     * Rendered from the same block list as the HTML, so the two cannot drift.
     * Not markup: a text part that is really HTML is worse than none, because
     * a text-only client then shows tags. And the same way through: the
     * button's link and the code are both there to type.
     */
    expect(text.trim().length).toBeGreaterThan(100);
    expect(text).not.toMatch(/<[a-z!][^>]*>/i);
    expect(text).toContain("{{ .ConfirmationURL }}");
    expect(text).toContain("{{ .SiteURL }}");
    expect(text).toContain(theme.SIGN_OFF);
    expect(text).toContain(theme.LEGAL_LINE);
    if (html.includes("{{ .Token }}")) expect(text).toContain("{{ .Token }}");
    // The heading is the first line after the masthead in both renderings.
    const heading = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] ?? "";
    expect(heading.length).toBeGreaterThan(0);
    expect(text).toContain(heading);
  });

  it.each(authHtml)("$name carries the lockup and the blue CTA", ({ html }) => {
    /*
     * The register, per template: the mark and the wordmark hosted from the
     * site Supabase is configured with, and one button in the brand blue with
     * white text on it. The button is the message's one action; the fallback
     * link below it is the same action in a form no client can strip.
     * (Track H: the cell now also carries its `bgcolor` after the style, which
     * the pattern allows; the colour it checks is unchanged.)
     */
    expect(html).toContain(`{{ .SiteURL }}${theme.LOCKUP_PATH}`);
    expect(html).toContain(`alt="${theme.WORDMARK_ALT}"`);
    const button = html.match(
      /<td align="center" style="border-radius:14px;background-color:(#[0-9A-F]{6});[^"]*mso-padding-alt:16px 34px;"[^>]*>\s*<a href="\{\{ \.ConfirmationURL \}\}"[^>]*color:#FFFFFF;[^>]*>([^<]+)<\/a>/,
    );
    expect(button).not.toBeNull();
    expect(button?.[1]).toBe(theme.BRAND);
    expect((button?.[2] ?? "").trim().length).toBeGreaterThan(0);
  });

  it.each(authHtml)("$name keeps every Supabase placeholder it needs", ({ name, html }) => {
    // A template that lost its placeholder renders a button linking to the
    // literal text "{{ .ConfirmationURL }}", which is a dead sign-in email.
    expect(html).toContain("{{ .ConfirmationURL }}");
    expect(html).toContain("{{ .SiteURL }}");
    expect(html).toContain("{{ .Email }}");
    if (name === "email-change.html") expect(html).toContain("{{ .NewEmail }}");
    if (name === "confirmation.html" || name === "magic-link.html" || name === "recovery.html") {
      // The code is the route through for a reader who will not press a link in
      // an email, which is a reasonable thing to be.
      expect(html).toContain("{{ .Token }}");
    }
  });

  it.each(authHtml)("$name offers one primary action", ({ html }) => {
    /*
     * One clear action per email. The fallback link is the same action in a
     * form a client cannot strip, not a second one, so it is counted separately
     * by looking for the styled button cell rather than for anchors.
     */
    const buttons = (html.match(/mso-padding-alt:16px 34px;/g) ?? []).length;
    expect(buttons).toBe(1);
  });

  it.each(authHtml)("$name says plainly that doing nothing is safe", ({ html }) => {
    /*
     * The single most useful sentence in an auth email, and the one that
     * separates it from the phishing message imitating it: a real one tells you
     * what happens if you ignore it, and never threatens you with a
     * consequence for doing so.
     */
    expect(html).toMatch(/ignore this message|there is nothing to do|do not open the link/i);
    expect(html).not.toMatch(/\b(urgent|immediately|suspended|will be deleted|act now)\b/i);
  });
});

/* -------------------------------------------------------------- the weight */

describe("emails stay light, because data here is metered and expensive", () => {
  it.each(EVERY_HTML)("$name is well under the Gmail clipping threshold", ({ html }) => {
    /*
     * Gmail clips a message past roughly 102KB and hides the rest behind "View
     * entire message", which on this product would hide the button. Nothing
     * here should come close, and the real reason for the budget is smaller
     * than Gmail: a reader on a metered Nigerian connection pays for every
     * kilobyte of a message they did not ask for.
     */
    const bytes = Buffer.byteLength(html, "utf8");
    expect(bytes).toBeLessThan(40_000);
  });
});
