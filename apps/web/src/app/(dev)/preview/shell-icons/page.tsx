import { getDictionary } from "@vallo/i18n";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { CreateDock } from "@/components/app/CreateDock";

/**
 * The dock on any tab and either side (7 October: icon only, the chosen tab
 * included; the Search disc's optical overshoot). `?side=stays&active=/stays`
 * picks the dock; tap the round More button for the tray and its assistant
 * row (the `bot` glyph that replaced the sparkle).
 */
export default async function ShellIconsPreview({
  searchParams,
}: {
  searchParams: Promise<{ side?: string; active?: string }>;
}) {
  const { side: sideParam, active: activeParam } = await searchParams;
  const side = sideParam === "stays" ? "stays" : "property";
  const active = activeParam ?? (side === "stays" ? "/stays" : "/home");
  const t = getDictionary("en");
  return (
    <main className="min-h-dvh bg-[var(--nf-surface-canvas)] p-card">
      <div className="grid gap-group" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 rounded-xl border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-primary)]"
          />
        ))}
      </div>
      <MobileTabBar
        t={t}
        side={side}
        active={active}
        signedIn
        createSlot={<CreateDock t={t} listHref="/profile/setup" signedIn />}
      />
    </main>
  );
}
