/**
 * READ A SOURCE FILE FOR ITS RAW TEXT FIELDS (test-only helper).
 *
 * Finds every `<input` and `<textarea` written directly in JSX, and says which
 * of the seven keyboard attributes each one names. No parser: a tag is read
 * from its `<name` to the `>` that closes it at brace depth zero, which is
 * enough for JSX attributes and is tested on the awkward shapes.
 */
export const KEYBOARD_ATTRIBUTES = ["type", "inputMode", "enterKeyHint", "autoComplete", "autoCapitalize", "autoCorrect", "spellCheck"] as const;

/** Inputs that are not typed into: no keyboard opens for them. */
const NOT_TYPED = new Set(["hidden", "file", "checkbox", "radio", "range", "color", "date", "time", "datetime-local", "month", "week", "submit", "button", "image", "reset"]);

export type RawField = {
  tag: "input" | "textarea";
  line: number;
  /** The keyboard attributes it names. */
  names: string[];
  /** It spreads props (`{...rest}`), so its attributes are decided by its caller. */
  spreads: boolean;
};

/** The attribute text of the tag opening at `from`, up to its closing `>`. */
function tagBody(code: string, from: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < code.length; i += 1) {
    const ch = code[i]!;
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return code.slice(from, i);
  }
  return code.slice(from);
}

/** `body` with everything inside braces removed, so only attribute names and string values are left. */
function topLevel(body: string): { text: string; spreads: boolean } {
  let depth = 0;
  let text = "";
  let spreads = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!;
    if (ch === "{") {
      if (depth === 0 && body.slice(i + 1).trimStart().startsWith("...")) spreads = true;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) text += "{}";
    } else if (depth === 0) text += ch;
  }
  return { text, spreads };
}

/** `code` must already have its comments blanked (`withoutComments`). */
export function rawFields(code: string): RawField[] {
  const found: RawField[] = [];
  for (const match of code.matchAll(/<(input|textarea)\b/g)) {
    const tag = match[1] as "input" | "textarea";
    const start = (match.index ?? 0) + match[0].length;
    const { text, spreads } = topLevel(tagBody(code, start));
    if (tag === "input") {
      const type = /\btype="([^"]*)"/.exec(text)?.[1];
      if (type && NOT_TYPED.has(type)) continue;
    }
    const names = KEYBOARD_ATTRIBUTES.filter((name) => new RegExp(`(?:^|\\s)${name}(?:=|\\s|$)`).test(text));
    found.push({ tag, line: code.slice(0, match.index ?? 0).split("\n").length, names, spreads });
  }
  return found;
}

/** A field the keyboard pass has not reached: it names nothing and no caller can. */
export const isBare = (field: RawField): boolean => field.names.length === 0 && !field.spreads;
