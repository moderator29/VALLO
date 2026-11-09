import type { Metadata } from "next";
import { OfflineAutoRecover } from "@/components/app/offline/OfflineAutoRecover";
import { OfflineRecent } from "@/components/app/offline/OfflineRecent";
import { DEFAULT_LOCALE, getDictionary } from "@vallo/i18n";
import { RetryButton } from "./RetryButton";
import { OfflinePacks } from "./OfflinePacks";
import { OfflineShelf } from "./OfflineShelf";
import { OfflineScreen } from "./OfflineScreen";

/**
 * The offline fallback: one calm card (`OfflineScreen`, `offline.css`).
 *
 * Precached by `public/sw.js` at install and served ONLY when a navigation
 * cannot reach the network AND this phone has no kept copy of that page
 * (every page a member has opened opens again from the phone instead). Two
 * constraints shape it:
 *
 *   1. It must render with no network at all, so it uses no optimised
 *      `next/image` URL and no data source: the mark is the precached brand
 *      file and the ground is two gradients.
 *   2. The copy has to be honest. It says this page has not been opened here
 *      yet, and that the pages that have been still open, which is what
 *      the worker does. "Go to Home" is a full load, so the worker answers it
 *      from the phone.
 */
export const metadata: Metadata = {
  title: "You are offline",
  description: "This page needs a connection. Pages you have opened still work offline.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  const t = getDictionary(DEFAULT_LOCALE);
  const copy = t.experienceEntry;
  /* The page is precached and static, so the copy is English, the same as
     every other sentence on it. */
  return (
    <OfflineScreen
      title={copy.offlineTitle}
      body={copy.offlineBody}
      action={
        <RetryButton
          label={copy.offlineRetry}
          statusOnline={copy.offlineStatusOnline}
          statusOffline={copy.offlineStatusOffline}
        />
      }
      secondary={
        /* A plain anchor, never `Link`: the client router cannot fetch with
           no network, and a full load is what the worker answers from the
           phone. */
        <a href="/home" className="nf-offline__home nf-tap">
          {copy.offlineHome}
        </a>
      }
    >
      {/* V-35: this phone's inspection packs, with their gate codes. */}
      <OfflinePacks copy={t.platform.gate} locale={DEFAULT_LOCALE} />
      {/* V-77: the shortlist this phone holds, with a compare. */}
      <OfflineShelf copy={t.platform.shelf} locale={DEFAULT_LOCALE} />
      {/* Recently viewed places this phone kept, and recovery on the first answer (Agent NATIVE, job 3). */}
      <OfflineRecent />
      <OfflineAutoRecover />
    </OfflineScreen>
  );
}
