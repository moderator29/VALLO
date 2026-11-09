"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { addToGroupShortlist } from "@/lib/features/roommates/actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * "Add to group shortlist" for a Vallo property (FE-B): the member's active
 * roommate groups in a Sheet, one tap each. Words arrive as props, since the
 * listing page is outside the roommates copy scope.
 */
export function AddToGroupShortlist({
  listingId,
  groups,
  words,
}: {
  listingId: string;
  groups: { id: string; name: string }[];
  words: { open: string; title: string; add: string; added: string };
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useSafeTransition();
  if (groups.length === 0) return null;
  const add = (g: { id: string; name: string }) =>
    start(async () => {
      try {
        const r = await addToGroupShortlist({ groupId: g.id, listingId });
        if (!r.ok) return void banner.error(r.error);
        feedback("confirm");
        banner.success(words.added.replace("{group}", g.name));
        setOpen(false);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return (
    <>
      <Button variant="secondary" size="sm" leadingIcon="plus" onClick={() => setOpen(true)} data-testid="listing-add-shortlist">
        {words.open}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={words.title} detents={[0.6]}>
        <ul className="grid gap-xs">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-sm">
              <span className="min-w-0 truncate text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">{g.name}</span>
              <Button variant="primary" size="sm" disabled={pending} onClick={() => add(g)}>
                {words.add}
              </Button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
