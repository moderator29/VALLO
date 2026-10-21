import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The money and sign-up screens say nothing the dictionary does not hold.
 *
 * "Total to pay" was written into three components in English, so a Yoruba
 * or Hausa reader paying for a stay read the one line that matters most in a
 * language they had not chosen. Checkout, the rent payment, and the sign-in,
 * sign-up and confirmation screens now read their sentences from
 * `@vallo/i18n`, and this keeps them that way.
 *
 * It reads the syntax tree, so comments (which quote old copy on purpose)
 * are not hits. A hit is any of:
 *   - visible JSX text with a word in it;
 *   - a string literal given to a prop a person reads or hears (`title`,
 *     `label`, `aria-label`, `placeholder`, `alt`, `body`, `note`,
 *     `subtitle`, `suffix`, `verdict`, `consequence`, `footnote`), even one
 *     word;
 *   - ANY other string or template literal carrying two or more words,
 *     wherever it sits: an action's `label`, a `setMessage(...)`, a
 *     conditional's branch, a constant.
 * Not read: `"use client"` directives, imports and types, `console.*` lines,
 * layout props (`className`, `href`, `id`, ...), and the allowances below.
 * HTML entities alone (`&middot;`) are punctuation, not copy.
 */

const SRC = join(__dirname, "..", "..");

/** The surfaces held to the rule. */
const SURFACES = [
  "app/(app)/checkout",
  "app/(app)/rent/pay",
  "app/(auth)",
  "components/auth",
  /* Schedule a visit (13 October 2026): written to the dictionary from the start. */
  "app/(app)/listing/[id]/visit",
  "components/app/inspections/visit",
  /* The language audit (17 October 2026): the listing page's booking panels
     (a table, a stay, a rental), its tenancy stepper and its waits. */
  "app/(app)/listing/[id]",
  /* A stay's booking page, its review, cancelling it and the getting-there panel. */
  "app/(app)/bookings",
  "components/app/bookings",
  /* The host wizard's drawn stays screens. */
  "components/host/stays",
];

/** Props whose string value is read or announced. */
const SPOKEN = new Set([
  "title", "label", "aria-label", "placeholder", "alt", "body", "note", "subtitle", "suffix",
  "verdict", "consequence", "footnote",
]);

/** Props that carry layout, routing or identity, never words for a person. */
const LAYOUT = new Set([
  "className", "secondaryClassName", "style", "href", "src", "id", "data-testid", "type", "name",
  "variant", "icon", "size", "autoComplete", "inputMode", "art", "fallback", "key", "rel", "target",
  "method", "encType", "role", "trailingIcon", "state", "tone", "aria-labelledby", "aria-describedby",
  "htmlFor", "form", "value", "defaultValue", "pattern",
  /* An image's responsive widths: a media query, never words for a person. */
  "sizes",
]);

/** Literal text that is not language: say why, or do not add it. */
const ALLOWED = new Map<string, string>([
  ['title="Vallo"', "the brand name on the logo, the same in every language"],
  ['"email name"', "the Sign in with Apple scope list, a protocol value"],
  ['"[vallo] auth route error"', "the console tag useErrorReport logs under, read by staff in the log, never shown"],
  ['"[vallo] space trust error"', "the console tag useErrorReport logs under, read by staff in the log, never shown"],
]);

/**
 * The page-tab titles in `export const metadata` are static exports that
 * cannot read the visitor's locale; moving them means `generateMetadata` on
 * each route, which is the next step and not done here.
 */
function inMetadata(node: ts.Node): boolean {
  for (let up: ts.Node | undefined = node; up; up = up.parent) {
    if (ts.isVariableDeclaration(up) && up.name.getText() === "metadata") return true;
  }
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const WORD = /[A-Za-z]{2,}/;
/* Two words with a space between them: a kebab-case state name is not copy. */
const WORDS = /[A-Za-z]{2,}[^\sA-Za-z]*\s+[^\sA-Za-z]*[A-Za-z]{2,}/;

export function hardCodedCopy(file: string, text: string): string[] {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const hits: string[] = [];
  const at = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const hit = (node: ts.Node, shown: string) => {
    if (!ALLOWED.has(shown)) hits.push(`${file}:${at(node)}: ${shown.replace(/\s+/g, " ").slice(0, 90)}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
    if (ts.isCallExpression(node) && /^console\./.test(node.expression.getText(source))) return;
    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression)) return;
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source);
      if (LAYOUT.has(name)) return;
      const value = node.initializer;
      if (value && ts.isStringLiteral(value)) {
        if ((SPOKEN.has(name) && WORD.test(value.text)) || WORDS.test(value.text)) hit(node, `${name}="${value.text}"`);
        return;
      }
    }
    if (ts.isJsxText(node)) {
      const words = node.text.replace(/&[a-zA-Z]+;/g, " ").trim();
      if (WORD.test(words)) hit(node, words);
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && WORDS.test(node.text)) {
      if (!inMetadata(node)) hit(node, `"${node.text}"`);
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" … ");
      if (WORDS.test(parts) && !inMetadata(node)) hit(node, `\`${parts}\``);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

describe("checkout, rent payment and sign-up read their copy from the dictionary", () => {
  it("recognises copy, and leaves expressions, entities and comments alone", () => {
    const sample = [
      "const a = <p>Total to pay</p>;",
      'const b = <Option title="Pay by card" body={c.cardBody} />;',
      "const c = <p>{c.totalToPay} &middot; {x}</p>;",
      "const d = <p>{/* Total to pay */}</p>;",
      "const e = <Amount suffix={`in full`} />;",
      'const f = <LogoMark title="Vallo" />;',
      'const g = [{ label: "See your stays", href: "/bookings", tone: "primary" }];',
      'const h = ok ? "The payment could not be completed." : error;',
      'setMessage("Passwords do not match.");',
      'const i = <Sheet verdict="Sent" className="nf-sheet nf-sheet--tall" />;',
      '"use client";',
      'export const metadata = { title: "Pay the rent" };',
      'console.warn("a line for the log");',
      "const j = `${n} has been received`;",
    ].join("\n");
    expect(hardCodedCopy("sample.tsx", sample).map((hit) => hit.split(":")[1])).toEqual(["1", "2", "5", "7", "8", "9", "10", "14"]);
  });

  it("finds no hard-coded English on those surfaces", () => {
    const hits = SURFACES.flatMap((surface) =>
      walk(join(SRC, surface)).flatMap((path) =>
        hardCodedCopy(relative(SRC, path).split("\\").join("/"), readFileSync(path, "utf8")),
      ),
    );
    expect(hits).toEqual([]);
  });
});
