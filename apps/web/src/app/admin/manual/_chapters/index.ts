import type { ManualSlug } from "@/lib/admin/manual/chapters";
import { ACCESS } from "./access";
import { BUSINESS_DEVELOPMENT } from "./business-development";
import { CONTENT } from "./content";
import { COPILOT } from "./copilot";
import { MARKETING } from "./marketing";
import { MONEY } from "./money";
import { OFFERS_AND_DEALS } from "./offers-and-deals";
import { SUPPORT_LEAD } from "./support-lead";
import { TECHNICAL } from "./technical";
import { DECISIONS } from "./decisions";
import { DESKS } from "./desks";
import { ESCALATION } from "./escalation";
import { MY_DESK } from "./my-desk";
import { ONBOARDING_A_LISTER } from "./onboarding-a-lister";
import { ONBOARDING_A_MEMBER } from "./onboarding-a-member";
import { PRODUCT_GUIDE } from "./product-guide";
import type { ManualBody } from "./parts";
import { QUEUES } from "./queues";
import { RECORDS } from "./records";
import { SOCIAL_MEDIA } from "./social-media";
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
  "business-development": BUSINESS_DEVELOPMENT,
  "social-media": SOCIAL_MEDIA,
  "product-guide": PRODUCT_GUIDE,
  "onboarding-a-lister": ONBOARDING_A_LISTER,
  "onboarding-a-member": ONBOARDING_A_MEMBER,
  copilot: COPILOT,
  money: MONEY,
  "offers-and-deals": OFFERS_AND_DEALS,
};
