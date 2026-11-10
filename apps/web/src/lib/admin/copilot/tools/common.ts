import { requireAdmin, type AdminAccess, type StaffScope } from "@/lib/admin/guard";
import type { CopilotViewer, ToolCtx, ToolResult } from "./types";

/**
 * Helpers every tool shares: the access re-check, result capping, ages and
 * the redaction net. Nothing here reads data; the desks' own reads do.
 */

export type AdminDoor = Extract<AdminAccess, { state: "admin" }>;

export function holds(viewer: CopilotViewer, scope: StaffScope): boolean {
  return viewer.isAdmin || viewer.isSuperAdmin || viewer.scopes.includes(scope);
}

export function holdsAny(viewer: CopilotViewer, scopes: readonly StaffScope[]): boolean {
  return scopes.some((scope) => holds(viewer, scope));
}

const REFUSED = "You do not have access to that desk, so I cannot read it. Do not guess; say it is not on their desks.";

/**
 * THE ACCESS RE-CHECK. The route already offered only the tools the viewer
 * holds, but a handler never trusts that: it asks the desk's own guard
 * (`requireAdmin(scope)`) again, and the answer must be the same person.
 */
export async function recheck(
  ctx: ToolCtx,
  scopes: readonly StaffScope[],
): Promise<{ ok: true; door: AdminDoor } | { ok: false; error: string }> {
  for (const scope of scopes) {
    if (!holds(ctx.viewer, scope)) continue;
    let door: AdminAccess;
    try {
      door = await requireAdmin(scope);
    } catch {
      continue;
    }
    if (door.state === "admin" && door.user.id === ctx.viewer.userId) return { ok: true, door };
  }
  return { ok: false, error: REFUSED };
}

export const refused = (): ToolResult => ({ ok: false, error: REFUSED });

export const UNREAD =
  "That read did not return anything just now, so there is no figure to quote. Say so plainly and do not estimate.";
export const unreadable = (what: string): ToolResult => ({ ok: false, error: `${what} could not be read just now. ${UNREAD}` });

export const DEFAULT_LIMIT = 8;
export const MAX_LIMIT = 25;

export function clampLimit(limit: number | undefined, fallback = DEFAULT_LIMIT): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

export type Capped<T> = { total: number; shown: number; more: boolean; items: T[] };

/** Top N of a list with the total and a flag for "more exist". */
export function capList<T>(items: readonly T[], limit: number, total: number = items.length): Capped<T> {
  const shown = items.slice(0, limit);
  return { total, shown: shown.length, more: total > shown.length, items: shown };
}

export function waitingHours(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round(((now - t) / 3_600_000) * 10) / 10);
}

export function oldestFirst<T>(items: readonly T[], at: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => (at(a) ?? "9999").localeCompare(at(b) ?? "9999"));
}

/** Cut a free-text field to a readable length. */
export function clip(text: string | null | undefined, max = 240): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}

/**
 * THE REDACTION NET. Tools pick their fields by name, so this should never
 * fire; it is the second lock. Any key that looks like a secret, a document,
 * an identity number or card data is dropped from whatever a tool returns,
 * and long strings are cut.
 */
const FORBIDDEN_KEY = /(password|passcode|secret|token|api[_-]?key|card|cvv|pan\b|bvn|nin\b|id[_-]?number|idnumber|account[_-]?number|accountnumber|storage[_-]?path|signed[_-]?url|media|back[_-]?media|document[_-]?url|selfie|otp|pin\b)/i;

export function scrub(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return value.length > 1500 ? `${value.slice(0, 1499)}...` : value;
  if (typeof value !== "object") return value;
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => scrub(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    out[key] = scrub(inner, depth + 1);
  }
  return out;
}

/** Only ever a console path: the copilot links to desks, never elsewhere. */
export function adminLink(path: string): string {
  return path.startsWith("/admin") ? path : "/admin";
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
