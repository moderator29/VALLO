export type TenureBucket = "under_30_days" | "1_to_6_months" | "over_6_months";

/** How long the account had existed when it asked to go; null when unknown. */
export function tenureBucket(createdAt: string | null | undefined, now: number): TenureBucket | null {
  const created = Date.parse(createdAt ?? "");
  if (!Number.isFinite(created)) return null;
  const days = (now - created) / 86_400_000;
  if (days < 30) return "under_30_days";
  if (days < 183) return "1_to_6_months";
  return "over_6_months";
}
