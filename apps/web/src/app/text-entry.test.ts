import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

/**
 * A FOCUSED TEXT FIELD LOOKS EXACTLY LIKE A RESTING ONE (the founder, 13
 * November 2026: "when I click I want to type it should look native ... it
 * should only be the container").
 *
 * Focus on a control that takes typing (an input of a text-like type, a
 * textarea, a contenteditable composer) draws nothing: no outline, no ring,
 * no halo, no glow, no edge colour, on the field or on the box around it. The
 * caret is the sign, as in the phone's own fields. `app/css/text-entry.css` is
 * the shared rule; this gate fails when any stylesheet brings a ring back:
 *
 *   1. a focus rule (`:focus`, `:focus-visible`, `:focus-within`, or a
 *      `:has()` around a focused field) whose focused part is a text field,
 *      or the box that holds one, and that sets an outline other than none,
 *      a box-shadow other than none, a border colour, or reveals a
 *      decoration (opacity or transform on something inside the box, which
 *      is how the sign-in halo was drawn);
 *   2. a TSX input or textarea, or its box, whose className carries a
 *      Tailwind focus ring utility (`focus:ring-2`, `focus-visible:outline`,
 *      `focus-within:border-...`).
 *
 * WHAT COUNTS AS A TEXT FIELD is read from the code rather than listed: every
 * class written on an `<input>` (not a checkbox, radio, range, file, colour
 * or button), a `<textarea>` or a contentEditable element in a TSX file is a
 * field class, and the classes on the two elements around it are its box.
 * A box is also anything named like one (search, field, composer, well),
 * so a ring on a new search bar is caught before its component exists.
 *
 * Buttons, links, checkboxes, radios, switches, sliders, tabs and selects
 * keep the keyboard ring; a selector that names `select` or `button` is not
 * a text field's.
 */
const SRC = join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next"]);

function files(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files(path, ext, out);
    else if (ext.test(entry.name) && !/\.test\.|\.spec\./.test(entry.name)) out.push(path);
  }
  return out;
}

/*
 * THE MARKS THAT ARE THE CONTENT, NOT A RING. Each is a field whose own text
 * is hidden, so the mark is where the caret would be. Keyed by the exact
 * selector as written, with the reason.
 */
const ALLOWED: Record<string, string> = {
  ".nf-code__box:has(.nf-code__input:focus-visible) .nf-code__cell":
    "The one-time-code boxes: the input is invisible over six cells and the current cell's edge is the caret (auth.css).",
  ".nf-mw-amount__figure:focus-within":
    "The wallet amount: the input is invisible (no caret, no text) over the big figure, so the mark round the figure is the only sign that typing goes there.",
};

/*
 * RINGS IN FILES ANOTHER AGENT OWNED ON 13 NOVEMBER 2026, routed to them
 * rather than edited here. Each entry goes when its rule does; the test says
 * so when one is stale.
 */
const ROUTED: Record<string, string> = {};

const NOT_TEXT_TYPES = /\[type=["']?(checkbox|radio|range|file|button|submit|reset|image|color|hidden)["']?\]/;
const BOX_NAME = /search|field|composer|well|newsletter|palette|find|notes|textarea|input/;

/* ---------------------------------------------------------------- TSX scan */

/** The end of a JSX opening tag that starts at `from`, skipping `=>` and braces. */
function tagEnd(text: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && text[i - 1] !== "=") return i;
  }
  return text.length;
}

const classesIn = (tag: string) => {
  const out: string[] = [];
  const attr = /className=(\{[\s\S]*?\}(?=\s+[a-zA-Z-]+=|\s*\/?$)|"[^"]*")/.exec(tag);
  if (!attr) return out;
  for (const m of (attr[1] ?? "").matchAll(/nf-[a-z0-9_-]+|wsd-[a-z0-9_-]+/g)) out.push(m[0]);
  return out;
};
const utilitiesIn = (tag: string) => {
  const attr = /className=(\{[\s\S]*?\}(?=\s+[a-zA-Z-]+=|\s*\/?$)|"[^"]*")/.exec(tag);
  return attr?.[1] ?? "";
};

interface Field {
  file: string;
  tag: string;
  own: string[];
  box: string[];
  utilities: string;
  boxUtilities: string;
}

function scanTsx(): Field[] {
  const fields: Field[] = [];
  for (const file of files(SRC, /\.tsx$/)) {
    const text = readFileSync(file, "utf8");
    /* A light JSX walk: a stack of the open elements' tags, so a field's box
       is the element it sits in. Generics (`useState<string>`) are skipped by
       requiring the `<` to follow something that can precede JSX. */
    const stack: { name: string; tag: string }[] = [];
    const re = /(^|[\s(>{?:&|,=])<(\/?)([A-Za-z][\w.]*)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index + (m[1] ?? "").length;
      const closing = m[2] === "/";
      const name = m[3] ?? "";
      if (closing) {
        const at = stack.map((s) => s.name).lastIndexOf(name);
        if (at !== -1) stack.length = at;
        continue;
      }
      if (!name) continue;
      const end = tagEnd(text, start + 1);
      const tag = text.slice(start, end + 1);
      const selfClosing = /\/\s*>$/.test(tag);
      const isText =
        ((name === "input" && !/type=["'](checkbox|radio|range|file|button|submit|reset|image|color|hidden)["']/.test(tag)) ||
          name === "textarea" ||
          /contentEditable(=\{true\}|\s|=["']true)/.test(tag));
      if (isText) {
        const box = stack.slice(-2);
        fields.push({
          file: file.slice(SRC.length),
          tag: tag.slice(0, 80).replace(/\s+/g, " "),
          own: classesIn(tag),
          box: box.flatMap((b) => classesIn(b.tag)),
          utilities: utilitiesIn(tag),
          boxUtilities: box.map((b) => utilitiesIn(b.tag)).join(" "),
        });
      }
      if (!selfClosing) stack.push({ name, tag });
      re.lastIndex = end;
    }
  }
  return fields;
}

const FIELDS = scanTsx();
const FIELD_CLASSES = new Set(FIELDS.flatMap((f) => f.own));
const BOX_CLASSES = new Set(FIELDS.flatMap((f) => f.box));
/* A class that is also on a select or a button somewhere is still a text
   field's when a text field carries it (`.nf-field`); the selector decides. */

/* --------------------------------------------------------------- CSS scan */

const FOCUS = /:focus(-visible|-within)?\b/;

/** Split a selector into compounds, keeping `:has(...)` and `:not(...)` whole. */
function compounds(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of selector) {
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth === 0 && /[\s>+~]/.test(c)) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

const classesOf = (compound: string) =>
  [...compound.replace(/:(not|where|is|has)\([^)]*\)/g, "").matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1] ?? "");

/*
 * `strict` is for the inside of a `:has()`: a card that lights when "an input"
 * inside it is focused is, every time in this code, a radio or checkbox card,
 * so there a bare `input` counts only with a text type or a field class.
 */
function isTextCompound(compound: string, strict = false): boolean {
  const bare = compound.replace(/:not\([^)]*\)/g, "");
  if (/(^|[^\w-])(select|button)\b/.test(bare)) return false;
  if (NOT_TEXT_TYPES.test(bare)) return false;
  if (/(^|[^\w-])textarea\b|\[contenteditable|\[role=["']?(textbox|searchbox)/.test(bare)) return true;
  if (/(^|[^\w-])input\b/.test(bare) && (!strict || /\[type=["']?(text|search|email|password|tel|url|number)/.test(bare))) return true;
  return classesOf(compound).some((c) => FIELD_CLASSES.has(c));
}

function isBoxCompound(compound: string): boolean {
  if (/(^|[^\w-])(select|button)\b/.test(compound.replace(/:not\([^)]*\)/g, ""))) return false;
  return classesOf(compound).some((c) => BOX_CLASSES.has(c) || BOX_NAME.test(c));
}

/** Does this declaration paint a ring, an edge or a revealed decoration? */
function paints(decl: Declaration, onDescendant: boolean): boolean {
  const prop = decl.prop.toLowerCase();
  const value = decl.value.trim().toLowerCase();
  if (prop.startsWith("--")) return false;
  if (prop === "outline" || prop === "outline-style" || prop === "outline-width" || prop === "outline-color")
    return !/^(none|0|0px|transparent)$/.test(value);
  if (prop === "box-shadow") return value !== "none";
  if (/^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-color$/.test(prop)) return true;
  if (/^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/.test(prop))
    return !/^(0|none|0px)$/.test(value);
  if (onDescendant && (prop === "opacity" || prop === "transform" || prop === "scale" || prop === "visibility"))
    return true;
  return false;
}

interface Finding {
  where: string;
  selector: string;
  props: string[];
}

function scanCss(): Finding[] {
  const found: Finding[] = [];
  for (const file of files(SRC, /\.css$/)) {
    if (file.endsWith("print.css")) continue;
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkRules((rule: Rule) => {
      if (!FOCUS.test(rule.selector)) return;
      for (const raw of rule.selectors) {
        const selector = raw.trim().replace(/\s+/g, " ");
        if (!FOCUS.test(selector)) continue;
        const parts = compounds(selector);
        let hit = false;
        let descendant = false;
        parts.forEach((part, i) => {
          if (!FOCUS.test(part)) return;
          const below = i < parts.length - 1;
          const has = /:has\(([^)]*:focus[^)]*)\)/.exec(part);
          const own = part.replace(/:has\([^)]*\)/g, "");
          if (has?.[1] && has[1].split(",").some((inner) => compounds(inner.trim()).some((c) => FOCUS.test(c) && isTextCompound(c, true)))) {
            hit = true;
            descendant ||= below;
          }
          if (/:focus-within/.test(own) && (isBoxCompound(own) || isTextCompound(own))) {
            hit = true;
            descendant ||= below;
          }
          if (/:focus(-visible)?(?!-)/.test(own) && isTextCompound(own)) {
            hit = true;
            descendant ||= below;
          }
        });
        if (!hit) continue;
        const props: string[] = [];
        rule.each((node) => {
          if (node.type === "decl" && paints(node, descendant)) props.push(`${node.prop}: ${node.value}`);
        });
        if (props.length) {
          found.push({ where: `${file.slice(SRC.length)}:${rule.source?.start?.line ?? 0}`, selector, props });
        }
      }
    });
  }
  return found;
}

const FOUND = scanCss();

describe("a focused text field draws nothing", () => {
  it("reads the fields from the code", () => {
    /* Sanity: the scan found the platform's fields and their boxes. */
    expect(FIELDS.length).toBeGreaterThan(80);
    for (const c of ["nf-field", "nf-shelf-field__input", "nf-composer__field", "nf-hero-plate__input"]) {
      expect(FIELD_CLASSES.has(c), c).toBe(true);
    }
    for (const c of ["nf-shelf-field", "nf-auth-field__box", "nf-composer__box", "nf-site-newsletter-field"]) {
      expect(BOX_CLASSES.has(c), c).toBe(true);
    }
  });

  it("no stylesheet gives a text field, or its box, a ring, an edge or a halo on focus", () => {
    const offenders = FOUND.filter((f) => !(f.selector in ALLOWED) && !(f.selector in ROUTED)).map(
      (f) => `${f.where}  ${f.selector}  { ${f.props.join("; ")} }`,
    );
    expect(offenders).toEqual([]);
  });

  it("the gate catches the rule it was written for", () => {
    /* The sign-in halo and the field's focus edge, as they stood. */
    const css = `
      .nf-auth-field__box:focus-within .nf-auth-field__halo { opacity: 1; transform: none; }
      .nf-auth .nf-field:focus { border-color: var(--nf-brand-primary); }
      .nf-field--glass:not([type="search"]):focus { box-shadow: 0 0 0 3px var(--nf-glow-2); }
      .nf-btn:focus-visible { outline: 2px solid var(--nf-focus-ring); }
      select.nf-field:focus { box-shadow: 0 0 0 3px var(--nf-glow-2); }
      :where(input[type="checkbox"]):focus-visible { outline: 2px solid var(--nf-focus-ring); }
    `;
    const hits: string[] = [];
    postcss.parse(css).walkRules((rule) => {
      const parts = compounds(rule.selector);
      const textish = parts.some(
        (p) =>
          FOCUS.test(p) &&
          ((/:focus-within/.test(p) && (isBoxCompound(p) || isTextCompound(p))) ||
            (/:focus(-visible)?(?!-)/.test(p) && isTextCompound(p))),
      );
      if (textish) hits.push(rule.selector);
    });
    expect(hits).toEqual([
      ".nf-auth-field__box:focus-within .nf-auth-field__halo",
      ".nf-auth .nf-field:focus",
      '.nf-field--glass:not([type="search"]):focus',
    ]);
  });

  it("allows only marks that still exist, and says when a routed ring is gone", () => {
    const selectors = new Set(FOUND.map((f) => f.selector));
    for (const key of Object.keys(ALLOWED)) expect(selectors.has(key), `stale ALLOWED entry: ${key}`).toBe(true);
    const staleRouted = Object.keys(ROUTED).filter((key) => !selectors.has(key));
    /* A routed rule deleted by its owner leaves a stale entry: delete it here. */
    expect(staleRouted, "routed rings now fixed; remove them from ROUTED").toEqual([]);
  });
});

describe("no Tailwind focus ring on a text field or its box", () => {
  it("is absent from every TSX field", () => {
    const RING = /(^|[\s"'`{])(focus|focus-visible|focus-within|group-focus-within|peer-focus):(ring|outline(?!-none)|shadow|border)/;
    const offenders = FIELDS.filter((f) => RING.test(f.utilities) || /focus-within:(ring|outline(?!-none)|shadow|border)/.test(f.boxUtilities)).map(
      (f) => `${f.file}: ${f.tag}`,
    );
    expect(offenders).toEqual([]);
  });
});
