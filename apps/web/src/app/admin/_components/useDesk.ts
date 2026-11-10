"use client";

import { useRouter } from "next/navigation";

import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * THE CLIENT HALF OF A STAFF DESK ACTION (marketing, content, technical,
 * support lead). One place that runs a server action in a transition, says
 * the outcome in the one top banner (with Undo only where a real inverse
 * exists), and refreshes the page. Nothing is optimistic: the screen changes
 * when the server has answered.
 */
export type Outcome =
  | { ok: true; data: { note?: string | null } & Record<string, unknown> }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type Reversible = { message: string; undo: () => Promise<{ ok: true } | { ok: false; error: string }>; undone: string };

export function useDesk() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const run = (
    task: () => Promise<Outcome>,
    done: string | Reversible,
    after?: (result: Outcome & { ok: true }) => void,
    onFail?: (fieldErrors: Record<string, string>) => void,
  ): void =>
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
        after?.(result);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { pending, run };
}
