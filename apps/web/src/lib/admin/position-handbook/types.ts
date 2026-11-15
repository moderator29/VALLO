import type { ReactNode } from "react";

/**
 * THE POSITION HANDBOOK, AS TYPES (15 November 2026).
 *
 * Every named staff position has its own handbook: what the job is for, what
 * to do on the first day, every desk the position opens, what may be decided
 * alone, the routine work step by step, the standards, the words to use, how
 * to escalate, what the copilot can do for it, the privacy rules that bite,
 * and who to go to.
 *
 * The shape is the staff manual's `ManualBody` on purpose (an intro, the "at a
 * glance" bullets, numbered sections with anchors), so one handbook renders
 * through the same documentation kit the manual draws with and reads as one
 * product. The manual's own type lives beside its chapters and belongs to that
 * work; this is the same shape declared here, so a handbook never waits on a
 * chapter file.
 *
 * Client-safe: types and data only. Nothing here imports the console door.
 */

/** One numbered section of a handbook. The id is the anchor a link lands on. */
export type HandbookSection = { id: string; title: string; body: ReactNode };

/** A whole handbook: the scope paragraph, the glance bullets, the sections. */
export type HandbookBody = { intro: ReactNode; glance: ReactNode[]; sections: HandbookSection[] };

/** One routine task of a role, as the steps a person follows in order. */
export type RoleTask = { id: string; title: string; steps: ReactNode[]; note?: ReactNode };

/** One standard: what is measured, and what good looks like. */
export type RoleStandard = { what: string; good: string };

/** Who to go to for one kind of question, named by position and never by a person. */
export type RoleContact = { what: string; who: string };

/**
 * THE ROLE'S OWN WORDS. Everything a handbook says that is true of this
 * position and no other. The shared parts (what Vallo is, the members, the
 * promises, the money wording, privacy, signing in, the audit log, escalation
 * and where to get help) are written once in `shared.tsx` and `build.tsx`, and
 * take these words as their subject, the way the manual's role chapters pass
 * their own words into `role-shared.tsx`.
 */
export type RoleWords = {
  /** "the Moderator": how the shared sections name the reader. */
  who: string;
  /** Why the shared "what Vallo is" section matters to this role, in one or two sentences. */
  keeps: string;
  /** What this job is for, in one paragraph a new person understands. */
  purpose: ReactNode;
  /** The glance bullets this role adds above the shared ones. */
  glance: ReactNode[];
  /** The first day, in order. */
  firstDay: ReactNode[];
  /** The first week, in order. */
  firstWeek: ReactNode[];
  /** What you may decide alone. */
  alone: ReactNode[];
  /** What needs somebody else, and who. */
  withSomebody: ReactNode[];
  /** What you never decide. */
  never: ReactNode[];
  /** Every routine task of the role, each as numbered steps. */
  tasks: RoleTask[];
  /** The standards and response times for the role. */
  standards: RoleStandard[];
  /** The words you use with members. */
  wordsUsed: ReactNode[];
  /** The words nobody at Vallo uses, and what to say instead. */
  wordsNever: ReactNode[];
  /** The privacy and safety rules that bite hardest for this role. */
  privacy: ReactNode[];
  /** What the copilot cannot do for this role beyond the standing limits. */
  copilotCannot: ReactNode[];
  /** Three good questions to ask the copilot. */
  copilotAsk: string[];
  /** Who to go to, by position. */
  contacts: RoleContact[];
};
