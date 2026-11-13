import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import "@/components/app/agreements/agreements.css";

/**
 * Agreements, before they arrive (details pass): the large title, the two
 * lines about how paying works, the section label and the cards, the shape
 * `page.tsx` draws. It replaces the group's generic three rows, which moved
 * the page when the list landed.
 *
 * M2: each card is a register row now, so its skeleton is too: the paper
 * sheet's footprint on the left, the title, the meta line, the version line
 * and the status pill, then the chevron.
 */
export default function LoadingAgreements() {
  return (
    <LoadingShell label="Loading your agreements" className="nf-page grid grid-cols-1 gap-md">
      <PageHeaderSkeleton layout="large" />
      <Skeleton className="mt-inline" width="92%" height="0.9375rem" radius="sm" />
      <Skeleton className="mt-2xs" width="70%" height="0.9375rem" radius="sm" />
      <Skeleton className="mb-block mt-inline" width="60%" height="0.8125rem" radius="sm" />
      <Skeleton className="mb-heading" width="9rem" height="1.125rem" radius="sm" />
      <ul className="nf-agr-register">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="nf-card nf-agr-row p-card">
            <Skeleton width="2.25rem" height="2.75rem" radius="xs" />
            <span className="block min-w-0">
              <Skeleton width="62%" height="1rem" radius="sm" />
              <Skeleton className="mt-xs" width="48%" height="0.8125rem" radius="sm" />
              <Skeleton className="mt-xs" width="40%" height="0.8125rem" radius="sm" />
              <Skeleton className="mt-xs" width="7rem" height="1.375rem" radius="pill" />
            </span>
            <Skeleton width="1.125rem" height="1.125rem" radius="sm" />
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
