import { ADMIN_GROUPS, ADMIN_NAV, groupItems, type AdminDestination } from "@/app/admin/_components/nav";
import type { StaffScope } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import type { CopilotViewer, ToolLink } from "./tools/types";

/**
 * THE CONSOLE'S MAP, FOR THE COPILOT (16 November 2026).
 *
 * "Where do I do X" is answered from the real menu, not from memory. The
 * address, the name and the group of every desk are READ from
 * `app/admin/_components/nav.ts`, which is the console's own authority and is
 * owned elsewhere: this file never restates a name or an address, so the
 * answer cannot drift from the rail.
 *
 * What this file does add, per desk, is the part a menu cannot carry: what the
 * desk is FOR in plain words, who may open it, and the words a person is
 * likely to use when they are looking for it. Those are written by hand, and
 * `copilot-coverage.test.ts` fails when the rail grows a desk that has none,
 * so a new desk cannot be added without the copilot learning about it.
 *
 * Client-safe: data and pure functions. `nav.ts` carries no component at
 * runtime (its icon imports are types), so nothing is pulled into a bundle.
 */

/** What a desk needs beyond its access areas. */
export type DeskDoor = "staff" | "coo" | "admin" | "super_admin";

export type DeskNote = {
  /** What the desk is for, in one plain sentence. */
  purpose: string;
  /** Any one of these opens it. Empty means every member of staff the console admits. */
  scopes: readonly StaffScope[];
  /** A role the desk needs on top of the scopes. */
  door?: DeskDoor;
  /** Words a person might use when looking for it, beyond its own name. */
  words?: readonly string[];
};

/**
 * ONE NOTE PER DESK ON THE RAIL, keyed by the rail's own key. Add a desk to
 * `nav.ts` and the coverage test names it here until it has a note.
 */
export const DESK_NOTES: Readonly<Record<string, DeskNote>> = {
  overview: { purpose: "The console's front page: what is waiting across the queues you can see, and the platform's figures for the last fortnight.", scopes: [], words: ["home", "front page", "dashboard", "pulse", "figures"] },
  "my-desk": { purpose: "Your own workspace: your tasks, the announcements addressed to you and what needs you first.", scopes: [], words: ["my work", "mine", "personal", "what needs me"] },
  "my-tasks": { purpose: "Your task list: open, overdue and done, with comments on each.", scopes: [], words: ["task", "todo", "to do", "reminder", "follow up"] },
  announcements: { purpose: "Staff announcements addressed to you, pinned and unread first.", scopes: [], words: ["notice", "announcement", "memo", "news"] },
  "weekly-report": { purpose: "Your own weekly report: what you did, filed every Saturday.", scopes: [], words: ["weekly", "my report", "saturday", "file my report"] },
  "weekly-reports": { purpose: "Who has filed their weekly report and who has not.", scopes: [], door: "admin", words: ["who filed", "reports table", "reviewers"] },
  copilot: { purpose: "This assistant as a full page, with every tool your access opens and what it will not do.", scopes: [], words: ["assistant", "copilot", "ask", "chat"] },
  queue: { purpose: "One queue for the work waiting on a decision: listings, applications, reports, flagged messages, held content and tickets.", scopes: ["moderation", "listing_approval", "support", "kyc_review"], words: ["queue", "waiting", "backlog", "decide", "lanes"] },
  lookup: { purpose: "Look up one member, listing, booking or payment by name, email, phone or reference.", scopes: ["support", "trust_safety", "moderation", "kyc_review"], words: ["lookup", "search", "find a member", "find a listing", "reference"] },
  "coo-overview": { purpose: "The COO desk: escalations raised to the COO, staff access recommendations, and the backlog across every desk.", scopes: ["operations"], door: "coo", words: ["coo", "backlog across desks", "recommendations"] },
  escalations: { purpose: "What staff could not or may not decide, sent to the team that can. Raise one with the Escalate button on any page.", scopes: [], words: ["escalate", "escalation", "hand over", "who decides", "urgent"] },
  listings: { purpose: "Listings waiting on a review decision: approve, ask the lister for more, or send it back.", scopes: ["listing_approval"], words: ["listing", "property", "review", "approve a listing", "publish"] },
  supply: { purpose: "Who is listing on Vallo: owners, agents, firms and hosts, with how many listings each has.", scopes: ["listing_approval", "business_development"], door: "admin", words: ["lister", "supply", "owners", "agents", "firms", "hosts"] },
  applications: { purpose: "Applications from people who want to list, waiting on a decision.", scopes: ["kyc_review", "listing_approval"], words: ["application", "apply to list", "agent application", "onboarding"] },
  businesses: { purpose: "Hotels, shortlet hosts and restaurants on Vallo, and whether each is verified.", scopes: ["kyc_review", "listing_approval", "business_development"], words: ["business", "hotel", "restaurant", "shortlet", "company"] },
  stops: { purpose: "Listers stopped from listing, and why.", scopes: ["listing_approval", "trust_safety"], words: ["stop", "stopped", "blocked lister", "barred"] },
  "business-development": { purpose: "The pipeline of landlords, agents, hotels, hosts and restaurants being brought onto Vallo, with follow-ups due.", scopes: ["business_development"], words: ["pipeline", "prospect", "lead", "follow up", "outreach", "bd"] },
  kyc: { purpose: "Identity work: ID, selfie and address documents waiting on a decision, with the cross-checks beside each person.", scopes: ["kyc_review"], words: ["kyc", "identity", "id", "selfie", "document", "verify", "verification"] },
  compliance: { purpose: "The money-laundering duties: cases, threshold reports, sanctions and politically exposed person checks.", scopes: ["compliance"], words: ["compliance", "aml", "sanctions", "threshold", "scuml", "pep"] },
  "review-calls": { purpose: "Video review calls with a member, booked from a case or an identity check.", scopes: ["kyc_review", "trust_safety"], words: ["call", "video call", "review call", "interview"] },
  money: { purpose: "The money desk: reconciliation, move-in charges, refunds and what the platform has taken.", scopes: ["finance"], words: ["money", "naira", "reconciliation", "revenue", "collected"] },
  payments: { purpose: "Every payment with its outcome, by card or transfer.", scopes: ["finance"], words: ["payment", "charge", "card", "transfer", "paid", "failed payment"] },
  chargebacks: { purpose: "Card disputes: what evidence is due, when, and how each ended.", scopes: ["finance"], words: ["chargeback", "dispute", "evidence", "bank claim"] },
  arrangements: { purpose: "Every protected payment, with the provider's state beside Vallo's. Read-only.", scopes: ["finance", "agreements"], words: ["protected payment", "provider", "arrangement", "escrow"] },
  fees: { purpose: "What Vallo charges and what each side pays.", scopes: ["finance"], words: ["fee", "commission", "charges", "pricing"] },
  referrals: { purpose: "Referral rewards owed, the monthly budget, and the referrals and payouts waiting on a decision.", scopes: ["finance"], words: ["referral", "reward", "invite", "payout", "budget"] },
  agreements: { purpose: "Tenancy agreements both sides confirmed, waiting for review before payment opens.", scopes: ["agreements"], words: ["agreement", "tenancy", "contract", "sign", "review gate"] },
  "agreement-settings": { purpose: "The review threshold, the risk signals and the incident switch for agreements.", scopes: ["agreements"], words: ["risk settings", "threshold", "signals", "incident switch"] },
  offers: { purpose: "Offers on properties for sale, from the first offer to the end of the deal.", scopes: ["agreements"], words: ["offer", "sale", "deal", "buy", "negotiation"] },
  bookings: { purpose: "Bookings and stays: what is booked, in stay now, and finished.", scopes: ["operations", "support"], words: ["booking", "stay", "reservation", "guest", "check in"] },
  visits: { purpose: "Inspection requests as a week or month calendar.", scopes: ["operations"], words: ["visit", "inspection", "viewing", "calendar", "appointment"] },
  reservations: { purpose: "Restaurant reservations and how each table went.", scopes: ["operations", "support"], words: ["restaurant", "table", "reservation", "diner", "seating"] },
  "restaurant-fees": { purpose: "What a seated table owes, and the seatings the restaurant and the diner disagree about.", scopes: ["finance", "operations"], words: ["restaurant fee", "seating", "cover", "disagree"] },
  /* The rail's Moderation row and its Around child are the same page, so the
     row's own note is the one the map carries. */
  moderation: { purpose: "Moderation: the feed members post to, and what is held or reported in it.", scopes: ["moderation", "circle"], words: ["moderation", "around", "feed", "post", "held", "timeline"] },
  social: { purpose: "Around: the feed members post to, and what is held or reported in it.", scopes: ["moderation", "circle"], words: ["around", "feed", "post", "social", "timeline"] },
  cases: { purpose: "One case per thing reported, from every part of the platform, with its timeline and what was decided.", scopes: ["trust_safety", "moderation", "support"], words: ["case", "report", "abuse", "trust", "safety", "investigation"] },
  trust: { purpose: "The Trust and Safety overview: how cases, restrictions and appeals are trending.", scopes: ["trust_safety", "analyst"], words: ["trust overview", "safety figures", "restrictions trend"] },
  appeals: { purpose: "Members appealing a decision, waiting on a second look.", scopes: ["trust_safety"], words: ["appeal", "second look", "overturn", "dispute a decision"] },
  roommates: { purpose: "Vallo Roommates: its posts, profiles, checks, schools and matching.", scopes: ["roommates", "moderation"], words: ["roommate", "flatmate", "sharing", "school", "match"] },
  "circle-desk": { purpose: "Vallo Circle: communities, their posts and the cases raised in them.", scopes: ["circle", "moderation"], words: ["circle", "community", "group", "club"] },
  "social-media": { purpose: "The content calendar, drafts, the media library and approvals for Vallo's own channels.", scopes: ["social_media"], words: ["instagram", "tiktok", "post schedule", "caption", "channel", "calendar"] },
  marketing: { purpose: "Campaigns, the campaign calendar, acquisition and how referrals are performing.", scopes: ["marketing"], words: ["campaign", "marketing", "acquisition", "tracked link", "promotion"] },
  content: { purpose: "The editorial calendar, article requests, checklists, translations and the help pages that fail members.", scopes: ["content"], words: ["article", "editorial", "help page", "translation", "blog", "copy"] },
  standing: { purpose: "A member's standing: their stamps, strikes and what each one means.", scopes: ["trust_safety", "moderation"], words: ["standing", "strike", "stamp", "reputation", "badge"] },
  "blocked-terms": { purpose: "The words the safety scan acts on.", scopes: ["moderation"], words: ["blocked word", "banned word", "term", "filter", "safety scan"] },
  "weight-withheld": { purpose: "Reviews and reports that do not count, and clearing a stamp.", scopes: ["moderation", "trust_safety"], words: ["withheld", "review weight", "does not count", "clear a stamp"] },
  tickets: { purpose: "Support tickets: what members have written in, which lane each is in and what is past its promised time.", scopes: ["support", "support_lead"], words: ["ticket", "support", "member wrote", "reply", "inbox", "complaint"] },
  people: { purpose: "The member file: one person's account, listings, bookings, payments and cases in one place.", scopes: ["support", "trust_safety"], words: ["member", "person", "account", "profile", "user", "member file"] },
  "account-recovery": { purpose: "Members locked out of their email, and the recovery each is waiting on.", scopes: ["support"], words: ["recovery", "locked out", "lost email", "cannot sign in", "reset"] },
  "doc-feedback": { purpose: "Which help pages members say did not help them.", scopes: ["support", "content"], words: ["help page", "docs feedback", "page that fails", "unhelpful"] },
  "support-lead": { purpose: "The support team's workload, quality scores, repeated issues and the policy library.", scopes: ["support_lead"], words: ["team load", "quality", "qa", "coaching", "policy note"] },
  operations: { purpose: "Operations: alerts, scheduled jobs, the audit log, notifications and the store checks.", scopes: ["operations"], words: ["operations", "jobs", "cron", "health", "ops"] },
  alerts: { purpose: "Alerts open and waiting on a person, worst first.", scopes: ["operations"], words: ["alert", "alarm", "critical", "incident", "page"] },
  crashes: { purpose: "Vallo's own crash log for iPhone, Android, the website and the server.", scopes: ["operations", "technical"], words: ["crash", "error", "stack", "app broke", "exception"] },
  audit: { purpose: "The audit log: every privileged decision, who made it and when.", scopes: ["operations"], door: "admin", words: ["audit", "who did", "history", "trail", "log"] },
  oversight: { purpose: "Team oversight: what each member of staff has been doing.", scopes: ["operations"], door: "admin", words: ["oversight", "staff activity", "who is working", "team"] },
  technical: { purpose: "The read-only health panel and the incident log, with runbooks and expiry reminders.", scopes: ["technical", "operations"], words: ["health", "uptime", "incident", "runbook", "technical", "latency"] },
  providers: { purpose: "Read-only checks of each provider key and the map tiles: connected or not, never the value.", scopes: ["operations", "technical"], words: ["provider", "key", "connected", "integration", "service check"] },
  "call-usage": { purpose: "Video and audio calls: volume, connect rate and minutes.", scopes: ["operations", "technical", "analyst"], words: ["call usage", "minutes", "connect rate", "video", "audio"] },
  retention: { purpose: "Money records past their retention date, and the typed-confirmation tool that clears them.", scopes: ["operations", "compliance"], words: ["retention", "keep records", "purge", "past date", "archive"] },
  "account-deletions": { purpose: "Why members delete their account, as rates over time.", scopes: ["operations", "support_lead", "marketing"], words: ["deletion", "left", "churn", "closed account", "why they go"] },
  analytics: { purpose: "The headline numbers: live listings, sign-ups, money collected and bookings.", scopes: ["analyst"], words: ["analytics", "numbers", "figures", "growth", "metrics", "headline"] },
  "front-door": { purpose: "The front door funnel and the invite codes: who arrives and who signs up.", scopes: ["analyst", "marketing"], words: ["funnel", "front door", "invite code", "sign up rate", "visitors"] },
  "listing-analytics": { purpose: "Views, saves, enquiries and viewing requests by listing, area and lister.", scopes: ["analyst"], words: ["listing stats", "views", "saves", "enquiries", "by area"] },
  "field-speed": { purpose: "How fast the app is on the phones people really use.", scopes: ["analyst", "technical"], words: ["speed", "performance", "slow", "load time", "field"] },
  "search-analytics": { purpose: "What people search for in VALLO Intelligence, as figures, and the search aliases that teach it new words.", scopes: ["analyst", "content", "marketing"], words: ["search", "searches", "zero results", "aliases", "synonyms", "what people look for"] },
  settings: { purpose: "Console settings: the switches, reference data, examples, staff access and the knowledge centre.", scopes: [], door: "admin", words: ["settings", "configure", "options"] },
  control: { purpose: "The control room: what is waiting on the super admin, which database files are still to run, how each main switch stands and which services are connected.", scopes: [], door: "super_admin", words: ["control room", "sql to run", "migration", "switches", "connected", "setup"] },
  switches: { purpose: "The platform's main switches, and what turning each one changes.", scopes: [], door: "admin", words: ["switch", "feature flag", "turn on", "turn off", "toggle"] },
  reference: { purpose: "Reference data: areas, local governments, occupations, room types and risk classes.", scopes: [], door: "admin", words: ["reference", "areas", "lookup list", "occupations", "room types"] },
  examples: { purpose: "The example listings that show the product before real supply arrives, and when each comes down.", scopes: [], door: "admin", words: ["example", "demo", "seeded", "sample listing", "retire"] },
  staff: { purpose: "Who holds staff access, what each person holds, and who has acknowledged the handbook.", scopes: [], door: "super_admin", words: ["staff", "access", "grant", "permissions", "who can"] },
  handbook: { purpose: "The staff handbook every member of staff acknowledges, with your own position's handbook beside it.", scopes: [], words: ["handbook", "my role", "rules", "conduct", "acknowledge"] },
  manual: { purpose: "The staff manual: how each desk works, what you may decide alone, what is written down and where to take what you cannot decide.", scopes: [], words: ["manual", "how do i", "procedure", "chapter", "guide"] },
  /* Outside the console: the member-facing help centre, linked from Settings.
     The copilot links only to console pages, so it is never offered as a
     destination; the note is here so the map is complete. */
  help: { purpose: "The members' own help centre, outside the console.", scopes: [], words: ["help centre", "faq", "member help"] },
};

export type DeskEntry = {
  key: string;
  /** The rail's own name for it. */
  label: string;
  /** The rail's own address. */
  href: string;
  /** The rail group it sits in, as the rail names the group. */
  group: string;
  purpose: string;
  scopes: readonly StaffScope[];
  door: DeskDoor;
  words: readonly string[];
};

const GROUP_OF = new Map<string, string>();
for (const group of ADMIN_GROUPS) {
  for (const item of groupItems(group)) if (!GROUP_OF.has(item.key)) GROUP_OF.set(item.key, group.label);
}

function entryFor(item: AdminDestination): DeskEntry | null {
  const note = DESK_NOTES[item.key];
  if (!note) return null;
  return {
    key: item.key,
    label: item.label,
    href: item.href,
    group: GROUP_OF.get(item.key) ?? "The console",
    purpose: note.purpose,
    scopes: note.scopes,
    door: note.door ?? "staff",
    words: note.words ?? [],
  };
}

/** Every desk on the rail that has a note, in rail order, one entry per address. */
export const DESK_MAP: readonly DeskEntry[] = (() => {
  const out: DeskEntry[] = [];
  const seen = new Set<string>();
  for (const item of ADMIN_NAV) {
    if (seen.has(item.href)) continue;
    const entry = entryFor(item);
    if (!entry) continue;
    seen.add(item.href);
    out.push(entry);
  }
  return out;
})();

/** The desks the rail lists, as addresses. The coverage test reads this. */
export const RAIL_HREFS: readonly string[] = [...new Set(ADMIN_NAV.map((item) => item.href))];

/** Can this viewer open this desk? The same shape of answer the door itself gives. */
export function canOpenDesk(entry: DeskEntry, viewer: CopilotViewer): boolean {
  if (entry.door === "super_admin") return viewer.isSuperAdmin;
  if (entry.door === "admin") return viewer.isAdmin || viewer.isSuperAdmin;
  if (entry.door === "coo") return viewer.isSuperAdmin || JOB_DESCRIPTIONS.coo.scopes.every((s) => viewer.scopes.includes(s));
  if (entry.scopes.length === 0) return true;
  return viewer.isAdmin || viewer.isSuperAdmin || entry.scopes.some((s) => viewer.scopes.includes(s));
}

/** The desk as a destination a tool can offer. Only a console page is ever one. */
export function deskLink(entry: DeskEntry): ToolLink | null {
  if (!entry.href.startsWith("/admin")) return null;
  const link: ToolLink = { label: `Open ${entry.label}`, href: entry.href };
  if (entry.door !== "staff") link.requires = entry.door;
  else if (entry.scopes.length === 1) link.scope = entry.scopes[0];
  return link;
}

const STOP = new Set(["the", "and", "for", "with", "how", "where", "what", "who", "can", "does", "did", "that", "this", "from", "into", "are", "was", "will", "you", "your", "its", "not", "has", "have", "about", "need", "should", "which", "do", "to", "of", "in", "on", "a", "an", "is", "it", "be", "me", "my", "i", "go", "get", "see", "find", "look"]);

function words(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)))];
}

/**
 * The desks that match what the person said, best first, and only ones they
 * can open. A whole phrase the desk names itself counts for more than a single
 * word, and the desk's own name counts for most.
 */
export function findDesks(query: string, viewer: CopilotViewer, limit = 4): (DeskEntry & { score: number })[] {
  const asked = query.toLowerCase();
  const terms = words(query);
  const scored: (DeskEntry & { score: number })[] = [];
  for (const entry of DESK_MAP) {
    if (!canOpenDesk(entry, viewer)) continue;
    let score = 0;
    const name = entry.label.toLowerCase();
    if (asked.includes(name)) score += 8;
    for (const phrase of entry.words) if (asked.includes(phrase)) score += phrase.includes(" ") ? 6 : 4;
    const haystack = `${name} ${entry.purpose} ${entry.words.join(" ")} ${entry.group}`.toLowerCase();
    for (const term of terms) if (haystack.includes(term)) score += 1;
    if (score > 0) scored.push({ ...entry, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.href.length - b.href.length).slice(0, limit);
}

/** Every desk this viewer can open, grouped the way the rail groups them. */
export function myDesks(viewer: CopilotViewer): DeskEntry[] {
  return DESK_MAP.filter((entry) => canOpenDesk(entry, viewer));
}
