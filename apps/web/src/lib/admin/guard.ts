import "server-only";
import { cache } from "react";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";
import type { Database } from "../supabase/database.types";
import { createAdminClient } from "../supabase/admin";
import { isStaffPosition, type StaffPosition } from "./staff-positions";

/**
 * The single door into the admin console.
 *
 * Every admin page and every admin action starts here, so there is exactly one
 * place that decides who counts as staff. The check runs against the caller's
 * own RLS-bound client: `user_roles_select_own` lets a user read their own role
 * rows and nothing else, so the answer comes from the database rather than from
 * a cookie, a header or anything the browser can forge.
 *
 * The outcomes are deliberately four, not two. "Unconfigured" means the owner
 * has not added the platform keys yet, which is not a failure and must never
 * crash a page. "Signed out" asks for a sign in. "Not admin" is an honest, calm
 * refusal, never a blank screen and never a 404 that pretends the console does
 * not exist. Only the last outcome carries a client and a user.
 */
export type AdminAccess =
  | { state: "unconfigured" }
  | { state: "signed-out" }
  | { state: "not-admin" }
  /** Staff, but this session has not proved its security key yet. */
  | { state: "step-up" }
  | {
      state: "admin";
      /**
       * The client the desk reads and writes with. For an admin it is their
       * own RLS-bound client, exactly as before. For a scoped staff member it
       * is the service client, handed out ONLY after the database said this
       * person holds the scope asked for and has acknowledged the current
       * handbook (Track K). Staff hold no admin role, so every admin RLS
       * policy would refuse their own client.
       */
      supabase: SupabaseClient<Database>;
      /** The caller's own RLS-bound client, for functions that read auth.uid(). */
      userClient: SupabaseClient<Database>;
      user: User;
      isAdmin: true;
      isSuperAdmin: boolean;
      /**
       * The founder's own account (a named super admin, `private.is_founder`):
       * the one person who may decide their own listing, application or
       * business. Absent or false for everybody else.
       */
      isFounder?: boolean;
      /** True when this door was passed on a staff scope, not an admin role. */
      isStaff: boolean;
    };

/**
 * TRACK K: THE SCOPES A STAFF MEMBER CAN BE GIVEN. Mirrors
 * `public.staff_scope`. Only a super admin grants them
 * (`public.admin_grant_staff`), and a staff member holds no app_role at all.
 */
export const STAFF_SCOPES = [
  "listing_approval",
  "kyc_review",
  "moderation",
  "support",
  "agreements",
  "guarantee",
  /* Added 29 September: a CFO, compliance officer or operations lead no
     longer has to be made a full admin to see their own area. */
  "finance",
  "compliance",
  "operations",
  /* Added 8 November with Trust and Safety (the case engine,
     `supabase/migrations/pending/roommates_7_trust_safety.sql`): every case
     and restriction, verification documents, appeals. */
  "trust_safety",
  /* Vallo Roommates moderation: its cases, profiles, posts and groups. No
     verification documents (those stay with kyc_review and trust_safety). */
  "roommates",
  /* Vallo Circle and the feed: communities, posts and their cases. */
  "circle",
  /* The numbers only: overview figures, never case content. */
  "analyst",
  /* Added 10 November 2026 with the Business Development and Social Media
     positions. `business_development` is never a new permission on its own:
     a Business Development Executive also holds `listing_approval`, the
     scope that already lets a Listings Reviewer review, verify, approve and
     publish a listing, and restrict a member on a property case (founder
     ruling, 10 Nov: "3 yes they do"). `social_media` carries no listing,
     moderation or financial access at all. */
  "business_development",
  "social_media",
] as const;
export type StaffScope = (typeof STAFF_SCOPES)[number];

export const STAFF_SCOPE_LABEL: Record<StaffScope, string> = {
  listing_approval: "Listing approval",
  kyc_review: "KYC review",
  moderation: "Reports and moderation",
  support: "Support",
  agreements: "Agreement approval",
  guarantee: "Guarantee claims",
  finance: "Finance",
  compliance: "Compliance",
  operations: "Operations",
  trust_safety: "Trust and Safety",
  roommates: "Roommates moderation",
  circle: "Circle moderation",
  analyst: "Read-only analyst",
  business_development: "Business development",
  social_media: "Social media",
};

export type StaffAccess = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  scopes: StaffScope[];
  /** The named position the super admin granted, when there is one. */
  position: StaffPosition | null;
  handbookVersion: string;
  handbookAcknowledged: boolean;
  /**
   * This session proved a security key for the console (29 September). The
   * database enforces it; this only chooses the screen. Absent from the
   * answer (the enforcement not deployed yet) reads as proved.
   */
  consoleVerified: boolean;
};

/** What the signed-in person may do in the console, read from the database. */
export async function readStaffAccess(supabase: SupabaseClient<Database>): Promise<StaffAccess | null> {
  const { data, error } = await supabase.rpc("my_staff_access" as never);
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const scopes = Array.isArray(d.scopes)
    ? (d.scopes as unknown[]).filter((s): s is StaffScope => STAFF_SCOPES.includes(s as StaffScope))
    : [];
  return {
    isAdmin: d.is_admin === true,
    isSuperAdmin: d.is_super_admin === true,
    scopes,
    position: isStaffPosition(d.position) ? d.position : null,
    handbookVersion: typeof d.handbook_version === "string" ? d.handbook_version : "",
    handbookAcknowledged: d.handbook_acknowledged === true,
    consoleVerified: d.console_verified === undefined ? true : d.console_verified === true,
  };
}

/** The caller's console access, read once per request however many desks ask. */
const staffAccessForRequest = cache(async (): Promise<StaffAccess | null> => {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  return readStaffAccess(session.supabase);
});

/**
 * May the signed-in person act as an administrator OUTSIDE the console (an
 * admin override on somebody else's booking, say)? Only an admin or super
 * admin whose session has proved their security key: a password alone is a
 * member everywhere, not only in the console. Read from the person's own
 * `my_staff_access`, never from `user_roles` through the service role, which
 * would skip the proof.
 */
export async function actsAsProvedAdmin(): Promise<boolean> {
  const staff = await staffAccessForRequest();
  return !!staff && (staff.isAdmin || staff.isSuperAdmin) && staff.consoleVerified;
}

/*
 * The same sentence `t.admin.access.unconfiguredBody` gives the screen, kept in
 * English here because a server action can return this to a caller with no page
 * and no locale around it.
 *
 * It used to read "The console switches on the moment the platform keys land",
 * which is "coming soon" in other words and made our deployment detail the
 * operator's problem. It is also not a pre-launch state: an operator reaches
 * this branch in production the moment a key lapses. So the copy says whose
 * fault it is, that nothing has been lost, and what to do, and it names no
 * schedule, because we cannot keep one.
 */
export const ADMIN_UNCONFIGURED_MESSAGE =
  "We cannot reach the console right now. This is on our side, not yours. Nothing has been lost. Try again in a few minutes.";

export const ADMIN_SIGNED_OUT_MESSAGE = "Sign in with your operations account to continue.";

export const ADMIN_STEP_UP_MESSAGE =
  "Confirm it is you with your security key to open the console. Nothing was changed.";

export const ADMIN_FORBIDDEN_MESSAGE =
  "This area is for the Vallo operations team. Your account does not carry that role.";

/**
 * THE SINGLE DOOR, NOW WITH A SCOPE (Track K).
 *
 * Without a scope it is exactly the old door: admins and super admins only.
 * With a scope it also admits a staff member who holds that scope and has
 * acknowledged the current handbook, and nobody else. Refusal is the default:
 * a desk that does not pass a scope is closed to every staff member.
 */
export async function requireAdmin(scope?: StaffScope): Promise<AdminAccess> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { state: "unconfigured" };
  if (session.state === "signed-out") return { state: "signed-out" };

  const { data, error } = await session.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);

  // A read error means we cannot prove the role, and an unproven role is not a
  // role. Refusing is the only safe answer here.
  if (error) return { state: "not-admin" };

  const roles = new Set((data ?? []).map((row) => row.role));
  const isSuperAdmin = roles.has("super_admin");
  const isAdmin = isSuperAdmin || roles.has("admin");
  if (isAdmin) {
    /* The second factor: an admin's session opens the console only after it
       proved a security key. An unreadable answer is not a proof. */
    const own = await staffAccessForRequest();
    if (!own) return { state: "not-admin" };
    if (!own.consoleVerified) return { state: "step-up" };
    /* Asked only of a super admin, and answered by the database. */
    let isFounder = false;
    if (isSuperAdmin) {
      const { data: founder } = await session.supabase.rpc("am_i_founder" as never);
      isFounder = founder === true;
    }
    return {
      state: "admin",
      supabase: session.supabase,
      userClient: session.supabase,
      user: session.user,
      isAdmin: true,
      isSuperAdmin,
      isFounder,
      isStaff: false,
    };
  }

  if (!scope) return { state: "not-admin" };
  const staff = await staffAccessForRequest();
  if (!staff || !staff.handbookAcknowledged || !staff.scopes.includes(scope)) return { state: "not-admin" };
  if (!staff.consoleVerified) return { state: "step-up" };
  let service: SupabaseClient<Database>;
  try {
    service = createAdminClient();
  } catch {
    return { state: "unconfigured" };
  }
  return {
    state: "admin",
    supabase: service,
    userClient: session.supabase,
    user: session.user,
    isAdmin: true,
    isSuperAdmin: false,
    isStaff: true,
  };
}

/**
 * Who may be inside the console shell at all: an admin, or a staff member
 * with at least one scope (the handbook gate is applied inside, so an
 * unacknowledged member can reach the handbook and nothing else).
 */
export type ConsoleAccess =
  | { state: "unconfigured" | "signed-out" | "not-admin" }
  | { state: "step-up"; user: User; staff: StaffAccess }
  | { state: "console"; user: User; supabase: SupabaseClient<Database>; staff: StaffAccess };

export async function requireConsole(): Promise<ConsoleAccess> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { state: "unconfigured" };
  if (session.state === "signed-out") return { state: "signed-out" };
  const staff = await staffAccessForRequest();
  if (!staff) return { state: "not-admin" };
  if (!staff.isAdmin && !staff.isSuperAdmin && staff.scopes.length === 0) return { state: "not-admin" };
  if (!staff.consoleVerified) return { state: "step-up", user: session.user, staff };
  return { state: "console", user: session.user, supabase: session.supabase, staff };
}

/**
 * The one-line refusal an action returns for a non-admin caller, so every
 * export in the console speaks the same plain language as the rest of the app.
 */
export function adminRefusal(access: Exclude<AdminAccess, { state: "admin" }>): string {
  if (access.state === "unconfigured") return ADMIN_UNCONFIGURED_MESSAGE;
  if (access.state === "signed-out") return ADMIN_SIGNED_OUT_MESSAGE;
  if (access.state === "step-up") return ADMIN_STEP_UP_MESSAGE;
  return ADMIN_FORBIDDEN_MESSAGE;
}
