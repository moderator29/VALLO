import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";

import { PreviewReminders } from "./PreviewReminders";

/** /settings/notifications/reminders with sample switches; `?live=0` draws the screen before the SQL is live. */
export const dynamic = "force-dynamic";

export default async function PreviewRemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const live = (await searchParams).live !== "0";
  const r = getDictionary(await getLocale()).reminders;
  return (
    /* The app shell's 16px gutter, which the harness layout does not draw. */
    <div className="px-md">
    <PageFrame title={r.title} subtitle={r.subtitle} fallback="/preview/features" width="narrow">
      <PreviewReminders live={live} copy={r} />
    </PageFrame>
    </div>
  );
}
