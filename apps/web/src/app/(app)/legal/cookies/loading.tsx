import { COOKIES_SECTIONS } from "@/lib/legal/cookies";
import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { LEGAL_SKELETON_FRAME, LegalDocumentSkeleton } from "../LegalDocumentSkeleton";

/** The wait, on the cookies page: the document's own paper shape. */
export default function LoadingLegalCookies() {
  return (
    <LoadingShell label="Loading the cookies page" className={LEGAL_SKELETON_FRAME}>
      <LegalDocumentSkeleton sections={COOKIES_SECTIONS.length} />
    </LoadingShell>
  );
}
