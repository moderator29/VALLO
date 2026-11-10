"use client";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

/**
 * A yes-or-no question before something a person might do by accident, such as
 * logging out. It composes `Sheet` in its card shape, so Escape, Back, the
 * focus trap and its return, and the scroll lock are the platform's.
 *
 * Cancel is the primary button on purpose: the safe answer is the easy one to
 * reach. Every word is the caller's; there is no default copy.
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  line,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  line: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  testId: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} card testId={testId}>
      <div className="grid gap-md">
        <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {line}
        </p>
        <div className="grid gap-sm sm:grid-cols-2">
          <Button
            variant="secondary"
            full
            disabled={pending}
            onClick={() => onOpenChange(false)}
            data-testid={`${testId}-cancel`}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="dangerQuiet"
            full
            loading={pending}
            onClick={onConfirm}
            data-testid={`${testId}-confirm`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
