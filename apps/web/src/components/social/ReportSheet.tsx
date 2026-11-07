"use client";

import { banner } from "@/lib/ui/toast";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { ReportReason } from "@/lib/social/posts-model";
import type { ReportWords } from "./sheet-words";
import type { ActionResult } from "@/lib/actions/envelope";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Reporting something, with a reason.
 *
 * Before this existed, both report paths in the product sent `reason: "OTHER"`
 * the instant somebody chose Report from a menu. That is two separate defects
 * wearing one coat: a queue where every item says "Something else" cannot be
 * triaged, and a destructive-feeling action that fires on the first tap with no
 * way back is a control people learn not to touch.
 *
 * So: the platform's `Sheet` at its near-full height, because choosing why is
 * the whole job and it deserves the screen, and because the sheet brings the
 * drag and flick to close, Back, Escape, the focus trap and the safe areas
 * that a hand-built panel here did not have. One reason, chosen deliberately. An optional sentence, because the
 * category is rarely the whole story. And a confirmation that says what happens
 * next, including the part people actually worry about, which is whether the
 * person being reported gets told.
 *
 * The sheet knows nothing about what it is reporting. It is handed a `submit`
 * that closes over the target, so the same component serves a post, a profile
 * and whatever the next reportable thing turns out to be.
 */

export function ReportSheet({
  title,
  subject,
  reasons,
  submit,
  onClose,
  words,
}: {
  /** "Report this post", "Report @tolu". */
  title: string;
  /** The one line naming exactly what is being reported. */
  subject: string;
  /** Only the reasons that can actually apply to this kind of thing. */
  reasons: readonly ReportReason[];
  submit: (input: { reason: ReportReason; detail: string }) => Promise<ActionResult<unknown>>;
  onClose: () => void;
  /** The reasons and the sheet's words, from the server (`reportWordsOf` or `sheetWordsOf(t).report`). */
  words: ReportWords;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useSafeTransition();

  const send = () => {
    if (!reason) return;
    startTransition(async () => {
      try {
        const result = await submit({ reason, detail: detail.trim() });
        if (!result.ok) {
          /* Said by the one banner (Grade 1), which sits above this sheet. The
             thank-you below stays: it is the record, with what to do next. */
          banner.error(result.error, { retry: send });
          return;
        }
        setSent(true);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* Escape, Back, the Tab trap, the counted scroll lock and the focus return
     all come with `Sheet`. This sheet opens FROM the action sheet, and the
     counted lock is what keeps the page still until the last one closes. */
  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={sent ? words.thanks : title}
      closeLabel={words.close}
      fullPage
    >
      <div>
        <p className="mb-md text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          {subject}
        </p>

        {sent ? (
          <>
            <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
              {words.sentBody}
            </p>
            <p className="mt-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
              {words.sentMute}
            </p>
            <Button variant="primary" onClick={onClose} full className="mt-lg">
              {words.done}
            </Button>
          </>
        ) : (
          <>
            <fieldset>
              <legend className="nf-overline mb-xs">{words.whatIsWrong}</legend>
              <div className="flex flex-col gap-xs">
                {reasons.map((key) => (
                  <label key={key} className="nf-social-reason">
                    <input
                      type="radio"
                      name="nf-report-reason"
                      value={key}
                      checked={reason === key}
                      onChange={() => setReason(key)}
                    />
                    <span>{words.reasons[key]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-md block">
              <span className="nf-overline">{words.detailLabel}</span>
              <textarea
                className="nf-field mt-xs min-h-[88px] w-full resize-y text-[length:var(--nf-text-body-sm)] leading-[1.5]"
                value={detail}
                maxLength={600}
                onChange={(event) => setDetail(event.target.value)}
                placeholder={words.detailPlaceholder}
              />
            </label>

            <div className="mt-lg flex flex-col gap-xs sm:flex-row-reverse">
              <Button
                variant="primary"
                onClick={send}
                disabled={!reason || pending}
                className="flex-1"
              >
                {pending ? words.sending : words.send}
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={pending}
                className="flex-1"
              >
                {words.cancel}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
