"use client";

import type { ActionResult } from "../actions/envelope";
import type { StateSendOrKeep } from "../offline/send-or-keep";
import { tapFailedOffline } from "../offline/tap-failed";
import { banner, updateToast } from "./toast";
import { bannerWithUndo, type UndoBannerOptions } from "./undo-banner";

/**
 * SAY IT ON THE TAP, SETTLE IT BEHIND (Agent FEEL, 13 November 2026).
 *
 * The rule for every control that confirms with a banner (follow, like,
 * bookmark, join, a shortlist): the caller flips its control, then calls this
 * in the same task. The banner goes up NOW, from what the tap means; the
 * server call runs behind it and can only correct:
 *
 *   - kept for later (no signal): the banner's words change in place;
 *   - refused, or lost and not kept: `rollBack` puts the control back and an
 *     error banner says why, with Try again when the caller gives `retry`;
 *   - accepted: nothing more is said. The answer is returned so the caller
 *     can reconcile (the database is the authority).
 *
 * Saves have their own flow with a device fallback (lib/saved/save-flow.ts);
 * it follows the same rule.
 */
export type SayNowOptions<T> = {
  /** What the tap did, in a sentence. */
  message: string;
  /** The real inverse, when there is one: the banner then offers Undo. */
  undo?: Omit<UndoBannerOptions, "undo"> & { undo: UndoBannerOptions["undo"] };
  /** The server call (usually `setOrKeep(...)`). */
  send: () => Promise<StateSendOrKeep<T>>;
  /** Put the control back exactly as it was before the tap. */
  rollBack: () => void;
  /** Offered as Try again on a refusal. */
  retry?: () => void;
  /** Said in place of the message when the tap was kept for when there is signal. */
  keptWords?: string;
  /** Said when the tap could neither be sent nor kept. */
  notKeptWords: string;
  "data-testid"?: string;
};

export async function sayNowSettleLater<T>(options: SayNowOptions<T>): Promise<ActionResult<T> | null> {
  const testId = options["data-testid"] ? { "data-testid": options["data-testid"] } : {};
  const id = options.undo
    ? bannerWithUndo(options.message, options.undo)
    : banner.success(options.message, testId);
  const refuse = (error: string) => {
    options.rollBack();
    banner.error(error, { ...(options.retry ? { retry: options.retry } : {}), ...testId });
  };
  try {
    const sent = await options.send();
    if (sent.state === "kept") {
      if (options.keptWords) updateToast(id, { message: options.keptWords, tone: "info", action: null });
      return null;
    }
    if (sent.state === "not_kept") {
      refuse(options.notKeptWords);
      return null;
    }
    if (!sent.result.ok) {
      refuse(sent.result.error);
      return null;
    }
    return sent.result;
  } catch (error) {
    options.rollBack();
    if (!tapFailedOffline(error)) banner.error(options.notKeptWords, testId);
    return null;
  }
}
