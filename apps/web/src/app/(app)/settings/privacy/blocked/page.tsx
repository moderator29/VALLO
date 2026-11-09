import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getDictionary } from "@vallo/i18n";
import { withNext } from "@/lib/auth/next-link";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { loadMyBlocks } from "@/lib/safety/blocks-queries";
import { BlockedEmpty, BlockedList, type BlockedRow } from "./BlockedList";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).settings.blocked.screenTitle,
    robots: { index: false, follow: false },
  };
}

/* A block list read from a cache could show somebody as unblocked who is not. */
export const dynamic = "force-dynamic";

/* The date in the reader's language, on the Lagos calendar, as every other
   settings date is drawn (it was fixed to en-GB, so a Hausa reader got an
   English month inside a Hausa sentence). */
const BLOCKED_ON = { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" } as const;

/**
 * Settings, Privacy & Security, Blocked accounts. DB2.
 *
 * The people the caller blocked (never who blocked them), newest first, each
 * with Unblock. Reached from the Blocked accounts row on /settings/privacy.
 */
export default async function BlockedAccountsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.settings.blocked;
  const list = await loadMyBlocks();

  return (
    <PageFrame title={copy.screenTitle} fallback="/settings/privacy" width="narrow" testId="blocked-settings">
      {list.state === "signed-out" ? (
        <div className="nf-panel nf-panel--card block p-card text-center">
          <p className="nf-body-sm text-content-2">{copy.signedOut}</p>
          <Link href={withNext("/sign-in", "/settings/privacy/blocked")} className="nf-btn nf-btn--primary mt-block w-full sm:w-auto">
            {t.common.signIn}
          </Link>
        </div>
      ) : list.state === "unreadable" ? (
        <p role="alert" className="nf-panel nf-panel--card block p-card nf-body-sm text-content">
          {copy.unreadable}
        </p>
      ) : (
        <div className="space-y-block">
          <p className="nf-body-sm text-content-2">{copy.intro}</p>
          {list.people.length === 0 ? (
            <BlockedEmpty title={copy.emptyTitle} body={copy.emptyBody} />
          ) : (
            <>
            {list.total > list.people.length && (
              <p role="status" className="nf-body-sm text-content-2" data-testid="blocked-showing-some">
                {copy.showingSome
                  .replace("{shown}", String(list.people.length))
                  .replace("{count}", String(list.total))}
              </p>
            )}
            <BlockedList
              rows={list.people.map(
                (p): BlockedRow => ({
                  userId: p.userId,
                  name: p.name ?? copy.someone,
                  when: copy.blockedOn.replace("{when}", formatDate(new Date(p.blockedAt), locale, BLOCKED_ON)),
                }),
              )}
              copy={{
                unblock: copy.unblock,
                unblocking: copy.unblocking,
                unblockConfirm: copy.unblockConfirm,
                unblockFailed: copy.unblockFailed,
              }}
            />
            </>
          )}
        </div>
      )}
    </PageFrame>
  );
}
