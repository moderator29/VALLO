import { formatDate, formatMoney, plural, type Dictionary, type PluralForms } from "@vallo/i18n/core";

import type { UiIconName } from "@/design-system/icons/UiIcon";
import {
  LIFESTYLE_KEYS,
  monthlyMinor,
  type Amenity,
  type BadgeKind,
  type Budget,
  type Lifestyle,
  type LifestyleKey,
  type MoveInFlex,
  type Period,
} from "@/lib/features/roommates/model";

/**
 * VALLO ROOMMATES, THE KIT'S WORDS AND FIGURES. Pure and safe on both sides:
 * the dictionary arrives as a prop (`t`), so a server page passes
 * `getDictionary("en").roommates` and a client island passes
 * `useScopedCopy("roommates")`. Nothing here imports `@vallo/i18n` itself.
 */
export type RoommatesCopy = Dictionary["roommates"];

export const LOCALE = "en" as const;

/** `{name}` style placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

export function counted(n: number, forms: PluralForms): string {
  return plural(n, forms, LOCALE);
}

/** "₦450k" on a card, "₦450,000" in a breakdown. */
export function naira(minor: number, compact = true): string {
  return formatMoney(minor, LOCALE, "NGN", { compact });
}

/** "₦450k/year". */
export function nairaPer(minor: number, period: Period, t: RoommatesCopy, compact = true): string {
  return `${naira(minor, compact)}${t.perPeriod[period]}`;
}

/** A budget as one line, or null when nothing was given. Never invents a bound. */
export function budgetText(b: Budget, t: RoommatesCopy): string | null {
  const c = t.ui.card;
  const per = t.perPeriod[b.period];
  if (b.minMinor !== null && b.maxMinor !== null && b.minMinor > 0) {
    return `${fill(c.budgetRange, { min: naira(b.minMinor), max: naira(b.maxMinor) })}${per}`;
  }
  if (b.maxMinor !== null) return `${fill(c.budgetUpTo, { amount: naira(b.maxMinor) })}${per}`;
  if (b.minMinor !== null) return `${fill(c.budgetFrom, { amount: naira(b.minMinor) })}${per}`;
  return null;
}

/** The monthly figure under a yearly amount, for the eye that thinks monthly. */
export function monthlyHint(minor: number | null, period: Period, t: RoommatesCopy): string | null {
  if (minor === null || period === "month") return null;
  const m = monthlyMinor(minor, period);
  return m === null ? null : fill(t.ui.onboarding.monthlyEquivalent, { amount: naira(m) });
}

/** "12 Jan 2027" from a calendar day ("2027-01-12"), read at noon so no zone moves it a day. */
export function dayText(iso: string, withYear = true): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDate(d, LOCALE, withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
}

export function moveInText(moveInOn: string | null, flex: MoveInFlex, t: RoommatesCopy): string {
  const c = t.ui.card;
  if (flex === "asap") return c.moveInAsap;
  if (moveInOn) return fill(c.moveInOn, { date: dayText(moveInOn) });
  return c.moveInFlexible;
}

/** "Yaba, Lagos", from whichever parts are there. */
export function placeText(...parts: (string | null | undefined)[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const v = p?.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out.length ? out.join(", ") : null;
}

/** Whether the "available from" day has come (today is passed in by the server). */
export function availableText(availableFrom: string | null, t: RoommatesCopy, today?: string): string | null {
  if (!availableFrom) return null;
  if (today && availableFrom <= today) return t.ui.card.availableNow;
  return fill(t.ui.card.availableFrom, { date: dayText(availableFrom, false) });
}

/* ------------------------------------------------------------------ glyphs */

export const LIFESTYLE_ICON: Record<LifestyleKey, UiIconName> = {
  cleanliness: "droplet",
  social: "circle-people",
  sleep: "moon",
  smoking: "shield-stop",
  pets: "heart",
  guests: "users",
  cooking: "utensils",
  schedule: "clock",
};

export const BADGE_ICON: Record<BadgeKind, UiIconName> = {
  student_email: "mail",
  student_id: "id-card",
  nysc: "certificate",
  workplace: "briefcase",
  identity: "user-check",
  phone: "phone",
};

export const AMENITY_ICON: Record<Amenity, UiIconName> = {
  wifi: "wifi",
  power_backup: "bolt",
  prepaid_meter: "receipt",
  water: "droplet",
  security: "shield-check",
  parking: "parking",
  kitchen: "kitchen",
  laundry: "washing-machine",
  ac: "snowflake",
  wardrobe: "door",
  gated: "gate",
  cleaning: "check",
};

export type LifestyleFact = { key: LifestyleKey; label: string; value: string; icon: UiIconName };

/**
 * The answers somebody gave, as chips. The ones that most decide a shared home
 * (smoking, tidiness, the home's atmosphere, sleep) come first, so a card that
 * shows two or three shows the telling ones.
 */
const PRIORITY: LifestyleKey[] = ["smoking", "cleanliness", "social", "sleep", "pets", "guests", "schedule", "cooking"];

export function lifestyleFacts(l: Lifestyle, t: RoommatesCopy, order: "priority" | "natural" = "priority"): LifestyleFact[] {
  const keys = order === "priority" ? PRIORITY : [...LIFESTYLE_KEYS];
  const out: LifestyleFact[] = [];
  for (const key of keys) {
    const v = l[key];
    if (v === null || v === undefined) continue;
    const q = t.lifestyle[key] as { label: string; options: Record<string, string> };
    const value = q.options[String(v)];
    if (value) out.push({ key, label: q.label, value, icon: LIFESTYLE_ICON[key] });
  }
  return out;
}

export function institutionKind(kind: string, t: RoommatesCopy): string {
  const kinds = t.ui.campus.kinds as Record<string, string>;
  return kinds[kind] ?? kinds.other ?? kind;
}

/** Today in Lagos as a calendar day, from a clock the server read once. */
export function lagosDay(now: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}
