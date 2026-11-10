import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOC_SLUGS } from "./slugs";

/* Read as text: the chapter files hold JSX that this environment does not load. */
const FILES = [
  "chapters.tsx",
  "chapters-more.tsx",
  "chapters-guide.tsx",
  "chapters-people.tsx",
  "chapters-platform.tsx",
  "chapters-offers.tsx",
];
const here = new URL("./", import.meta.url);

describe("DOC_SLUGS", () => {
  it("names every chapter exactly once, and nothing else", () => {
    const source = FILES.map((file) => readFileSync(new URL(file, here), "utf8")).join("\n");
    const chapters = [...source.matchAll(/^ {2}slug: "([a-z0-9-]+)",/gm)].map((m) => m[1]);
    expect(chapters.length).toBeGreaterThan(0);
    expect([...DOC_SLUGS].sort()).toEqual([...chapters].sort());
    expect(new Set(DOC_SLUGS).size).toBe(DOC_SLUGS.length);
  });
});
