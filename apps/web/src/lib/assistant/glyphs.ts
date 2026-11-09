import type { AiPermission } from "./permissions";

/** The founder's glyph pack, transparent PNGs drawn bare (no plate or circle behind them). */
export const AI_GLYPH = {
  assistant: "/brand/glyphs/ai-assistant.webp",
  account: "/brand/glyphs/ai-account.webp",
  privacy: "/brand/glyphs/ai-privacy.webp",
  payment: "/brand/glyphs/ai-payment.webp",
  security: "/brand/glyphs/ai-security.webp",
  permissions: "/brand/glyphs/ai-permissions.webp",
  protection: "/brand/glyphs/ai-protection.webp",
  compare: "/brand/glyphs/ai-compare.webp",
  photos: "/brand/glyphs/ai-photos.webp",
  schedule: "/brand/glyphs/ai-schedule.webp",
  balance: "/brand/glyphs/ai-balance.webp",
  reminder: "/brand/glyphs/ai-reminder.webp",
  saved: "/brand/glyphs/ai-saved.webp",
  share: "/brand/glyphs/ai-share.webp",
  humanHelp: "/brand/glyphs/ai-human-help.webp",
  toggle: "/brand/glyphs/ai-toggle.webp",
} as const;

export const PERMISSION_GLYPH: Record<AiPermission, string> = {
  discovery: AI_GLYPH.assistant,
  saved_prefs: AI_GLYPH.saved,
  bookings_viewings: AI_GLYPH.schedule,
  account_info: AI_GLYPH.account,
  transactions: AI_GLYPH.payment,
  wallet_balance: AI_GLYPH.balance,
  payment_assist: AI_GLYPH.protection,
  notifications: AI_GLYPH.reminder,
};

/** The glyph for a summary block, from what it is about. */
export function summaryGlyph(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("balance")) return AI_GLYPH.balance;
  if (t.includes("viewing")) return AI_GLYPH.schedule;
  if (t.includes("account")) return AI_GLYPH.account;
  if (t.includes("payment") || t.includes("spent") || t.includes("refund") || t.includes("booking")) return AI_GLYPH.payment;
  return null;
}
