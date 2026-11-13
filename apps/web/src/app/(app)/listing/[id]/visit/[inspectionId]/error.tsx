"use client";

import { VisitError } from "@/components/app/inspections/visit/VisitStates";

/** The status screen's own failure: try again, or back to the listing. */
export default function VisitStatusError(props: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  return <VisitError {...props} />;
}
