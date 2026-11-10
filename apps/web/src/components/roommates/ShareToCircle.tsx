"use client";

import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { listShareableCircles, shareRoommateToCircle } from "@/lib/features/circle/actions";
import type { ShareableCircle } from "@/lib/features/circle/share-rules";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { removePost } from "@/lib/social/posts-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { fill } from "./format";

export type ShareTarget = { kind: "room" | "person"; id: string };

type Load = { state: "loading" } | { state: "failed"; message: string } | { state: "ready"; circles: ShareableCircle[]; memberOf: number };

const NOTE_MAX = 280;

/**
 * SHARE A ROOMMATES PAGE INTO A CIRCLE (founder, 10 November 2026). The sheet
 * lists only the Circles the person is in AND can post in (the server decides
 * that, `listShareableCircles`), takes an optional short note, and posts a
 * Circle post that carries a Roommates card. The outcome is a top banner;
 * Undo takes the post down again through the author's own delete, and is not
 * offered when the post was held for a moderator (a held post cannot be
 * taken down by its author, so there is no real inverse).
 */
export function ShareToCircleSheet({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: ShareTarget }) {
  const copy = useScopedCopy("roommates");
  const w = copy.circleShare;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoad({ state: "loading" });
    listShareableCircles()
      .then((result) => {
        if (!live) return;
        if (!result.ok) setLoad({ state: "failed", message: result.error });
        else {
          setLoad({ state: "ready", circles: result.data.circles, memberOf: result.data.memberOf });
          if (result.data.circles.length === 1) setPicked(result.data.circles[0]!.id);
        }
      })
      .catch(() => {
        if (live) setLoad({ state: "failed", message: w.loadFailed });
      });
    return () => {
      live = false;
    };
  }, [open, attempt, w.loadFailed]);

  const send = () =>
    start(async () => {
      try {
        if (!picked) return;
        const result = await shareRoommateToCircle({ communityId: picked, target, note });
        if (!result.ok) {
          feedback("error");
          banner.error(result.error, { retry: send });
          return;
        }
        feedback("confirm");
        onOpenChange(false);
        setNote("");
        setPicked(null);
        const { id, held, name } = result.data;
        if (held) banner.info(fill(w.sharedHeld, { name }));
        else bannerWithUndo(fill(w.shared, { name }), { undo: () => removePost({ postId: id }), undone: fill(w.undone, { name }), label: w.undo });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const ready = load.state === "ready" && load.circles.length > 0;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={w.title}
      description={w.body}
      closeLabel={copy.ui.flow.close}
      detents={[0.7]}
      {...(ready
        ? {
            footer: (
              <Button variant="primary" size="lg" full loading={pending} disabled={!picked} onClick={send} data-testid="circle-share-send">
                {w.send}
              </Button>
            ),
          }
        : {})}
    >
      <div data-testid="circle-share-sheet" data-state={load.state === "ready" ? (load.circles.length > 0 ? "list" : load.memberOf > 0 ? "blocked" : "none") : load.state}>
        {load.state === "loading" ? (
          <p className="nf-rm-note" role="status">
            {w.loading}
          </p>
        ) : null}
        {load.state === "failed" ? (
          <div className="nf-rmv-act">
            <p className="nf-rmv-act__line">{load.message}</p>
            <Button variant="secondary" size="md" onClick={() => setAttempt((n) => n + 1)} data-testid="circle-share-retry">
              {w.retry}
            </Button>
          </div>
        ) : null}
        {load.state === "ready" && load.circles.length === 0 ? (
          <div className="nf-rmv-act">
            <p className="nf-rmv-act__line">{load.memberOf > 0 ? w.emptyBlocked : w.emptyNone}</p>
            <ButtonLink href="/circle" variant="primary" size="md" data-testid="circle-share-find">
              {w.findCircle}
            </ButtonLink>
          </div>
        ) : null}
        {ready ? (
          <>
            <p className="nf-rm-note">{w.pick}</p>
            <ul className="nf-rmv-picklist">
              {load.circles.map((c) => (
                <li key={c.id}>
                  <button type="button" className="nf-rmv-pick" aria-pressed={picked === c.id} onClick={() => { feedback("select"); setPicked(c.id); }} data-testid="circle-share-option">
                    <span className="nf-rm-plate" aria-hidden="true">
                      <UiIcon name={picked === c.id ? "check" : "circle-people"} size={20} />
                    </span>
                    <span className="nf-rmv-pick__name">{c.name}</span>
                    {c.visibility === "private" ? <UiIcon name="lock" size={16} /> : <span aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
            <TextArea label={w.noteLabel} optionalText={copy.ui.flow.optional} value={note} maxLength={NOTE_MAX} rows={3} onChange={(e) => setNote(e.target.value)} />
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

/** The entry on a person's profile: an icon button that opens the sheet. */
export function ShareToCircleButton({ target }: { target: ShareTarget }) {
  const copy = useScopedCopy("roommates");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="icon" round iconOnly aria-label={copy.circleShare.action} onClick={() => setOpen(true)} data-testid="roommates-share-circle">
        <UiIcon name="circle-people" size={20} />
      </Button>
      <ShareToCircleSheet open={open} onOpenChange={setOpen} target={target} />
    </>
  );
}
