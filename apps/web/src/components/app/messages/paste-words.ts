import type { ValloLinkKind } from "@/lib/paste/paste";

/**
 * THE WORDS OF A PASTE. English for now, like the thread's "Message copied".
 * Nothing here names where a paste came from: no app is told that.
 */
export const PASTE_WORDS = {
  trayLabel: "Pasted, ready to send",
  textTag: "TEXT",
  linkTag: "LINK",
  valloTag: "VALLO",
  characters: "{count} characters",
  over: "{count} over the limit",
  openText: "Pasted text, {count} characters. Open it to read and edit.",
  removeText: "Remove the pasted text",
  removeLink: "Remove the pasted link",
  removePhoto: "Remove this photo",
  sheetTitle: "Pasted text",
  sheetHint: "This is sent as your message when you press Send. Nothing has been sent yet.",
  sheetLabel: "The pasted text",
  done: "Done",
  photosOnly: "Only photos can be pasted here.",
  wordsOnly: "This box takes words. Photos and files cannot be pasted here.",
  photosFull: "That is as many photos as one message holds.",
  tooLong: "That is {count} characters over the limit for one message. Shorten the pasted text, then send.",
  sendsAsCard: "Sends as its card",
  vallo: {
    listing: "A listing on Vallo",
    stay: "A stay on Vallo",
    roommate: "A room on Vallo",
    post: "A post on Vallo",
    profile: "A profile on Vallo",
  } satisfies Record<ValloLinkKind, string>,
  paste: "Paste",
  pasteCode: "Paste the code",
  pasteEmpty: "There is no code on the clipboard to paste.",
  pasteBlocked: "This browser did not let Vallo read the clipboard. Press and hold a box, then choose Paste.",
} as const;

export const count = (n: number): string => n.toLocaleString("en-NG");
export const fillCount = (template: string, n: number): string => template.replace("{count}", count(n));
