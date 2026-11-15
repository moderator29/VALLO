import { isValidElement, type ReactNode } from "react";

/**
 * A HANDBOOK'S OWN WORDS, FLATTENED (15 November 2026).
 *
 * The copilot has to answer from the same words the person reads, so the
 * handbook is written once as JSX and read back as plain text here. The
 * approach is `app/(site)/docs/glance.ts`: walk the tree, take what elements
 * hold as CHILDREN, and tidy the spacing JSX leaves behind when a link or a
 * bold name ends a sentence.
 *
 * Props are not read. A table's cells and a flow's step names live in props,
 * and a step name run into its outcome is not a sentence. What matters for a
 * handbook is its prose, and the prose is in the children.
 *
 * Pure, and client-safe.
 */

/** The prose inside a node tree: what its elements hold as children. */
export function plainText(node: ReactNode, depth = 0): string {
  if (depth > 40 || node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => plainText(child, depth + 1)).join(" ");
  if (isValidElement(node)) return plainText((node.props as { children?: ReactNode }).children, depth + 1);
  return "";
}

/** JSX spacing leaves " ." where a link or a bold name ends a sentence; read it as written. */
export function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:!?])/g, "$1")
    .trim();
}

/** One node's prose, tidied. */
export function textOf(node: ReactNode): string {
  return tidy(plainText(node));
}
