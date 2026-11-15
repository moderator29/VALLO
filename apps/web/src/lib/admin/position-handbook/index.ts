import { JOB_DESCRIPTIONS, STAFF_POSITIONS, type StaffPosition } from "@/lib/admin/staff-positions";
import { buildHandbook } from "./build";
import { textOf } from "./flatten";
import { handbookMarkdown, type HandbookDocument } from "./markdown";
import {
  AGREEMENTS_OFFICER,
  KYC_REVIEWER,
  LISTINGS_REVIEWER,
  MODERATOR,
  SUPPORT_AGENT,
} from "./roles/frontline";
import { CEO, CFO, COO } from "./roles/exec";
import {
  BUSINESS_DEVELOPMENT_EXECUTIVE,
  CONTENT_MANAGER,
  MARKETING_MANAGER,
  SOCIAL_MEDIA_MANAGER,
  TECHNICAL_ADMINISTRATOR,
} from "./roles/growth";
import {
  COMPLIANCE_OFFICER,
  CUSTOMER_SUPPORT_LEAD,
  FINANCE_OFFICER,
  OPERATIONS_MANAGER,
  TRUST_SAFETY_LEAD,
} from "./roles/leads";
import type { HandbookBody, RoleWords } from "./types";

/**
 * THE POSITION HANDBOOKS (15 November 2026).
 *
 * One detailed handbook for every named staff position: what the job is for,
 * the first day and the first week, every desk the position opens, what it
 * may decide, the work step by step, the standard, the words, how to
 * escalate, what the copilot does for it, the privacy rules that bite, and
 * who to go to. A person reads their own at
 * `/admin/handbook/position`, and any position's at
 * `/admin/handbook/position/<position>`.
 *
 * WHAT THE COPILOT IMPORTS, and the only thing it needs:
 *
 *   import { POSITION_HANDBOOK_INDEX, positionHandbookPassages } from "@/lib/admin/position-handbook";
 *   positionHandbookPassages(position: StaffPosition): { id: string; title: string; text: string }[]
 *
 * The passages are the handbook's own words, flattened from the same JSX the
 * page renders (`flatten.ts`, the approach `app/(site)/docs/glance.ts` uses),
 * so the copilot and the page can never disagree. Pure: no database, no
 * request, no server door.
 *
 * Client-safe. Nothing here imports `lib/admin/guard.ts`, which is
 * server-only; the access area labels come from the manual's client-safe copy
 * of them, and `position-handbook.test.ts` fails the moment that copy and the
 * console's own labels disagree.
 */

/** The day the handbooks were last read against the console's code. */
export const POSITION_HANDBOOK_UPDATED = "2026-11-15";

/** Each position's own words. Every position in `STAFF_POSITIONS` has one. */
const ROLE_WORDS: Record<StaffPosition, RoleWords> = {
  moderator: MODERATOR,
  support_agent: SUPPORT_AGENT,
  kyc_reviewer: KYC_REVIEWER,
  listings_reviewer: LISTINGS_REVIEWER,
  agreements_officer: AGREEMENTS_OFFICER,
  trust_safety_lead: TRUST_SAFETY_LEAD,
  compliance_officer: COMPLIANCE_OFFICER,
  finance_officer: FINANCE_OFFICER,
  operations_manager: OPERATIONS_MANAGER,
  cfo: CFO,
  coo: COO,
  ceo: CEO,
  business_development_executive: BUSINESS_DEVELOPMENT_EXECUTIVE,
  social_media_manager: SOCIAL_MEDIA_MANAGER,
  marketing_manager: MARKETING_MANAGER,
  content_manager: CONTENT_MANAGER,
  technical_administrator: TECHNICAL_ADMINISTRATOR,
  customer_support_lead: CUSTOMER_SUPPORT_LEAD,
};

/** Where one position's handbook is read. */
export function positionHandbookRoute(position: StaffPosition): string {
  return `/admin/handbook/position/${position}`;
}

const BODIES = new Map<StaffPosition, HandbookBody>();

/** One position's handbook, built once per process. */
export function positionHandbook(position: StaffPosition): HandbookBody {
  const built = BODIES.get(position);
  if (built) return built;
  const body = buildHandbook(position, ROLE_WORDS[position]);
  BODIES.set(position, body);
  return body;
}

/** Every handbook, named, with its route. What a copilot lists. */
export type PositionHandbookEntry = {
  position: StaffPosition;
  title: string;
  /** One sentence: what the position is for, from its job description. */
  summary: string;
  route: string;
  sections: number;
};

export const POSITION_HANDBOOK_INDEX: readonly PositionHandbookEntry[] = STAFF_POSITIONS.map((position) => ({
  position,
  title: JOB_DESCRIPTIONS[position].title,
  summary: JOB_DESCRIPTIONS[position].summary,
  route: positionHandbookRoute(position),
  sections: positionHandbook(position).sections.length,
}));

/**
 * ONE HANDBOOK'S PASSAGES, FOR A COPILOT. The handbook's own words, section by
 * section, as plain text with the anchor each one is read at. Pure.
 */
export function positionHandbookPassages(position: StaffPosition): { id: string; title: string; text: string }[] {
  const body = positionHandbook(position);
  const title = JOB_DESCRIPTIONS[position].title;
  const out: { id: string; title: string; text: string }[] = [
    {
      id: "overview",
      title: `${title}: handbook overview`,
      text: [textOf(body.intro), ...body.glance.map((point) => textOf(point))].filter(Boolean).join(" "),
    },
  ];
  for (const section of body.sections) {
    out.push({ id: section.id, title: `${title}: ${section.title}`, text: textOf(section.body) });
  }
  return out;
}

/** One handbook flattened to the plain document a file is made from. */
export function positionHandbookDocument(position: StaffPosition): HandbookDocument {
  const body = positionHandbook(position);
  return {
    position,
    title: JOB_DESCRIPTIONS[position].title,
    route: positionHandbookRoute(position),
    updated: POSITION_HANDBOOK_UPDATED,
    intro: textOf(body.intro),
    glance: body.glance.map((point) => textOf(point)),
    sections: body.sections.map((section) => ({
      id: section.id,
      title: section.title,
      text: textOf(section.body),
    })),
  };
}

export { handbookMarkdown };
export type { HandbookDocument };
export { handbookFileName, slugOf, todayInLagos } from "./markdown";
export type { HandbookBody, HandbookSection, RoleWords } from "./types";
