/**
 * Turns `consistency-sweep.mjs`'s JSON into the audit document's tables, and
 * decides for each measured value whether it matches the rule.
 *
 * THE RULES IT CHECKS, and where each one is written down:
 *
 *   back size      44 by 44 CSS px                 docs/BACK_NAVIGATION.md
 *   back place     top left of the header          docs/BACK_NAVIGATION.md
 *   back count     one per screen                  docs/BACK_NAVIGATION.md
 *   card radius    18px, the card tier             tokens.css --nf-radius-card
 *   overflow       scrollWidth equals clientWidth  RESPONSIVE_RESEARCH 2
 *   targets        44 by 44 on touch               RESPONSIVE_RESEARCH 7
 *                  (judged on the touch pass only: the narrow width runs
 *                  with a touch screen, the wide one with a mouse)
 *
 * `--md` prints the document's tables; without it, a summary.
 */
import { readFileSync } from "node:fs";

const file = process.argv.find((a) => a.endsWith(".json")) ?? "consistency-sweep.json";
const md = process.argv.includes("--md");
const { rows, failures } = JSON.parse(readFileSync(file, "utf8"));

const CARD_RADIUS = 18;
/** A surface that wears the card's material but is not a card. Name and reason. */
const CARD_EXEMPT = [
  /* A place type, a cancellation policy, a price band: a control carrying
     text, so the control corner, stated in `app/css/catalogue.css`. */
  "nf-stays-tile",
];
/* The gap under a large title, as the shared frame draws it. Measured from
   the frame's own pages rather than asserted, so the rule is what the
   majority of framed pages actually do; an outlier is a page that differs
   from its own system. */
/*
 * EVERY ROW THAT IS A REAL PAGE, headed or not. The first version of this
 * filter also required `r.header`, which silently dropped 24 of 108 live
 * rows: a page with no h1 and no frame header has no gap to judge, but it
 * still has a document that can scroll sideways and controls that can be
 * painted under 44, and those were going unjudged. The gap rule below is
 * guarded on `kind === "frame"`, so a headless row simply has no gap verdict.
 */
const measured = rows.filter((r) => !r.needsSession);
const gapsByWidth = {};
for (const row of measured.filter((r) => r.header?.kind === "frame" && r.headerGap !== null)) {
  (gapsByWidth[row.width] ??= []).push(row.headerGap);
}
const mode = (list) => {
  const counts = new Map();
  for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};
const GAP = Object.fromEntries(Object.entries(gapsByWidth).map(([w, list]) => [w, mode(list)]));

function verdict(row) {
  const out = [];
  if (row.overflow > 0) out.push(`sideways scroll ${row.overflow}px`);
  if (row.back.count > 1) out.push(`${row.back.count} back controls`);
  if (row.back.count === 1) {
    const b = row.back.box;
    if (b.w < 43.5 || b.h < 43.5) out.push(`back ${b.w} by ${b.h}`);
    if (row.header && b.y > row.header.box.y + row.header.box.h + 8) out.push("back below the header");
  }
  /*
   * EVERY CARD on the page, against the card tier. 0 is a square surface
   * (a full-bleed band) and is not an off-tier corner.
   *
   * A CLASS THAT IS WEARING THE CARD'S MATERIAL IS NOT ALWAYS A CARD, and
   * one case is written down in the stylesheet rather than guessed at here:
   * `.nf-stays-tile` is a place type or a cancellation policy, a CONTROL you
   * pick, and `app/css/catalogue.css` states the shape law it follows ("it
   * carries text, so `--nf-radius-control`") above the rule that draws it.
   * It carries `.nf-panel--card` for the shared fill and edge, not for the
   * corner. An exemption is listed by name with its reason so it can be
   * argued with; anything not on this list is reported.
   */
  for (const card of row.cardRadii ?? (row.cardRadius === null ? [] : [{ r: row.cardRadius, cls: "" }])) {
    if (card.r === 0 || Math.abs(card.r - CARD_RADIUS) <= 0.6) continue;
    if (CARD_EXEMPT.some((name) => card.cls.includes(name))) continue;
    out.push(`card radius ${card.r}${card.cls ? ` on \`${card.cls.split(" ").pop()}\`` : ""}`);
  }
  /*
   * THE 44PX RULE IS A TOUCH RULE, so it is a verdict only on the pass that
   * had a touch screen. A 36px row in a footer is right for a mouse and the
   * product says so in a media query; counting it as a failure at 1440 would
   * be reporting a deliberate decision as a defect. The number is still
   * recorded at both widths, it is just not held against the wide one.
   */
  if (row.smallCount > 0 && row.pointer !== "fine") out.push(`${row.smallCount} under 44`);
  const want = GAP[row.width];
  if (row.header?.kind === "frame" && want !== null && row.headerGap !== null && Math.abs(row.headerGap - want) > 8) {
    out.push(`header gap ${row.headerGap} (system ${want})`);
  }
  return out;
}

const scored = measured.map((row) => ({ row, issues: verdict(row) }));

if (!md) {
  const total = rows.length;
  const session = rows.filter((r) => r.needsSession).length;
  console.log(`measured ${measured.length} of ${total} loads (${session} need a session, ${failures.length} failed)`);
  const tally = new Map();
  for (const { issues } of scored) for (const issue of issues) {
    const key = issue.replace(/\d+(\.\d+)?/g, "N");
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  console.log("\nby kind:");
  for (const [k, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
  console.log(`\nsystem header gap: ${JSON.stringify(GAP)}`);
  console.log(`clean rows: ${scored.filter((s) => s.issues.length === 0).length}`);
  const worst = [...scored].sort((a, b) => b.issues.length - a.issues.length).slice(0, 20);
  console.log("\nworst rows:");
  for (const { row, issues } of worst) {
    console.log(`  ${row.route} ${row.width} ${row.theme}: ${issues.join("; ")}`);
  }
  process.exit(0);
}

/* The document's table. One row per route per width; the theme pass is folded
   in, because a value that differs between themes is itself a finding and is
   called out in the last column rather than doubling every row. */
const byRouteWidth = new Map();
for (const { row, issues } of scored) {
  const key = `${row.route}|${row.width}`;
  const seen = byRouteWidth.get(key);
  if (!seen) byRouteWidth.set(key, { row, issues, themes: [row.theme] });
  else {
    seen.themes.push(row.theme);
    /* Keep the union of what the two themes showed. */
    for (const issue of issues) if (!seen.issues.includes(issue)) seen.issues.push(`${issue} (${row.theme})`);
  }
}

console.log("| Route | W | Header | Back (x,y,w,h) | Primary y | Gap | Card r | L/E | Overflow | Under 44 | Matches the rule |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
for (const { row, issues } of [...byRouteWidth.values()].sort((a, b) =>
  a.row.route === b.row.route ? a.row.width - b.row.width : a.row.route < b.row.route ? -1 : 1,
)) {
  const h = row.header;
  const header = h ? `${h.kind}${h.hasSubtitle ? "+sub" : ""}${h.hasActions ? "+act" : ""}` : "none";
  const back = row.back.count === 0 ? "none" : `${row.back.box.x},${row.back.box.y},${row.back.box.w},${row.back.box.h}`;
  const states = `${row.states.loading ? "L" : "-"}${row.states.error ? "E" : "-"}`;
  /* A route that sent the browser somewhere else was NOT measured at its own
     address, and the table must not imply it was. The address actually
     rendered is printed beside it. */
  const where = row.redirected ? `\`${row.route}\`<br>to \`${row.finalUrl}\`` : `\`${row.route}\``;
  console.log(
    `| ${where} | ${row.width} | ${header} | ${back} | ${row.primary ? row.primary.box.y : "none"} | ` +
      `${row.headerGap ?? "-"} | ${row.cardRadius ?? "-"} | ${states} | ${row.overflow} | ${row.smallCount} | ` +
      `${issues.length === 0 ? "yes" : issues.join("; ")} |`,
  );
}
