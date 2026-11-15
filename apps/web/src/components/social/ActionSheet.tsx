"use client";

import { useEffect, useRef, useState } from "react";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import {
  ActionSheet as SharedActionSheet,
  type ActionSheetQuick,
  type ActionSheetRow,
} from "@/components/ui/ActionSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { countOf } from "@vallo/i18n/core";
import type { MenuWords } from "./sheet-words";
import { SHARE_WORDS } from "@/lib/features/listing-share/model";

/**
 * The sheet behind a card's `…`.
 *
 * Since 14 November 2026 it is the platform's shared action sheet
 * (components/ui/ActionSheet.tsx, handoff 6.3): a header card that says what
 * the sheet is about, Share, Save and Copy link as round quick actions (the
 * three everybody knows by their glyph), then the rows, and a Done bar. On a
 * phone it is the platform's sheet; a wide screen with a mouse gets the
 * sheet's own centred dialog, because the callers pass no trigger to hang a
 * popover from.
 *
 * Every ROW still carries a title AND the sentence that says what it does,
 * because "Hide" and "Not interested" and "Mute" are three words people cannot
 * tell apart and the difference between them matters: one is about a post, one
 * is about a feed, one is about a person. The sentence rides in the row's
 * second line. The quick actions are the ones whose word needs no sentence.
 *
 * **The rows change with what was tapped.** A person's post does not offer
 * "Contact Agent", because there is no agent to contact, and a control that
 * cannot work should not be there to press. What is offered is decided by the
 * caller and passed in, so this component holds no knowledge of what a post is.
 *
 * **The destructive rows are last and each one asks first.** Delete is
 * confirmed by the caller's slide (`DeleteSheet`) and Report by its form
 * (`ReportSheet`), so those two are handed straight over. Block and Remove
 * share had no question in front of them, only an Undo afterwards; they now
 * ask in the shared `ConfirmSheet`, in the row's own words, and the Undo
 * still follows.
 *
 * Everything about being a sheet (drag or flick to close, Escape, Back, the
 * focus trap and return, the counted scroll lock, the home-indicator inset) is
 * `Sheet`'s, inherited through the shared part.
 */

export type SheetAction = {
  key: string;
  title: string;
  note: string;
  /** One of the platform's navigation glyphs, or one of the social marks. */
  icon?: UiIconName;
  glyph?: UiIconName;
  danger?: boolean;
};

/** The acts drawn as round quick actions, in this order, when the caller offers them. */
const QUICK_KEYS = ["share", "save", "copy"] as const;
/** Destructive acts the caller already confirms in a sheet of its own. */
const OWN_CONFIRM = new Set(["delete", "report"]);

export function ActionSheet({
  label,
  actions,
  onChoose,
  onClose,
  body,
  dismissLabel,
}: {
  /** What this sheet is about: the header card's title, and the dialog's accessible name. */
  label: string;
  actions: SheetAction[];
  onChoose: (key: string) => void;
  onClose: () => void;
  /** The one line under the title, in the reader's language (`sheetWordsOf`). */
  body: string;
  /** The locale's "Not now" (`sheetWordsOf`): the way out of a question asked before a destructive act. */
  dismissLabel: string;
}) {
  /* The caller mounts this while its menu is up and unmounts it in `onClose`.
     A destructive act is asked about AFTER the sheet has closed, so the
     close is reported only once nothing is waiting on an answer. */
  const [open, setOpen] = useState(true);
  const [asking, setAsking] = useState<SheetAction | null>(null);
  const closed = useRef(onClose);
  useEffect(() => {
    closed.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open && asking === null) closed.current();
  }, [open, asking]);

  const iconOf = (action: SheetAction): UiIconName => action.glyph ?? action.icon ?? "sliders";

  const quick: ActionSheetQuick[] = QUICK_KEYS.flatMap((key) => {
    const action = actions.find((a) => a.key === key);
    return action
      ? [
          {
            id: action.key,
            label: action.title,
            icon: iconOf(action),
            onSelect: () => onChoose(action.key),
            testId: `post-action-${action.key}`,
          },
        ]
      : [];
  });

  const rows: ActionSheetRow[] = actions
    .filter((action) => !(QUICK_KEYS as readonly string[]).includes(action.key))
    .map((action) =>
      action.danger
        ? {
            id: action.key,
            kind: "danger" as const,
            label: action.title,
            hint: action.note,
            icon: iconOf(action),
            confirm: "own" as const,
            onSelect: () => {
              if (OWN_CONFIRM.has(action.key)) onChoose(action.key);
              else setAsking(action);
            },
            testId: `post-action-${action.key}`,
          }
        : {
            id: action.key,
            label: action.title,
            hint: action.note,
            icon: iconOf(action),
            onSelect: () => onChoose(action.key),
            testId: `post-action-${action.key}`,
          },
    );

  return (
    <>
      <SharedActionSheet
        open={open}
        onOpenChange={setOpen}
        title={label}
        header={{ title: label, subtitle: body }}
        quick={quick}
        rows={rows}
        testId="post-action-sheet"
      />
      {asking ? (
        <ConfirmSheet
          open
          onOpenChange={(next) => {
            if (!next) setAsking(null);
          }}
          title={`${asking.title}?`}
          line={asking.note}
          confirmLabel={asking.title}
          cancelLabel={dismissLabel}
          onConfirm={() => {
            onChoose(asking.key);
            setAsking(null);
          }}
          testId="post-action-confirm"
        />
      ) : null}
    </>
  );
}

/**
 * What a card offers, given what it is.
 *
 * One function so the feed, the thread and the profile cannot drift into three
 * slightly different menus. "Contact Agent" appears only where there is an
 * agent, and "Delete" only on your own, which is the whole reason this takes
 * facts rather than a kind name.
 */
export function actionsForPost(options: {
  isMine: boolean;
  isAgentAuthor: boolean;
  hasListing: boolean;
  saved: boolean;
  /**
   * Own post, still live, still inside the fifteen minute window the update
   * policy allows. **Without this row there was no way into the editor at all.**
   * `editPost`, `PostEditor`, the `edited_at` marker and the rescan on edit were
   * all built and all unreachable, because nothing in the product ever asked for
   * the edit action. The window is read at render time, so a card that has sat
   * open past it simply stops offering the row, and the action asks the database
   * again anyway.
   */
  editable: boolean;
  /**
   * Whether this reader has already reposted it, and how many people have.
   *
   * **Repost had no control anywhere in the product.** `toggleRepost` was a
   * validated action with its own rate limit, `post_reposts` had RLS, a counter
   * trigger and `notify_repost`, `PostCard` took an `onRepost` prop, both
   * surfaces wrote an optimistic patch for it, and the Activity tab rendered
   * "reposted this" entries that nothing could ever create. `PostCard`'s own
   * comment said repost "lives in the action sheet rather than in this row",
   * and this sheet had no such row. Six pieces of one feature and no way in.
   */
  reposted: boolean;
  repostCount: number;
  /** Whether there is a person behind this post at all. See the note above the
      mute and block rows: the assistant's reply and the platform's own system
      entry both have a null author, and neither can be muted or blocked. */
  hasAuthor: boolean;
  who: string;
  /** A listing shared into the feed: "Remove share" replaces Delete (and an edit is not offered). */
  isListingShare?: boolean;
}, words: MenuWords): SheetAction[] {
  /* The public count, said in words. The card's row has five items already and
     the owner's standing note is that nothing is jam-packed, so the number
     lives here rather than becoming a sixth control at 390px. */
  const soFar =
    options.repostCount > 0
      ? ` ${countOf(options.repostCount, "peopleSoFar")}`
      : "";

  const rows: SheetAction[] = [
    {
      key: "save",
      /* The card's own control is a bookmark labelled Save, and this writes the
         exact same `post_reactions` row with the mark SAVE. It used to say
         "Interested" here, which is a second word for one concept and the kind
         of drift that ends with two features nobody can tell apart. */
      title: options.saved ? words.saved : words.save,
      note: options.saved ? words.savedNote : words.saveNote,
      glyph: "bookmark",
    },
    {
      key: "repost",
      title: options.reposted ? words.reposted : words.repost,
      /* Exactly where it goes and no further. A repost appears under Activity
         on your own page, and the author is told. It does not lift the post
         into anybody's feed, because nothing in this product injects a repost
         into a feed, and promising that here would be the fourth control on
         this surface found saying more than it does. */
      note: options.reposted
        ? `${words.repostedNote}${soFar}`
        : `${words.repostNote}${soFar}`,
      glyph: "repost",
    },
  ];

  if (options.isAgentAuthor && options.hasListing) {
    rows.push({
      key: "contact",
      title: words.contact,
      note: words.contactNote,
      glyph: "chat-bubble",
    });
  }

  rows.push({
    key: "share",
    title: words.share,
    note: words.shareNote,
    glyph: "share",
  });

  /*
   * Copy link, on its own row at last.
   *
   * The `copy` branch has been in the feed's menu handler since the sheet
   * landed and no row ever asked for it, so the only way to get a link was to
   * open the share sheet and hope the platform offered copying. Share now says
   * what it does and this says what it does, which is also the pair every
   * reference screen shows.
   */
  rows.push({
    key: "copy",
    title: words.copy,
    note: words.copyNote,
    glyph: "link",
  });

  if (options.isMine && options.isListingShare) {
    rows.push({
      key: "remove-share",
      title: SHARE_WORDS.removeRow,
      note: SHARE_WORDS.removeNote,
      glyph: "trash",
      danger: true,
    });
    return rows;
  }

  if (options.isMine) {
    if (options.editable) {
      rows.push({
        key: "edit",
        title: words.edit,
        note: words.editNote,
        glyph: "plus",
      });
    }
    rows.push({
      key: "delete",
      title: words.delete,
      note: words.deleteNote,
      glyph: "trash",
      danger: true,
    });
    return rows;
  }

  /*
   * Mute and block act on a PERSON, and two kinds of post have nobody behind
   * them: the assistant's reply, whose `author_id` is null by design, and the
   * platform's own system entry. Both were offering "Mute this person" and
   * "Block this person", and both handlers answer a missing author with "There
   * is nobody to do that to on this post." That is a control that cannot work,
   * which this sheet's own rules forbid, and it was the assistant's card it
   * appeared on most.
   *
   * Report stays either way. Reporting is about the post, `reportPost` takes a
   * post id, and a machine answer is exactly the thing somebody should be able
   * to report.
   */
  if (options.hasAuthor) {
    rows.push({
      /*
       * One control, named for what it does.
       *
       * This row used to say "Not interested" and "See less like this from X",
       * and what it wrote was a full mute. Understating a control is the same
       * defect as overstating one, and it was harder to spot: somebody taps a
       * soft-sounding row and a person disappears from their feeds, their
       * stories and their threads. There is no per-post ranking signal in this
       * product to feed a genuine "see less", so the honest answer is to offer
       * the thing that exists under its own name.
       */
      key: "mute",
      title: words.mute.replace("{who}", options.who),
      note: words.muteNote,
      glyph: "mute",
    });
  }

  rows.push({
    key: "report",
    title: words.report,
    note: words.reportNote,
    glyph: "flag",
    danger: true,
  });

  if (options.hasAuthor) {
    rows.push({
      key: "block",
      title: words.block.replace("{who}", options.who),
      note: words.blockNote,
      glyph: "block",
      danger: true,
    });
  }

  return rows;
}
