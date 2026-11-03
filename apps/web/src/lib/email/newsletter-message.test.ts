import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  BANNERS,
  BANNER_HEIGHT,
  BANNER_WIDTH,
  NEWSLETTER_COPY,
  NEWSLETTER_LANDING,
  NEWSLETTER_ROUTES,
  bannerPath,
  platformNewsletter,
} from "./newsletter-message";
import { siteUrl } from "./render";
import { DARK, LEGAL_LINE, LIGHT, SCHEME_DARK_GROUND, SCHEME_DARK_INK, SIGN_OFF } from "./theme";
import { OUTBOX_TEMPLATES } from "../notify/templates";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..", "..", "app");
const PUBLIC = join(HERE, "..", "..", "..", "public");

const m = platformNewsletter({ name: "Adaeze Chinwe Obi" });
const anon = platformNewsletter({});

function visible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#\d+;|&rarr;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function appRoutes(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string, path: string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        if (entry.name === "page.tsx") found.add("/" + path.join("/"));
        continue;
      }
      const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      walk(join(dir, entry.name), isGroup ? path : [...path, entry.name]);
    }
  };
  walk(APP, []);
  return found;
}

function hrefs(html: string): string[] {
  const base = siteUrl();
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map((x) => (x[1] ?? "").replace(/&amp;/g, "&"))
    .filter((h) => !h.startsWith("urn:") && !h.startsWith("http://www.w3.org"))
    .map((h) => {
      expect(h.startsWith(base), `${h} is not on this site`).toBe(true);
      return h.slice(base.length);
    });
}

describe("the platform newsletter renders", () => {
  it("has a subject, preheader, html and a text part", () => {
    expect(m.subject).toBe("Adaeze, a first letter from Vallo");
    expect(anon.subject).toBe("A first letter from Vallo");
    expect(m.html).toContain("<!doctype html>");
    expect(m.text.trim().length).toBeGreaterThan(1500);
    expect(m.text).not.toContain("<");
    expect(m.preheader.length).toBeGreaterThan(20);
  });

  it("greets by first name, or by nobody without a falling comma", () => {
    expect(visible(m.html)).toContain("Hi Adaeze,");
    expect(m.text).toContain("Hi Adaeze,");
    expect(visible(anon.html)).toContain("Hi there,");
    expect(anon.html).not.toMatch(/Hi\s*,/);
  });

  it("escapes a hostile name", () => {
    const x = platformNewsletter({ name: `<b>O'Neil&"x"` });
    expect(x.html).not.toMatch(/<b>/);
  });

  it("carries the sections in order and one lit button drawn twice", () => {
    const text = visible(m.html);
    const order = [
      NEWSLETTER_COPY.why.heading,
      NEWSLETTER_COPY.today.heading,
      NEWSLETTER_COPY.roadmap.heading,
      NEWSLETTER_COPY.ready.heading,
      NEWSLETTER_COPY.button,
    ].map((h) => text.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(NEWSLETTER_COPY.today.items.length).toBeGreaterThanOrEqual(3);
    expect(NEWSLETTER_COPY.today.items.length).toBeLessThanOrEqual(5);
    expect(NEWSLETTER_COPY.roadmap.items.length).toBeGreaterThanOrEqual(4);
    expect(NEWSLETTER_COPY.roadmap.items.length).toBeLessThanOrEqual(6);
    expect(m.html.split(">Open Vallo").length - 1).toBe(2);
    expect(m.html).toContain("v:roundrect");
  });

  it("closes with the sign-off and legal line in both renderings", () => {
    for (const part of [m.html, m.text]) {
      expect(part).toContain(SIGN_OFF);
      expect(part).toContain(LEGAL_LINE);
    }
  });

  it("is registered in the outbox on the marketing channel", () => {
    const t = OUTBOX_TEMPLATES["platform.newsletter"];
    expect(t?.channel).toBe("marketing");
    const built = t?.build({}, {
      recipientId: "u",
      recipient: { name: "Ada" },
      lookups: {} as never,
    });
    expect(built?.subject).toBe("Ada, a first letter from Vallo");
  });
});

describe("links", () => {
  const routes = appRoutes();

  it.each([...NEWSLETTER_ROUTES])("%s is a page in the app", (route) => {
    expect(routes.has(route), `${route} has no page.tsx`).toBe(true);
  });

  it("links only to whitelisted routes, and prints each in the text", () => {
    const allowed = new Set<string>(NEWSLETTER_ROUTES);
    const found = hrefs(m.html);
    expect(found.length).toBeGreaterThanOrEqual(8);
    for (const path of found) {
      expect(allowed.has(path.split("?")[0] ?? path), `${path} not allowed`).toBe(true);
      expect(m.text).toContain(siteUrl() + path);
    }
  });

  it("sends the button to the app", () => {
    expect(m.html).toContain(`href="${siteUrl()}${NEWSLETTER_LANDING}"`);
  });
});

describe("banners", () => {
  const images = m.html.match(/<img\b[^>]*>/g) ?? [];

  it("references the three banners by absolute url, with size and real alt", () => {
    const banners = images.filter((i) => i.includes("/brand/email/newsletter/"));
    expect(banners).toHaveLength(3);
    for (const b of Object.values(BANNERS)) {
      const tag = banners.find((i) => i.includes(`src="${siteUrl()}${bannerPath(b.name)}"`));
      expect(tag, b.name).toBeDefined();
      expect(tag).toMatch(/\bwidth="\d+"/);
      expect(tag).toMatch(/\bheight="\d+"/);
      expect(tag).toMatch(/alt="[^"]{8,}"/);
    }
  });

  it.each(Object.values(BANNERS))("$name exists on disk as a 1200x480 png", ({ name }) => {
    const file = join(PUBLIC, "brand", "email", "newsletter", `${name}.png`);
    expect(existsSync(file)).toBe(true);
    const buf = readFileSync(file);
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    expect(buf.readUInt32BE(16)).toBe(BANNER_WIDTH);
    expect(buf.readUInt32BE(20)).toBe(BANNER_HEIGHT);
  });

  it("reads completely with every image removed", () => {
    const blind = visible(m.html.replace(/<img\b[^>]*>/g, ""));
    for (const h of [NEWSLETTER_COPY.why.heading, NEWSLETTER_COPY.roadmap.heading, NEWSLETTER_COPY.ready.heading]) {
      expect(blind).toContain(h);
    }
  });
});

describe("the words", () => {
  const BANNED =
    /\b(insured|guarantee|guaranteed|demo|sample|preview|coming soon|amazing|revolutionary|viewings?|returns?|invest\w*|returns|profit|yield)\b/i;

  it("uses no banned word, in subject, markup or text", () => {
    for (const part of [m.subject, m.html, m.text]) expect(part).not.toMatch(BANNED);
  });

  it("has no exclamation mark and no em or en dash", () => {
    for (const part of [m.subject, visible(m.html), m.text]) expect(part).not.toContain("!");
    for (const part of [m.subject, m.html, m.text]) {
      expect(part).not.toContain("—");
      expect(part).not.toContain("–");
    }
  });

  it("prints no count, statistic, percentage or date", () => {
    const words = visible(m.html).replace(LEGAL_LINE, "");
    expect(words.match(/\d+/g) ?? []).toEqual([]);
    expect(words).not.toMatch(/%/);
    expect(words).not.toMatch(/\b(january|february|march|april|june|july|august|september|october|november|december|20\d\d|q[1-4])\b/i);
  });

  it("promises nothing of the platform's holdings", () => {
    const words = visible(m.html);
    expect(words).not.toMatch(/\b(users|members) (have|already)\b/i);
    expect(words).not.toMatch(/\b(will|shall) (launch|arrive|ship)\b/i);
  });
});

/* ---- contrast: the same measure email-dark-paint.test.ts applies ---- */

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function lum(hex: string): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("paint and contrast", () => {
  const body = m.html.slice(m.html.indexOf("<body")).replace(/<!--[\s\S]*?-->/g, "");

  it("every table and cell paints its own ground (bgcolor and inline agree)", () => {
    for (const tag of body.match(/<(td|table)\b[^>]*>/g) ?? []) {
      const bg = /bgcolor="(#[0-9A-Fa-f]{6})"/.exec(tag)?.[1];
      const inline = /background-color:(#[0-9A-Fa-f]{6})/.exec(tag)?.[1];
      expect(bg, tag).toBeDefined();
      expect(inline?.toLowerCase(), tag).toBe(bg?.toLowerCase());
    }
  });

  it("every written ink clears AA on the grounds it sits on", () => {
    for (const ink of [LIGHT.text, LIGHT.body, LIGHT.muted]) {
      expect(ratio(ink, LIGHT.card)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ink, LIGHT.panel)).toBeGreaterThanOrEqual(4.3);
    }
  });

  it("every ink and ground class used repaints to DARK values that clear AA", () => {
    for (const [cls, ink] of Object.entries(SCHEME_DARK_INK)) {
      if (!body.includes(cls)) continue;
      for (const ground of [DARK.card, DARK.panel]) {
        expect(ratio(ink, ground), cls).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(Object.keys(SCHEME_DARK_GROUND).length).toBeGreaterThan(0);
  });
});
