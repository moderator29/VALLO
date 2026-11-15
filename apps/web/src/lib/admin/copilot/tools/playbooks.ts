import type { StaffScope } from "@/lib/admin/guard";
import { tokens, visiblePassages, type ManualPassage } from "./manual-search";

/**
 * PLAYBOOKS: a step by step procedure for a named task, assembled from the
 * staff manual's own text (never written freehand here) with the real desk
 * link. Each playbook names the manual sections it is built from and the
 * access area that opens the desk. Pure: no server imports.
 */

export type Playbook = {
  key: string;
  title: string;
  /** Words a person might use for it, matched with the title. */
  words: readonly string[];
  /** Manual section links the steps come from, as `/admin/manual/<slug>#<id>`. */
  from: readonly string[];
  deskHref: string;
  deskName: string;
  /** The access areas that open the desk; empty means every staff member. */
  scopes: readonly StaffScope[];
};

export const PLAYBOOKS: readonly Playbook[] = [
  { key: "approve_listing", title: "Approve a listing", words: ["listing", "approve", "send back", "reject", "review listing"], from: ["/admin/manual/queues#listings", "/admin/manual/decisions#alone"], deskHref: "/admin/listings", deskName: "Listings", scopes: ["listing_approval"] },
  { key: "kyc_check", title: "Process a KYC or identity check", words: ["kyc", "identity", "id check", "document", "selfie", "verification", "agent application"], from: ["/admin/manual/queues#identity"], deskHref: "/admin/kyc", deskName: "KYC review", scopes: ["kyc_review"] },
  /* Added 15 November 2026 with the Cross-checks panel on the KYC desk. Its
     steps are the manual's own ("Before you escalate a possible fake ID").
     No word here is short enough to hide inside another word. */
  { key: "forged_id", title: "Suspected forged ID", words: ["forged", "forgery", "fake", "tampered", "edited id", "same id number", "id on two accounts", "bvn", "nin slip", "nin number", "cross-check", "cross check", "check digits", "passport lines"], from: ["/admin/manual/business-development#forged-id"], deskHref: "/admin/kyc", deskName: "KYC review", scopes: ["kyc_review"] },
  { key: "handle_report", title: "Handle a report or flagged message", words: ["report", "flag", "moderation", "abuse", "held content"], from: ["/admin/manual/queues#reports"], deskHref: "/admin/reports", deskName: "Reports and moderation", scopes: ["moderation", "trust_safety"] },
  { key: "support_ticket", title: "Work a support ticket", words: ["ticket", "support", "claim", "reply", "resolve"], from: ["/admin/manual/queues#tickets"], deskHref: "/admin/support", deskName: "Support", scopes: ["support", "support_lead"] },
  { key: "payment_dispute", title: "Handle a refund or payment dispute", words: ["refund", "payment", "dispute", "chargeback", "cancel", "money back"], from: ["/admin/manual/queues#refunds", "/admin/manual/queues#other"], deskHref: "/admin/chargebacks", deskName: "Chargebacks and refunds", scopes: ["finance", "support"] },
  { key: "escalate_case", title: "Escalate a case", words: ["escalate", "escalation", "urgent", "out of hours", "cannot decide", "who answers"], from: ["/admin/manual/escalation#in-the-console", "/admin/manual/escalation#who-answers", "/admin/manual/escalation#urgent", "/admin/manual/escalation#out-of-hours"], deskHref: "/admin/manual/escalation", deskName: "Escalation chapter", scopes: [] },
  /* Added 15 November 2026 with the product guide (chapter 15). Its steps are
     the guide's own words: what is open, what each side gets, what to say and
     what nobody says. Open to every member of staff. */
  { key: "answer_about_vallo", title: "Answer a prospect or a member about Vallo", words: ["prospect", "pitch", "outreach", "why list", "why should", "benefit", "b2b", "b2c", "what is vallo", "what vallo costs", "is it free", "what to say", "draft a reply", "partner"], from: ["/admin/manual/product-guide#what-to-say", "/admin/manual/product-guide#what-is-open", "/admin/manual/product-guide#for-businesses", "/admin/manual/product-guide#for-people", "/admin/manual/product-guide#never-say"], deskHref: "/admin/manual/product-guide", deskName: "Vallo, feature by feature", scopes: [] },
  { key: "weekly_report", title: "Write the weekly report", words: ["weekly", "report", "proof", "reviewer"], from: ["/admin/manual/weekly-report"], deskHref: "/my-desk", deskName: "My desk", scopes: [] },
];

export function findPlaybook(query: string): Playbook | null {
  const q = query.toLowerCase();
  const words = tokens(query);
  let best: { p: Playbook; score: number } | null = null;
  for (const p of PLAYBOOKS) {
    let score = p.key === q.trim() ? 100 : 0;
    for (const phrase of [p.title.toLowerCase(), ...p.words]) if (q.includes(phrase)) score += phrase.includes(" ") ? 4 : 2;
    for (const w of words) if (p.title.toLowerCase().includes(w)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

type Viewer = { isAdmin: boolean; isSuperAdmin: boolean; scopes: readonly StaffScope[] };

export type PlaybookAnswer =
  | { ok: true; title: string; steps: string[]; sources: { chapter: string; section: string; link: string }[]; desk: { name: string; href: string }; note: string }
  | { ok: false; reason: "unknown" | "no_access" | "no_text"; message: string; available: string[] };

/** Build the procedure for a viewer. A desk the viewer cannot open is never read out. */
export function buildPlaybook(query: string, passages: readonly ManualPassage[], viewer: Viewer): PlaybookAnswer {
  const available = PLAYBOOKS.map((p) => p.title);
  const playbook = findPlaybook(query);
  if (!playbook) return { ok: false, reason: "unknown", message: "No playbook matches that. Use search_manual, or point to /admin/manual.", available };
  const open = viewer.isAdmin || viewer.isSuperAdmin || playbook.scopes.length === 0 || playbook.scopes.some((s) => viewer.scopes.includes(s));
  if (!open) return { ok: false, reason: "no_access", message: `${playbook.title} is on the ${playbook.deskName} desk, which this person does not have access to. Say so and suggest their lead or the escalation chapter.`, available };
  const seen = visiblePassages(passages, viewer).filter((p) => p.source === "manual" && playbook.from.some((f) => p.link === f || (!f.includes("#") && p.link.startsWith(f))));
  if (seen.length === 0) return { ok: false, reason: "no_text", message: "The manual has no text for that yet. Point to /admin/manual.", available };
  const steps: string[] = [];
  for (const p of seen) {
    for (const sentence of p.text.split(/(?<=[.!?])\s+/)) {
      const text = sentence.trim();
      if (text.length >= 20 && !steps.includes(text)) steps.push(text);
    }
  }
  const sources = [...new Map(seen.map((p) => [p.link, { chapter: p.title, section: p.heading, link: p.link }])).values()];
  return { ok: true, title: playbook.title, steps: steps.slice(0, 10), sources, desk: { name: playbook.deskName, href: playbook.deskHref }, note: "Steps are the manual's own sentences in order. Cite the chapter, and offer to open the desk or draft the next step." };
}
