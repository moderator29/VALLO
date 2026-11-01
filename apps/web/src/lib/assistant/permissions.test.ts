import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVATION_PERMISSIONS,
  AI_PERMISSIONS,
  AI_PRIVACY_VERSION,
  AI_TERMS_VERSION,
  PERMISSIONS,
  SENSITIVE_PERMISSIONS,
  hasPermission,
  isAiPermission,
} from "./permissions";

/** The migration that holds the database half, applied or still waiting. */
function migrationText(): string {
  const root = join(process.cwd(), "..", "..");
  const dir = join(root, "supabase", "migrations");
  const applied = readdirSync(dir).find((f) => f.endsWith("_ai_assistant_enforcement.sql"));
  const file = applied ? join(dir, applied) : join(root, "docs", "PENDING_ai_assistant_enforcement.sql.txt");
  expect(existsSync(file), "the AI assistant migration must exist, applied or pending").toBe(true);
  return readFileSync(file, "utf8");
}

describe("the assistant's permissions", () => {
  it("are the same eight keys in the app and in the database check constraint", () => {
    const sql = migrationText();
    const check = sql.match(/permission in \(([^)]*)\)/s)?.[1] ?? "";
    const dbKeys = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(dbKeys).toEqual([...AI_PERMISSIONS].sort());
  });

  it("name the same document versions the database accepts", () => {
    const sql = migrationText();
    expect(sql).toContain(`'terms', '${AI_TERMS_VERSION}'`);
    expect(sql).toContain(`'privacy', '${AI_PRIVACY_VERSION}'`);
  });

  it("describe every permission, once, with money kept sensitive and apart from activation", () => {
    expect(PERMISSIONS.map((p) => p.key).sort()).toEqual([...AI_PERMISSIONS].sort());
    expect([...SENSITIVE_PERMISSIONS].sort()).toEqual(["payment_assist", "transactions", "wallet_balance"]);
    for (const key of SENSITIVE_PERMISSIONS) expect(ACTIVATION_PERMISSIONS).not.toContain(key);
    expect(ACTIVATION_PERMISSIONS).toContain("discovery");
  });

  it("say read and act apart: only the three money-touching and booking ones can act", () => {
    const acting = PERMISSIONS.filter((p) => p.kind === "act").map((p) => p.key).sort();
    expect(acting).toEqual(["bookings_viewings", "notifications", "payment_assist"]);
    expect(PERMISSIONS.find((p) => p.key === "transactions")?.kind).toBe("read");
  });

  it("grant nothing when the assistant is off, whatever rows exist", () => {
    expect(hasPermission({ enabled: false, permissions: ["discovery", "transactions"], epoch: 3 }, "transactions")).toBe(false);
    expect(hasPermission({ enabled: true, permissions: ["discovery"], epoch: 1 }, "transactions")).toBe(false);
    expect(hasPermission({ enabled: true, permissions: ["discovery"], epoch: 1 }, "discovery")).toBe(true);
  });

  it("recognise only real keys", () => {
    expect(isAiPermission("wallet_balance")).toBe(true);
    expect(isAiPermission("everything")).toBe(false);
    expect(isAiPermission(null)).toBe(false);
  });

  it("use no em dash and never name the payments partner in the words shown to members", () => {
    const words = JSON.stringify(PERMISSIONS);
    expect(words).not.toContain("—");
  });
});
