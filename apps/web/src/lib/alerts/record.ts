import "server-only";

import { createAdminClient } from "../supabase/admin";
import type { Database } from "../supabase/database.types";
import { isSupabaseConfigured } from "../supabase/env";
import { reportError } from "../observability/report";
import { pageHuman } from "../ops/page";

/**
 * The one door into `risk_alerts` for anything that is not a human.
 *
 * Webhooks, the reconciliation route and BA's cron jobs all fail in the same
 * shape: a log line nobody is reading at 3am. `risk_alerts` is the table the
 * console already reads on `/admin/alerts` with a badge in the rail, so a row
 * there is the difference between a failure that waits for the next person to
 * open the desk and one that waits for somebody to grep Vercel.
 *
 * NEVER THROWS. A job or a webhook that has already done its work must not
 * turn into a failure because the alert about it could not be written, and
 * the callers here are exactly the code paths where a second failure is most
 * likely (the service key missing, Postgres briefly unreachable). Every
 * failure collapses into `{ ok: false, reason }` and a warn line.
 *
 * NEVER PERSONAL. `detail` is scrubbed before it is written: keys that name a
 * person or a credential are dropped, strings are cut short, nesting is
 * flattened. An alert is read by every admin, so it is a wider audience than
 * the server log, and the vocabulary is references, kobo amounts, opaque ids
 * and machine tokens. Nothing else belongs here (rule 16).
 *
 * THE TABLE IS OLDER THAN THIS CONTRACT. `risk_alerts` has `title`,
 * `description`, `entity_type` and `entity_id`, and a three-value severity.
 * The contract's `kind` becomes the title in words and the first line of the
 * description as the exact token, so `/admin/alerts` can search either; the
 * scrubbed detail follows as compact JSON. `info`, `warning` and `critical`
 * map onto `low`, `medium` and `high`.
 */

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertInput = {
  /** A dotted machine token, e.g. "webhook.signature_invalid" or "cron.hold_sweep". */
  kind: string;
  severity: AlertSeverity;
  /** Anything worth reading beside the alert. Scrubbed before it is stored. */
  detail: Record<string, unknown>;
  /** The record this is about, when there is one: a reference, a job name, a booking id. */
  subjectId?: string;
  /** What kind of record `subjectId` names. Defaults to the first segment of `kind`. */
  subjectKind?: string;
};

export type AlertOutcome =
  | { ok: true; id: string | null; deduplicated: boolean }
  | { ok: false; reason: string };

type DbSeverity = Database["public"]["Enums"]["alert_severity"];

const SEVERITY: Record<AlertSeverity, DbSeverity> = {
  info: "low",
  warning: "medium",
  critical: "high",
};

/**
 * The same open alert, raised again inside this window, is one alert.
 *
 * A webhook that Paystack retries five times, or a cron job that fails on
 * every run for an hour, must not fill the desk with identical rows an
 * operator has to close one by one. Same title, same subject, still open,
 * younger than this: the new one is folded into the old one.
 *
 * It was ten minutes, which folded nothing for a job that runs every
 * fifteen: sanctions-screen opened 411 identical "lists unreadable" rows in
 * four days and buried every other alert on the desk. An alert that is
 * still open is still the news, so a day is the window; once somebody
 * closes it, the next failure opens a fresh one.
 */
/* 26 hours, not 24 (R-04, 7 November 2026): a daily job fires about 24
   hours after its last run, often a few seconds more, so a strict day let
   every run open a fresh copy: "Store: readiness, red" stood at 25 open
   alerts for one unchanged fault. Two spare hours fold a daily repeat into
   the alert already open.

   The window is measured against `last_seen_at`, never `created_at`
   (BR-03, 14 November 2026): a fold refreshes `last_seen_at`, so an open
   alert whose fault keeps repeating stays inside the window for ever and
   stays ONE row. Measured against `created_at`, the open row aged out of
   the window two days after it was opened, so a daily fault folded once and
   then opened a fresh row every other day: "Store: readiness, red" had
   piled up 29 open rows by 14 November with the last-seen column already
   live. A fault that goes quiet for more than the window and then returns
   still opens a fresh row, which is right: that is new news. */
const DEDUP_WINDOW_MS = 26 * 60 * 60 * 1_000;

const MAX_STRING = 200;
const MAX_DESCRIPTION = 2_000;
const MAX_KEYS = 24;

/**
 * Keys that name a person or a credential, dropped whatever their value.
 * Matched as substrings, lower cased, so `customerEmail`, `bank_account` and
 * `x-paystack-signature` all go.
 */
const FORBIDDEN_KEY_PARTS = [
  "email",
  "phone",
  "nin",
  "bvn",
  "account_number",
  "accountnumber",
  "card",
  "pan",
  "cvv",
  "token",
  "secret",
  "signature",
  "password",
  "authorization",
  "body",
  "name",
  "address",
];

function forbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEY_PARTS.some((part) => lower.includes(part));
}

/** Flatten one level, drop the forbidden, cut the long. Never throws. */
export function scrubDetail(detail: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(detail ?? {})) {
    if (kept >= MAX_KEYS) break;
    if (forbiddenKey(key)) continue;
    if (value === null || value === undefined) {
      out[key] = null;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "string") {
      out[key] = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
    } else {
      // Objects, arrays, bigints, functions: a short stand-in rather than a
      // nested bag whose inner keys this scrubber has not looked at.
      let text: string;
      try {
        text = typeof value === "bigint" ? value.toString() : JSON.stringify(value) ?? "";
      } catch {
        text = "[unserialisable]";
      }
      out[key] = text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}...` : text;
    }
    kept += 1;
  }
  return out;
}

/** "webhook.signature_invalid" reads as "Webhook: signature invalid". */
export function alertTitle(kind: string): string {
  const [head, ...rest] = kind.trim().split(".");
  const words = (segment: string) => segment.replace(/[_-]+/g, " ").trim();
  const subject = words(head ?? "");
  const tail = rest.map(words).filter((part) => part.length > 0).join(", ");
  const text = tail.length > 0 ? `${subject}: ${tail}` : subject;
  return text.length === 0 ? "Alert" : text.charAt(0).toUpperCase() + text.slice(1);
}

/** The exact token on the first line, then the scrubbed detail. */
export function alertDescription(kind: string, detail: Record<string, unknown>): string {
  const scrubbed = scrubDetail(detail);
  const json = Object.keys(scrubbed).length > 0 ? JSON.stringify(scrubbed) : "";
  const text = json.length > 0 ? `${kind}\n${json}` : kind;
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION)}...` : text;
}

function hasServiceRole(): boolean {
  return isSupabaseConfigured() && (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length > 0;
}

/**
 * Write one alert. Returns rather than throws, always.
 *
 * `subjectId` is stored as `entity_id` and `subjectKind` (or the first
 * segment of `kind`) as `entity_type`, so an operator can find every alert
 * about one reference or one job from the desk's search.
 */
export async function recordAlert(input: AlertInput): Promise<AlertOutcome> {
  const kind = (input.kind ?? "").trim().slice(0, 120);
  if (kind.length === 0) return { ok: false, reason: "kind_missing" };

  const severity = SEVERITY[input.severity] ?? "medium";
  const title = alertTitle(kind).slice(0, 200);
  const description = alertDescription(kind, input.detail ?? {});
  const entityType = (input.subjectKind ?? kind.split(".")[0] ?? "alert").slice(0, 60);
  const entityId = input.subjectId ? input.subjectId.slice(0, 200) : null;

  if (!hasServiceRole()) {
    console.warn(`[alert] unrecorded severity=${input.severity} kind=${kind} reason=service_role_not_configured`);
    return { ok: false, reason: "service_role_not_configured" };
  }

  try {
    const admin = createAdminClient();

    // Fold a repeat into the open alert it repeats. Best effort: a failed read
    // here simply means one extra row, never a missing one.
    let existingId: string | null = null;
    try {
      let lookup = admin
        .from("risk_alerts")
        .select("id")
        .eq("status", "open")
        .eq("title", title)
        .gte("last_seen_at", new Date(Date.now() - DEDUP_WINDOW_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      lookup = entityId === null ? lookup.is("entity_id", null) : lookup.eq("entity_id", entityId);
      const { data } = await lookup.maybeSingle();
      existingId = data?.id ?? null;
    } catch {
      existingId = null;
    }
    if (existingId) {
      await admin.from("risk_alerts").update({ last_seen_at: new Date().toISOString() }).eq("id", existingId);
      return { ok: true, id: existingId, deduplicated: true };
    }

    const { data, error } = await admin
      .from("risk_alerts")
      .insert({
        severity,
        status: "open",
        title,
        description,
        entity_type: entityType,
        entity_id: entityId,
      })
      .select("id")
      .single();
    if (error) {
      console.warn(`[alert] unrecorded severity=${input.severity} kind=${kind} reason=${error.code ?? "insert_failed"}`);
      if (input.severity === "critical") await escalate(kind, title, description, admin, null);
      return { ok: false, reason: error.message ?? "insert_failed" };
    }
    if (input.severity === "critical") await escalate(kind, title, description, admin, data?.id ?? null);
    return { ok: true, id: data?.id ?? null, deduplicated: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 200) : "threw";
    console.warn(`[alert] unrecorded severity=${input.severity} kind=${kind} reason=${reason}`);
    return { ok: false, reason };
  }
}

/** A critical alert pages a human at most once an hour per title. */
const PAGE_WINDOW_MS = 60 * 60 * 1_000;

/**
 * OPS-03: a critical alert leaves the building. It goes to Sentry (when
 * `SENTRY_DSN` is set, so Sentry's own alert rules apply) and to a person
 * through `lib/ops/page.ts`, unless the same title already paged within the
 * hour. A failure to insert the row still pages: an alert that could not even
 * be written is the one most worth hearing about.
 *
 * Best effort and never throws, like everything in this file.
 */
async function escalate(
  kind: string,
  title: string,
  description: string,
  admin: ReturnType<typeof createAdminClient>,
  newId: string | null,
): Promise<void> {
  try {
    let pagedRecently = false;
    try {
      let recent = admin
        .from("risk_alerts")
        .select("id", { count: "exact", head: true })
        .eq("title", title)
        .gte("created_at", new Date(Date.now() - PAGE_WINDOW_MS).toISOString());
      if (newId) recent = recent.neq("id", newId);
      const { count } = await recent;
      pagedRecently = (count ?? 0) > 0;
    } catch {
      pagedRecently = false;
    }
    await reportError({
      error: new Error(`alert ${kind}`),
      level: "fatal",
      context: { kind: `alert.${kind}`.slice(0, 120) },
    });
    if (!pagedRecently) await pageHuman({ kind, title, body: description });
  } catch {
    /* Escalation is best effort; the row, when it was written, stands. */
  }
}
