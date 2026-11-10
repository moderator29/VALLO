"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * MARKDOWN-LITE FOR THE COPILOT'S ANSWERS. Paragraphs, bullet and numbered
 * lists, headings (drawn as bold lines), **bold**, `code`, and links. A link
 * is drawn only when its address is a console path (it starts with /admin);
 * any other address is shown as plain text, so an answer can never send a
 * staff member off the console. Nothing is injected as HTML: every piece is a
 * React element, so there is nothing to escape.
 */

const EM_DASH = String.fromCharCode(0x2014);

/** A console path and nothing else: no scheme, no host, no `..`, no `//`. */
export function isConsolePath(value: string): boolean {
  if (value.length > 300 || value.includes("..") || value.includes("//")) return false;
  return /^\/admin([/?#][A-Za-z0-9_./?=&#%-]*)?$/.test(value);
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\/admin[A-Za-z0-9_/.?=&%#-]*)/g;

function inline(text: string, onNavigate: (() => void) | undefined, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const token = match[0];
    const key = `${keyBase}-${n++}`;
    if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = token.slice(close + 2, -1);
      out.push(
        isConsolePath(href) ? (
          <Link key={key} href={href} className="nf-link" onClick={onNavigate}>
            {label}
          </Link>
        ) : (
          label
        ),
      );
    } else {
      /* A bare console path. Trailing punctuation is not part of the address. */
      const trimmed = token.replace(/[.,;:)]+$/, "");
      const tail = token.slice(trimmed.length);
      out.push(
        isConsolePath(trimmed) ? (
          <Link key={key} href={trimmed} className="nf-link" onClick={onNavigate}>
            {trimmed}
          </Link>
        ) : (
          trimmed
        ),
      );
      if (tail) out.push(tail);
    }
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "p"; text: string } | { kind: "h"; text: string } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[] };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replaceAll(EM_DASH, ", ").replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list.kind === "ul" ? { kind: "ul", items: list.items } : { kind: "ol", items: list.items });
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*(?:[-*•])\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,4}\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h", text: heading[1] ?? "" });
    } else if (bullet || numbered) {
      flushParagraph();
      const kind = bullet ? "ul" : "ol";
      if (list && list.kind !== kind) flushList();
      list = list ?? { kind, items: [] };
      list.items.push((bullet ?? numbered)?.[1] ?? "");
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function CopilotMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = parseBlocks(text);
  return (
    <div className="nf-copilot-md">
      {blocks.map((block, i) => {
        const key = `b${i}`;
        if (block.kind === "ul") {
          return (
            <ul key={key}>
              {block.items.map((item, j) => (
                <li key={`${key}-${j}`}>{inline(item, onNavigate, `${key}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={key}>
              {block.items.map((item, j) => (
                <li key={`${key}-${j}`}>{inline(item, onNavigate, `${key}-${j}`)}</li>
              ))}
            </ol>
          );
        }
        if (block.kind === "h") {
          return (
            <p key={key} className="nf-copilot-md__heading">
              <strong>{inline(block.text, onNavigate, key)}</strong>
            </p>
          );
        }
        return <p key={key}>{inline(block.text, onNavigate, key)}</p>;
      })}
    </div>
  );
}
