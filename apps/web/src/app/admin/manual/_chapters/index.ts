import type { ManualSlug } from "@/lib/admin/manual/chapters";
import { ACCESS } from "./access";
import { DECISIONS } from "./decisions";
import { DESKS } from "./desks";
import { ESCALATION } from "./escalation";
import type { ManualBody } from "./parts";
import { QUEUES } from "./queues";
import { RECORDS } from "./records";

/** Each chapter's words, keyed by the slug the index in `lib/admin/manual` lists. */
export const MANUAL_BODIES: Record<ManualSlug, ManualBody> = {
  access: ACCESS,
  desks: DESKS,
  queues: QUEUES,
  decisions: DECISIONS,
  records: RECORDS,
  escalation: ESCALATION,
};
