"use client";

import { useRouter } from "next/navigation";

import { useScopedCopy } from "@/lib/i18n/copy-scope";

import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * One way to run a roommate write from a button (FE-B): wait for the server,
 * say every outcome in the banner (the founder's "banner everywhere"), feel
 * an accepted action as `confirm`, refresh the page's read, and never draw
 * an outcome as text beside the control. A refusal carries the database's own
 * sentence (the RM codes in `actions.ts`).
 */
export function useRun() {
  const copy = useScopedCopy("roommates");
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const run = <T,>(
    task: () => Promise<Result<T>>,
    options: { success?: string | ((data: T) => string); onOk?: (data: T) => void; onFail?: (r: { error: string; fieldErrors?: Record<string, string> }) => void; refresh?: boolean; undo?: () => Promise<Result<unknown>> } = {},
  ) =>
    start(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          options.onFail?.(result);
          banner.error(result.error);
          return;
        }
        feedback("confirm");
        const words = typeof options.success === "function" ? options.success(result.data) : options.success;
        /* A reversible write carries Undo, which calls the real inverse and says so. */
        const undo = options.undo;
        if (words) {
          banner.success(
            words,
            undo
              ? {
                  action: {
                    label: copy.area.undo,
                    run: () => {
                      void undo().then((back) => {
                        if (back.ok) {
                          banner.info(copy.area.undone);
                          router.refresh();
                        } else banner.error(back.error);
                      });
                    },
                  },
                }
              : undefined,
          );
        }
        options.onOk?.(result.data);
        if (options.refresh !== false) router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { pending, run, router };
}
