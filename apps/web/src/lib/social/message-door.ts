import type { ContactPolicy } from "./profiles-model";

/**
 * THE MESSAGE BUTTON ON A PROFILE (founder, 11 October 2026). Pure, so it is
 * tested rather than trusted.
 *
 * `social_profiles.contact_policy` is OPEN ("Anyone can message me") or
 * REQUEST ("Ask me first", the default). The rule:
 *
 *   the owner's own profile    no Message button, ever
 *   OPEN                       the Message button, for anybody
 *   REQUEST, viewer follows    the Message button
 *   REQUEST, viewer does not   no button; the profile says "Follow to
 *                              message" beside Follow instead
 *
 * Following is the ask. Once the viewer follows, the page refreshes (the
 * Follow button does that) and the button is there. The same rule guards
 * `/u/<handle>/message` and the send itself, for somebody with no chat with
 * the person yet, so typing the address does not get round a hidden button.
 * A signed-out viewer follows nobody, so a REQUEST profile asks them to
 * follow, and Follow sends them to sign in first.
 */
export type MessageDoor = "message" | "follow-first" | "none";

/*
 * The words, beside the rule, the way `CONTACT_POLICY_COPY` sits beside the
 * policy in `profiles-model.ts`. English for now: they are new, so every
 * locale would show English anyway until a speaker translates them, and they
 * move into the dictionary with that translation.
 */
/** Said instead of Message, beside Follow. */
export const FOLLOW_TO_MESSAGE = "Follow to message";
/** The message screen, reached by address with the button hidden. `{name}` is theirs. */
/** SW11: source of truth is now `packages/i18n/src/locales/social.en.ts`. */
import { getDictionary } from "@vallo/i18n";
export const FOLLOW_FIRST_COPY = getDictionary("en").social.followFirst;

export function messageDoor(input: {
  isOwner: boolean;
  contactPolicy: ContactPolicy;
  viewerFollows: boolean;
}): MessageDoor {
  if (input.isOwner) return "none";
  if (input.contactPolicy === "REQUEST" && !input.viewerFollows) return "follow-first";
  return "message";
}
