import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAFF_SCOPE_LABEL } from "@/lib/admin/guard";
import { MANUAL_AREA_LABEL } from "@/lib/admin/manual/chapters";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS, type StaffPosition } from "@/lib/admin/staff-positions";
import { BANNED_EVERYWHERE, SCHEDULE_PROMISES, firstBannedPhrase } from "@/lib/copy/banned-phrases";
import { CONTACT_EMAIL } from "@/lib/support-email";
import { renderClient } from "@/lib/testing/render-client";
import { unbackedClaim } from "@/lib/trust/claims";
import { handbookFileName, handbookMarkdown, type HandbookDocument } from "./markdown";

/**
 * THE POSITION HANDBOOKS, HELD TO WHAT THE CONSOLE ACTUALLY DOES.
 *
 * Four things are checked, and each one is a way a handbook could quietly go
 * wrong:
 *
 *   1. COVERAGE. Every position has a handbook, and no handbook names a
 *      position that does not exist.
 *   2. DRIFT, which is the one that bites. A handbook describes the access a
 *      position holds. If a scope is added to a position and the handbook
 *      does not name it, the person reads a handbook that is missing a desk
 *      they can open; if a handbook names an area the position does not hold,
 *      they go looking for a desk that will refuse them. So every handbook
 *      must print the console's OWN label for every scope its position holds,
 *      must list no other area as one it holds, and the labels the handbooks
 *      draw with must equal `STAFF_SCOPE_LABEL` exactly.
 *   3. THE WORDS, read as a reader reads them: every handbook is rendered to
 *      HTML and its visible text is checked for the dashes the founder ruled
 *      out, schedule promises, unbacked claims of safety, a second contact
 *      address, an invented phone number, and links to pages the app does not
 *      serve.
 *   4. THE COPILOT'S COPY. `positionHandbookPassages` must carry the real
 *      sentences, because the copilot answers from them and the handbook and
 *      the copilot may never disagree.
 *
 * The job descriptions' own words are quoted verbatim by every handbook: that
 * is the point, so the handbook carries the whole job description rather than
 * a second copy of it. Three of those sentences in
 * `lib/admin/staff-positions.ts` carry a claim word, because the console is
 * outside the trust sweep that would have caught them. They are removed
 * before the claim check below, so this test bites on the handbooks' own
 * prose and not on another module's shipped copy.
 */

const APP = join(process.cwd(), "src", "app");

/** Every page route under `src/app`, as the URL pattern it serves. */
function pageRoutes(dir: string, segments: string[], out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("_")) continue;
      pageRoutes(full, /^\(.*\)$/.test(entry) ? segments : [...segments, entry], out);
    } else if (/^page\.tsx?$/.test(entry)) {
      out.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }
  }
  return out;
}

const ROUTES = pageRoutes(APP, [], []);

function served(path: string): boolean {
  const want = path.split(/[?#]/)[0]!.replace(/\/$/, "") || "/";
  if (ROUTES.includes(want)) return true;
  const parts = want.slice(1).split("/");
  return ROUTES.some((route) => {
    const have = route.slice(1).split("/");
    return have.length === parts.length && have.every((seg, i) => /^\[.+\]$/.test(seg) || seg === parts[i]);
  });
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The job descriptions' own sentences, which every handbook quotes as written. */
const JOB_WORDS: string[] = STAFF_POSITIONS.flatMap((position) => {
  const job = JOB_DESCRIPTIONS[position];
  return [job.summary, job.reportsTo, ...job.responsibilities, ...job.expectations, ...job.escalate];
});

function withoutJobDescriptions(text: string): string {
  let out = text;
  for (const sentence of JOB_WORDS) out = out.split(sentence).join(" ");
  return out;
}

type Passage = { id: string; title: string; text: string };
type IndexEntry = { position: StaffPosition; title: string; summary: string; route: string; sections: number };
type Built = {
  updated: string;
  index: IndexEntry[];
  pages: Record<string, string>;
  passages: Record<string, Passage[]>;
  documents: Record<string, HandbookDocument>;
};

/**
 * THE HANDBOOKS ARE JSX, SO THEY ARE READ THROUGH A BUNDLE.
 *
 * This suite runs in the unit project, whose React is the react-server build
 * with no JSX runtime a test can import. That is why `render-client.ts`
 * exists, and why the staff manual's tests and the copilot's manual-search
 * test both go through it. One bundle here builds every handbook, renders each
 * to HTML, and hands back the index, the passages and the flattened documents
 * as JSON. Eighteen separate bundles of the whole documentation kit would be
 * minutes of esbuild for one assertion, so there is exactly one.
 */
let built: Built | null = null;

async function build(): Promise<Built> {
  if (built) return built;
  const json = await renderClient(`
    import { renderToStaticMarkup } from "react-dom/server";
    import { PositionHandbookView } from "@/app/admin/handbook/position/PositionHandbookView";
    import { STAFF_POSITIONS } from "@/lib/admin/staff-positions";
    import {
      POSITION_HANDBOOK_INDEX,
      POSITION_HANDBOOK_UPDATED,
      positionHandbookDocument,
      positionHandbookPassages,
    } from "@/lib/admin/position-handbook";
    function everything() {
      const pages = {};
      const passages = {};
      const documents = {};
      for (const position of STAFF_POSITIONS) {
        pages[position] = renderToStaticMarkup(<PositionHandbookView position={position} own canReadEveryPosition />);
        passages[position] = positionHandbookPassages(position);
        documents[position] = positionHandbookDocument(position);
      }
      return { updated: POSITION_HANDBOOK_UPDATED, index: POSITION_HANDBOOK_INDEX, pages, passages, documents };
    }
    export const html = () => JSON.stringify(everything());
  `);
  built = JSON.parse(json) as Built;
  return built;
}

const BUNDLE_BUDGET = 240_000;

describe("the position handbooks", () => {
  it("gives every named position exactly one handbook, and names no position that does not exist", async () => {
    const all = await build();
    expect(all.index.map((entry) => entry.position)).toEqual([...STAFF_POSITIONS]);
    expect(Object.keys(all.documents).sort()).toEqual([...STAFF_POSITIONS].sort());
    for (const entry of all.index) {
      expect(STAFF_POSITIONS).toContain(entry.position);
      expect(entry.title).toBe(JOB_DESCRIPTIONS[entry.position].title);
      expect(entry.summary).toBe(JOB_DESCRIPTIONS[entry.position].summary);
      expect(entry.route).toBe(`/admin/handbook/position/${entry.position}`);
      expect(served(entry.route), entry.route).toBe(true);
    }
  }, BUNDLE_BUDGET);

  it("gives every handbook at least eight sections, each with its own anchor", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      const ids = all.documents[position]!.sections.map((section) => section.id);
      expect(ids.length, position).toBeGreaterThanOrEqual(8);
      expect(new Set(ids).size, position).toBe(ids.length);
      for (const id of ids) expect(id, position).toMatch(/^[a-z0-9-]+$/);
      expect(all.index.find((entry) => entry.position === position)!.sections).toBe(ids.length);
    }
  }, BUNDLE_BUDGET);

  it("draws its access area names from the console's own labels, so a handbook cannot drift from them", () => {
    /* The handbooks stay client-safe by reading the manual's client-safe copy
       of the labels. That copy is only safe while it is identical. */
    expect(MANUAL_AREA_LABEL).toEqual(STAFF_SCOPE_LABEL);
  });

  it("names every access area its position holds, with the console's own label", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      const text = textOf(all.pages[position]!);
      for (const scope of JOB_DESCRIPTIONS[position].scopes) {
        expect(text, `${position} must name ${scope}`).toContain(STAFF_SCOPE_LABEL[scope]);
      }
    }
  }, BUNDLE_BUDGET);

  it("lists no access area its position does not hold", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      const held = JOB_DESCRIPTIONS[position].scopes.map((scope) => STAFF_SCOPE_LABEL[scope]);
      const text = textOf(all.pages[position]!);
      /* The sentence that lists the areas a position holds is printed twice,
         in "What this job is for" and over the desk table, and both are built
         from the position's own scopes. So the list has to be exactly them. */
      const listed = [...text.matchAll(/Your access areas? (?:are|is) ([^.]+)\./g)].map((match) => match[1]!.trim());
      expect(listed.length, position).toBeGreaterThan(0);
      /* Take the areas it does hold out of the sentence, longest name first
         so "Reports and moderation" goes before "Reports". What is left must
         be separators: any word still standing is an area the handbook claims
         and the position does not have. */
      const names = [...held].sort((a, b) => b.length - a.length);
      for (const sentence of listed) {
        let rest = sentence;
        for (const name of names) rest = rest.split(name).join(" ");
        expect(rest.replace(/[\s,]|and\b/g, ""), `${position} lists more than ${held.join(", ")}`).toBe("");
      }
    }
  }, BUNDLE_BUDGET);

  it("reads within the founder's wording rules and links only to pages the app serves", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      const html = all.pages[position]!;
      const text = textOf(html);
      expect(text.length, position).toBeGreaterThan(8_000);

      /* No em or en dash anywhere a reader can see. */
      expect(text, position).not.toMatch(
        new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
      );
      /* Nothing that promises a date nobody can keep, and never "not live". */
      expect(firstBannedPhrase(text, [...SCHEDULE_PROMISES, ...BANNED_EVERYWHERE]), position).toBeNull();
      /* No unbacked "safe", "secure", "protected" or "checked" of our own. */
      expect(unbackedClaim(withoutJobDescriptions(text)), position).toBeNull();
      /* One contact address, and only that one. */
      for (const email of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(email, position).toBe(CONTACT_EMAIL);
      /* The Guarantee appears only as history. */
      if (/Guarantee/.test(text)) expect(text, position).toMatch(/retired/);
      /* No invented phone number, in any Nigerian form. */
      expect(text, position).not.toMatch(/\+?234[\s-]?\d|\b0[789]0\d[\s-]?\d{3}[\s-]?\d{4}\b/);

      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]!);
      expect(hrefs.length, position).toBeGreaterThan(5);
      expect(
        hrefs.filter((href) => href.startsWith("/") && !served(href)),
        position,
      ).toEqual([]);
    }
  }, BUNDLE_BUDGET);

  it("says at the top which position the handbook is for, and offers both ways to save it", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      const html = all.pages[position]!;
      expect(textOf(html), position).toContain(`This handbook is for the ${JOB_DESCRIPTIONS[position].title}.`);
      expect(html, position).toContain('data-handbook-print=""');
      expect(html, position).toContain('data-testid="handbook-save-pdf"');
      expect(html, position).toContain('data-testid="handbook-save-file"');
      expect(textOf(html), position).toContain("Save as PDF");
      expect(textOf(html), position).toContain("Save as a file");
    }
  }, BUNDLE_BUDGET);

  it("leaves the out of hours contact and the rota for the founder to name", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      expect(textOf(all.pages[position]!), position).toContain("To be named by the founder");
    }
  }, BUNDLE_BUDGET);

  it("says that what is not open is today's position, and never when it will open", async () => {
    const all = await build();
    /* The founder, 15 November 2026: where a handbook says a feature is
       switched off or not open, it has to say that this is how it stands
       today, that it is read against the code often and changes, and that the
       live answer is the screen itself. And no handbook anywhere may name a
       date by which anything will open. */
    let withNote = 0;
    for (const position of STAFF_POSITIONS) {
      const text = textOf(all.pages[position]!);
      /* Anything that states today's product position carries the note. */
      if (/is not open on Vallo|switched off/.test(text)) {
        expect(text, position).toContain("How it stands today");
      }
      if (text.includes("How it stands today")) {
        withNote += 1;
        expect(text, position).toContain("That is where it stands today, 15 November 2026.");
        expect(text, position).toContain("The screen itself is the live answer, never this handbook");
      }
      /* Never a date by which something will open or be ready. */
      expect(text, position).not.toMatch(
        /\b(?:by|from|in) (?:the end of |early |mid |late )?(?:January|February|March|April|May|June|July|August|September|October|November|December|Q[1-4]|20\d\d)\b(?![^.]{0,40}\b(?:was|were|retired|added|read)\b)/,
      );
      expect(firstBannedPhrase(text, SCHEDULE_PROMISES), position).toBeNull();
    }
    /* The rule has to be exercised, not merely available. */
    expect(withNote).toBeGreaterThanOrEqual(6);
  }, BUNDLE_BUDGET);
});

describe("what a copilot reads", () => {
  it("gives every position passages with unique ids and real text", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      const passages = all.passages[position]!;
      expect(passages.length, position).toBeGreaterThanOrEqual(9);
      expect(new Set(passages.map((passage) => passage.id)).size, position).toBe(passages.length);
      for (const passage of passages) {
        expect(passage.title, position).toContain(JOB_DESCRIPTIONS[position].title);
        expect(passage.text.length, `${position}#${passage.id}`).toBeGreaterThan(80);
        /* Flattened prose, not markup, and tidied where JSX left a space
           before a full stop. */
        expect(passage.text, passage.id).not.toMatch(/[<>]/);
        expect(passage.text, passage.id).not.toMatch(/ \./);
      }
      /* One passage per section, after the overview, in the page's order. */
      expect(passages.slice(1).map((passage) => passage.id)).toEqual(
        all.documents[position]!.sections.map((section) => section.id),
      );
    }
  }, BUNDLE_BUDGET);

  it("carries the real sentences, flattened from the same words the page renders", async () => {
    const all = await build();
    const moderator = all.passages.moderator!;
    const find = (id: string) => moderator.find((passage) => passage.id === id);

    expect(find("your-desks")!.text).toContain("Reports and moderation");
    expect(find("the-work")!.text).toContain("Decide a report");
    expect(find("the-work")!.text).toContain("Your name goes on it so a colleague does not work it too.");
    expect(find("money-wording")!.text).toContain("Vallo does not hold customer funds.");
    expect(find("escalation")!.text).toContain("ESC-000123");
    expect(find("your-copilot")!.text).toContain("I never move money");

    /* Every position's own purpose, and its job description, survive. */
    for (const position of STAFF_POSITIONS) {
      const purpose = all.passages[position]!.find((passage) => passage.id === "what-this-job-is-for");
      expect(purpose, position).toBeTruthy();
      expect(purpose!.text, position).toContain(JOB_DESCRIPTIONS[position].summary);
      for (const point of JOB_DESCRIPTIONS[position].responsibilities) {
        expect(purpose!.text, `${position} responsibility`).toContain(point);
      }
    }
  }, BUNDLE_BUDGET);
});

describe("saving a handbook as a file", () => {
  it("builds Markdown with every section heading, in order, and the words under it", async () => {
    const all = await build();
    for (const position of STAFF_POSITIONS) {
      const document = all.documents[position]!;
      const markdown = handbookMarkdown(document);
      expect(markdown).toContain(`# Vallo staff handbook: ${JOB_DESCRIPTIONS[position].title}`);
      expect(markdown).toContain(`Read against the console on ${all.updated}`);
      expect(markdown).toContain(`/admin/handbook/position/${position}`);
      document.sections.forEach((section, index) => {
        expect(markdown, `${position} heading ${section.id}`).toContain(`## ${index + 1}. ${section.title}`);
        expect(markdown, `${position} anchor ${section.id}`).toContain(`#${section.id}`);
      });
      /* The words are in the file, not only the headings. */
      expect(markdown.length, position).toBeGreaterThan(20_000);
      expect(markdown, position).not.toMatch(/[<>]/);
    }
  }, BUNDLE_BUDGET);

  it("names the file for the position and the day it was made", async () => {
    const all = await build();
    const bd = all.documents.business_development_executive!;
    expect(handbookFileName(bd, "2026-11-15")).toBe("vallo-handbook-business-development-director-2026-11-15.md");
    expect(handbookFileName(bd)).toBe(`vallo-handbook-business-development-director-${all.updated}.md`);
    for (const position of STAFF_POSITIONS) {
      expect(handbookFileName(all.documents[position]!, "2026-12-01"), position).toMatch(
        /^vallo-handbook-[a-z0-9-]+-2026-12-01\.md$/,
      );
    }
  }, BUNDLE_BUDGET);
});
