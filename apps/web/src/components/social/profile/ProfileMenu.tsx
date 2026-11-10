"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReportSheet } from "@/components/social/ReportSheet";
import type { ReportWords } from "@/components/social/sheet-words";
import { useOverlay } from "@/lib/ui/use-overlay";
import { Sheet } from "@/components/ui/Sheet";
import {
  blockUser,
  muteTarget,
  reportProfile,
  unblockUser,
  unmuteTarget,
} from "@/lib/social/posts-actions";
import { POST_COPY, PROFILE_REPORT_REASONS } from "@/lib/social/posts-model";
import { displayHost } from "@/lib/brand-domain";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import "./social-profile.css";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";
import { withNext } from "@/lib/auth/next-link";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The `…` on a person's page. The sibling of the one on every card.
 *
 * Copy link, mute, report, block. Share is its own round control beside this
 * one on the cover, because sending somebody a person's page is a thing people
 * do often enough to deserve a tap rather than two. The rest are the same
 * actions the card menu calls, and that is the point: blocking somebody from
 * their page and blocking them from something they wrote must be the same
 * block, or one of the two quietly becomes a different feature.
 *
 * Every one of these takes a USER id. The post menu learned this the hard way,
 * where passing a post id would have blocked a uuid that is nobody, reported
 * success, and changed nothing at all.
 *
 * **Blocking from here needs somewhere to land, and that is the whole reason
 * this component is more than a popover.** `social_profiles_select` carries
 * `not private.blocked_with(user_id)` bidirectionally, so the instant the block
 * row is written this page stops existing for the person who wrote it: a
 * refresh would drop them onto the "nothing to show here" screen with no
 * explanation, which reads as the app having lost the person they just acted
 * on. So the block is confirmed first, and then the page is replaced by a
 * designed answer that says what happened, what it means, and offers to undo
 * it. No navigation, no 404, and the undo is real: `unblockUser` deletes the
 * row and the page comes back.
 */
export function ProfileMenu({
  handle,
  userId,
  displayLabel,
  isOwner,
  signedIn,
  initialMuted = false,
  onCover = false,
  reportWords,
}: {
  handle: string;
  userId: string;
  displayLabel: string;
  isOwner: boolean;
  signedIn: boolean;
  initialMuted?: boolean;
  /** Floating on a cover photograph rather than sitting on the canvas. */
  onCover?: boolean;
  /** The report sheet's reasons and words, from the server (`reportWordsOf`). */
  reportWords: ReportWords;
}) {
  const signInHref = useSignInHref();
  /* VIEW-ONLY PUBLIC PROFILE (founder, 9 November 2026). A signed-out visitor
     who taps mute or report on an anon-viewable profile goes to sign UP
     carrying this page, not the app's shared sign-in door. Signed in, this is
     never read. */
  const guestHref = signedIn ? signInHref : withNext("/sign-up", `/u/${handle}`);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [pending, startTransition] = useSafeTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const blockedRef = useRef<HTMLDivElement>(null);

  /*
   * THE MENU OPENS WHOLLY ON SCREEN (D79, founder: it "renders clipped off
   * the right edge"). It hangs from the trigger's start edge; where that
   * would run past the viewport it hangs from the end edge instead, and if a
   * narrow screen still cuts it, it is slid back inside an 8px margin. Read
   * and written before paint, so it never flashes in the wrong place.
   */
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    const MARGIN = 8;
    const viewport = document.documentElement.clientWidth;
    const fits = () => {
      const box = menu.getBoundingClientRect();
      return box.left >= MARGIN && box.right <= viewport - MARGIN;
    };
    menu.style.insetInlineStart = "";
    menu.style.insetInlineEnd = "";
    menu.style.translate = "";
    if (fits()) return;
    menu.style.insetInlineStart = "auto";
    menu.style.insetInlineEnd = "0px";
    if (fits()) return;
    const box = menu.getBoundingClientRect();
    const shift = box.left < MARGIN ? MARGIN - box.left : viewport - MARGIN - box.right;
    menu.style.translate = `${shift}px 0`;
  }, [open]);

  const who = displayLabel || `@${handle}`;

  /* Focus goes back to the `…` that started this. The sheet's own return
     would aim at the Block row, which left with the menu, and land on the
     page body. */
  const cancelBlock = useCallback(() => {
    setConfirmBlock(false);
    openerRef.current?.focus();
  }, []);
  /* The blocked result has no dismiss. See the note on its hook below. */
  const noop = useCallback(() => {}, []);

  /*
   * Three overlays live in this component and they are not the same kind of
   * thing, so they do not get the same treatment.
   *
   * The MENU is a `role="menu"` popover. It never claimed `aria-modal` and it
   * must not start: a menu is not a modal, nothing behind it is inert, and
   * trapping Tab in a four-row popover strands the keyboard. It keeps Escape
   * and its focus return, which it already had, and that is the whole
   * contract for a popover.
   *
   * The BLOCK CONFIRM is the platform's `Sheet`: a dismissable question, so
   * it takes the drag and flick to close, Back, Escape and the focus trap
   * every other sheet has.
   *
   * The BLOCKED RESULT stays a full-page cover on the shared hook, and it is
   * deliberately NOT a `Sheet`: it is a terminal state that replaces a page
   * which has just stopped existing for this reader, and a sheet can be
   * dragged, flicked, backed or tapped away, which would drop them onto that
   * missing page. They cannot appear together: `blocked` returns early below,
   * so the confirm is unmounted by the time the result renders.
   */
  /* No `onClose`: this is a terminal state, not a dismissable overlay. The
     way out is "Back to Around" or "Undo the block", both inside it. Escape
     resolving to nothing is correct; what matters is that Tab cannot reach
     the profile behind, which is the page that just stopped existing for
     this reader. */
  useOverlay({ open: blocked, onClose: noop, panelRef: blockedRef });

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /**
   * Copy, not share. Share is its own control beside this one now, and two
   * menu rows that open the same sheet is one row too many. Copying is a
   * genuinely different act: it puts the address in a message somebody is
   * already writing, with no sheet in the way.
   */
  const copyLink = () => {
    setOpen(false);
    const url = `${window.location.origin}/u/${handle}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      banner.success(POST_COPY.copied);
      return;
    }
    banner.info(`The address is ${displayHost()}/u/${handle}`);
  };

  const requireSignIn = () => {
    if (signedIn) return false;
    router.push(guestHref);
    return true;
  };

  const onMute = () => {
    setOpen(false);
    if (requireSignIn()) return;
    const next = !muted;
    startTransition(async () => {
      try {
        const result = next
          ? await muteTarget({ targetKind: "USER", targetId: userId })
          : await unmuteTarget({ targetKind: "USER", targetId: userId });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        setMuted(next);
        if (next) {
          /* Undo is the real inverse, and puts the menu's own state back. */
          bannerWithUndo(POST_COPY.mutedDone, {
            undo: () => unmuteTarget({ targetKind: "USER", targetId: userId }),
            undone: `Unmuted. ${who} will show up in your feeds again.`,
            onUndone: () => {
              setMuted(false);
              router.refresh();
            },
          });
        } else {
          bannerWithUndo(`Unmuted. ${who} will show up in your feeds again.`, {
            undo: () => muteTarget({ targetKind: "USER", targetId: userId }),
            undone: POST_COPY.mutedDone,
            onUndone: () => {
              setMuted(true);
              router.refresh();
            },
          });
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const doBlock = () => {
    startTransition(async () => {
      try {
        const result = await blockUser({ userId });
        if (!result.ok) {
          setConfirmBlock(false);
          /* The sheet's own return aims at the Block row, which left with the
             menu; the `…` is where the keyboard belongs. */
          openerRef.current?.focus();
          banner.error(result.error);
          return;
        }
        setConfirmBlock(false);
        setBlocked(true);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const undoBlock = () => {
    startTransition(async () => {
      try {
        const result = await unblockUser({ userId });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        setBlocked(false);
        banner.success(`Unblocked. You and ${who} can see each other again.`);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* ------------------------------------------------- after the block lands */
  if (blocked) {
    return (
      <div
        className="nf-social-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`You blocked ${who}`}
      >
        <div ref={blockedRef} className="nf-social-sheet__panel">
          <h2 className="nf-h3 text-[length:var(--nf-text-body-lg)]">You blocked {who}</h2>
          <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
            {POST_COPY.blockedDone}
          </p>
          <p className="mt-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            That is why this page is covered: from now on it is not there for
            you, and yours is not there for them. Nothing you already wrote is
            deleted.
          </p>

          <div className="mt-lg flex flex-col gap-xs">
            <ButtonLink href="/around" variant="primary" full>
              Back to Around
            </ButtonLink>
            <Button
              type="button"
              variant="secondary"
              full
              onClick={undoBlock}
              disabled={pending}
              loading={pending}
            >
              {pending ? "Undoing" : "Undo the block"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <button
          ref={openerRef}
          type="button"
          className={onCover ? "nf-social-round nf-btn--glass" : "nf-social-more nf-btn--glass"}
          aria-label={`More actions for ${who}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <UiIcon name="more" size={20} />
        </button>

        {open ? (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${who}`}
              className="nf-post__menu nf-social-more__menu"
            >
              <button
                type="button"
                role="menuitem"
                className="nf-post__menu-item"
                onClick={copyLink}
              >
                Copy link to this page
              </button>

              {isOwner ? (
                <Link
                  role="menuitem"
                  href={`/u/${handle}/edit`}
                  className="nf-post__menu-item"
                  onClick={() => setOpen(false)}
                >
                  Edit your profile
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="nf-post__menu-item"
                    onClick={onMute}
                  >
                    {muted ? `Unmute ${who}` : `Mute ${who}`}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="nf-post__menu-item nf-post__menu-item--danger"
                    onClick={() => {
                      setOpen(false);
                      if (requireSignIn()) return;
                      setReporting(true);
                    }}
                  >
                    {reportWords.reportWho.replace("{who}", () => who)}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="nf-post__menu-item nf-post__menu-item--danger"
                    onClick={() => {
                      setOpen(false);
                      if (requireSignIn()) return;
                      setConfirmBlock(true);
                    }}
                  >
                    Block {who}
                  </button>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* ------------------------------------------------ before the block */}
      <Sheet
        open={confirmBlock}
        onOpenChange={(next) => {
          /* Not while the block is being written: a drag, Back or Escape then
             would hide the sheet with the block still landing behind it. */
          if (!next && !pending) cancelBlock();
        }}
        title={`Block ${who}?`}
        fullPage
      >
        <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          You will not see each other anywhere on Vallo. Their page stops
          existing for you and yours stops existing for them, including in
          places you are both in.
        </p>
        <p className="mt-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          They are not told. Undo is offered on the next screen if you
          change your mind.
        </p>
        <div className="mt-lg flex flex-col gap-xs sm:flex-row-reverse">
          {/* `nf-social-danger` was a social-layer-only destructive
              treatment standing exactly where `variant="danger"` goes, so
              the social layer's delete button did not look like the
              platform's delete button. One vocabulary for one act. */}
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            onClick={doBlock}
            disabled={pending}
            loading={pending}
          >
            {pending ? "Blocking" : `Block ${who}`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={cancelBlock}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </Sheet>

      {reporting ? (
        <ReportSheet
          title={reportWords.reportWho.replace("{who}", () => who)}
          subject={reportWords.accountSubject.replace("{handle}", () => handle)}
          reasons={PROFILE_REPORT_REASONS}
          words={reportWords}
          submit={({ reason, detail }) => reportProfile({ userId, reason, detail })}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </>
  );
}
