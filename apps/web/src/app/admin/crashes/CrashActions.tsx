"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setCrashStatus } from "@/lib/admin/desk-reads/crash-log-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { CRASH_COPY } from "./crash-copy";

/** Mark fixed and Quiet it on an open crash; Open again on a closed one. */
export function CrashActions({ crashId, status }: { crashId: string; status: "open" | "resolved" | "ignored" }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();

  function set(next: "open" | "resolved" | "ignored") {
    start(async () => {
      try {
        const result = await setCrashStatus({ crashId, status: next });
        if (!result.ok) {
          banner.error(result.error, { retry: () => set(next) });
          return;
        }
        banner.success(next === "resolved" ? CRASH_COPY.fixedDone : next === "ignored" ? CRASH_COPY.quietDone : CRASH_COPY.reopenDone);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  if (status !== "open") {
    return (
      <div className="nf-crash__actions">
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => set("open")}>
          {CRASH_COPY.reopen}
        </Button>
      </div>
    );
  }
  return (
    <div className="nf-crash__actions">
      <Button variant="primary" size="sm" disabled={pending} onClick={() => set("resolved")} data-testid="crash-fixed">
        {CRASH_COPY.markFixed}
      </Button>
      <Button variant="quiet" size="sm" disabled={pending} onClick={() => set("ignored")}>
        {CRASH_COPY.quiet}
      </Button>
    </div>
  );
}
