/**
 * THE COPILOT'S CHAT HISTORY, AS STORED (founder, 16 November 2026: "there
 * should be chat history, and when I leave and go back my chat history should
 * be there").
 *
 * Pure: what a saved conversation may hold and how it is cleaned on the way
 * in and on the way out. The route (`app/api/admin/copilot/threads`) checks the
 * console door and writes with the person's own session, so the table's
 * owner-only policies decide (`copilot_threads_2026-11-16.sql`).
 *
 * A confirm token is NEVER stored. A card read back from history that was
 * still waiting is shown as expired: it can be asked for again, never pressed.
 */

export const MAX_STORED_TURNS = 80;
export const MAX_TURN_TEXT = 8000;
export const MAX_THREADS_LISTED = 30;

export type StoredProposal = {
  proposal: {
    id: string;
    tool: string;
    label: string;
    summary: string;
    args: Record<string, string | number | boolean | null>;
    mode: "act" | "draft";
    deskHref: string;
    preview?: { heading: string; text: string };
    confirmLabel?: string;
    expiresAt: string;
  };
  status: "pending" | "confirming" | "done" | "failed" | "dismissed" | "expired";
  message?: string;
  href?: string;
};

export type StoredTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposals: StoredProposal[];
  destinations: { label: string; href: string }[];
  /** What the copilot read for this answer, for the steps line and the next questions. */
  tools?: { name: string; label: string }[];
};

export type ThreadSummary = { id: string; title: string; desk: string; updatedAt: string };

const STATUSES = new Set(["pending", "confirming", "done", "failed", "dismissed", "expired"]);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === "string" ? v.slice(0, max) : null);
/** A page inside the console, and nothing else. */
export const isConsolePath = (href: unknown): href is string => typeof href === "string" && /^\/admin(?:[/?#][A-Za-z0-9_\-./?=&%#~+]*)?$/.test(href);

function cleanArgs(raw: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!isObj(raw)) return out;
  for (const [key, value] of Object.entries(raw).slice(0, 12)) {
    if (key.length > 40) continue;
    if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 600);
  }
  return out;
}

function cleanProposal(raw: unknown, { loading }: { loading: boolean }): StoredProposal | null {
  if (!isObj(raw) || !isObj(raw.proposal)) return null;
  const p = raw.proposal;
  const id = str(p.id, 80);
  const label = str(p.label, 200);
  const summary = str(p.summary, 600);
  if (!id || !label || summary === null) return null;
  const deskHref = isConsolePath(p.deskHref) ? p.deskHref : "/admin";
  let status = typeof raw.status === "string" && STATUSES.has(raw.status) ? (raw.status as StoredProposal["status"]) : "expired";
  /* No token comes back from storage, so nothing read back can be pressed. */
  if (loading && (status === "pending" || status === "confirming" || status === "failed")) status = "expired";
  if (!loading && status === "confirming") status = "pending";
  const preview = isObj(p.preview) && typeof p.preview.heading === "string" && typeof p.preview.text === "string" ? { heading: p.preview.heading.slice(0, 120), text: p.preview.text.slice(0, 4000) } : undefined;
  const out: StoredProposal = {
    proposal: {
      id,
      tool: str(p.tool, 80) ?? "",
      label,
      summary,
      args: cleanArgs(p.args),
      mode: p.mode === "draft" ? "draft" : "act",
      deskHref,
      ...(preview ? { preview } : {}),
      ...(typeof p.confirmLabel === "string" ? { confirmLabel: p.confirmLabel.slice(0, 40) } : {}),
      expiresAt: str(p.expiresAt, 40) ?? "",
    },
    status,
  };
  const message = str(raw.message, 400);
  if (message) out.message = message;
  if (isConsolePath(raw.href)) out.href = raw.href;
  return out;
}

/**
 * A conversation cleaned for storage (`loading: false`) or for the screen
 * (`loading: true`). Unknown fields are dropped, every string is capped, only
 * console pages survive as links, and the newest turns are kept.
 */
export function cleanTurns(raw: unknown, { loading = false }: { loading?: boolean } = {}): StoredTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredTurn[] = [];
  for (const t of raw.slice(-MAX_STORED_TURNS)) {
    if (!isObj(t) || (t.role !== "user" && t.role !== "assistant")) continue;
    const text = str(t.text, MAX_TURN_TEXT);
    if (text === null) continue;
    const proposals = Array.isArray(t.proposals) ? t.proposals.map((p) => cleanProposal(p, { loading })).filter((p): p is StoredProposal => p !== null).slice(0, 6) : [];
    const destinations = Array.isArray(t.destinations)
      ? t.destinations
          .filter((d): d is { label: string; href: string } => isObj(d) && typeof d.label === "string" && isConsolePath(d.href))
          .slice(0, 8)
          .map((d) => ({ label: d.label.slice(0, 80), href: d.href }))
      : [];
    const tools = Array.isArray(t.tools)
      ? t.tools
          .filter((x): x is { name: string; label: string } => isObj(x) && typeof x.name === "string" && /^[a-z_]{1,60}$/.test(x.name) && typeof x.label === "string")
          .slice(0, 12)
          .map((x) => ({ name: x.name, label: x.label.slice(0, 80) }))
      : [];
    if (!text && proposals.length === 0) continue;
    out.push({ id: str(t.id, 40) || `s${out.length}`, role: t.role, text, proposals, destinations, ...(tools.length ? { tools } : {}) });
  }
  return out;
}

/** The conversation's name in the history list: the first question, on one line. */
export function threadTitle(turns: readonly StoredTurn[]): string {
  const first = turns.find((t) => t.role === "user" && t.text.trim())?.text ?? "";
  const line = first.replace(/\s+/g, " ").trim();
  if (!line) return "New conversation";
  return line.length > 80 ? `${line.slice(0, 79).trimEnd()}...` : line;
}

/** The desk a conversation was had on, as stored: a short plain key. */
export function cleanDesk(raw: unknown): string {
  return typeof raw === "string" && /^[a-z0-9_ -]{1,60}$/i.test(raw) ? raw : "console";
}

export const isThreadId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
