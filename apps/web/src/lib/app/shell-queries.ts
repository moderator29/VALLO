import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { resolveSessionClaims } from "../actions/session";
import { getMode, getWorkspaceKey } from "../mode";
import {
  kindFromSupplyRole,
  makeWorkspace,
  orderWorkspaces,
  resolveCurrent,
  standingFromStatus,
  type Workspace,
  type WorkspacesView,
} from "../supply/workspaces";
import { resolveWorkspaces } from "../supply/workspaces-queries";

/**
 * What the consumer shell needs to render itself honestly.
 *
 * Four facts, resolved once in the layout rather than per surface: who is
 * actually signed in, how many notifications they have not read, and whether
 * this person has an agent workspace or an operations console to be shown a
 * door into.
 *
 * The last two are what stop the side navigation from lying. An Agent Mode
 * group offered to somebody with no `agents` row is a dead end four taps deep,
 * and a Console group offered to somebody with no staff role is a refusal
 * screen dressed as a destination.
 *
 * Both used to be wrong in the same way. The shell greeted every visitor as
 * "Guest" from a hardcoded constant whose comment said "until real sessions
 * land", long after sessions had landed, so a signed-in user was greeted by the
 * placeholder. And the rail declared a `badge?: number` that no item ever set,
 * so an unread count was rendered nowhere despite being one query away.
 *
 * Everything here fails soft. Navigation chrome is never worth taking a page
 * down for: an unreadable count is zero, an unreadable name is Guest.
 */

export type ShellIdentity = {
  /** First name where we have one, otherwise a neutral label. Never a fiction. */
  userName: string;
  /** The @handle from the social profile, for the drawer. Empty when none. */
  userHandle: string;
  /** Reserved for the human-checked tick; nothing sets it yet. */
  verified: boolean;
  /** Unread notifications for this caller. Zero renders no badge at all. */
  unreadNotifications: number;
  /** The person's own photo, or an empty string when they have not set one. */
  avatarUrl: string;
  /** True only for a real session, so the shell never offers a signed-out avatar. */
  signedIn: boolean;
  /** An approved agent, so Agent Mode is a place they can actually go. */
  isAgent: boolean;
  /** An admin or a scoped staff member, so the console is a place they can actually go. */
  isAdmin: boolean;
  /**
   * Owns at least one business that is a stays workspace (any kind but
   * `agency`, as `resolveWorkspaces` draws it) and is not an example listing,
   * so a host has a door into `/host`.
   */
  isHost: boolean;
};

const GUEST: ShellIdentity = {
  userName: "Guest",
  userHandle: "",
  verified: false,
  unreadNotifications: 0,
  avatarUrl: "",
  signedIn: false,
  isAgent: false,
  isAdmin: false,
  isHost: false,
};

const NO_WORKSPACES: WorkspacesView = { workspaces: [], current: { kind: "personal" } };

/** The first word of a display name, so the greeting stays short on a phone. */
function firstWord(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

/** A staff grant with at least one scope, from `my_staff_access()`'s answer. */
function hasStaffScopes(staff: unknown): boolean {
  const scopes = (staff as { scopes?: unknown } | null)?.scopes;
  return Array.isArray(scopes) && scopes.length > 0;
}

function nameFrom(profile: { first_name?: string | null; nickname?: string | null; display_name?: string | null } | null): string {
  return (
    firstWord(profile?.nickname ?? "") ||
    firstWord(profile?.first_name ?? "") ||
    firstWord(profile?.display_name ?? "") ||
    GUEST.userName
  );
}

/** What `public.shell_context()` answers (migration PERF-DB 4). */
type ShellContextRow = {
  profile: { first_name: string | null; nickname: string | null; display_name: string | null; avatar_url: string | null } | null;
  handle: string | null;
  unread: number | null;
  agent: { id: string; display_name: string; role: "owner" | "agent" | null; status: string } | null;
  businesses: { id: string; name: string; kind: string; status: string; is_demo: boolean | null }[] | null;
  roles: string[] | null;
  staff: unknown;
  is_host: boolean | null;
};

type ShellContext = { identity: ShellIdentity; workspaces: WorkspacesView };

/**
 * The shell's workspace list from the one read, drawn exactly as
 * `resolveWorkspaces` draws it: the agents row whatever its status, every
 * business the person owns or is the agent of (`agency` is the firm, anything
 * else a stays workspace), and the console for an admin role.
 */
async function workspacesFrom(row: ShellContextRow): Promise<WorkspacesView> {
  const [mode, key] = await Promise.all([getMode(), getWorkspaceKey()]);
  const workspaces: Workspace[] = [];
  if (row.agent) {
    workspaces.push(
      makeWorkspace({
        kind: kindFromSupplyRole(row.agent.role),
        id: row.agent.id,
        name: row.agent.display_name,
        standing: standingFromStatus(row.agent.status),
      }),
    );
  }
  for (const business of row.businesses ?? []) {
    workspaces.push(
      makeWorkspace({
        kind: business.kind === "agency" ? "firm" : "host",
        id: business.id,
        name: business.name,
        standing: standingFromStatus(business.status),
      }),
    );
  }
  if ((row.roles?.length ?? 0) > 0) {
    workspaces.push({
      key: "admin",
      kind: "console",
      name: "Operations console",
      standing: "active",
      side: "property",
      href: "/admin",
    });
  }
  const ordered = orderWorkspaces(workspaces);
  return { workspaces: ordered, current: resolveCurrent(ordered, mode, key) };
}

/**
 * THE SEPARATE READS, kept as the fallback for a database without
 * `shell_context()` (or one whose call failed). Six requests for the identity;
 * the workspaces fall back to `resolveWorkspaces()`. Same predicates and the
 * same fail-closed rules as the single read.
 */
async function identityFromSeparateReads(supabase: SupabaseClient<Database>, userId: string): Promise<ShellIdentity> {
  const [profileResult, socialResult, unreadResult, agentResult, roleResult, staffResult, hostResult] = await Promise.all([
    supabase.from("profiles").select("first_name, nickname, display_name, avatar_url").eq("id", userId).maybeSingle(),
    /* The handle lives on the social profile, which is select-own. */
    supabase.from("social_profiles").select("handle").eq("user_id", userId).maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    /* `agents` is select-own plus admin, and `user_roles` carries
       `user_roles_select_own`, so both of these resolve for the person
       themselves and for nobody else. Neither needs a service key. */
    supabase.from("agents").select("id").eq("user_id", userId).eq("status", "APPROVED").maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]),
    /* Track K: a scoped staff member holds no admin role, but the console
       is still a place they can go (their own desks and the handbook). */
    supabase.rpc("my_staff_access" as never),
    supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .neq("kind", "agency")
      .or("is_demo.is.null,is_demo.eq.false")
      .limit(1),
  ]);

  const profile = profileResult.data;
  return {
    userName: nameFrom(profile),
    userHandle: socialResult.error ? "" : (socialResult.data?.handle ?? ""),
    verified: false,
    unreadNotifications: unreadResult.error ? 0 : (unreadResult.count ?? 0),
    avatarUrl: profile?.avatar_url ?? "",
    signedIn: true,
    // A read that failed is not a role. All three fail closed.
    isAgent: !agentResult.error && agentResult.data !== null,
    isAdmin:
      (!roleResult.error && (roleResult.data?.length ?? 0) > 0) ||
      (!staffResult.error && hasStaffScopes(staffResult.data)),
    isHost: !hostResult.error && (hostResult.data?.length ?? 0) > 0,
  };
}

/**
 * ONE READ FOR THE WHOLE SHELL.
 *
 * The layout used to make nine PostgREST requests per navigation (six here and
 * three in `resolveWorkspaces`, which read `agents` and `user_roles` a second
 * time), after a GoTrue round trip for the user. Now it is:
 *
 *   - the caller's id from `resolveSessionClaims()`: the access token's ES256
 *     signature and expiry verified locally, the same check PostgREST applies
 *     to every one of these reads (the proxy has already refreshed the token
 *     for this request with `getClaims()`, SPEED-1);
 *   - one `shell_context()` call, SECURITY INVOKER, so every part of it runs
 *     under the caller's own RLS exactly as the separate reads did.
 *
 * Cached per request, so the layout, the home greeting, the support page and
 * the console layout share one execution.
 */
/**
 * THE SHELL'S ROW, HELD FOR A MOMENT PER MEMBER (platform speed, 13 November
 * 2026).
 *
 * `shell_context()` is on the path of every signed-in page load, and
 * `pg_stat_statements` since this morning's reset puts it at a mean of 637 ms
 * with a 6 s maximum under load (its own warm cost, measured with EXPLAIN as
 * a member, is about 70 ms; the rest is contention). The row is the member's
 * name, avatar, unread count, workspaces and roles, none of which changes
 * from one page load to the next, so a copy is held for HELD_MS and a load
 * inside that window makes no round trip at all.
 *
 * THIS IS PER INSTANCE AND PER MEMBER, AND NOTHING ELSE. The key is the user
 * id the token was verified to carry, so one member's row can never be served
 * to another, and the row never leaves this process (never Next's data cache,
 * never the edge). It is the same memo `lib/cache/memo.ts` describes, keyed.
 * What it costs: a name, a photograph or an unread count changed within the
 * last HELD_MS is drawn as it was, on this instance, until the window closes;
 * the badge keeps itself current through its own subscription regardless.
 * Sign-out holds nothing (a guest never reaches this), and a session revoked
 * elsewhere still fails at the page's own reads, as it always did.
 */
const HELD_MS = 30_000;
const heldRows = new Map<string, { row: ShellContextRow; expires: number }>();

async function readShellRow(session: { supabase: SupabaseClient<Database>; userId: string }): Promise<ShellContextRow | null> {
  const now = Date.now();
  const held = heldRows.get(session.userId);
  if (held && held.expires > now) return held.row;
  const { data, error } = await session.supabase.rpc("shell_context" as never);
  const row = error || !data ? null : (data as unknown as ShellContextRow);
  if (row) heldRows.set(session.userId, { row, expires: now + HELD_MS });
  /* The map cannot grow without bound: anything past its window is dropped
     whenever it is looked at. */
  if (heldRows.size > 500) for (const [key, entry] of heldRows) if (entry.expires <= now) heldRows.delete(key);
  return row;
}

/** Drop a member's held row, so the next load reads it fresh (tests, and a write that changes the shell). */
export function forgetShellRow(userId: string): void {
  heldRows.delete(userId);
}

const getShellContext = cache(async function getShellContext(): Promise<ShellContext> {
  try {
    const session = await resolveSessionClaims();
    if (session.state !== "signed-in") return { identity: GUEST, workspaces: NO_WORKSPACES };

    const row = await readShellRow(session);
    if (!row) {
      const [identity, workspaces] = await Promise.all([
        identityFromSeparateReads(session.supabase, session.userId),
        resolveWorkspaces(),
      ]);
      return { identity, workspaces };
    }

    const identity: ShellIdentity = {
      userName: nameFrom(row.profile),
      userHandle: row.handle ?? "",
      verified: false,
      unreadNotifications: Number(row.unread ?? 0),
      avatarUrl: row.profile?.avatar_url ?? "",
      signedIn: true,
      isAgent: row.agent !== null && row.agent.status === "APPROVED",
      isAdmin: (row.roles?.length ?? 0) > 0 || hasStaffScopes(row.staff),
      isHost: row.is_host === true,
    };
    return { identity, workspaces: await workspacesFrom(row) };
  } catch {
    return { identity: GUEST, workspaces: NO_WORKSPACES };
  }
});

/**
 * Wrapped in React's per-request cache, so the layout and the home greeting
 * share one execution rather than issuing the same reads twice on the
 * platform's busiest route.
 */
export const getShellIdentity = cache(async function getShellIdentity(): Promise<ShellIdentity> {
  return (await getShellContext()).identity;
});

/**
 * The workspace switch's list, from the same single read as the identity.
 * Everything fails soft: a read that failed is not a workspace.
 */
export const getShellWorkspaces = cache(async function getShellWorkspaces(): Promise<WorkspacesView> {
  return (await getShellContext()).workspaces;
});
