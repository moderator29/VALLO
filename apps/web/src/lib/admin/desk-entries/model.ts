import { isHttpUrl, isIsoDate, isUuid, lagosToday, trimmed, trimmedOrNull } from "@/lib/admin/desk-rules";

/**
 * THE SMALLER TOOLS OF THE FOUR NEW DESKS (founder, 10 November 2026): the
 * notes, briefs, checklists, runbooks, reminders, macros and coaching notes
 * a Marketing Manager, Content Manager, Technical Administrator and Customer
 * Support Lead use every week. They share one table (`staff_desk_entries`)
 * and one set of actions; the `kind` says what a row means and this file
 * says, for each kind, which fields it has and how it moves. Pure and
 * client-safe: the screen draws its forms from these definitions and the
 * server actions validate with the same ones, so the two cannot disagree.
 *
 * Nothing here holds a secret, a credential, a message from a member or a
 * payment detail, and the form text says so where it matters.
 */

export const ENTRY_DESKS = ["marketing", "content", "technical", "support_lead"] as const;
export type EntryDesk = (typeof ENTRY_DESKS)[number];

export type FieldType = "text" | "long" | "date" | "url" | "select" | "check";
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
  max?: number;
};

export type EntryFlow = "plain" | "approval";

export type KindDef = {
  kind: string;
  desk: EntryDesk;
  label: string;
  plural: string;
  /** One sentence under the tab heading: what the tool is for. */
  blurb: string;
  /** Short prefix of the reference people quote, for example CR for a content request. */
  ref: string;
  titleLabel: string;
  titlePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  bodyRequired?: boolean;
  bodyMax?: number;
  /** A date field: required or optional. */
  due?: { label: string; required?: boolean };
  link?: { label: string };
  /** A support agent the note is about (coaching notes). */
  subject?: { label: string };
  flow: EntryFlow;
  fields: readonly FieldDef[];
  /** What marking one done is called. */
  doneLabel?: string;
  /** Show the body as numbered steps (a runbook). */
  steps?: boolean;
};

const opts = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
const text = (key: string, label: string, placeholder = "", max = 300): FieldDef => ({ key, label, type: "text", placeholder, max });
const long = (key: string, label: string, placeholder = "", max = 1500): FieldDef => ({ key, label, type: "long", placeholder, max });
const select = (key: string, label: string, options: readonly { value: string; label: string }[]): FieldDef => ({ key, label, type: "select", options });
const check = (key: string, label: string): FieldDef => ({ key, label, type: "check" });

const TRANSLATION = opts(["not_started", "Not started"], ["drafting", "Drafting"], ["reviewed", "Reviewed"], ["live", "Live"]);
const DEPARTMENTS = opts(
  ["marketing", "Marketing"],
  ["support", "Support"],
  ["operations", "Operations"],
  ["trust", "Trust and Safety"],
  ["finance", "Finance"],
  ["product", "Product and technical"],
  ["business_development", "Business development"],
  ["other", "Somewhere else"],
);

export const KIND_DEFS: readonly KindDef[] = [
  /* ----------------------------------------------------------- marketing */
  {
    kind: "segment_note", desk: "marketing", label: "Audience segment", plural: "Audience segments", ref: "SG", flow: "plain",
    blurb: "Who a campaign is for: renters, buyers, agents, landlords, hosts, restaurants, students. Write what you know and where you learned it.",
    titleLabel: "Segment", titlePlaceholder: "e.g. Final-year students looking for rooms",
    bodyLabel: "Who they are and what they need", bodyPlaceholder: "What they look for, what worries them, what makes them trust a listing.", bodyRequired: true,
    fields: [text("size", "Roughly how many, and from where", "e.g. about 4,000 sign-ups from the Roommates page"), text("best_channel", "Where they are reached best", "e.g. Instagram stories, campus groups")],
  },
  {
    kind: "market_note", desk: "marketing", label: "Market note", plural: "Market notes", ref: "MN", flow: "plain",
    blurb: "What you see in a city or a market: rent levels, a competitor's offer, a season. Note the source, so nobody mistakes a guess for a fact.",
    titleLabel: "Topic", titlePlaceholder: "e.g. Lekki shortlet demand in December",
    bodyLabel: "What you saw", bodyPlaceholder: "What changed, how you know, and what it might mean for a campaign.", bodyRequired: true,
    fields: [text("city", "City or area", "e.g. Lagos, Yaba"), text("source", "Where this came from", "e.g. agent call, public listing site, our own searches")],
  },
  {
    kind: "creative_brief", desk: "marketing", label: "Creative brief", plural: "Creative briefs", ref: "CB", flow: "plain",
    blurb: "One page that tells the Social Media Manager and the Content Manager what a campaign needs, so nobody guesses.",
    titleLabel: "Campaign or asset", titlePlaceholder: "e.g. December shortlet push, three reels",
    bodyLabel: "The one message", bodyPlaceholder: "The single thing a person should remember after seeing this.", bodyRequired: true,
    due: { label: "Needed by" }, doneLabel: "Mark delivered",
    fields: [text("audience", "Audience", "Which segment"), text("tone", "Tone", "e.g. warm, plain, a little cheeky, never pushy"), long("deliverables", "What is needed", "e.g. 3 reels, 6 captions, 1 landing line"), text("cta", "What we ask people to do", "e.g. Browse stays in Lagos"), text("must_avoid", "Must not say", "e.g. any promise about payments being safe")],
  },
  {
    kind: "ab_test", desk: "marketing", label: "A/B test", plural: "A/B test log", ref: "AB", flow: "plain",
    blurb: "Every test you run, what you changed and what happened, so the same lesson is not learned twice.",
    titleLabel: "Question being tested", titlePlaceholder: "e.g. Does a price in the first line lift clicks?",
    bodyLabel: "What happened and what you will do next", bodyPlaceholder: "Numbers from the platform's own dashboard, and your reading of them.",
    due: { label: "Test ends" }, doneLabel: "Mark finished",
    fields: [text("variant_a", "Version A", "What people saw"), text("variant_b", "Version B", "What people saw"), text("metric", "What you measured", "e.g. link clicks per 1,000 impressions"),
      select("result", "Result", opts(["running", "Still running"], ["a_won", "A did better"], ["b_won", "B did better"], ["no_difference", "No real difference"], ["stopped", "Stopped early"]))],
  },
  {
    kind: "monthly_report", desk: "marketing", label: "Monthly performance report", plural: "Monthly reports", ref: "MR", flow: "approval",
    blurb: "The month in one page for the COO: what ran, what it cost, what it brought. Use the report builder, edit it, then send it for approval.",
    titleLabel: "Report", titlePlaceholder: "e.g. Marketing report, November 2026",
    bodyLabel: "The report", bodyPlaceholder: "Use the report builder on the Report tab to start, then add your reading.", bodyRequired: true, bodyMax: 12000,
    fields: [text("month", "Month", "YYYY-MM, e.g. 2026-11", 7)],
  },
  /* ------------------------------------------------------------- content */
  {
    kind: "content_request", desk: "content", label: "Content request", plural: "Content requests", ref: "CR", flow: "plain",
    blurb: "A place for other departments to ask for words: a help article, an email, a notice. Log each ask, say who is waiting, and close it when it ships.",
    titleLabel: "What is needed", titlePlaceholder: "e.g. A help article on how deposits work",
    bodyLabel: "Details", bodyPlaceholder: "What they need it for, who will read it, any facts they have already agreed.", bodyRequired: true,
    due: { label: "Needed by" }, doneLabel: "Mark delivered",
    fields: [select("from_dept", "Asked by", DEPARTMENTS), select("priority", "How urgent", opts(["normal", "Normal"], ["soon", "Soon"], ["urgent", "Urgent"])), text("contact", "Who to ask", "Name or desk, never a phone number or email", 120)],
  },
  {
    kind: "style_note", desk: "content", label: "Style and tone note", plural: "Style guide", ref: "ST", flow: "plain",
    blurb: "The house voice, written down once: how Vallo sounds, how it spells things, which words it never uses.",
    titleLabel: "Rule", titlePlaceholder: "e.g. Say 'pay on Vallo', never 'safe payment'",
    bodyLabel: "The rule and an example", bodyPlaceholder: "What to do, what not to do, and a before and after.", bodyRequired: true,
    fields: [text("applies_to", "Applies to", "e.g. all member-facing text, emails, help articles", 160)],
  },
  {
    kind: "seo_check", desk: "content", label: "SEO checklist", plural: "SEO checklists", ref: "SE", flow: "plain",
    blurb: "One checklist per article, run before it is published, so every page can be found by the people who need it.",
    titleLabel: "Article", titlePlaceholder: "e.g. How to rent a room near your campus",
    bodyLabel: "Notes", bodyPlaceholder: "The search phrase you are writing for, and anything still to fix.",
    link: { label: "Page or draft link" }, doneLabel: "Mark checked",
    fields: [text("phrase", "The phrase a person would search", "e.g. rent a room near UNILAG", 160), check("title_ok", "Title says what the page is, under 60 characters"), check("meta_ok", "Description written, under 160 characters"), check("headings_ok", "One main heading, then clear sub-headings"), check("links_ok", "Links to two related Vallo pages, and none are broken"), check("alt_ok", "Every image has plain alt text"), check("url_ok", "The address is short and readable")],
  },
  {
    kind: "translation", desk: "content", label: "Translation status", plural: "Translation status", ref: "TR", flow: "plain",
    blurb: "Where each piece stands in English, Hausa, Yoruba and Igbo. A piece is live in a language only when a fluent person has read it.",
    titleLabel: "Item", titlePlaceholder: "e.g. Help article: paying a deposit",
    bodyLabel: "Notes", bodyPlaceholder: "Who is translating, who will review, what is blocked.",
    link: { label: "Link to the source text" }, doneLabel: "Mark complete",
    fields: [select("en", "English", TRANSLATION), select("ha", "Hausa", TRANSLATION), select("yo", "Yoruba", TRANSLATION), select("ig", "Igbo", TRANSLATION)],
  },
  {
    kind: "publish_check", desk: "content", label: "Publishing checklist", plural: "Publishing checklists", ref: "PC", flow: "plain",
    blurb: "The last look before anything goes live. Every box ticked, or a note saying why not.",
    titleLabel: "Item", titlePlaceholder: "e.g. November product update",
    bodyLabel: "Notes", bodyPlaceholder: "Anything the checks turned up.", link: { label: "Link to the draft" }, doneLabel: "Mark published",
    fields: [check("facts", "Every fact checked against the desk that owns it"), check("money_wording", "Money wording right: Vallo never holds customer money"), check("claims", "No promise that a payment is safe, protected or guaranteed"), check("approved", "Approved in the content desk"), check("links", "Every link opens the right page"), check("translations", "Languages needed are ready"), check("scheduled", "Date and channel agreed"), check("announced", "Staff told if they will get questions")],
  },
  {
    kind: "staff_announcement_draft", desk: "content", label: "Staff announcement draft", plural: "Staff announcement drafts", ref: "SA", flow: "approval",
    blurb: "Words for a staff announcement, written well and approved before the COO or an admin posts it in My Desk. Nothing here reaches staff or members by itself.",
    titleLabel: "Headline", titlePlaceholder: "e.g. New help article on deposits",
    bodyLabel: "Message", bodyPlaceholder: "Short, plain, and what staff should do about it.", bodyRequired: true, bodyMax: 4000,
    fields: [select("audience", "For", opts(["all", "Everyone"], ["support", "Support"], ["moderation", "Moderation"], ["operations", "Operations"], ["listing_approval", "Listings"], ["finance", "Finance"]))],
  },
  {
    kind: "docs_gap", desk: "content", label: "Help gap", plural: "Help and docs gaps", ref: "HG", flow: "plain",
    blurb: "A page or answer members need and do not have, or one that does not help. Start from the Pages-that-fail list, and from what support keeps explaining.",
    titleLabel: "Page or question", titlePlaceholder: "e.g. /help/deposits, or 'How do I get my deposit back?'",
    bodyLabel: "What is missing", bodyPlaceholder: "What people asked, and what the answer should say.", bodyRequired: true,
    due: { label: "Fix by" }, doneLabel: "Mark fixed",
    fields: [select("source", "Seen in", opts(["doc_feedback", "Pages that fail"], ["tickets", "Support tickets"], ["staff", "A colleague"], ["other", "Somewhere else"]))],
  },
  /* ----------------------------------------------------------- technical */
  {
    kind: "runbook", desk: "technical", label: "Runbook", plural: "Runbooks", ref: "RB", flow: "plain", steps: true,
    blurb: "A step list for something that goes wrong the same way twice. Write it so a tired person at night can follow it. Never put a key, password or token in one.",
    titleLabel: "When this happens", titlePlaceholder: "e.g. Scheduled job has not run for three hours",
    bodyLabel: "Steps, one per line", bodyPlaceholder: "Check the Health tab for the job.\nOpen the audit log and look for the last run.\nIf it failed, tell the COO.", bodyRequired: true, bodyMax: 6000,
    fields: [text("who", "Who to call first", "A role, not a number", 120), text("check_after", "How you know it worked", "", 200)],
  },
  {
    kind: "oncall_note", desk: "technical", label: "On-call note", plural: "On-call notes", ref: "OC", flow: "plain",
    blurb: "The handover for whoever watches next: what is shaky, what is being watched, who is away.",
    titleLabel: "Handover", titlePlaceholder: "e.g. Week of 9 November",
    bodyLabel: "What the next person needs to know", bodyPlaceholder: "Open incidents, jobs to watch, planned changes, who is reachable and when.", bodyRequired: true,
    due: { label: "Week starting" }, doneLabel: "Mark handed over", fields: [],
  },
  {
    kind: "release_note", desk: "technical", label: "Release note", plural: "Release notes", ref: "RN", flow: "plain",
    blurb: "What changed in each release, in plain words, so support and operations are not surprised.",
    titleLabel: "Release", titlePlaceholder: "e.g. 9 November web release",
    bodyLabel: "What changed", bodyPlaceholder: "What people will notice, what was fixed, anything staff should know.", bodyRequired: true,
    due: { label: "Released on" },
    fields: [text("version", "Version or build", "e.g. the short code shown on the Health tab", 60), select("type", "Mostly", opts(["feature", "A new feature"], ["fix", "A fix"], ["infrastructure", "Behind the scenes"], ["mixed", "A mix"]))],
  },
  {
    kind: "status_draft", desk: "technical", label: "Status page draft", plural: "Status page drafts", ref: "SP", flow: "approval",
    blurb: "The wording for a status page or a notice during an incident. It is a draft until the COO or an admin approves it; nothing is published from here.",
    titleLabel: "Headline", titlePlaceholder: "e.g. Some bookings are slow to confirm",
    bodyLabel: "Message", bodyPlaceholder: "What is wrong, who is affected, what we are doing, when we will update. No cause you are not sure of.", bodyRequired: true, bodyMax: 3000,
    fields: [select("state", "Stage", opts(["investigating", "Investigating"], ["identified", "Cause found"], ["monitoring", "Watching the fix"], ["resolved", "Resolved"])), text("incident_ref", "Incident reference", "e.g. INC-1A2B3C", 60)],
  },
  {
    kind: "reminder", desk: "technical", label: "Expiry reminder", plural: "Expiry reminders", ref: "XR", flow: "plain",
    blurb: "Things that quietly run out: a certificate, a domain, a dependency's support, a plan. Name what, where to renew and when. Not the login.",
    titleLabel: "What expires", titlePlaceholder: "e.g. Domain renewal for the main site",
    bodyLabel: "How to renew", bodyPlaceholder: "Who renews it and where, in words. Never a password or a key.",
    due: { label: "Expires on", required: true }, doneLabel: "Mark renewed",
    fields: [select("category", "Kind", opts(["certificate", "Certificate"], ["domain", "Domain"], ["dependency", "Dependency or library"], ["licence", "Licence"], ["plan", "Provider plan"], ["other", "Other"])), text("where", "Where it lives", "e.g. the registrar, the host, the app store", 160)],
  },
  {
    kind: "incident_review", desk: "technical", label: "Post-incident review", plural: "Post-incident reviews", ref: "PR", flow: "plain",
    blurb: "After every serious incident: what happened, why, what went well and what changes. A review blames a process, never a person.",
    titleLabel: "Incident", titlePlaceholder: "e.g. Slow bookings on 9 November",
    bodyLabel: "What happened, in order", bodyPlaceholder: "A timeline in plain words: when it started, when it was noticed, what was done, when it ended.", bodyRequired: true, bodyMax: 6000,
    doneLabel: "Mark reviewed",
    fields: [text("incident_ref", "Incident reference", "e.g. INC-1A2B3C", 60), long("impact", "Who was affected and how", "Counts, not names"), long("cause", "Why it happened", "The cause, as far as you know it"), long("went_well", "What went well"), long("to_improve", "What to change"), long("actions", "Actions, with who and when")],
  },
  /* -------------------------------------------------------- support lead */
  {
    kind: "macro", desk: "support_lead", label: "Canned reply", plural: "Canned replies", ref: "MC", flow: "approval",
    blurb: "A tested reply for a question that comes up often. The team uses approved replies only, and always edits them to fit the person.",
    titleLabel: "Name", titlePlaceholder: "e.g. Deposit not showing yet",
    bodyLabel: "The reply", bodyPlaceholder: "Warm and plain. Say what we know, what happens next and when. Never promise an outcome another desk decides.", bodyRequired: true, bodyMax: 4000,
    fields: [text("topic", "Topic", "e.g. payments, bookings, account", 80), select("language", "Language", opts(["en", "English"], ["ha", "Hausa"], ["yo", "Yoruba"], ["ig", "Igbo"]))],
  },
  {
    kind: "rota_note", desk: "support_lead", label: "Rota note", plural: "Rota notes", ref: "RO", flow: "plain",
    blurb: "Who covers which hours, who is away and what the cover needs to know. Names of colleagues only; no personal details.",
    titleLabel: "Cover", titlePlaceholder: "e.g. Weekend cover, 14 and 15 November",
    bodyLabel: "Who and when", bodyPlaceholder: "Who is on, from when to when, and who they ask.", bodyRequired: true,
    due: { label: "Starts on" }, doneLabel: "Mark finished", fields: [],
  },
  {
    kind: "escalation_rule", desk: "support_lead", label: "Escalation rule", plural: "Escalation matrix", ref: "ER", flow: "plain",
    blurb: "For each kind of problem: who it goes to, how fast, and what to put in the handover. The matrix the team reads when unsure.",
    titleLabel: "When", titlePlaceholder: "e.g. A member says money left their bank and has not arrived",
    bodyLabel: "What to do", bodyPlaceholder: "The steps, and what the receiving desk needs from you.", bodyRequired: true,
    fields: [select("send_to", "Send to", opts(["finance", "Finance"], ["trust_safety", "Trust and Safety"], ["operations", "Operations"], ["compliance", "Compliance"], ["coo", "The COO"], ["technical", "Technical"])), text("within", "Within", "e.g. the same hour", 80)],
  },
  {
    kind: "coaching_note", desk: "support_lead", label: "Coaching note", plural: "Coaching notes", ref: "CN", flow: "plain",
    blurb: "A note about one agent's growth: what they do well, one thing to work on, and when you will look again. About the work, never the person.",
    titleLabel: "Focus", titlePlaceholder: "e.g. Shorter first replies",
    bodyLabel: "What you observed and what you agreed", bodyPlaceholder: "A specific example, what better looks like and what support you will give.", bodyRequired: true,
    subject: { label: "Agent" }, due: { label: "Look again on" }, doneLabel: "Mark followed up",
    fields: [select("area", "Area", opts(["tone", "Tone"], ["accuracy", "Accuracy"], ["speed", "Speed"], ["policy", "Policy"], ["other", "Something else"]))],
  },
  {
    kind: "kb_gap", desk: "support_lead", label: "Knowledge-base gap", plural: "Knowledge-base gaps", ref: "KB", flow: "plain",
    blurb: "A question the team answers again and again that the help pages do not answer. The Content Manager reads this list.",
    titleLabel: "The question", titlePlaceholder: "e.g. How long does a deposit take to show?",
    bodyLabel: "What the answer should say", bodyPlaceholder: "The answer the team gives today, so the writer can start from it.", bodyRequired: true,
    doneLabel: "Mark answered",
    fields: [text("topic", "Topic", "e.g. payments", 80), text("seen", "Roughly how often", "e.g. 10 tickets this week", 80)],
  },
];

const BY_KIND = new Map(KIND_DEFS.map((def) => [def.kind, def]));

export function kindDef(kind: unknown): KindDef | null {
  return typeof kind === "string" ? (BY_KIND.get(kind) ?? null) : null;
}
export function kindsOfDesk(desk: EntryDesk): KindDef[] {
  return KIND_DEFS.filter((def) => def.desk === desk);
}
export function isEntryDesk(v: unknown): v is EntryDesk {
  return typeof v === "string" && (ENTRY_DESKS as readonly string[]).includes(v);
}

/* ----------------------------------------------------------------- statuses */

export const ENTRY_STATUSES = ["open", "done", "draft", "submitted", "approved", "sent_back", "retired"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export function isEntryStatus(v: unknown): v is EntryStatus {
  return typeof v === "string" && (ENTRY_STATUSES as readonly string[]).includes(v);
}
export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  open: "Open",
  done: "Done",
  draft: "Draft",
  submitted: "Waiting for approval",
  approved: "Approved",
  sent_back: "Sent back",
  retired: "Retired",
};

/** The status a new entry starts in. */
export function startStatus(def: Pick<KindDef, "flow">): EntryStatus {
  return def.flow === "approval" ? "draft" : "open";
}

/** Only an entry that is not waiting on, or past, a decision is edited in place. */
export function isEntryEditable(def: Pick<KindDef, "flow">, status: EntryStatus): boolean {
  if (status === "retired") return false;
  if (def.flow === "approval") return status === "draft" || status === "sent_back";
  return status === "open" || status === "done";
}

/* ------------------------------------------------------------------ entries */

export type Entry = {
  id: string;
  desk: EntryDesk;
  kind: string;
  title: string;
  body: string;
  status: EntryStatus;
  dueOn: string | null;
  linkUrl: string | null;
  subjectUser: string | null;
  fields: Record<string, string>;
  reviewNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  ownerId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The reference people quote: a short code and the first six characters of the id. */
const OTHER_REFS: Record<string, string> = { campaign: "CP", content_item: "CI", incident: "INC", ticket_review: "QA", policy: "PL" };
export function entryRef(kind: string, id: string): string {
  const def = kindDef(kind);
  return `${def?.ref ?? OTHER_REFS[kind] ?? "EN"}-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** A fields object from stored JSON: only string values, only the keys the kind declares. */
export function cleanFields(def: KindDef, raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const source = raw as Record<string, unknown>;
  for (const field of def.fields) {
    const value = source[field.key];
    if (typeof value === "string" && value !== "") out[field.key] = value;
  }
  return out;
}

export type EntryInput = {
  title: string;
  body: string;
  dueOn: string;
  linkUrl: string;
  subjectUser: string;
  fields: Record<string, string>;
};
export const EMPTY_ENTRY_INPUT: EntryInput = { title: "", body: "", dueOn: "", linkUrl: "", subjectUser: "", fields: {} };

export type ParsedEntry =
  | { value: { title: string; body: string; due_on: string | null; link_url: string | null; subject_user: string | null; fields: Record<string, string> } }
  | { error: string; fieldErrors: Record<string, string> };

/** Validates one entry against its kind before any write. */
export function parseEntry(def: KindDef, input: EntryInput): ParsedEntry {
  const fieldErrors: Record<string, string> = {};
  const title = trimmed(input.title, 200);
  if (!title) fieldErrors.title = `Give the ${def.label.toLowerCase()} a title.`;
  const bodyMax = def.bodyMax ?? 8000;
  const body = (input.body ?? "").trim();
  if (def.bodyRequired && !body) fieldErrors.body = "This needs some words.";
  if (body.length > bodyMax) fieldErrors.body = "That is too long. Split it in two.";
  const dueOn = trimmedOrNull(input.dueOn, 10);
  if (!def.due && dueOn) fieldErrors.dueOn = "This tool has no date.";
  if (def.due?.required && !dueOn) fieldErrors.dueOn = "Choose a date.";
  if (dueOn && !isIsoDate(dueOn)) fieldErrors.dueOn = "Choose a real date.";
  const linkUrl = trimmedOrNull(input.linkUrl, 2000);
  if (linkUrl && !def.link) fieldErrors.linkUrl = "This tool has no link.";
  if (linkUrl && !isHttpUrl(linkUrl)) fieldErrors.linkUrl = "Use a full web address starting with https://.";
  const subject = trimmedOrNull(input.subjectUser, 40);
  if (def.subject && !subject) fieldErrors.subjectUser = "Choose who this is about.";
  if (subject && !def.subject) fieldErrors.subjectUser = "This tool is not about a person.";
  if (subject && !isUuid(subject)) fieldErrors.subjectUser = "Choose someone from the list.";

  const fields: Record<string, string> = {};
  for (const field of def.fields) {
    const raw = typeof input.fields?.[field.key] === "string" ? (input.fields[field.key] as string) : "";
    if (field.type === "check") {
      if (raw === "yes") fields[field.key] = "yes";
      continue;
    }
    const value = raw.trim().slice(0, field.max ?? 300);
    if (!value) continue;
    if (field.type === "select" && !field.options?.some((o) => o.value === value)) {
      fieldErrors[`fields.${field.key}`] = "Choose one from the list.";
      continue;
    }
    if (field.type === "date" && !isIsoDate(value)) {
      fieldErrors[`fields.${field.key}`] = "Choose a real date.";
      continue;
    }
    if (field.type === "url" && !isHttpUrl(value)) {
      fieldErrors[`fields.${field.key}`] = "Use a full web address starting with https://.";
      continue;
    }
    fields[field.key] = value;
  }
  if (Object.keys(fieldErrors).length > 0) return { error: "Check the highlighted fields and try again.", fieldErrors };
  return { value: { title, body: body.slice(0, bodyMax), due_on: dueOn, link_url: linkUrl, subject_user: subject, fields } };
}

/** The text a Copy button puts on the clipboard for one entry. */
export function entryCopyText(def: KindDef, entry: Pick<Entry, "title" | "body" | "fields" | "kind" | "id">): string {
  const lines = [entry.title];
  if (entry.body) lines.push("", entry.body);
  for (const field of def.fields) {
    const value = entry.fields[field.key];
    if (!value) continue;
    if (field.type === "check") lines.push(`${field.label}: yes`);
    else if (field.type === "select") lines.push(`${field.label}: ${field.options?.find((o) => o.value === value)?.label ?? value}`);
    else lines.push(`${field.label}: ${value}`);
  }
  return lines.join("\n");
}

export function checkCounts(def: KindDef, fields: Record<string, string>): { done: number; total: number } {
  const checks = def.fields.filter((f) => f.type === "check");
  return { done: checks.filter((f) => fields[f.key] === "yes").length, total: checks.length };
}

/** A runbook's steps: the non-empty lines of its body. */
export function stepsOf(body: string): string[] {
  return body.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Past its date and not yet closed. */
export function isEntryOverdue(entry: Pick<Entry, "dueOn" | "status">, today: string = lagosToday()): boolean {
  return entry.dueOn !== null && entry.dueOn < today && (entry.status === "open" || entry.status === "draft" || entry.status === "sent_back" || entry.status === "submitted");
}

export function entriesOf(entries: readonly Entry[], kind: string): Entry[] {
  return entries.filter((e) => e.kind === kind);
}

export type EntryCounts = { open: number; overdue: number; waitingApproval: number; done: number };
export function countEntries(entries: readonly Entry[], today: string = lagosToday()): EntryCounts {
  const live = entries.filter((e) => e.status !== "retired");
  return {
    open: live.filter((e) => e.status === "open" || e.status === "draft" || e.status === "sent_back").length,
    overdue: live.filter((e) => isEntryOverdue(e, today)).length,
    waitingApproval: live.filter((e) => e.status === "submitted").length,
    done: live.filter((e) => e.status === "done" || e.status === "approved").length,
  };
}

/** Reminders that run out within `days` (inclusive) and are not renewed. */
export function expiringSoon(entries: readonly Entry[], days: number, today: string = lagosToday()): Entry[] {
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return entries
    .filter((e) => e.kind === "reminder" && e.status === "open" && e.dueOn !== null && e.dueOn <= limit)
    .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : 1));
}
