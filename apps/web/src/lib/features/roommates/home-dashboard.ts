import type { RoommatesHome } from "./queries";

/**
 * THE ROOMMATES HOME DASHBOARD, AS DATA (pure, tested). What this person
 * should do next, read only from the home read that already exists. The order
 * is the order of how much it matters to somebody else waiting on them:
 * answer requests first, then group invites, then viewings, then finish the
 * profile, then look at matches, then post.
 */
export type NextAction =
  | { kind: "requests"; count: number }
  | { kind: "invites"; count: number }
  | { kind: "viewings"; count: number }
  | { kind: "profile"; started: boolean }
  | { kind: "matches"; count: number }
  | { kind: "post" }
  | { kind: "sign-in" };

export function nextAction(home: Pick<RoommatesHome, "signedIn" | "myStatus" | "pending" | "recommended">): NextAction {
  if (!home.signedIn) return { kind: "sign-in" };
  if (home.pending.requests > 0) return { kind: "requests", count: home.pending.requests };
  if (home.pending.invites > 0) return { kind: "invites", count: home.pending.invites };
  if (home.pending.viewings > 0) return { kind: "viewings", count: home.pending.viewings };
  if (home.myStatus === "none" || home.myStatus === "draft") return { kind: "profile", started: home.myStatus === "draft" };
  if (home.recommended.length > 0) return { kind: "matches", count: home.recommended.length };
  return { kind: "post" };
}

export type DashboardCounts = { requests: number; invites: number; viewings: number; matches: number };

export function dashboardCounts(home: Pick<RoommatesHome, "pending" | "recommended">): DashboardCounts {
  return { requests: home.pending.requests, invites: home.pending.invites, viewings: home.pending.viewings, matches: home.recommended.length };
}

/** The tabs of the Roommates sub-navigation, in order. `match` decides the active tab from a path. */
export type RoommatesTabId = "home" | "discover" | "groups" | "schools" | "nysc" | "mine" | "safety";

export const ROOMMATES_TABS: readonly { id: RoommatesTabId; href: string; prefixes: readonly string[] }[] = [
  { id: "home", href: "/roommates", prefixes: [] },
  { id: "discover", href: "/roommates/discover", prefixes: ["/roommates/discover", "/roommates/p/", "/roommates/r/"] },
  { id: "groups", href: "/roommates/groups", prefixes: ["/roommates/groups"] },
  { id: "schools", href: "/roommates/campus", prefixes: ["/roommates/campus"] },
  { id: "nysc", href: "/roommates/nysc", prefixes: ["/roommates/nysc"] },
  { id: "mine", href: "/roommates/me", prefixes: ["/roommates/me", "/roommates/profile", "/roommates/new", "/roommates/verify", "/roommates/split"] },
  { id: "safety", href: "/roommates/safety", prefixes: ["/roommates/safety"] },
];

export function activeRoommatesTab(pathname: string): RoommatesTabId {
  if (pathname === "/roommates") return "home";
  for (const tab of ROOMMATES_TABS) {
    if (tab.prefixes.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)))) return tab.id;
  }
  return "home";
}

/**
 * True on a tab's own root page (`/roommates`, `/roommates/discover`, and so
 * on), with or without a trailing slash. Those pages draw the area's tabs
 * under their own title, so the layout's copy of the row stands down on
 * exactly these paths and nowhere else: an inner page (a room, a person, a
 * form) is not a root and keeps the bar above it.
 */
export function isRoommatesTabRoot(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return ROOMMATES_TABS.some((tab) => tab.href === path);
}
