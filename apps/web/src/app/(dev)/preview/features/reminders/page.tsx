import { PageFrame } from "@/components/app/PageFrame";
import { REMINDERS_COPY } from "@/lib/features/notices/copy";

import { PreviewReminders } from "./PreviewReminders";

/** /settings/notifications/reminders with sample switches; `?live=0` draws the screen before the SQL is live. */
export const dynamic = "force-dynamic";

export default async function PreviewRemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const live = (await searchParams).live !== "0";
  return (
    <PageFrame title={REMINDERS_COPY.title} subtitle={REMINDERS_COPY.subtitle} fallback="/preview/features" width="narrow">
      <PreviewReminders live={live} />
    </PageFrame>
  );
}
