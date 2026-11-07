import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import "@/app/css/system.css";

/**
 * The wait on a legal document, in `LegalDocument`'s own shape (C6, the route
 * sweep). The loading files used to draw the contents as a glass card
 * (`nf-panel--card`) of 44px slabs floating on the canvas, which is what the
 * page drew before R3-03 put the whole document on paper. They now draw what
 * arrives: the header in the member's theme, then ONE paper sheet carrying
 * the last-updated line, the contents as the numbered index (as many rows as
 * the document has sections, two columns from 768 as the real index sets
 * them), and the first sections as a heading and measured prose with the
 * hairline between them. The classes are the page's own (`nf-legal__*` in
 * system.css), so every box lands where its text will.
 *
 * The slabs on the sheet read the paper's hairline ink (document.css), not
 * the night inset, which drew dark bars on white.
 *
 * The boxes only: each loading.tsx wraps them in `LoadingShell` with its own
 * label and LEGAL_SKELETON_FRAME, so every route's wait announces through the
 * kit where the state sweep can see it (scripts/design/state-sweep.mjs).
 */
export const LEGAL_SKELETON_FRAME = "mx-auto w-full max-w-3xl pb-3xl pt-md";

export function LegalDocumentSkeleton({ sections }: { sections: number }) {
  return (
    <>
      <PageHeaderSkeleton layout="large" subtitle />
      <DocumentSheet as="div" kind="document" className="nf-legal mt-lg">
        <Skeleton width="11rem" height="0.8125rem" radius="sm" />
        <div className="nf-legal__toc">
          <Skeleton width="4.5rem" height="0.75rem" radius="sm" className="nf-legal__toc-title" />
          <ol>
            {Array.from({ length: sections }, (_, i) => (
              <li key={i} className="flex min-h-11 items-center gap-sm px-xs">
                <Skeleton width="1rem" height="0.75rem" radius="xs" className="shrink-0" />
                <Skeleton width={`${55 + ((i * 17) % 35)}%`} height="0.875rem" radius="sm" />
              </li>
            ))}
          </ol>
        </div>
        <div className="nf-legal__body">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="nf-legal__section">
              <Skeleton width="55%" height="1.375rem" radius="sm" />
              <div className="nf-legal__prose space-y-xs">
                <Skeleton height="1rem" radius="sm" />
                <Skeleton height="1rem" radius="sm" />
                <Skeleton width="92%" height="1rem" radius="sm" />
                <Skeleton width="64%" height="1rem" radius="sm" />
              </div>
            </div>
          ))}
        </div>
      </DocumentSheet>
    </>
  );
}
