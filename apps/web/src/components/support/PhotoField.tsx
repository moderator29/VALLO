"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { PHOTO_ACCEPT, preparePhoto, type PreparedPhoto } from "./photo";
import { banner } from "@/lib/ui/toast";

/**
 * One optional photo or screenshot, picked, previewed and removable.
 *
 * The picker is a real file input behind a 44px label, so it works with a
 * keyboard, a screen reader and the phone's own camera or photo sheet.
 */
export function PhotoField({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: PreparedPhoto | null;
  onChange(next: PreparedPhoto | null): void;
  disabled?: boolean;
  /** The reply box's inline size: a square icon button instead of a row. */
  compact?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [reading, setReading] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    const prepared = await preparePhoto(file);
    setReading(false);
    if (input.current) input.current.value = "";
    if ("error" in prepared) {
      /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
      banner.error(prepared.error);
      return;
    }
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(prepared);
  };

  const remove = () => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  };

  const picker = (
    <input
      ref={input}
      id={id}
      type="file"
      accept={PHOTO_ACCEPT}
      className="sr-only"
      disabled={disabled || reading}
      onChange={(event) => void pick(event.target.files?.[0])}
      data-testid="support-photo-input"
    />
  );

  if (value) {
    return (
      <div className="flex items-center gap-group" data-testid="support-photo-preview">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
        <img
          src={value.previewUrl}
          alt="The photo you are attaching"
          className="h-16 w-16 shrink-0 rounded-sm border border-[var(--nf-border-subtle)] object-cover"
        />
        <span className="nf-caption min-w-0 flex-1 text-[var(--nf-content-secondary)]">Photo attached</span>
        <Button variant="quiet" size="sm" onClick={remove} disabled={disabled}>
          Remove
        </Button>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        {picker}
        <label
          htmlFor={id}
          aria-label="Attach a photo or screenshot"
          className="nf-btn nf-btn--glass nf-btn--icon inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center p-0"
        >
          <UiIcon name="picture" size={20} />
        </label>
      </>
    );
  }

  return (
    <div>
      {picker}
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-group rounded-lg border border-dashed border-[var(--nf-border-default)] bg-[var(--nf-surface-primary)] p-card-sm"
      >
        <UiIcon name="picture" size={20} className="shrink-0 text-[var(--nf-content-secondary)]" />
        <span className="min-w-0 flex-1">
          <span className="nf-body-sm block font-semibold text-[var(--nf-content-primary)]">
            {reading ? "Preparing the photo…" : "Add a photo or screenshot"}
          </span>
          <span className="nf-caption block text-[var(--nf-content-muted)]">
            Optional. Only you and the support team can see it.
          </span>
        </span>
      </label>
    </div>
  );
}
