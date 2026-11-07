"use client";

import { RemindersSettings } from "@/app/(app)/settings/notifications/reminders/RemindersSettings";
import { defaultPreferences } from "@/lib/features/notices/model";

/** Sample switches: one nudge kind off, the rest on. Saves go nowhere. */
export function PreviewReminders({ live }: { live: boolean }) {
  const initial = { ...defaultPreferences(), nudge_profile: false };
  return (
    <RemindersSettings
      initial={initial}
      live={live}
      save={async (input) => ({ ok: true, data: input })}
    />
  );
}
