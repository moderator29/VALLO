/**
 * The crash log desk's words. Staff-only console copy, kept English like the
 * alerts desk beside it (`app/admin/alerts/ack-copy.ts`, STAFF_ENGLISH in
 * packages/i18n/src/review-status.ts).
 */
export const CRASH_COPY = {
  title: "Crash log",
  lede: "Every distinct crash on the iPhone app, the Android app, the website and the server, counted. Nothing in it names a person.",
  missingTitle: "The crash log is waiting for its table",
  missingBody: "Paste grade1_crash_log.sql into the Supabase SQL editor once. Until then, browser crashes still arrive as alerts.",
  emptyOpen: "No open crashes",
  emptyOpenBody: "Nothing has crashed that is not already marked fixed or quiet.",
  emptyOther: "Nothing here",
  emptyOtherBody: "No crash has this state yet.",
  statOpen: "Open",
  statDay: "Seen in the last 24 hours",
  statusTabs: { open: "Open", resolved: "Fixed", ignored: "Quiet" },
  sourceAll: "All",
  source: { web: "Website", ios: "iPhone app", android: "Android app", server: "Server" },
  times: "{count} times",
  once: "Once",
  first: "First seen {when}",
  last: "Last seen {when}",
  where: "Where: {area}",
  release: "Build {release}",
  ref: "Reference {ref}",
  stack: "Stack",
  markFixed: "Mark fixed",
  quiet: "Quiet it",
  reopen: "Open again",
  fixedDone: "Marked fixed. It opens again if it happens again.",
  quietDone: "Quiet. It will not ask for attention again.",
  reopenDone: "Open again.",
  filterLabel: "Filter crashes",
} as const;
