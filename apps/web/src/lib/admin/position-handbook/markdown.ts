/**
 * A HANDBOOK AS A FILE THE BROWSER WRITES (15 November 2026).
 *
 * "Save as a file" has to produce the same words the person just read, with
 * no npm package and no server round trip. So the page hands the browser a
 * plain document (the handbook flattened to text, in `index.ts`) and these
 * pure functions turn it into Markdown and a file name. The client component
 * makes a Blob from the string, downloads it through an object URL and revokes
 * the URL again.
 *
 * Pure and client-safe: no React, no imports, nothing server-only. The same
 * functions build the file in the browser and check it in a test.
 */

/** One handbook, flattened to the plain words a file can hold. */
export type HandbookDocument = {
  position: string;
  /** The position's title, as the console names it. */
  title: string;
  /** The route this handbook is read at. */
  route: string;
  /** The day the handbook was last read against the code, as an ISO date. */
  updated: string;
  intro: string;
  glance: string[];
  sections: { id: string; title: string; text: string }[];
};

/** A title as a file name part: lower case, words joined by single hyphens. */
export function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The file name, as the founder asked for it:
 * `vallo-handbook-business-development-director-2026-11-15.md`. The date is
 * the day the file is made, so a person with two copies can tell which is
 * newer; it falls back to the day the handbook was last read against the code.
 */
export function handbookFileName(document: HandbookDocument, isoDate?: string): string {
  const date = /^\d{4}-\d{2}-\d{2}/.test(isoDate ?? "") ? isoDate!.slice(0, 10) : document.updated.slice(0, 10);
  return `vallo-handbook-${slugOf(document.title)}-${date}.md`;
}

/** Today in Lagos, as an ISO date, for the file name. */
export function todayInLagos(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  /* en-CA gives YYYY-MM-DD, which is the shape we want. */
  return parts.replace(/\//g, "-");
}

/** Wrap long text at the given width, so the file reads in a plain editor. */
function wrap(text: string, width = 92): string {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length + 1 > width) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out.join("\n");
}

/**
 * The handbook as Markdown: a heading per section, in the order the page
 * shows them, with the anchors kept so a line in the file can be found again
 * on the screen.
 */
export function handbookMarkdown(document: HandbookDocument): string {
  const lines: string[] = [];
  lines.push(`# Vallo staff handbook: ${document.title}`);
  lines.push("");
  lines.push(`Read against the console on ${document.updated}. Read it on the console at ${document.route}.`);
  lines.push("");
  lines.push(
    "This file is a copy. The screen is the live answer: what is open on Vallo is read against the code often and changes, so where this file and the console disagree, believe the console.",
  );
  lines.push("");
  lines.push(wrap(document.intro));
  lines.push("");
  lines.push("## At a glance");
  lines.push("");
  for (const point of document.glance) lines.push(`- ${wrap(point).replace(/\n/g, "\n  ")}`);
  lines.push("");
  lines.push("## Contents");
  lines.push("");
  document.sections.forEach((section, index) => {
    lines.push(`${index + 1}. ${section.title}`);
  });
  lines.push("");
  document.sections.forEach((section, index) => {
    lines.push(`## ${index + 1}. ${section.title}`);
    lines.push("");
    lines.push(`Anchor: ${document.route}#${section.id}`);
    lines.push("");
    lines.push(wrap(section.text));
    lines.push("");
  });
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}
