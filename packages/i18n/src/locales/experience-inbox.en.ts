/**
 * Session 3's copy for messages, the notification centre, assistant and support (W5).
 *
 * One module per owner so nine agents can add strings without editing en.ts
 * at the same time. English only: ha, ig and yo fall back to it through
 * `withFallback` until a translator supplies a line, because an invented
 * translation of a new line is worse than none. Money sentences never live
 * here; they come from `lib/money/copy.ts` (Session 2).
 *
 * Counted phrases are `{ one, other }` pairs read through `plural()`, so a
 * count is never inflected by hand. Nothing here states a figure, a name or a
 * date: those arrive from the real row and are formatted where they are drawn.
 */
export const experienceInboxEn = {
  /* ------------------------------------------------ the notification centre */
  notifications: {
    title: "Notifications",
    unread: "{count} unread",
    markAllRead: "Mark all read",
    preferences: "Preferences",
    preferencesLabel: "Notification preferences",
    filterLabel: "Filter notifications by kind",
    families: {
      all: "All",
      money: "Money",
      trust: "Trust",
      spaces: "Spaces",
      messages: "Messages",
      account: "Account",
    },
    sections: {
      needsYou: "Needs you",
      fresh: "New",
      earlier: "Earlier",
    },
    day: { today: "Today", yesterday: "Yesterday" },
    empty: {
      title: "You are all caught up",
      body: "Bookings, messages, agreements and money all land here the moment they happen.",
      action: "Find a place",
    },
    emptyFamily: {
      title: "Nothing under {family}",
      body: "When something happens in this area it appears here, and in All.",
      action: "Show all",
    },
    unreadMark: "Unread",
    showOlder: "Show older",
    loadingOlder: "Loading older",
    olderFailed: "Older notifications did not load. Check your connection and try again.",
    verbs: {
      reply: "Reply",
      confirm: "Confirm",
      review: "Review",
      addDetails: "Add details",
      check: "Check",
      renew: "Renew",
      open: "Open",
    },
    group: {
      messages: { one: "{count} new message", other: "{count} new messages" },
      updates: { one: "{count} update", other: "{count} updates" },
      show: "Show the updates",
      hide: "Hide the updates",
    },
    details: "Details",
    openRow: "Open",
    /* The signed-out and unreachable states. */
    signedOut: {
      title: "Sign in to see your notifications",
      body: "Your bookings, messages and agreements are tied to your account, so we only ever show you your own.",
      action: "Sign in",
      secondary: "Notification settings",
    },
    unreachable: { action: "Try again" },
    loading: "Loading your notifications",
  },

  /* --------------------------------------------- one notification, in full */
  notificationView: {
    pageTitle: "Notification",
    back: "Notifications",
    whatHappened: "What happened",
    when: "When",
    received: "Received",
    about: "About",
    amount: "Amount in this notice",
    nextHeading: "What to do next",
    nothingAsked: "Nothing is asked of you. This is for your records.",
    backToList: "Back to notifications",
    timelineHeading: "Earlier on this",
    timelineNow: "This notice",
    timelineEmpty: "This is the first notice about it.",
    changePreferences: "Change what you are told about {family}",
    familyLines: {
      money: "A payment, a refund, or a date money is due.",
      trust: "A check, a badge, or a document that needs a look.",
      spaces: "A listing, a booking, a stay or a tenancy.",
      messages: "A conversation, or somebody in your circle.",
      account: "Your sign-in, your devices, or support.",
    },
    /* The noun the link to the underlying object names. */
    objects: {
      booking: "booking",
      payment: "payment",
      agreement: "agreement",
      tenancy: "tenancy",
      inspection: "inspection",
      conversation: "conversation",
      space: "space",
      verification: "verification",
      passport: "Vallo passport",
      ticket: "support ticket",
      post: "post",
      profile: "profile",
      setting: "setting",
      workspace: "workspace",
      page: "page",
    },
    openObject: "Open the {object}",
    notFound: {
      title: "This notification is not here",
      body: "It may belong to another account, or it was removed. Your list has the rest.",
    },
    signedOut: {
      title: "Sign in to read this notification",
      body: "A notification is only ever readable by the person it was sent to.",
      action: "Sign in",
    },
    unreachable: {
      title: "This notification could not be loaded",
      body: "The read did not go through. Nothing has changed on your account.",
      action: "Try again",
    },
    loading: "Loading the notification",
    sender: "From",
  },

  /* ------------------------------------------------------- the thread, 15.4 */
  /**
   * `/messages/[id]`, the page's own words around the thread (Round 3 sweep,
   * C3). The paused sentence is the inbox's.
   */
  threadPage: {
    title: "Conversation",
    signedOutTitle: "Sign in to read this conversation",
    signedOutBody: "A conversation is only ever readable by the two people in it, so this one needs your account. Sign in and it opens where you left it.",
  },
  thread: {
    unreadDivider: {
      one: "{count} unread message",
      other: "{count} unread messages",
    },
    quoted: {
      you: "You",
      replyingTo: "Replying to {name}",
      photo: "Photo",
      voice: "Voice note",
      file: "Attachment",
      unavailable: "The message you replied to is no longer here",
    },
    attachment: {
      photo: "Photo",
      voice: "Voice note",
      file: "File",
      open: "Open {name}",
      size: "{size}",
    },
    voice: {
      play: "Play voice note",
      pause: "Pause voice note",
      label: "Voice note, {duration}",
      labelUnknown: "Voice note",
      position: "Playback position",
      unavailable: "This voice note could not be played",
    },
    day: { today: "Today", yesterday: "Yesterday" },
    newMessages: "Jump to the newest message",
    /* The conversation screen's own words (`ThreadView`), moved out of the
       component in the language audit (17 October 2026). `{name}` is the
       other person. */
    view: {
      options: "Conversation options",
      conversation: "Conversation",
      openProfile: "{name}, open profile",
      keepInside: "Keep every chat and payment inside Vallo",
      emptyTitle: "Say hello to {name}",
      emptyListing:
        "Nothing has been said here yet. Ask what you need to know about the property, agree a time to see it, and keep the whole conversation in one place.",
      emptyBooking: "Nothing has been said here yet. Ask about your arrival, the room or anything the booking does not answer.",
      emptyReservation: "Nothing has been said here yet. Confirm the time, the size of the party, and anything the kitchen should know.",
      emptyDirect:
        "Nothing has been said here yet. Whatever you write stays between the two of you, and the whole conversation is kept here.",
      roleLandlord: "Landlord",
      roleAgent: "Vallo Agent",
      roleTenant: "Tenant",
      photoYours: "Photo you attached",
      photoFrom: "Photo from {name}",
      videoYours: "Video you attached",
      videoFrom: "Video from {name}",
      forwarded: "Forwarded",
      deleted: "This message was deleted",
      open: "Open",
      sending: "Sending",
      notSent: "Not sent.",
      retry: "Retry",
      /** `{text}` is the start of the message that failed. */
      retryText: "Retry sending: {text}",
      retryPhoto: "Retry sending your photo",
      retryMessage: "Retry sending this message",
      typing: "{name} is typing",
      dismissSafety: "Dismiss safety note",
      photoReady: "Photo ready to send",
      photoAttached: "Photo attached",
      removePhoto: "Remove photo",
      remove: "Remove",
      cancelReply: "Cancel reply",
      cancel: "Cancel",
      attachPhoto: "Attach a photo",
      messageTo: "Message {name}",
      placeholder: "Type a message",
      send: "Send message",
      forwardedTo: "Forwarded to {name}.",
      inspectionConfirmed: "Inspection confirmed.",
      inspectionConfirmedDevice: "Inspection confirmed on this device",
      failed: "That did not go through. Check your connection and try again.",
      /** The line over a shared card. */
      shared: {
        listing: "Shared a listing",
        booking: "Shared a booking",
        stay: "Shared a stay",
        passport: "Shared a passport",
      },
      /* The options sheet (`ThreadOptionsSheet`). */
      close: "Close",
      confirmInspected: "Confirm I have inspected this property",
      conversationWith: "Conversation with {name}",
      verifiedListing: "Verified listing",
      verificationPending: "Verification pending",
      approved: "Approved",
      shareHere: "Share a listing or a booking here",
      shareHereBody: "It arrives as a card {name} can open.",
      blockAsk: "Block {name}?",
      block: "Block {name}",
      blockBody: "They stop being able to reach you, here and everywhere else.",
      /** `BLOCK_CONFIRM_COPY`, word for word. */
      blockConfirm:
        "They will not be able to message you, see your profile or find your listings, and you will not see theirs. They are not told. You can undo this in Settings, Privacy.",
      keepOpen: "Keep the conversation open",
      /** The owner's canonical safety rule, verbatim (`SAFETY_EDUCATION_COPY`). */
      safetyRule:
        "For your safety, keep every chat and payment inside Vallo. Deals made outside the platform are not protected by us. Pay only after you have inspected the property.",
    },
    /** A listing or booking shared into a conversation (`ChatCard`). */
    card: {
      /** `{rating}` is a number. */
      rated: "Rated {rating} out of 5",
      forward: {
        listing: "Forward this listing to another conversation",
        stay: "Forward this stay to another conversation",
        booking: "Forward this booking to another conversation",
      },
      verified: "Verified",
      /** `{area}` is the area or city. */
      map: "Map of {area}. The pin shows the area, not the address.",
      viewStay: "View stay",
      viewListing: "View listing",
      messageAgent: "Message agent",
      checkIn: "Check in",
      checkOut: "Check out",
      guests: "Guests",
      viewBooking: "View booking details",
      contactHost: "Contact host",
    },
    /** A message's long-press menu (`MessageMenu`). */
    menu: {
      close: "Close menu",
      label: "Message options",
      reply: "Reply",
      forward: "Forward",
      copy: "Copy",
      deleteForMe: "Delete for me",
      deleteForEveryone: "Delete for everyone",
    },
    /** The forward chooser (`ForwardSheet`). */
    forward: {
      title: "Forward to",
      close: "Close",
      search: "Search the people you follow",
      clear: "Clear search",
      placeholder: "Search",
      loading: "Loading your chats",
      empty: "Follow someone to forward a message to them.",
      unreachable: "We could not load your chats just now. Close this and try again.",
      failed: "That did not work. Please try again.",
      noMatch: "Nobody you follow matches that.",
      listLabel: "Chats you can forward to",
      sending: "Sending",
    },
  },

  /* -------------------------------------------------------------- the inbox */
  inbox: {
    filters: {
      label: "Filter conversations",
      recent: "Recent",
      unread: "Unread",
      requests: "Requests",
      archived: "Archived",
      reported: "Reported",
    },
    emptyUnread: {
      title: "Nothing is waiting on you",
      body: "Every conversation here has been read. A new message brings its conversation back to this filter.",
    },
    unreadBadge: { one: "{count} unread message", other: "{count} unread messages" },
    presence: { online: "Online now" },
    /** The wide screen's list beside an open conversation (`InboxPane`). */
    pane: "Conversations",
    /* `/messages`, the page's own words (Round 3 sweep, C3). */
    title: "Inbox",
    paused: "Messaging is paused for maintenance. Your conversations are stored on your account, not on this device. Try again in a few minutes.",
    signedOutTitle: "Sign in to see your messages",
    signedOutBody: "Conversations live with your account, so they follow you between devices and nobody else can read them. Message an agent from any listing to start one.",
    signIn: "Sign in",
    explore: "Explore places",
    /* The inbox list itself (`Inbox`), moved out of the component (Round 3
       sweep, C3). `{count}` a number, `{query}` what was typed, `{name}` the
       other person. */
    unreadCount: "{count} unread",
    markAllRead: "Mark all read",
    marking: "Marking...",
    compose: "Find a place to message an agent about",
    search: "Search messages",
    searchPlaceholder: "Search messages…",
    clearSearch: "Clear the search",
    sides: "Conversations by side",
    sideProperty: "Property",
    sideStays: "Stays",
    typing: "Typing...",
    archive: "Archive",
    moveBack: "Move back to Recent",
    archivedNote: "Archived. It is under Archived, and {name} still sees it.",
    movedBackNote: "Moved back to Recent.",
    noMatchTitle: "Nothing matches that",
    noMatchBody: "No conversation mentions \"{query}\". Try a host's name, a listing or a word from the message.",
    noRequestsTitle: "No requests waiting",
    noRequestsBody: "A message from somebody you have never spoken to waits here first, so a stranger never lands in your main list.",
    noArchivedTitle: "Nothing archived",
    noArchivedBody: "Archive a conversation from Recent to put it away. Only you stop seeing it there; the other person still has it, and a new reply brings it back.",
    archiveClosedTitle: "Archive is not open yet",
    archiveClosedBody: "Soon you will be able to put conversations away here. Nothing you have is hidden in the meantime.",
    noReportedTitle: "Nothing reported",
    noReportedBody: "A conversation you report, or one with a person you reported, is listed here so you can find it again.",
    noStaysTitle: "No stay conversations yet",
    noStaysBody: "Message a hotel or a restaurant, or book a stay. The conversation appears here with the place attached.",
    findStay: "Find a stay",
    noneTitle: "No conversations yet",
    noneBody: "Open any property and tap Message agent. The thread appears here, with the property attached, so nobody has to ask which one you mean.",
    findPlace: "Find a place",
    recentEmptyTitle: "Nothing in Recent",
    recentEmptyBody: "Everything on this side is a request or archived. Reply to a request and it moves here.",
  },

  /**
   * `/messages/share/[kind]/[id]`: sending a listing, booking or stay into a
   * conversation as a card. The page's own words, moved out of the page so
   * ha, ig and yo can carry them (Round 3 sweep, C3).
   */
  share: {
    title: "Share to chat",
    intoTitle: "Share into this chat",
    signedOutTitle: "Sign in to share this",
    signedOutBody: "Sharing sends a card into one of your conversations, so it needs your account. You will come straight back here.",
    signIn: "Sign in",
    pausedTitle: "Messaging is paused for maintenance",
    pausedBody: "Nothing has been lost. Try again in a few minutes.",
    back: "Back",
    /**
     * The picker itself (`SharePicker`). `{name}` is the other person's name;
     * `{noun}` is one of `nouns`.
     */
    picker: {
      sharing: "What you are sharing",
      sendTo: "Send it to",
      noThreadsTitle: "No conversations to send it to",
      noThreadsBody: "Open any property and tap Message agent. Once you have a conversation, you can share things into it from here.",
      findPlace: "Find a place",
      sendToName: "Send to {name}",
      shareWith: "Share with {name}",
      nothingTitle: "Nothing to share yet",
      nothingBody: "A booking you hold, a place you saved, or a property you have chatted about can be sent into this conversation as a card.",
      sendNoun: "Send {noun}",
      nouns: { listing: "this listing", booking: "this booking", stay: "this stay" },
      lands: "The card lands in the conversation as a message they can open.",
      notNow: "Not now",
    },
  },

  /**
   * `/messages/new`: the first message to an agent about one property. The
   * page's and the form's own words, moved out of the code (Round 3 sweep, C3).
   * `{title}` is the listing's title.
   */
  newMessage: {
    metaTitle: "New message",
    title: "Message the agent",
    backToProperty: "Back to the property",
    goToInbox: "Go to your Inbox",
    didNotOpen: "This chat did not open",
    signedOutTitle: "Sign in to message the agent",
    signedOutBody: "Chat with the agent, arrange an inspection and keep every step of the deal in one place, on the record. You will come straight back to this conversation.",
    signIn: "Sign in",
    unreachableTitle: "We cannot reach messaging right now",
    unreachableBody: "This is on our side, not yours. Nothing has been lost and nothing has been sent. Try again in a few minutes.",
    firstAbout: "Your first message about {title}",
    first: "Your first message",
    placeholder: "Say hello, and ask what you want to know. Is it still available? Can you do an inspection this week?",
    send: "Send",
  },

  /**
   * A message to a person, written from their profile (9 October 2026).
   * `{name}` is their name, `{handle}` their @name.
   */
  direct: {
    metaTitle: "Message",
    title: "Message {name}",
    placeholder: "Write a message to {name}",
    hint: "They get a notification. Once they reply you can call each other from the chat.",
    send: "Send",
    sending: "Sending",
    back: "Back to the profile",
    signedOutTitle: "Sign in to message {name}",
    signedOutBody: "Messages are between members, so this needs your account. You will come straight back here.",
    signIn: "Sign in",
    notFoundTitle: "We could not find that person",
    notFoundBody: "They may have changed their name, or you may not be able to reach them. Search for them again.",
    findPeople: "Find people",
    selfTitle: "That is you",
    selfBody: "Pick somebody else to message, or open your inbox.",
    inbox: "Open your inbox",
    unreachableTitle: "We cannot reach messaging right now",
    unreachableBody: "This is on our side, not yours. Nothing has been sent. Try again in a few minutes.",
  },

  /* ------------------------------------------------------------- assistant */
  assistant: {
    answerLabel: "Vallo AI",
    thinking: "Thinking",
    searching: "Searching listings",
    stop: "Stop",
    copy: "Copy answer",
    copied: "Copied",
    statusDone: "Answer complete",
    statusStopped: "Answer stopped",
    statusError: "The answer did not arrive",
    stoppedNote: "You stopped this answer. What arrived is kept.",
    islandTitle: "Vallo AI is answering",
    islandDetail: "Tap to go to the answer",
    islandOpen: "Go to the answer",
    expand: "Show details",
    collapse: "Hide details",
    you: "You",
  },

  /* --------------------------------------------------------------- support */
  support: {
    /**
     * `/support`, the in-app help home: the page's own words, its hero's and
     * its Messages row's, moved out of the code (Round 3 sweep, C3).
     * `{name}` is the reader's first name; `{standard}` and `{urgent}` are the
     * reply commitments from lib/trust/standards, lower-cased.
     */
    home: {
      greetingNamed: "Hi {name}, how can we help?",
      greeting: "Hi there, how can we help?",
      promise: "A person replies {standard}, and {urgent} when money or safety is at stake.",
      ask: "Ask a question",
      otherWays: "Other ways to get help",
      reportProblem: "Report a problem",
      writeToUs: "Write to us",
      helpCentre: "Help centre",
      close: "Close",
      yourSupport: "Your support",
      messages: "Messages",
      newReply: "New reply",
      open: "Open: {count}",
      messagesSignedOut: "Sign in to see your support conversations",
      messagesUnreadable: "Could not be loaded just now. Open to try again",
      messagesEmpty: "Your support conversations will appear here",
      messagesSome: "Your support conversations and our replies",
      safety: "Safety and policies",
      legal: "Legal",
      terms: "Terms",
      privacy: "Privacy",
      deleteAccount: "Delete account",
      deleteAccountSub: "How to delete your account and data",
    },
    /**
     * The three member support routes' own page words (`/support/messages`,
     * `/support/messages/[id]`, `/support/new`), moved out of the pages in the
     * Round 3 sweep (C3). The forms' and the thread's words are still in their
     * components.
     */
    pages: {
      listMeta: "Support messages",
      listTitle: "Messages",
      listSub: "Your support conversations",
      listSignedOutTitle: "Sign in to see your conversations",
      listSignedOutBody: "Tickets you file while signed in, and every reply from the team, are kept here.",
      signIn: "Sign in",
      helpCentre: "Open the help centre",
      listUnreadableTitle: "Your conversations could not be loaded",
      listUnreadableBody: "Nothing is lost. Check your connection and try again.",
      contactInstead: "Use the contact form instead",
      listEmptyTitle: "No support conversations yet",
      listEmptyBody: "When you write to the team while signed in, the ticket and every reply appear here. A ticket filed while signed out is answered by email instead.",
      writeToSupport: "Write to support",
      ticketTitle: "Support conversation",
      ticketSignedOutTitle: "Sign in to read this conversation",
      ticketSignedOutBody: "Support conversations are kept on your account, so only you can open them.",
      ticketUnreadableTitle: "This conversation could not be loaded",
      ticketUnreadableBody: "Nothing is lost: every message is kept on your ticket. Check your connection and try again.",
      backToMessages: "Back to messages",
      reportProblem: "Report a problem",
      newSignedOutTitle: "Sign in to write to support",
      newSignedOutBody: "Signed in, your message and every reply are kept on your account. You can also use the contact form without an account.",
      contactForm: "Use the contact form",
      newSub: "A person reads every message",
    },
    palette: {
      heading: "Search for help",
      placeholder: "Refunds, inspections, verification",
      popular: "Popular articles",
      matching: { one: "{count} matching answer", other: "{count} matching answers" },
      none: "No answer matches that yet.",
      noneHelp: "Try a shorter word, or ask a question above. A person reads every ticket.",
      hint: "Use the arrow keys to move and Enter to open",
      openAnswer: "Open the answer",
      browseAll: "Browse every answer in the help centre",
      clear: "Clear the search",
    },
    thread: {
      you: "You",
      support: "Vallo support",
      sending: "Sending",
      newReply: "New reply",
      /* The conversation page's own words (Round 3 sweep, C3). */
      conversation: "Conversation",
      status: "Status",
      problemReport: "Problem report",
      question: "Question",
      progress: "Support progress",
      steps: { filed: "Filed", picked: "Picked up", resolved: "Resolved", closed: "Closed" },
      /** `{label}` is the related record's own label. */
      about: "About: {label}",
      aiChat: "Your chat with the AI helper",
      photoAttached: "Photo attached",
      photoAlt: "Attached photo",
      personWillReply: "A person will reply here. You will get a notification and an email when they do.",
      askNew: "Ask a new question",
      /** Who a staff reply is from (`staffByline`): their first name only. Without one, `support` above. */
      bylineNamed: "{name}, Vallo support",
    },
    /**
     * Where a ticket stands for the member (`memberStateCopy`): a chip and the
     * line under it. `closedMeaning` replaces Resolved's line when the team
     * closed it rather than resolved it.
     */
    states: {
      open: { label: "Open", meaning: "Filed. A person will pick it up and reply here." },
      waiting: { label: "Waiting on you", meaning: "The team replied and needs something from you. Reply below." },
      progress: { label: "In progress", meaning: "A person has it and is working on it." },
      resolved: { label: "Resolved", meaning: "Answered. If it is not sorted, reopen it below." },
      closedMeaning: "Closed by the team. Ask a new question if you still need help.",
    },
    /**
     * A ticket's topic as the member reads it (the list row and the
     * conversation's title), by its stored code. The staff console and the
     * emails keep `SUPPORT_TOPIC_LABEL`, which these equal in English.
     */
    topicNames: {
      safety: "Someone asked me to pay outside Vallo",
      booking: "A booking or stay",
      payment: "A payment or refund",
      inspection: "An inspection",
      agreement: "An agreement",
      listing: "Listing a property",
      verification: "Verification",
      account: "My account",
      other: "Something else",
    },
    /** The ticket list's rows (`ListView`). */
    list: {
      label: "Support conversations",
      untitled: "Support ticket",
      supportSaid: "Support",
      youSaid: "You",
      waiting: "Waiting for a person to pick it up",
      emailNote: "Replies also arrive by email and in your notifications.",
    },
    /**
     * The new-query form and its receipt (`NewQueryForm`, `FiledView`).
     * `{expected}` is one of the `expected` lines below.
     */
    form: {
      offline: "You are offline. Your message is kept here; send it when you are back online.",
      question: "Question",
      problem: "Problem",
      kindLabel: "What kind of message",
      topic: "Topic",
      about: "What is it about?",
      chooseTopic: "Choose a topic",
      chooseTopicHint: "Account, payment, booking, safety and more",
      linkedHint: "Linked, so the team opens the right record",
      remove: "Remove",
      linkRecord: "Link a record",
      linkRecordHint: "Optional. Choose from your own records",
      whatHappened: "What happened?",
      yourQuestion: "Your question",
      whatHappenedHint: "What happened, when, and what you expected instead.",
      yourQuestionHint: "Ask it the way you would ask a person.",
      send: "Send to support",
      afterSend: "{expected} You get a reference now, and the reply in Messages, your notifications and your email.",
      close: "Close",
      topics: "Topics",
      filedTitle: "We have your message",
      filedBody: "{expected} We have emailed you this reference and you will get a notification when the team replies.",
      openConversation: "Open the conversation",
      backToHelp: "Back to help and support",
      /**
       * How soon a person answers (`expectedResponse`), by the topic's grade:
       * the windows /standards publishes (`RESPONSE_COMMITMENTS`), which a
       * test holds these equal to in English.
       */
      expected: {
        urgent: "A person replies within 4 hours.",
        standard: "A person replies within 1 day.",
        routine: "A person replies within 3 days.",
      },
      /** The topics the form offers (`TOPIC_CHOICES`), by code: a title and a hint. */
      topicChoices: {
        account: { title: "Account", hint: "Signing in, your profile, settings" },
        verification: { title: "Verification", hint: "Your ID, badge or agent checks" },
        listing: { title: "Listing", hint: "A property you list or manage" },
        payment: { title: "Payment or refund", hint: "A charge, a refund or a receipt" },
        inspection: { title: "Inspection", hint: "A viewing you booked or hosted" },
        agreement: { title: "Agreement", hint: "Rent or stay terms you agreed" },
        booking: { title: "Booking or stay", hint: "Dates, check-in, the place itself" },
        safety: { title: "Safety", hint: "Asked to pay outside Vallo, or something felt unsafe" },
        other: { title: "Something else", hint: "Anything not listed here" },
      },
    },
    /** The reply box. */
    reply: {
      label: "Reply to support",
      placeholder: "Add anything the team should know",
      empty: "Write your reply first.",
      offline: "You are offline. Your reply is kept here; send it when you are back online.",
      sent: "Sent. The team will see it on your ticket.",
      offlineWhat: "Your reply",
      send: "Send reply",
    },
    /** Resolve, rate and reopen. `{rating}` is a number, `{until}` a formatted date. */
    actions: {
      sorted: "Sorted already?",
      resolve: "Mark as resolved",
      rated: "You rated this {rating} out of 5. Thank you.",
      changeRating: "Change your rating",
      chooseStars: "Choose from one to five stars.",
      howDid: "How did we do?",
      /** `{n}` is a number and `{word}` the word for it, lower case. */
      starLabel: "{n} of 5, {word}",
      /* One to five stars, in order: `starWords[stars - 1]`. */
      starWords: ["Very poor", "Poor", "Okay", "Good", "Excellent"],
      addLabel: "Anything to add?",
      optional: "Optional",
      addPlaceholder: "What went well, or what we could do better",
      sendRating: "Send rating",
      notSorted: "Not sorted?",
      reopenBody: "Reopen this ticket and it goes back to the team with everything said so far. You can reopen it until {until}.",
      reopen: "Reopen ticket",
    },
  },
};
