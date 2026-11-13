/**
 * WHAT THE COPILOT'S RENDERER CAN READ (the founder, 12 November 2026: "the ai
 * copilot for the admin panel for each desk, the frontend is not okay, you see
 * how gibberish it is").
 *
 * It could not read three things an admin copilot writes constantly, and each
 * one arrived as a single run-on line. Measured against the real parser before
 * the fix, from one ordinary answer about desk counts:
 *
 *   a table   -> {"kind":"p","text":"| Desk | Waiting | | --- | --- | | Listings | 3 | | Support | 15 |"}
 *   a SQL block -> {"kind":"p","text":"```sql select id, created_at from listings where status = 'pending' order by created_at asc; ```"}
 *   a quote   -> {"kind":"p","text":"> Note: this only counts live listings."}
 *
 * That is the gibberish. A desk summary is a table and an answer to an
 * operator is SQL, so this was not an edge case, it was the common case.
 *
 * These tests hold the parser to reading all three. They are block-level
 * assertions rather than rendered-DOM ones because the blocks are what was
 * wrong: the elements follow from them.
 */
import { describe, expect, it } from "vitest";
import { parseBlocks } from "./markdown-lite";

describe("the copilot reads a table", () => {
  const source = ["| Desk | Waiting |", "| --- | --- |", "| Listings | 3 |", "| Support | 15 |"].join("\n");

  it("is a table, not a paragraph of pipes", () => {
    const blocks = parseBlocks(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe("table");
  });

  it("keeps the head and every row, with the pipes gone", () => {
    const block = parseBlocks(source)[0]!;
    if (block.kind !== "table") throw new Error("not a table");
    expect(block.head).toEqual(["Desk", "Waiting"]);
    expect(block.rows).toEqual([
      ["Listings", "3"],
      ["Support", "15"],
    ]);
  });

  it("leaves a lone row of pipes alone when no rule follows it, so prose is never eaten", () => {
    /* Without the `| --- |` under it, it is not a table and must stay text. */
    const blocks = parseBlocks("| this is just | some text |");
    expect(blocks[0]!.kind).toBe("p");
  });
});

describe("the copilot reads a fenced block", () => {
  const source = ["```sql", "select id, created_at", "from listings", "where status = 'pending';", "```"].join("\n");

  it("is code, not a paragraph with the backticks showing", () => {
    const blocks = parseBlocks(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe("code");
  });

  it("keeps the line breaks, because a statement joined by spaces is not the statement", () => {
    const block = parseBlocks(source)[0]!;
    if (block.kind !== "code") throw new Error("not code");
    expect(block.text).toBe("select id, created_at\nfrom listings\nwhere status = 'pending';");
    expect(block.text).not.toContain("```");
  });

  it("swallows markdown inside the fence rather than reading it", () => {
    const blocks = parseBlocks(["```", "# not a heading", "- not a bullet", "```"].join("\n"));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe("code");
  });

  it("closes an unterminated fence at the end instead of eating the rest in silence", () => {
    const blocks = parseBlocks(["Here it is:", "```", "select 1;"].join("\n"));
    expect(blocks.map((b) => b.kind)).toEqual(["p", "code"]);
  });
});

describe("the copilot reads a quote", () => {
  it("drops the marker instead of printing it", () => {
    const blocks = parseBlocks("> Note: this only counts live listings.");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe("quote");
    if (blocks[0]!.kind !== "quote") throw new Error("not a quote");
    expect(blocks[0]!.text).toBe("Note: this only counts live listings.");
  });
});

describe("the whole answer, as a desk copilot would write it", () => {
  it("comes apart into the blocks it was written as", () => {
    const answer = [
      "## Waiting on you",
      "",
      "| Desk | Waiting |",
      "| --- | --- |",
      "| Listings | 3 |",
      "",
      "To clear the oldest first, run:",
      "",
      "```sql",
      "select id from listings;",
      "```",
      "",
      "> Only live listings are counted.",
      "",
      "See /admin/listings for the queue.",
    ].join("\n");
    expect(parseBlocks(answer).map((b) => b.kind)).toEqual(["h", "table", "p", "code", "quote", "p"]);
  });
});
