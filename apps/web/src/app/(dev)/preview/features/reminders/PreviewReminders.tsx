"use client";

import { RemindersSettings } from "@/app/(app)/settings/notifications/reminders/RemindersSettings";
import { defaultPreferences } from "@/lib/features/notices/model";
import type { Dictionary } from "@vallo/i18n/core";

/** Sample switches: one nudge kind off, the rest on. Saves go nowhere. */
export function PreviewReminders({ live, copy }: { live: boolean; copy: Dictionary["reminders"] }) {
  const initial = { ...defaultPreferences(), nudge_profile: false };
  return (
    <RemindersSettings
      initial={initial}
      live={live}
      copy={copy}
      save={async (input) => ({ ok: true, data: input })}
    />
  );
}
