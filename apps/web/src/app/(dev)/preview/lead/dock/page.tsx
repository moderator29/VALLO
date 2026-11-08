import { getDictionary } from "@vallo/i18n";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { CreateDock } from "@/components/app/CreateDock";

/**
 * The five-slot dock with its real centre "+" (`CreateDock`) and the round
 * More button, Home active, over a few placeholder cards so the capsule is
 * seen floating over content. Take it once per theme (the `nf_theme` cookie)
 * and tap the More button for the tray.
 */
export default function DockPreview() {
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
        side="property"
        active="/home"
        unreadNotifications={3}
        unreadConversationsPreview={2}
        signedIn
        createSlot={<CreateDock t={t} listHref="/profile/setup" signedIn />}
      />
    </main>
  );
}
