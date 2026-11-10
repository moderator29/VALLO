"use client";

import type { UiIconName } from "@/design-system/icons/UiIcon";
import { ActionSheetIllustrated, type ActionSheetRow } from "@/components/ui/ActionSheetIllustrated";
import { countOf } from "@vallo/i18n/core";
import type { MenuWords } from "./sheet-words";
import { SHARE_WORDS } from "@/lib/features/listing-share/model";

/**
 * The sheet behind a card's `…`.
 *
 * It is the platform's illustrated action sheet (north star 15.2, reference
 * 43): a clay object on a soft ground, a title, one line, then hairline rows
 * each with a round glyph plate, the action and the sentence that says what it
 * actually does, and one quiet dismiss. It used to be a generic list in a plain
 * `Sheet`, which is exactly the pattern 15.2 says this component replaces.
 *
 * Every row carries a title AND the sentence that says what it does, because
 * "Hide" and "Not interested" and "Mute" are three words people cannot tell
 * apart and the difference between them matters: one is about a post, one is
 * about a feed, one is about a person. The sentence rides in the row's `hint`.
 *
 * **The rows change with what was tapped.** A person's post does not offer
 * "Contact Agent", because there is no agent to contact, and a control that
 * cannot work should not be there to press. What is offered is decided by the
 * caller and passed in, so this component holds no knowledge of what a post is.
 *
 * Everything about being a sheet (drag or flick to close, Escape, Back, the
 * focus trap and return, the counted scroll lock, the home-indicator inset, a
 * body that scrolls when ten two-line rows are taller than a phone held
 * sideways) is `Sheet`'s, inherited through `ActionSheetIllustrated`. A danger
 * row takes the rose plate and label and never glows.
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

export function ActionSheet({
  label,
  actions,
  onChoose,
  onClose,
  body,
  dismissLabel,
}: {
  /** What this sheet is about: the title, and the dialog's accessible name. */
  label: string;
  actions: SheetAction[];
  onChoose: (key: string) => void;
  onClose: () => void;
  /** The one line under the title, in the reader's language (`sheetWordsOf`). */
  body: string;
  /** The single quiet dismiss, the locale's "Not now" (`sheetWordsOf`). */
  dismissLabel: string;
}) {
  const rows: ActionSheetRow[] = actions.map((action) => ({
    id: action.key,
    label: action.title,
    hint: action.note,
    icon: action.glyph ?? action.icon ?? "sliders",
    danger: action.danger,
    onSelect: () => onChoose(action.key),
  }));

  return (
    <ActionSheetIllustrated
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={label}
      body={body}
      object="local-talks"
      rows={rows}
      dismissLabel={dismissLabel}
      testId="post-action-sheet"
    />
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
