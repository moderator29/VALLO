import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * A SUCCESS BANNER THAT CAN BE TAKEN BACK (founder, November 2026, "the
 * banner everywhere"). The Inbox archive is the reference: the top banner says
 * what happened and where it went, and offers Undo. Undo calls the real
 * inverse on the server, says its own outcome in a banner, and is pressed at
 * most once per banner (a second press is ignored, so a double tap cannot run
 * the inverse twice).
 *
 * Use it only where a real inverse exists server-side. A delete, a send, a
 * payment, a published decision or a restriction says what happened with
 * `banner.success` and offers no Undo.
 */

export type UndoResult = { ok: true } | { ok: false; error: string };

export type UndoBannerOptions = {
  /** The real inverse of the action that was just done. */
  undo: () => Promise<UndoResult>;
  /** Said when the inverse worked. */
  undone: string;
  /** Runs after the inverse worked, e.g. to put the screen back. */
  onUndone?: () => void;
  /** The label of the action. Defaults to "Undo". */
  label?: string;
};

export const UNDO_FAILED = "That could not be undone. Try again in a moment.";

export function bannerWithUndo(message: string, options: UndoBannerOptions): number {
  let used = false;
  const run = () => {
    if (used) return;
    used = true;
    void (async () => {
      try {
        const result = await options.undo();
        if (result.ok) {
          options.onUndone?.();
          banner.success(options.undone);
        } else {
          banner.error(result.error);
        }
      } catch (error) {
        if (!tapFailedOffline(error)) banner.error(UNDO_FAILED);
      }
    })();
  };
  return banner.success(message, { action: { label: options.label ?? "Undo", run } });
}
