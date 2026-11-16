/**
 * THE ASSISTANT'S ANSWERS, READ AS THE MODEL WROTE THEM (the founder, 15
 * November 2026: "in the AI response chat remove those ** or -, make it like
 * ChatGPT style output, clean headers and styles").
 *
 * The model writes light markdown: headings, **bold**, lists, numbered steps,
 * the odd table. The chat used to print it as it came, so a member read
 * "**Free to browse**" with the stars and every list item started with a
 * hyphen. This turns that text into blocks and inline runs that the answer
 * component draws as real headings, lists and emphasis.
 *
 * It is the member twin of the console copilot's parser
 * (`components/admin/copilot/markdown-lite.tsx`), extended for a reader: heading
 * levels, a divider, sub-items, numbered lists that keep their own numbers,
 * italics, and tidying of a half-written mark while an answer is still
 * arriving, so "**" never flashes on screen mid-stream.
 *
 * Pure: no React, no DOM, nothing injected as HTML anywhere downstream. A link
 * is only ever a path inside Vallo (`/...`); any other address is shown as
 * plain words, so an answer can never send a member off the platform.
 */

const EM_DASH = String.fromCharCode(0x2014);

export type ListItem = { text: string; depth: 0 | 1 };

export type AnswerBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "ul"; items: ListItem[] }
  | { kind: "ol"; start: number; items: ListItem[] }
  | { kind: "code"; text: string }
  /** A message drafted for the member to send themselves (a ```message fence), drawn as a card. */
  | { kind: "message"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "hr" };

export type InlineRun =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

/** A path inside Vallo, and nothing else: no scheme, no other host, no `//`. */
export function isInternalPath(href: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9_\-./?=&%#~+]*$/.test(href);
}

function cells(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}
function isTableRule(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-") && line.includes("|");
}
function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line.trimEnd());
}

/**
 * While an answer is still arriving its last line can end in the middle of a
 * mark ("**Free to bro"). Shown as it is, the stars flash and vanish a moment
 * later. A mark that is not yet closed is held back until it is.
 */
export function tidyStreaming(text: string): string {
  const lines = text.split("\n");
  let last = lines[lines.length - 1] ?? "";
  /* An odd number of "**" on the last line: drop the one still open. */
  const pairs = last.match(/\*\*/g)?.length ?? 0;
  if (pairs % 2 === 1) {
    const at = last.lastIndexOf("**");
    last = last.slice(0, at) + last.slice(at + 2);
  }
  /* An unclosed inline code mark. */
  if ((last.match(/`/g)?.length ?? 0) % 2 === 1) {
    const at = last.lastIndexOf("`");
    last = last.slice(0, at) + last.slice(at + 1);
  }
  /* A link still being written: "[label](/list" shows as its label. */
  last = last.replace(/\[([^\]\n]*)\]\([^)\n]*$/, "$1").replace(/\[([^\]\n]*)$/, "$1");
  /* A fence still being opened ("```mes"): wait for its line to end, so a
     message card never flashes as a block of code first. */
  if (/^\s*```[A-Za-z]*$/.test(last)) last = "";
  /* A lone marker that has not become a bullet or a heading yet. */
  if (/^\s*(?:[-*•]|#{1,6}|\d+[.)])\s*$/.test(last)) last = "";
  lines[lines.length - 1] = last;
  return lines.join("\n");
}

/**
 * No em dash reaches a member. After a step's number it becomes a colon
 * ("Step 2: Complete the setup"); anywhere else a comma, with the spaces
 * around it tidied so the words do not read "Step 2 ,  pay".
 */
function withoutEmDashes(text: string): string {
  return text
    .replace(new RegExp(`(\\bstep[ \\t]+\\d+)[ \\t]*${EM_DASH}[ \\t]*`, "gi"), "$1: ")
    .replace(new RegExp(`[ \\t]*${EM_DASH}[ \\t]*`, "g"), ", ");
}

/**
 * A short line that names a step and nothing else ("Step 2: Complete the
 * voice setup", bold or not) opens that step's section, the way a heading
 * would. A long line or a full sentence stays a paragraph.
 */
const STEP_LINE = /^\s*(?:\*\*)?(step\s+\d+\s*[:.)-]\s*[^*\n]{1,64}?)(?:\*\*)?\s*$/i;

export function parseAnswer(source: string, options: { streaming?: boolean } = {}): AnswerBlock[] {
  const text = withoutEmDashes(options.streaming ? tidyStreaming(source) : source).replace(/\r/g, "");
  const lines = text.split("\n");
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let list: { kind: "ul"; items: ListItem[] } | { kind: "ol"; start: number; items: ListItem[] } | null = null;
  let fence: string[] | null = null;
  let fenceIsMessage = false;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trimEnd();

    const fenceMark = /^\s*```+\s*[A-Za-z0-9_+-]*\s*$/.test(line);
    if (fence) {
      if (fenceMark) {
        blocks.push(fenceIsMessage ? { kind: "message", text: fence.join("\n").trim() } : { kind: "code", text: fence.join("\n") });
        fence = null;
      } else {
        fence.push(raw);
      }
      continue;
    }
    if (fenceMark) {
      flush();
      fence = [];
      fenceIsMessage = /^\s*```+\s*message\s*$/i.test(line);
      continue;
    }

    if (isTableRow(line) && isTableRule(lines[i + 1] ?? "")) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j] ?? "")) {
        rows.push(cells(lines[j] ?? ""));
        j += 1;
      }
      blocks.push({ kind: "table", head, rows });
      i = j - 1;
      continue;
    }

    if (!line.trim()) {
      /* A blank line ends a paragraph. It does not end a list: models put a
         blank line between numbered steps, and each step is still the list. */
      flushParagraph();
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ kind: "hr" });
      continue;
    }

    const heading = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(3, (heading[1] ?? "#").length) as 1 | 2 | 3;
      blocks.push({ kind: "h", level, text: heading[2] ?? "" });
      continue;
    }

    /* A line that is only bold, and short, is a heading in all but name:
       "**My verdict:**". Drawn as one so the answer has its sections. */
    const boldLine = /^\s*\*\*([^*\n]{1,80})\*\*\s*:?\s*$/.exec(line);
    if (boldLine) {
      flush();
      blocks.push({ kind: "h", level: 3, text: (boldLine[1] ?? "").replace(/:\s*$/, "") });
      continue;
    }

    const step = STEP_LINE.exec(line);
    if (step && !/[.!?]$/.test((step[1] ?? "").trim())) {
      flush();
      blocks.push({ kind: "h", level: 3, text: (step[1] ?? "").trim().replace(/^(step\s+\d+)\s*[:.)-]\s*/i, "$1: ") });
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      blocks.push({ kind: "quote", text: quote[1] ?? "" });
      continue;
    }

    const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const indent = ((bullet ?? numbered)?.[1] ?? "").replace(/\t/g, "  ").length;
      const depth: 0 | 1 = indent >= 2 && list !== null ? 1 : 0;
      const itemText = bullet ? (bullet[2] ?? "") : (numbered?.[3] ?? "");
      /* A sub-item joins whatever list it sits under, whatever its own mark. */
      if (depth === 1 && list) {
        list.items.push({ text: itemText, depth });
        continue;
      }
      const kind = bullet ? "ul" : "ol";
      if (list && list.kind !== kind) flushList();
      if (!list) {
        list = kind === "ul" ? { kind: "ul", items: [] } : { kind: "ol", start: Number(numbered?.[2] ?? "1") || 1, items: [] };
      }
      list.items.push({ text: itemText, depth: 0 });
      continue;
    }

    /* A line under a list item that is indented continues that item. */
    if (list && /^\s{2,}\S/.test(raw) && list.items.length > 0) {
      const lastItem = list.items[list.items.length - 1]!;
      lastItem.text = `${lastItem.text} ${line.trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }
  /* A message still being written is drawn as its card while it arrives. */
  if (fence) blocks.push(fenceIsMessage ? { kind: "message", text: fence.join("\n").trim() } : { kind: "code", text: fence.join("\n") });
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*\n]+?\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|(?<![*\w])\*(?!\s)[^*\n]+?(?<!\s)\*(?![*\w]))/g;

/**
 * One line's runs: plain words, bold, italic, code and links. Underscores are
 * never read as italics, because handles have them (@chii_realty).
 */
export function inlineRuns(text: string): InlineRun[] {
  const out: InlineRun[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    const token = match[0];
    if (token.startsWith("**")) out.push({ kind: "strong", text: token.slice(2, -2) });
    else if (token.startsWith("`")) out.push({ kind: "code", text: token.slice(1, -1) });
    else if (token.startsWith("[")) {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = token.slice(close + 2, -1);
      out.push(isInternalPath(href) ? { kind: "link", text: label, href } : { kind: "text", text: label });
    } else out.push({ kind: "em", text: token.slice(1, -1) });
    last = at + token.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** The answer as plain words, for copying, sharing and reading aloud: no stars, no hashes. */
export function plainAnswer(source: string): string {
  const runs = (line: string) => inlineRuns(line).map((r) => r.text).join("");
  return parseAnswer(source)
    .map((block) => {
      switch (block.kind) {
        case "p":
        case "quote":
          return runs(block.text);
        case "h":
          return runs(block.text);
        case "ul":
          return block.items.map((item) => `${item.depth ? "    " : ""}• ${runs(item.text)}`).join("\n");
        case "ol": {
          let n = block.start - 1;
          return block.items
            .map((item) => (item.depth ? `    • ${runs(item.text)}` : `${(n += 1)}. ${runs(item.text)}`))
            .join("\n");
        }
        case "code":
        case "message":
          return block.text;
        case "table":
          return [block.head, ...block.rows].map((row) => row.map(runs).join(" | ")).join("\n");
        case "hr":
          return "";
      }
    })
    .filter((part) => part !== "")
    .join("\n\n");
}
