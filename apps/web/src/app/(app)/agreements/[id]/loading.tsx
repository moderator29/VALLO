import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * M2: one agreement, before it arrives, in the shapes it arrives in: the
 * header, the live-status band with its four steps, then the terms sheet's
 * heading and its rows down to the total. Without this the register's
 * skeleton stood in for a document, and the page jumped when it landed.
 */
export default function LoadingAgreement() {
  return (
    <LoadingShell label="Loading the agreement" className="nf-page nf-md">
      <PageHeaderSkeleton layout="large" />
      <div className="nf-card mt-inline block space-y-xs p-card">
        <Skeleton width="30%" height="0.75rem" radius="xs" />
        <Skeleton width="68%" height="1.25rem" radius="sm" />
        <Skeleton width="44%" height="0.875rem" radius="sm" />
        <div className="grid grid-cols-4 gap-sm pt-sm">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="grid justify-items-center gap-xs">
              <Skeleton width="1.25rem" circle />
              <Skeleton width="70%" height="0.75rem" radius="xs" />
            </span>
          ))}
        </div>
      </div>
      <div className="nf-card mt-block block space-y-sm p-card">
        <Skeleton width="36%" height="0.75rem" radius="xs" />
        <Skeleton width="58%" height="1.125rem" radius="sm" />
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="flex justify-between gap-md pt-xs">
            <Skeleton width="34%" height="0.875rem" radius="sm" />
            <Skeleton width="26%" height="0.875rem" radius="sm" />
          </span>
        ))}
      </div>
    </LoadingShell>
  );
}
