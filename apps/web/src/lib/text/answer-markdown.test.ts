import { describe, expect, it } from "vitest";
import { inlineRuns, isInternalPath, parseAnswer, plainAnswer, tidyStreaming } from "./answer-markdown";

/* The founder's own screenshot of 15 November 2026, as the model wrote it. */
const FROM_THE_SCREENSHOT = `Good question! A few honest reasons people use Vallo:

- **Everything in one place**: rentals, sales, land, shops/offices, plus shortlets.
- **Free to browse, message, inspect and pay**: no fees for renters or guests.
- **Transparent trust ladder**: every lister shows exactly what's been verified.`;

describe("an answer, read as the model wrote it", () => {
  it("turns the screenshot's hyphens into a list and its stars into bold, with nothing left over", () => {
    const blocks = parseAnswer(FROM_THE_SCREENSHOT);
    expect(blocks[0]).toEqual({ kind: "p", text: "Good question! A few honest reasons people use Vallo:" });
    expect(blocks[1]?.kind).toBe("ul");
    const list = blocks[1] as Extract<(typeof blocks)[number], { kind: "ul" }>;
    expect(list.items).toHaveLength(3);
    expect(inlineRuns(list.items[0]!.text)[0]).toEqual({ kind: "strong", text: "Everything in one place" });
    expect(plainAnswer(FROM_THE_SCREENSHOT)).not.toMatch(/\*\*|^- /m);
  });

  it("draws headings at three levels, and a short bold line as a heading", () => {
    expect(parseAnswer("# Big\n## Middle\n#### Small")).toEqual([
      { kind: "h", level: 1, text: "Big" },
      { kind: "h", level: 2, text: "Middle" },
      { kind: "h", level: 3, text: "Small" },
    ]);
    expect(parseAnswer("**My verdict:**")).toEqual([{ kind: "h", level: 3, text: "My verdict" }]);
  });

  it("keeps a numbered list whole across the blank lines models put between steps, from its own first number", () => {
    const blocks = parseAnswer("3. Open Stays\n\n4. Pick dates\n\n5. Pay inside Vallo");
    expect(blocks).toEqual([
      { kind: "ol", start: 3, items: [{ text: "Open Stays", depth: 0 }, { text: "Pick dates", depth: 0 }, { text: "Pay inside Vallo", depth: 0 }] },
    ]);
  });

  it("nests an indented item under the one above it", () => {
    const blocks = parseAnswer("- Lagos\n  - Lekki\n  - Yaba\n- Abuja");
    expect(blocks[0]).toEqual({
      kind: "ul",
      items: [
        { text: "Lagos", depth: 0 },
        { text: "Lekki", depth: 1 },
        { text: "Yaba", depth: 1 },
        { text: "Abuja", depth: 0 },
      ],
    });
  });

  it("reads a divider, a quote, code and a table", () => {
    expect(parseAnswer("---")).toEqual([{ kind: "hr" }]);
    expect(parseAnswer("> Never pay outside Vallo")).toEqual([{ kind: "quote", text: "Never pay outside Vallo" }]);
    expect(parseAnswer("```\nline one\nline two\n```")).toEqual([{ kind: "code", text: "line one\nline two" }]);
    expect(parseAnswer("| Area | Rent |\n| --- | --- |\n| Yaba | 1.2m |")).toEqual([{ kind: "table", head: ["Area", "Rent"], rows: [["Yaba", "1.2m"]] }]);
  });

  it("never writes an em dash into what a member reads", () => {
    expect(JSON.stringify(parseAnswer(`Step 2 ${String.fromCharCode(0x2014)} pay`))).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("the words inside a line", () => {
  it("reads bold, italic and code, and leaves handles with underscores alone", () => {
    expect(inlineRuns("Ask **@chii_realty** about *this* `flat`")).toEqual([
      { kind: "text", text: "Ask " },
      { kind: "strong", text: "@chii_realty" },
      { kind: "text", text: " about " },
      { kind: "em", text: "this" },
      { kind: "text", text: " " },
      { kind: "code", text: "flat" },
    ]);
    expect(inlineRuns("snake_case_name stays")).toEqual([{ kind: "text", text: "snake_case_name stays" }]);
    expect(inlineRuns("5 * 3 * 2")).toEqual([{ kind: "text", text: "5 * 3 * 2" }]);
  });

  it("links only to places inside Vallo; any other address is shown as its words", () => {
    expect(inlineRuns("[Stays](/stays)")).toEqual([{ kind: "link", text: "Stays", href: "/stays" }]);
    for (const outside of ["https://evil.example/pay", "//evil.example", "javascript:alert(1)", "mailto:x@y.z"]) {
      const runs = inlineRuns(`[Pay here](${outside})`);
      expect(runs.some((r) => r.kind === "link"), outside).toBe(false);
      expect(runs[0], outside).toEqual({ kind: "text", text: "Pay here" });
      expect(isInternalPath(outside), outside).toBe(false);
    }
  });
});

describe("an answer still arriving", () => {
  it("holds back a mark until it is closed, so stars never flash on screen", () => {
    expect(tidyStreaming("- **Free to bro")).toBe("- Free to bro");
    expect(tidyStreaming("Use `vall")).toBe("Use vall");
    expect(tidyStreaming("See [Stays](/sta")).toBe("See Stays");
    expect(tidyStreaming("Done.\n-")).toBe("Done.\n");
    expect(tidyStreaming("**Done** and **")).toBe("**Done** and ");
  });

  it("leaves a finished answer exactly as it is", () => {
    expect(tidyStreaming(FROM_THE_SCREENSHOT)).toBe(FROM_THE_SCREENSHOT);
  });
});
