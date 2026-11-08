/**
 * THE WORDS OF /pro (SW11). The source of truth is now
 * `packages/i18n/src/locales/pro.en.ts`; this re-export keeps every
 * consumer's import unchanged and applies the type constraints that
 * reference app-side types.
 */
import { proEn } from "@vallo/i18n/en/pro";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { PlanPerk, PlanQuotaKey } from "./pro-state";

export type ProBenefit = { claim: string; reason: string; icon: UiIconName };

/** The words for a plan the database describes, by its `plan_key`. */
export type ProPlanWords = {
  /** The segmented pill's word. */
  short: string;
  /** Who the plan is for, under its name. */
  line: string;
  /** The small word on the metal card. */
  tag: string;
};

const _p = proEn;

export const PRO_COPY = {
  ..._p,
  quotas: _p.quotas as Record<PlanQuotaKey, { one: string; other: string; reason: string; icon: UiIconName }>,
  perks: _p.perks as Record<PlanPerk, ProBenefit>,
  promises: { ..._p.promises, rows: _p.promises.rows as { icon: UiIconName; title: string; sub: string }[] },
} as const;

export const PRO_PLAN_WORDS: Record<string, ProPlanWords> = _p.planWords;
