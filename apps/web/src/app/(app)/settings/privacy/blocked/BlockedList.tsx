"use client";

import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { unblockUserSafely } from "@/lib/safety/blocks-actions";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/** Nobody blocked yet: what the list is for, and where Block lives. */
export function BlockedEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="nf-panel nf-panel--card block p-card text-center" data-testid="blocked-empty">
      <span className="mx-auto mb-row flex h-12 w-12 items-center justify-center text-muted" aria-hidden="true">
        <UiIcon name="block" size="lg" />
      </span>
      <h2 className="nf-h3">{title}</h2>
      <p className="mx-auto mt-row max-w-[42ch] nf-body-sm text-content-2">{body}</p>
    </div>
  );
}

export type BlockedRow = {
  userId: string;
  name: string;
  when: string;
};

type Copy = {
  unblock: string;
  unblocking: string;
  unblockConfirm: string;
  unblockFailed: string;
};

/**
 * The list, with Unblock on each row. The first tap arms the row and the
 * button then says what will happen (the confirmation sentence names the
 * person); the second tap unblocks. The action goes through the caller's own
 * RLS client (`blocks_delete_own`) and revalidates this route, so the row
 * leaves because the server says it is gone, not because this component
 * guessed. Until then it is hidden optimistically and comes back on failure.
 */
export function BlockedList({ rows, copy }: { rows: BlockedRow[]; copy: Copy }) {
  const [armed, setArmed] = useState<string | null>(null);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();

  function press(row: BlockedRow) {
    setFailed(null);
    if (armed !== row.userId) {
      setArmed(row.userId);
      return;
    }
    startTransition(async () => {
      const result = await unblockUserSafely({ userId: row.userId });
      if (result.ok) {
        setGone((prev) => new Set(prev).add(row.userId));
        /* Only clear the arm if it is still this row's. */
        setArmed((a) => (a === row.userId ? null : a));
      } else {
        setFailed(row.userId);
      }
    });
  }

  const visible = rows.filter((row) => !gone.has(row.userId));

  return (
    <ul className="space-y-row" data-testid="blocked-list">
      {visible.map((row) => {
        const isArmed = armed === row.userId;
        return (
          <li key={row.userId} className="nf-panel nf-panel--card block p-card" data-testid="blocked-row">
            <div className="flex items-center justify-between gap-inline">
              <div className="min-w-0">
                <p className="nf-body truncate font-semibold text-content">{row.name}</p>
                <p className="nf-caption mt-row text-muted">{row.when}</p>
              </div>
              <Button
                variant={isArmed ? "danger" : "secondary"}
                size="sm"
                onClick={() => press(row)}
                disabled={pending}
                aria-live="polite"
                data-testid="blocked-unblock"
                className="shrink-0"
              >
                {pending && isArmed ? copy.unblocking : copy.unblock}
              </Button>
            </div>
            {isArmed && !pending && (
              <p className="nf-body-sm mt-row text-content-2" role="status">
                {copy.unblockConfirm.replace("{name}", row.name)}
              </p>
            )}
            {failed === row.userId && (
              <p className="nf-body-sm mt-row text-danger" role="alert">
                {copy.unblockFailed}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
