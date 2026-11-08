/**
 * The social layer's words (SW11): posts, stories, areas, the bot and
 * profiles. Moved from model files in `apps/web/src/lib/social/` into
 * the i18n package so the other three locales can translate them.
 */

export const socialPostEn = {
  held:
    "This mentions something we check by hand. Somebody is reading it before it goes up, and only you can see it until then.",
  removed: "This post was removed.",
  removedReplies: "The replies under it are still here.",
  emptyFeed:
    "Nothing has been said here yet. What you say will be the first thing anybody arriving reads.",
  emptyFeedSignedOut: "Nothing has been said here yet.",
  endOfSession: "That is everything for today.",
  blockedDone:
    "Blocked. You will not see each other anywhere on Vallo, and they are not told.",
  mutedDone:
    "Muted. They stop showing up in your feeds, stories and threads. Their own page still opens, and they are not told.",
  reportedDone:
    "Thank you. Somebody will look at this. We do not tell them who reported it.",
  copied: "Link copied.",
  picturePrompt: "Add a picture",
  pictureNote: "Up to four. Each one is redrawn on your phone first, so the location tag your camera wrote never leaves it.",
  pictureNeedsWords:
    "Say something about it and you can post. A picture on its own has no place to land.",
  pictureRemove: "Remove this picture",
  pictureLost:
    "Your words are up. The picture did not reach us, so the post has none yet.",
  deleteConfirm:
    "Delete this post? Replies under it stay, with a note where it was.",
  editedDone: "Changed. It says edited from now on.",
  editHeld:
    "Your change mentions something we check by hand, so the post is with us while somebody reads it. Only you can see it until then.",
};

export const socialPostFailureEn = {
  down: "We could not do that just now. Please try again in a moment.",
  gone: "That post is no longer there. It may have been taken down. Refresh the feed.",
  notInArea: "Join this place before you post in it.",
  tooDeep:
    "This thread is as deep as it goes. Reply higher up so people can follow it.",
  editWindowClosed:
    "The fifteen minutes for changing a post has passed. What is written stays as it is, and you can take it down whenever you like.",
  editNotLive: "This post is not showing, so there is nothing to change on it.",
  deleteWhileHeld:
    "This one is still with a moderator, so it cannot be taken down from here yet. Nobody else can see it while it is with them.",
  signedOutLike: "Sign in to like this.",
  pictureType: "Choose a JPG, PNG or WebP picture.",
  pictureTooBig: "That picture is over 10MB. Please choose a smaller one.",
  pictureReencode:
    "We could not prepare that picture safely on this device, so it was not uploaded. Try a different one.",
  pictureTooMany: "Four pictures is the most a post can carry. Remove one and try again.",
  pictureUpload: "That upload did not go through. Check your connection and try again.",
};

export const socialStoryEn = {
  chip: "STORY",
  publishing: "Publishing",
  publish: "Publish story",
  headlinePlaceholder: "What happened?",
  standfirstPlaceholder: "The paragraph under the headline. Two sentences is plenty.",
  placePlaceholder: "Lekki Phase 1, Lagos",
  imagePrompt: "Choose the picture",
  imageNote:
    "Pictures are re-encoded on your phone before they are uploaded, so the location tag a camera writes never leaves it.",
  needsImage: "Choose a picture and it will publish. A caption is optional.",
  held:
    "Your story mentions something we check by hand. Somebody is reading it before it goes up, and only you can see it until then.",
  emptyMine:
    "A story is a picture, a headline and a line or two. It stays up, so it is worth writing the ones people will still want next month.",
  addComment: "Add a comment...",
  updates: "Updates",
  stories: "Stories",
  removed: "This story was removed.",
};

export const socialStoryFailureEn = {
  down: "We could not publish that just now. Please try again in a moment.",
  upload: "That upload did not go through. Check your connection and try again.",
  reencode:
    "We could not prepare that picture safely, so it was not uploaded. Try a different one.",
  tooBig: "That picture is over 10MB. Please choose a smaller one.",
  wrongType: "Choose a JPG, PNG or WebP picture.",
  notInArea: "Join this place before you write a story about it.",
  gone: "That story is no longer there. It may have been taken down. Refresh to see the ones still up.",
  notYet:
    "We cannot reach stories right now. Everything else you can do here works as normal.",
  signedOutLike: "Sign in to like this story.",
};

export const socialAreaEn = {
  what: "Places on Vallo, kept by the people who actually live around them.",
  proposePending:
    "Your place is with us. We look at every one by hand, usually within a day, and you will get a notification either way.",
  proposeWhy:
    "We approve places one at a time so every one has somebody watching it. A place nobody is watching becomes a place nobody trusts.",
  joinedNone:
    "You have not joined a place yet. Join the ones you live in, stayed in, or care about, and they show up here.",
  noneOpenYet:
    "No places are open here yet. If you know one worth opening, tell us and we will look at it.",
  paused:
    "This place is paused while we sort something out. Nothing has been deleted and it will be back.",
  moderatorPending:
    "Your application is with us. We read every one, and you will hear either way.",
  slowMode:
    "This place is new, so posting needs a confirmed phone number and a first post is read before it goes up. That lifts once the place finds its feet.",
};

export const socialAreaFailureEn = {
  down: "We could not do that just now. Please try again in a moment.",
  gone: "That place is no longer open.",
  notMember: "Join this place first, then you can apply to look after it.",
  duplicate: "Somebody has already suggested that place. We will look at it.",
  alreadyApplied:
    "You already have an application open for this place. We will come back to you on it.",
  alreadyJoined: "You are already in this place.",
};

export const socialBotEn = {
  consent:
    "Vallo AI only answers people who have agreed to how it works. Open the assistant once to see what is sent, and to whom, before asking it here.",
  empty:
    "I could not find anything solid on that. Somebody who actually lives around here will know better than me.",
  unconfigured:
    "I am not switched on in places yet. Everything else around here works as normal.",
  upstream:
    "I could not finish that thought. Ask me again in a moment and your post is still here.",
  already: "I have already answered on this one. Reply to me and I will read it.",
  paced:
    "You have summoned me a few times in quick succession. Give it a moment and ask again.",
  notLive:
    "I do not answer on a post that a person is still reading. Summon me again once it is live.",
  slowMode:
    "This place is still finding its feet, so I stay out of it until it has. The people here will answer you.",
};

export const socialPidginEn = {
  title: "Pidgin is welcome",
  detail: "Tells people, and the assistant, that they can reply to you in Pidgin.",
};

export const socialFollowFirstEn = {
  title: "Follow {name} to message them",
  body: "They take new messages only from people who follow them. Follow them from their profile and the Message button appears.",
};

/** SW11: the contact policy words from profiles-model.ts. */
export const socialContactPolicyEn = {
  REQUEST: {
    title: "Ask me first",
    detail: "Someone new has to send a request before they can message you.",
  },
  OPEN: {
    title: "Anyone can message me",
    detail: "People around you can open a chat without asking first.",
  },
};
