/**
 * THE WORDS A PASTE USES. English only (the founder's rule for new copy),
 * in one place so the thread, the support reply and the feed composer say
 * the same thing about the same thing.
 */
export const PASTE_WORDS = {
  textTag: "TEXT",
  linkTag: "LINK",
  characters: "{n} characters",
  over: "{n} characters over the limit",
  open: "Open the pasted text to read and edit it",
  remove: "Remove the pasted text",
  removeLink: "Remove the pasted link",
  /* A file that is neither a picture nor a video is refused with words, never
     in silence (handoff 6.2 part 6). */
  refusedFile: "Only pictures and videos can be attached. That file was not added.",
  refusedFiles: "Only pictures and videos can be attached. {n} files were not added.",
} as const;
