import { getDictionary } from "@vallo/i18n";
import { MenuFixture } from "./MenuFixture";

/**
 * The long-press message menu, open, with every row: the reaction row (one
 * chosen), Reply, Forward, Copy, Save photo, Delete for me and Delete for
 * everyone. A thread only draws the reaction row for a signed-in reader, so
 * no other harness page shows it. Its rules are in `app/css/threads.css`.
 *
 *   /preview/fixes/message-menu          with the reaction row
 *   /preview/fixes/message-menu?bare=1   without it (the narrower menu)
 */
export const dynamic = "force-dynamic";

export default async function PreviewMessageMenu({ searchParams }: { searchParams: Promise<{ bare?: string }> }) {
  const { bare } = await searchParams;
  const t = getDictionary("en");
  return (
    <main className="min-h-dvh bg-[var(--nf-surface-canvas)] px-md pt-md">
      <MenuFixture words={t.experienceInbox.thread.menu} bare={bare === "1"} />
    </main>
  );
}
