import type { AiPermission } from "./permissions";

/** The founder's glyph pack, transparent PNGs drawn bare (no plate or circle behind them). */
export const AI_GLYPH = {
  assistant: "/brand/glyphs/ai-assistant.png",
  account: "/brand/glyphs/ai-account.png",
  privacy: "/brand/glyphs/ai-privacy.png",
  payment: "/brand/glyphs/ai-payment.png",
  security: "/brand/glyphs/ai-security.png",
  permissions: "/brand/glyphs/ai-permissions.png",
  protection: "/brand/glyphs/ai-protection.png",
  compare: "/brand/glyphs/ai-compare.png",
  photos: "/brand/glyphs/ai-photos.png",
  schedule: "/brand/glyphs/ai-schedule.png",
  balance: "/brand/glyphs/ai-balance.png",
  reminder: "/brand/glyphs/ai-reminder.png",
  saved: "/brand/glyphs/ai-saved.png",
  share: "/brand/glyphs/ai-share.png",
  humanHelp: "/brand/glyphs/ai-human-help.png",
  toggle: "/brand/glyphs/ai-toggle.png",
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
