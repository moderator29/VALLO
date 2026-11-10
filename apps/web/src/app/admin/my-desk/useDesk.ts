"use client";

import { useRouter } from "next/navigation";

import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

export type Outcome =
  | { ok: true; data: { note?: string | null } & Record<string, unknown> }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** What a reversible action says, and the real inverse behind its Undo. */
export type Reversible = { message: string; undo: () => Promise<Outcome>; undone: string };

/** The one way My Desk's controls run an action: a banner for every outcome, nothing optimistic. */
export function useDesk() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const run = (
    task: () => Promise<Outcome>,
    done: string | Reversible,
    after?: () => void,
    onFail?: (fieldErrors: Record<string, string>) => void,
  ) =>
    start(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          onFail?.(result.fieldErrors ?? {});
          banner.error(result.error, { retry: () => run(task, done, after, onFail) });
          return;
        }
        feedback("confirm");
        if (result.data.note) banner.warning(result.data.note);
        else if (typeof done === "string") banner.success(done);
        else bannerWithUndo(done.message, { undo: done.undo, undone: done.undone, onUndone: () => router.refresh() });
        after?.();
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { pending, run };
}
