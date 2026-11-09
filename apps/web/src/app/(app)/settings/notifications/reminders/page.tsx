import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";

import { PageFrame } from "@/components/app/PageFrame";
import { readReminderSettings } from "@/lib/features/notices/preferences";

import { RemindersSettings } from "./RemindersSettings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).reminders.title };
}

/** Never cached: a switch read from a cache is a switch somebody already changed. */
export const dynamic = "force-dynamic";

/**
 * Reminders: the new notices and gentle nudges (FEATURE_BACKLOG A5 and A6),
 * each switchable. The older reminders (viewings, check-ins, reviews, price
 * drops) stay on /settings/notifications, which this links back to.
 */
export default async function RemindersSettingsPage() {
  const state = await readReminderSettings();
  if (state.state === "signed-out") redirect("/sign-in?next=/settings/notifications/reminders");
  const r = getDictionary(await getLocale()).reminders;

  return (
    <PageFrame
      title={r.title}
      subtitle={r.subtitle}
      fallback="/settings/notifications"
      width="narrow"
    >
      <RemindersSettings initial={state.preferences} live={state.live} copy={r} />
    </PageFrame>
  );
}
