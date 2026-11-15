"use client";

import { banner } from "@/lib/ui/toast";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { editPost } from "@/lib/social/posts-actions";
import { EDIT_WINDOW_MINUTES, POST_MAX } from "@/lib/social/posts-model";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Fixing what you wrote.
 *
 * In place inside the card rather than on a page of its own, because an edit is
 * almost always a typo and sending somebody to another screen to change one
 * letter is the kind of thing that makes people give up and post again instead.
 *
 * Two honest states most editors skip.
 *
 * The window closing is a real outcome and gets a real sentence. Fifteen minutes
 * is enforced by `posts_update_own`, and a page that has been open for twenty of
 * them will offer this and be refused; the refusal says what happened rather
 * than "something went wrong".
 *
 * An edit is rescanned. `posts_scan` fires on UPDATE as well as INSERT, so a
 * change that introduces an account number holds the post exactly as a new one
 * would. When that happens this says so plainly, because a post that quietly
 * stopped being visible after an edit is the worst possible way to find out.
 */
export function PostEditor({
  postId,
  initialBody,
  onDone,
  onSaved,
}: {
  postId: string;
  initialBody: string;
  onDone: () => void;
  /** Given the new body, so the card can show it without waiting for a reload. */
  onSaved: (body: string, held: boolean) => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [pending, startTransition] = useSafeTransition();

  const trimmed = body.trim();
  const left = POST_MAX - body.length;
  const changed = trimmed.length > 0 && trimmed !== initialBody.trim();

  const save = () => {
    startTransition(async () => {
      try {
        const result = await editPost({ postId, body: trimmed });
        if (!result.ok) {
          /* Said by the one banner at the top of the screen (Grade 1). */
          banner.error(result.error, { retry: save });
          return;
        }
        onSaved(trimmed, result.data.held);
        onDone();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (changed && !pending) save();
      }}
    >
      <textarea autoCapitalize="sentences" enterKeyHint="enter"
        className="nf-field min-h-[92px] w-full resize-y text-[length:var(--nf-text-body)] leading-[1.5]"
        value={body}
        maxLength={POST_MAX}
        autoFocus
        aria-label="Change what you wrote"
        onChange={(event) => setBody(event.target.value)}
      />

      <p className="mt-xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
        You can change a post for {EDIT_WINDOW_MINUTES} minutes after writing it.
        It will say edited afterwards, and anything you add is checked the same
        way a new post is.
      </p>

      <div className="mt-sm flex flex-wrap items-center justify-end gap-sm">
        {left < 240 ? (
          <span
            className={`nf-numeric text-[length:var(--nf-text-overline)] ${
              left < 0 ? "text-[var(--nf-state-error)]" : "text-[var(--nf-content-muted)]"
            }`}
          >
            {left}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!changed || pending}>
          {pending ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}
