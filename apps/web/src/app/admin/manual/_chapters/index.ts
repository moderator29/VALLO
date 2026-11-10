import type { ManualSlug } from "@/lib/admin/manual/chapters";
import { ACCESS } from "./access";
import { CONTENT } from "./content";
import { MARKETING } from "./marketing";
import { SUPPORT_LEAD } from "./support-lead";
import { TECHNICAL } from "./technical";
import { DECISIONS } from "./decisions";
import { DESKS } from "./desks";
import { ESCALATION } from "./escalation";
import { MY_DESK } from "./my-desk";
import type { ManualBody } from "./parts";
import { QUEUES } from "./queues";
import { RECORDS } from "./records";
import { WEEKLY_REPORT } from "./weekly-report";

/** Each chapter's words, keyed by the slug the index in `lib/admin/manual` lists. */
export const MANUAL_BODIES: Record<ManualSlug, ManualBody> = {
  access: ACCESS,
  desks: DESKS,
  queues: QUEUES,
  decisions: DECISIONS,
  records: RECORDS,
  escalation: ESCALATION,
  "my-desk": MY_DESK,
  "weekly-report": WEEKLY_REPORT,
  marketing: MARKETING,
  content: CONTENT,
  technical: TECHNICAL,
  "support-lead": SUPPORT_LEAD,
};
