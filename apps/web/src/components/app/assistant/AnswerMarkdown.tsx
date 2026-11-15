"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { inlineRuns, parseAnswer } from "@/lib/text/answer-markdown";
import "./answer-markdown.css";

/**
 * THE ASSISTANT'S ANSWER, DRAWN (the founder, 15 November 2026: "make it like
 * ChatGPT style output, clean headers, styles, people would find attractive").
 *
 * Headings, paragraphs, bullet and numbered lists (with a sub-level), bold,
 * italic, code, quotes, tables and dividers, from what the model wrote
 * (`lib/text/answer-markdown.ts`). Every piece is a React element: nothing is
 * injected as HTML, so there is nothing to escape. A link is drawn only for a
 * path inside Vallo.
 *
 * While the answer is still arriving, a mark that is not closed yet is held
 * back (`streaming`), so stars never flash on screen.
 */
function Inline({ text, keyBase }: { text: string; keyBase: string }) {
  const out: ReactNode[] = inlineRuns(text).map((run, i) => {
    const key = `${keyBase}-${i}`;
    switch (run.kind) {
      case "strong":
        return <strong key={key}>{run.text}</strong>;
      case "em":
        return <em key={key}>{run.text}</em>;
      case "code":
        return (
          <code key={key} className="nf-md__code">
            {run.text}
          </code>
        );
      case "link":
        return (
          <Link key={key} href={run.href} className="nf-md__link">
            {run.text}
          </Link>
        );
      default:
        return run.text;
    }
  });
  return <>{out}</>;
}

/* An answer sits under the page's own headings, so its levels start at h3. */
const HEADING_TAG = { 1: "h3", 2: "h4", 3: "h5" } as const;

export function AnswerMarkdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = parseAnswer(text, { streaming });
  return (
    <div className="nf-md" data-testid="answer-markdown">
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case "h": {
            const Tag = HEADING_TAG[block.level];
            return (
              <Tag key={key} className={`nf-md__h nf-md__h--${block.level}`}>
                <Inline text={block.text} keyBase={key} />
              </Tag>
            );
          }
          case "ul":
          case "ol": {
            const items = block.items.map((item, j) => (
              <li key={`${key}-${j}`} className={item.depth ? "nf-md__sub" : undefined}>
                <Inline text={item.text} keyBase={`${key}-${j}`} />
              </li>
            ));
            return block.kind === "ul" ? (
              <ul key={key} className="nf-md__list">
                {items}
              </ul>
            ) : (
              <ol key={key} className="nf-md__list nf-md__list--num" start={block.start}>
                {items}
              </ol>
            );
          }
          case "code":
            return (
              <pre key={key} className="nf-md__pre">
                <code>{block.text}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote key={key} className="nf-md__quote">
                <Inline text={block.text} keyBase={key} />
              </blockquote>
            );
          case "table":
            return (
              <div key={key} className="nf-md__tablewrap">
                <table className="nf-md__table">
                  <thead>
                    <tr>
                      {block.head.map((cell, j) => (
                        <th key={`${key}-h${j}`} scope="col">
                          <Inline text={cell} keyBase={`${key}-h${j}`} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={`${key}-r${j}`}>
                        {row.map((cell, k) => (
                          <td key={`${key}-r${j}c${k}`}>
                            <Inline text={cell} keyBase={`${key}-r${j}c${k}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={key} className="nf-md__hr" />;
          default:
            return (
              <p key={key} className="nf-md__p">
                <Inline text={block.text} keyBase={key} />
              </p>
            );
        }
      })}
    </div>
  );
}
