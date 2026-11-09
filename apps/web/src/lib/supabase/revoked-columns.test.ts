import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * DB-10 STEP 2 AND NEW-A4-01 STEP 2 CAN ONLY GO LIVE ONCE NO READ NAMES WHAT THEY TAKE AWAY.
 *
 * PostgREST refuses a whole read when one named column is not granted, so a
 * select that names a revoked column does not lose a field, it loses the page:
 * on 24 September a listing read naming `ownership_verified_at`,
 * `mandate_verified_at`, `latitude` and `longitude` answered 403 signed in and
 * 401 signed out within two minutes of the step-2 grants, and the grants were
 * reverted (20260924071045).
 *
 * The revoked columns are read from the step-2 migrations themselves, never
 * restated here: the newest file named `<14 digits>_db10_step2_*.sql` and
 * `<14 digits>_new_a4_01_step2_*.sql` in supabase/migrations or its pending/
 * folder, so a re-applied step 2 must keep those names. Every select on
 * listings, businesses, accommodations and catalogue_entries in the app is
 * checked, and so is any of those tables embedded in a resolved select on
 * another table:
 *   - through a caller's own client, it names no column step 2 takes from
 *     `authenticated`, and it is never `*` (an empty `.select()` is `*`);
 *   - a select naming the exact point (latitude, longitude, location) goes
 *     through `pointSelect` or `withPublicPoint`, so a signed-out reader asks
 *     for the public twins, unless it runs in a function only a signed-in
 *     member reaches (SIGNED_IN_ONLY, each with its reason).
 *
 * IT FAILS CLOSED. A select it cannot read as text is an offence, not a skip:
 * a constant built by a function call, an imported constant, a template with
 * `${}` or a variable. The one way through is EVALUATED below, which imports
 * the real value so the test checks what PostgREST is actually sent.
 *
 * An admin client is skipped by the name of the receiver (`admin`,
 * `service...`) or by living under lib/admin or app/admin: the service role
 * reads every column. That trusts the name, so a service client must be called
 * one.
 */

const WEB = process.cwd();
const REPO = join(WEB, "..", "..");
const SRC = join(WEB, "src");
const MIGRATIONS = join(REPO, "supabase", "migrations");

const TABLES = ["listings", "businesses", "accommodations", "catalogue_entries"] as const;
type Table = (typeof TABLES)[number];

/** Functions whose selects only a signed-in member ever runs, so `anon`'s point grants do not apply. */
const SIGNED_IN_ONLY: Record<string, string> = {
  "lib/host/queries.ts#loadMyHostDraft": "returns emptyHostDraft() unless session.state is signed-in",
  "lib/saved/queries.ts#getSavedPlaces": "returns [] unless session.state is signed-in",
};

/** Computed or imported selects, with the real value PostgREST is sent. */
async function evaluated(): Promise<Record<string, string>> {
  const agentQueries = await import("../agent/listings-queries");
  const canary = await import("../ops/catalogue-canary");
  /* The listing answers kept in their own columns (V-28, V-66, V-68), read
     by the wizard and by the repository through imported constants. */
  const compound = await import("../listings/compound");
  const service = await import("../listings/service");
  const unit = await import("../listings/unit-shape");
  /* The public listing-card columns the Circle post composer and the shortlist
     read through one shared constant (`POST_LISTING_COLUMNS`). */
  const postListing = await import("../features/post-listing/model");
  return {
    "lib/agent/listings-queries.ts:LISTING_PUBLIC_SELECT": agentQueries.LISTING_PUBLIC_SELECT,
    "lib/ops/catalogue-canary.ts:CANARY_CARD_SELECT": canary.CANARY_CARD_SELECT,
    "lib/agent/listings-queries.ts:COMPOUND_COLUMNS": compound.COMPOUND_COLUMNS,
    "lib/agent/listings-queries.ts:SERVICE_COLUMNS": service.SERVICE_COLUMNS,
    "lib/agent/listings-queries.ts:UNIT_COLUMNS": unit.UNIT_COLUMNS,
    "lib/listings/supabase-repository.ts:COMPOUND_BY_ID_COLUMNS": compound.COMPOUND_BY_ID_COLUMNS,
    "lib/listings/supabase-repository.ts:SERVICE_BY_ID_COLUMNS": service.SERVICE_BY_ID_COLUMNS,
    "lib/listings/supabase-repository.ts:UNIT_BY_ID_COLUMNS": unit.UNIT_BY_ID_COLUMNS,
    "lib/features/post-listing/actions.ts:POST_LISTING_COLUMNS": postListing.POST_LISTING_COLUMNS,
    "lib/social/posts-queries.ts:POST_LISTING_COLUMNS": postListing.POST_LISTING_COLUMNS,
  };
}

/* ------------------------------------------------------------ the step-2 lists */

/** The newest step-2 file of that name, applied or still pending. */
function migrationText(pattern: RegExp): string {
  const dirs = [MIGRATIONS, join(MIGRATIONS, "pending")];
  const files = dirs
    .flatMap((dir) => readdirSync(dir).filter((name) => pattern.test(name)).map((name) => ({ dir, name })))
    .sort((a, b) => a.name.localeCompare(b.name));
  const latest = files.at(-1);
  if (!latest) throw new Error(`no migration matching ${pattern}`);
  return readFileSync(join(latest.dir, latest.name), "utf8");
}

/** Column lists read out of `('<table>', array['a', 'b', ...])` rows. */
function revokedFromAuthenticated(): Map<Table, Set<string>> {
  const sql = migrationText(/^\d{14}_db10_step2_.*\.sql$/);
  const out = new Map<Table, Set<string>>();
  for (const row of sql.matchAll(/\(\s*'(\w+)'\s*,\s*array\s*\[([^\]]*)\]/g)) {
    const table = row[1] as Table;
    if (!TABLES.includes(table)) continue;
    out.set(table, new Set([...row[2]!.matchAll(/'(\w+)'/g)].map((m) => m[1]!)));
  }
  return out;
}

function revokedFromAnon(): { tables: Set<string>; columns: Set<string> } {
  const sql = migrationText(/^\d{14}_new_a4_01_step2_.*\.sql$/);
  const tables = sql.match(/array\s*\[\s*('listings'[^\]]*)\]/);
  const columns = sql.match(/not in\s*\(([^)]*)\)/);
  if (!tables || !columns) throw new Error("could not read the anon revoke out of the NEW-A4-01 step-2 migration");
  return {
    tables: new Set([...tables[1]!.matchAll(/'(\w+)'/g)].map((m) => m[1]!)),
    columns: new Set([...columns[1]!.matchAll(/'(\w+)'/g)].map((m) => m[1]!)),
  };
}

/* ------------------------------------------------------------ reading a select */

/** The text between a "(" at `start - 1` and its matching ")". */
function balanced(text: string, start: number): string {
  let depth = 1;
  let i = start;
  while (i < text.length && depth > 0) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
    i += 1;
  }
  return text.slice(start, i - 1);
}

/** Split call arguments at top-level commas (outside brackets and quotes). */
function topLevelArgs(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const ch of args) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) depth -= 1;
    else if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const PLAIN_LITERAL = /^(?:`([^`$]*)`|"([^"]*)"|'([^']*)')$/;

/** A plain literal, or literals joined with `+`; null for anything else. */
function literalValue(expr: string): string | null {
  const parts = expr.split(/\s*\+\s*/).map((part) => part.trim());
  const values: string[] = [];
  for (const part of parts) {
    const m = part.match(PLAIN_LITERAL);
    if (!m) return null;
    values.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return values.join("");
}

export type Resolution = { text: string; publicPoint: boolean } | { unresolved: string };

/**
 * The text a select call hands PostgREST, or why it cannot be read.
 * `select(X)`, `select(await pointSelect(c, X))`, `select(withPublicPoint(X))`,
 * where X is a plain literal, a same-file constant built only from literals,
 * or an EVALUATED key.
 */
export function resolveSelect(args: string, file: string, rel: string, known: Record<string, string>): Resolution {
  const first = topLevelArgs(args)[0] ?? "";
  if (first === "") return { text: "*", publicPoint: false };
  let expr = first.replace(/^await\s+/, "");
  let publicPoint = false;
  const wrapped = expr.match(/^(pointSelect|withPublicPoint)\(([\s\S]*)\)$/);
  if (wrapped) {
    publicPoint = true;
    expr = topLevelArgs(wrapped[2]!).at(-1) ?? "";
  }
  const literal = literalValue(expr);
  if (literal !== null) return { text: literal, publicPoint };
  if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
    const key = `${rel}:${expr}`;
    if (key in known) return { text: known[key]!, publicPoint: publicPoint || /latitude_public/.test(known[key]!) };
    const def = file.match(new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${expr}\\s*(?::[^=]+)?=\\s*([\\s\\S]*?);\\s*\\n`));
    if (!def) return { unresolved: `${expr} is not a constant of this file (imported or a variable)` };
    const value = literalValue(def[1]!.trim());
    if (value === null) return { unresolved: `${expr} is computed (not only literals); add it to EVALUATED` };
    return { text: value, publicPoint };
  }
  return { unresolved: `select argument is not a literal or a constant: ${expr.slice(0, 60)}` };
}

/** Top-level column names of a PostgREST select (aliases, casts and hints dropped). */
export function topLevelColumns(select: string): string[] {
  let flat = "";
  let depth = 0;
  for (const ch of select) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (depth === 0) flat += ch;
  }
  return flat
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(":").filter(Boolean).pop()!.split("!")[0]!.split("::")[0]!.trim())
    .filter((name) => !/\s/.test(name));
}

/** Relations on the four tables embedded in a select, with their own column lists. */
export function embedded(select: string): { table: Table; columns: string[] }[] {
  const out: { table: Table; columns: string[] }[] = [];
  const re = new RegExp(`\\b(${TABLES.join("|")})\\s*(?:!\\w+)?\\s*\\(`, "g");
  for (const m of select.matchAll(re)) {
    out.push({ table: m[1] as Table, columns: topLevelColumns(balanced(select, m.index! + m[0].length)) });
  }
  return out;
}

/** The point columns withPublicPoint rewrites to their public twins. */
const REWRITTEN_POINT = new Set(["latitude", "longitude"]);

/** Check one select on one table. */
export function offences(
  where: string,
  table: Table,
  columns: string[],
  publicPoint: boolean,
  signedInOnly: boolean,
  authRevoked: Map<Table, Set<string>>,
  anon: { tables: Set<string>; columns: Set<string> },
): string[] {
  const found: string[] = [];
  const revoked = authRevoked.get(table) ?? new Set<string>();
  const anonReads = anon.tables.has(table) && !publicPoint && !signedInOnly;
  for (const column of columns) {
    /* pointSelect / withPublicPoint send `latitude:latitude_public` and
       `longitude:longitude_public` for every caller (29 September), so the
       exact columns never reach PostgREST. `location` is not rewritten. */
    if (publicPoint && REWRITTEN_POINT.has(column)) continue;
    if (column === "*") {
      if (authRevoked.has(table) || anonReads) found.push(`${where} ${table}: select * (step 2 revokes columns of this table)`);
    } else if (revoked.has(column)) {
      found.push(`${where} ${table}.${column}: revoked from authenticated`);
    } else if (anonReads && anon.columns.has(column)) {
      found.push(`${where} ${table}.${column}: revoked from anon; use pointSelect/withPublicPoint`);
    }
  }
  return found;
}

/* ------------------------------------------------------------ the sweep */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && entry.name !== "database.types.ts") {
      out.push(path);
    }
  }
  return out;
}

function isAdminCall(before: string, rel: string): boolean {
  if (/(^|\/)(lib|app)\/admin\//.test(rel)) return true;
  const receiver = before.match(/([\w.]+(?:\(\))?)\s*$/)?.[1] ?? "";
  return /admin|service/i.test(receiver);
}

function enclosingFunction(file: string, at: number): string {
  const names = [...file.slice(0, at).matchAll(/(?:^|\s)(?:async\s+)?function\s+(\w+)/g)];
  return names.at(-1)?.[1] ?? "";
}

async function scan(): Promise<string[]> {
  const authRevoked = revokedFromAuthenticated();
  const anon = revokedFromAnon();
  const known = await evaluated();
  const found: string[] = [];
  for (const path of sourceFiles(SRC)) {
    const rel = relative(SRC, path);
    const file = readFileSync(path, "utf8");
    for (const call of file.matchAll(/\.select\(/g)) {
      const at = call.index!;
      const args = balanced(file, at + call[0].length);
      const chainStart = Math.max(file.lastIndexOf(";", at), file.lastIndexOf("{", at), 0);
      const chain = file.slice(chainStart, at);
      const from = chain.match(/\.from\(\s*["'](\w+)["']\s*\)/);
      const table = from?.[1] as Table | undefined;
      const onTable = table !== undefined && TABLES.includes(table);
      const fromAt = from ? chainStart + from.index! : at;
      if (isAdminCall(file.slice(Math.max(0, fromAt - 160), fromAt), rel)) continue;
      const where = `${rel}:${file.slice(0, at).split("\n").length}`;
      const resolution = resolveSelect(args, file, rel, known);
      if ("unresolved" in resolution) {
        if (onTable) found.push(`${where} ${table}: cannot be read (${resolution.unresolved})`);
        continue;
      }
      const signedInOnly = `${rel}#${enclosingFunction(file, at)}` in SIGNED_IN_ONLY;
      if (onTable) {
        found.push(
          ...offences(where, table, topLevelColumns(resolution.text), resolution.publicPoint, signedInOnly, authRevoked, anon),
        );
      }
      for (const inner of embedded(resolution.text)) {
        found.push(...offences(where, inner.table, inner.columns, resolution.publicPoint, signedInOnly, authRevoked, anon));
      }
    }
  }
  return found;
}

/* ------------------------------------------------------------ tests */

describe("no own-client read names a column the step-2 grants take away", () => {
  it("reads the revoked columns out of the step-2 migrations", () => {
    const auth = revokedFromAuthenticated();
    /* 29 September: step 2 again. Members lose the private columns AND the
       exact point; the "checked" marks stay public on purpose. */
    expect(auth.get("listings")).toContain("address");
    expect(auth.get("listings")).toContain("review_notes");
    expect(auth.get("listings")).toContain("latitude");
    expect(auth.get("listings")).not.toContain("ownership_verified_at");
    expect(auth.get("businesses")).toContain("verification_tier");
    expect(auth.get("businesses")).toContain("tin");
    expect(auth.get("accommodations")).toContain("address");
    expect(auth.get("catalogue_entries")).toContain("location");
    const anon = revokedFromAnon();
    expect([...anon.columns].sort()).toEqual(["latitude", "location", "longitude"]);
    expect(anon.tables).toContain("listings");
  });

  it("flags the select that broke on 24 September (the instrument works)", () => {
    const auth = revokedFromAuthenticated();
    const anon = revokedFromAnon();
    const broke = "id,title,latitude,longitude,ownership_verified_at,mandate_verified_at,listing_photos(storage_path)";
    const found = offences("fixture", "listings", topLevelColumns(broke), false, false, auth, anon).join("\n");
    expect(found).toMatch(/latitude: revoked from authenticated/);
    expect(found).toMatch(/longitude: revoked from authenticated/);
    /* The exact point through pointSelect is the public twin; location is not rewritten. */
    expect(offences("fixture", "listings", topLevelColumns("id, latitude, longitude"), true, false, auth, anon)).toEqual([]);
    expect(offences("fixture", "listings", topLevelColumns("id, location"), true, false, auth, anon)).toHaveLength(1);
    const nested = embedded("id, listings!inner(id, address), status");
    expect(offences("fixture", nested[0]!.table, nested[0]!.columns, false, false, auth, anon)).toHaveLength(1);
    expect(offences("fixture", "listings", topLevelColumns("id, latitude"), true, false, auth, anon)).toEqual([]);
    expect(offences("fixture", "listings", topLevelColumns("*"), true, true, auth, anon)).toHaveLength(1);
  });

  it("fails closed on every select it cannot read as text", () => {
    const file = [
      'const COMPUTED = withoutColumns(BASE, ["address"]);',
      'const JOINED = "id, " + "title";',
      "const TEMPLATE = `id, ${extra}`;",
    ].join("\n") + "\n";
    const unresolved = (args: string) => "unresolved" in resolveSelect(args, file, "fixture.ts", {});
    expect(unresolved("COMPUTED")).toBe(true);
    expect(unresolved("IMPORTED_SELECT")).toBe(true);
    expect(unresolved("TEMPLATE")).toBe(true);
    expect(unresolved("`id, ${extra}`")).toBe(true);
    expect(unresolved("columns")).toBe(true);
    expect(unresolved("await pointSelect(supabase, COMPUTED)")).toBe(true);
    expect(resolveSelect("JOINED", file, "fixture.ts", {})).toEqual({ text: "id, title", publicPoint: false });
    expect(resolveSelect("", file, "fixture.ts", {})).toEqual({ text: "*", publicPoint: false });
    expect(resolveSelect("COMPUTED", file, "fixture.ts", { "fixture.ts:COMPUTED": "id" })).toEqual({
      text: "id",
      publicPoint: false,
    });
  });

  it("reads the real value of every computed select it lets through", async () => {
    const known = await evaluated();
    for (const [key, value] of Object.entries(known)) {
      expect(value.length, `${key} evaluated to nothing`).toBeGreaterThan(0);
    }
    expect(known["lib/agent/listings-queries.ts:LISTING_PUBLIC_SELECT"]).not.toMatch(/\baddress\b|\blandmark\b|review_notes/);
  });

  it("finds no offending select in the app", async () => {
    expect(await scan()).toEqual([]);
  });
});
