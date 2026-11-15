import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailConfigured } from "@/lib/email/client";
import { termiiConfig } from "@/lib/phone-otp/termii";
import { canSendAbroad } from "@/lib/phone-otp/transport";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "../guard";
import {
  SETUP_ITEMS,
  orderSetup,
  readConnections,
  readSwitches,
  setupStateFrom,
  type ConnectionReading,
  type SetupItem,
  type SetupReading,
  type SwitchReading,
} from "./setup";

/**
 * THE CONTROL ROOM'S READS (the founder, 15 November 2026). Super admin only.
 *
 * Everything here only looks: which parts of the database are in place, how
 * the main switches stand, which outside services this deployment is set up
 * to reach (presence only, never a value), and what is waiting on the
 * founder. Nothing on this page runs SQL or changes anything; a switch is
 * changed on the Switches desk and SQL is run in the Supabase SQL editor.
 */

type Probe = (item: SetupItem) => Promise<{ code?: string | null; message?: string | null } | null>;

/** One look at each marker, with the service client. A probe that throws is "could not be read". */
export async function readSetup(probe: Probe, items: readonly SetupItem[] = SETUP_ITEMS): Promise<SetupReading[]> {
  const readings = await Promise.all(
    items.map(async (item): Promise<SetupReading> => {
      try {
        return { item, state: setupStateFrom(await probe(item)) };
      } catch {
        return { item, state: "unknown" };
      }
    }),
  );
  return orderSetup(readings);
}

function probeWith(db: SupabaseClient): Probe {
  return async (item) => {
    const { error } = await db
      .from(item.marker.table)
      .select(item.marker.column ?? "*", { head: true, count: "exact" })
      .limit(1);
    return error ? { code: (error as { code?: string }).code ?? null, message: error.message } : null;
  };
}

export type WaitingLine = { key: string; count: number; words: string; href: string };

export type ControlRoom =
  | { state: "forbidden" }
  | { state: "unavailable" }
  | {
      state: "ok";
      setup: SetupReading[];
      switches: SwitchReading[];
      connections: ConnectionReading[];
      waiting: WaitingLine[];
    };

async function countOpen(db: SupabaseClient, table: string, filter: (q: ReturnType<SupabaseClient["from"]>) => unknown): Promise<number | null> {
  try {
    const query = filter(db.from(table)) as PromiseLike<{ count: number | null; error: unknown }>;
    const { count, error } = await query;
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** What is waiting on the super admin, each as one plain line with where to go. Lines with nothing waiting are left out. */
export async function readWaiting(db: SupabaseClient, userId: string): Promise<WaitingLine[]> {
  const head = { count: "exact" as const, head: true };
  const [alerts, critical, recommendations, escalations] = await Promise.all([
    countOpen(db, "risk_alerts", (q) => q.select("id", head).eq("status", "open")),
    countOpen(db, "risk_alerts", (q) => q.select("id", head).eq("status", "open").eq("severity", "critical")),
    countOpen(db, "staff_access_recommendations", (q) => q.select("id", head).eq("status", "open")),
    countOpen(db, "staff_escalations", (q) =>
      q.select("id", head).in("status", ["open", "acknowledged", "in_progress"]).or(`routed_to.eq.super_admin,level.eq.2,assigned_to.eq.${userId}`),
    ),
  ]);
  const lines: WaitingLine[] = [];
  if (escalations) {
    lines.push({
      key: "escalations",
      count: escalations,
      words: `${plural(escalations, "escalation is", "escalations are")} waiting on you.`,
      href: "/admin/escalations",
    });
  }
  if (critical) {
    lines.push({
      key: "critical_alerts",
      count: critical,
      words: `${plural(critical, "critical alert is", "critical alerts are")} open.`,
      href: "/admin/alerts",
    });
  }
  if (alerts && alerts - (critical ?? 0) > 0) {
    const rest = alerts - (critical ?? 0);
    lines.push({ key: "alerts", count: rest, words: `${plural(rest, "other alert is", "other alerts are")} open.`, href: "/admin/alerts" });
  }
  if (recommendations) {
    lines.push({
      key: "access",
      count: recommendations,
      words: `${plural(recommendations, "staff access recommendation is", "staff access recommendations are")} waiting for your decision.`,
      href: "/admin/overview",
    });
  }
  return lines;
}

export async function readControlRoom(env: Readonly<Record<string, string | undefined>> = process.env): Promise<ControlRoom> {
  const access = await requireAdmin();
  if (access.state !== "admin" || !access.isSuperAdmin) return { state: "forbidden" };
  let db: SupabaseClient;
  try {
    db = createAdminClient() as unknown as SupabaseClient;
  } catch {
    return { state: "unavailable" };
  }
  const present = (name: string) => (env[name] ?? "").trim() !== "";
  const [setup, flags, waiting] = await Promise.all([
    readSetup(probeWith(db)),
    db.from("feature_flags").select("key, enabled"),
    readWaiting(db, access.user.id),
  ]);
  return {
    state: "ok",
    setup,
    switches: readSwitches(((flags.data ?? []) as { key: string; enabled: boolean }[]) ?? []),
    connections: readConnections({
      codesNigeria: termiiConfig(env as Record<string, string | undefined>) !== null,
      codesAbroad: canSendAbroad(),
      /* Presence only. The rail itself decides whether the settings are usable (its own config). */
      paymentPartner: present("ESCROWPAY_API_KEY") && present("ESCROWPAY_API_BASE_URL"),
      paymentPartnerWebhook: present("ESCROWPAY_WEBHOOK_SECRET"),
      cardPayments: present("PAYSTACK_SECRET_KEY") || present("PAYSTACK_TEST_SECRET_KEY"),
      email: isEmailConfigured(),
      copilot: present("ANTHROPIC_API_KEY"),
      onCallPage: present("OPS_ALERT_EMAIL") || present("OPS_ALERT_WEBHOOK_URL"),
    }),
    waiting,
  };
}
