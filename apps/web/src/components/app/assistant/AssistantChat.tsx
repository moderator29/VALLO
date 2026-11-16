"use client";

import { ChatWatermark } from "@/components/app/messages/ChatWatermark";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOverlay } from "@/lib/ui/use-overlay";
import { banner } from "@/lib/ui/toast";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark, LogoWordmark, wordmarkWidth } from "@/design-system/brand/Logo";
import { DepthWords } from "@/components/motion/DepthWords";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import {
  countOf,
  formatNumber,
  formatRating,
  type Locale,
  type Dictionary,
} from "@vallo/i18n/core";
import type { AssistantCopy } from "./assistant-copy";
import type {
  AssistantListingItem,
  AssistantStreamEvent,
  AssistantTurn,
} from "@/lib/assistant/types";
import { hrefForListing } from "@/lib/listings/href";
import type { ListingKind } from "@/lib/listings/types";
import type { AssistantCard } from "@/lib/assistant/types";
import { BackControl } from "@/components/ui/BackControl";
import { Button, ButtonLink } from "@/components/ui/Button";
import { buildHandoff, saveHandoff } from "@/lib/assistant/handoff";
import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
import {
  AssistantSidebar,
} from "./AssistantSidebar";
import { AssistantSettingsSheet } from "./AssistantSettingsSheet";
import { AssistantBlocks, isBlockEvent, type AssistantBlock } from "./AssistantBlocks";
import { DEFAULT_PREFS, FRESH_AFTER_MS, loadPrefs, savePrefs, type AssistantPrefs } from "@/lib/assistant/prefs";
import {
  clearStoredThreads,
  deriveTitle,
  loadThreads,
  makeId,
  saveThreads,
  type Message,
  type Thread,
} from "./threads";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { recordAiConsent } from "@/lib/ai/consent-actions";
import { AI_CONSENT_REQUIRED_CODE } from "@/lib/ai/consent";
import { WORKSPACE_FRAMES, type AssistantWorkspace } from "@/lib/assistant/workspace";
import { Icon3D } from "@/components/ui/Icon3D";
import { AIResponse, type AIResponseStatus } from "@/components/ui/AIResponse";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { plainAnswer } from "@/lib/text/answer-markdown";
import { ActionSheet, type ActionSheetRow } from "@/components/ui/ActionSheet";
import { useDictation } from "./use-dictation";
import "./assistant-answer.css";
import "@/app/css/home.css";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";
import "./assistant-chat.css";

/**
 * Vallo AI, to its governing image (`docs/design/references/BF49B814`).
 *
 * The header pair under the chrome (the name and "Always here. Ask
 * anything."), the thread as bubbles (mine brand blue on the right with the
 * time and the ticks, the assistant's glass on the left with the concierge
 * object beside it), the real catalogue results as two-up cards inside the
 * thread, the thinking pill while the model works, the suggestion chips on a
 * rail above the composer, and the composer.
 *
 * SINCE 15 NOVEMBER 2026 IT READS LIKE THE CHAT APPS PEOPLE KNOW (the
 * founder's ChatGPT screenshots, taken as a pattern and drawn in Vallo's own
 * blue): answers are words on the page with a quiet icon row under them
 * (copy, read aloud, share, more), the member's message is a blue bubble on
 * the right, the composer is one floating pill (plus for the suggestions,
 * the words, a microphone only where the browser can take dictation, and a
 * round send that becomes Stop), and a round arrow brings a reader who has
 * scrolled up back to the newest words. Styles: `assistant-chat.css`.
 *
 * WHAT IS REAL, because every control on this screen does its thing:
 *
 *   Replies stream live from /api/assistant: text lands token by token in
 *   the bubble, and when the concierge searches the catalogue the results
 *   render as cards linking to the listing, each with a working save.
 *   The chips send their question. The ticks appear on a message once the
 *   assistant has answered it. The settings button opens the real settings
 *   sheet (reply style, language, clear history). The history button opens
 *   the drawer of past conversations, which live under `nf_ai_threads` on
 *   this device. Sending again or leaving the page aborts any in-flight
 *   stream. Signed in, the server returns a durable conversation id, kept on
 *   the thread as `serverId` so future turns append to the same row.
 *
 * THE CARDS CARRY ONLY WHAT THE ROUTE STREAMS. The wire type now carries the
 * facts the render shows (the Verified mark, beds, baths and floor area),
 * each read off the repository row and omitted when the lister stated
 * nothing, so a card here draws exactly what the search page's card draws
 * for the same listing and never a picture of a fact.
 *
 * The chrome strings (the name pair, the prompts, the composer's placeholder,
 * the thinking word) come from `home.assistant` in the dictionary, so the
 * three other languages reach them.
 */

const NETWORK_ERROR_MESSAGE =
  "The assistant could not reach the network. Your message is kept; tap retry.";

/* GRADE 1 (P1.4, R70): the way to a person, from inside the assistant.
   English only for now, beside the other English lines in this file. */
const PERSON_WORDS = {
  label: "Talk to a person",
  hint: "Hand this conversation to the Vallo support team",
};
const PACE_FALLBACK_MESSAGE =
  "You are moving faster than the assistant can think. Give it a few minutes and try again.";

/*
 * THE OPENING PROMPTS, AND WHY THESE.
 *
 * Each asks what this platform, specifically, can answer: a real budget in
 * the unit rent is actually quoted in, the move-in total it computes, the
 * power columns no competitor carries, and the shortlet market. A starter
 * that cannot be answered teaches somebody the assistant does not work, so
 * nothing here is a mood the catalogue has no inventory for.
 *
 * THE LAST TWO ARE THE OTHER SIDE, and they are here because all four of the
 * originals were property (ledger 10.4). Vallo is two sides, and an assistant
 * whose every opening line is a rent question tells somebody the Stays half
 * of their own account is not its business. A hotel and a table are both
 * shapes the catalogue actually holds, so both are answerable.
 */
const STARTERS: { icon: UiIconName; key: keyof Dictionary["home"]["assistant"]["chips"] }[] = [
  { icon: "search", key: "lekki" },
  { icon: "wallet", key: "moveIn" },
  { icon: "bolt", key: "generator" },
  { icon: "calendar-booking", key: "shortlets" },
  { icon: "bed", key: "stay" },
  { icon: "utensils", key: "table" },
];

/*
 * WHERE A RESULT OPENS: the SIDE LAW, applied on the card.
 *
 * `lib/side.constants.ts` rules that the URL wins over the cookie, so a hotel
 * link opens in the Stays shell for everybody and a flat opens in Property.
 * The assistant route streams every result with `href` hardcoded to
 * `/listing/<id>` regardless of what the row is, so until now a hotel the
 * assistant found opened inside the property shell: property dock, property
 * chrome, a Book Inspection footer under a room that is sold by the night.
 *
 * `/api/assistant` now builds the right path through `hrefForListing`, so
 * fresh results arrive correct. THIS STAYS ANYWAY, because conversations live
 * on the device under `nf_ai_threads` and every result card stored before
 * that fix carries the old `/listing/<id>` in its own JSON. Without this a
 * person's own history would keep opening hotels in the property shell for as
 * long as they kept the thread. The wire carries `kind`, so the right
 * destination is recomputed from a stale row rather than migrated.
 *
 * The same `hrefForListing` the route uses, so there is one rule and not a
 * second one wearing a client's clothes. The wire types `kind` as `string`
 * because it is the column value, and `hrefForListing` answers `/listing/<id>`
 * for anything it does not recognise, which is the same thing the stale row
 * already said.
 */
function destinationFor(item: AssistantListingItem): string {
  return hrefForListing(item.kind as ListingKind, item.id);
}

/**
 * The category, as a word rather than as the column value.
 *
 * The card printed `listing.kind` straight from the wire, so it read "hotel"
 * in lower case beside a rating in the product's own numerals. One noun per
 * kind, capitalised; anything unrecognised falls through unchanged rather
 * than being hidden, because a category we cannot name is still a fact.
 */
const KIND_NOUN: Record<string, string> = {
  hotel: "Hotel",
  apartment: "Apartment",
  home: "Home",
  shortlet: "Shortlet",
  villa: "Villa",
  restaurant: "Restaurant",
  experience: "Experience",
  rental: "Rental",
  shop: "Shop",
  office: "Office",
  land: "Land",
};

const DRAWER_EXIT_MS = 240;

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  hour: "2-digit",
  minute: "2-digit",
});

/** Turns a thread's visible messages into the wire history for the route. */
function toTurns(messages: Message[]): AssistantTurn[] {
  return messages
    .filter((m) => m.text.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.text }));
}

export function AssistantChat({
  locale,
  viewer,
  seed,
  aiConsented = false,
  privateAccess = false,
  picks = [],
  workspace,
  t,
}: {
  locale: Locale;
  /**
   * Opened inside a workspace (`/agent/assistant`, `/host/assistant`). The
   * workspace's shell draws the bar, so this surface draws no back control or
   * lockup of its own; the prompts are the workspace's, and the route is told
   * which workspace by key (`lib/assistant/workspace.ts`).
   */
  workspace?: AssistantWorkspace;
  /** STORE-07: whether this person has agreed to the AI disclosure. The
      server route refuses without it either way. */
  aiConsented?: boolean;
  /** The member has switched the assistant on and granted more than discovery: say so, quietly. */
  privateAccess?: boolean;
  /** "Picked for you by VALLO AI", computed on the server for a member who allowed it. */
  picks?: AssistantCard[];
  /** The signed-in person, for the mark beside their own bubbles. Absent for a guest. */
  viewer?: { initials: string; avatarUrl: string } | undefined;
  /**
   * Fixture conversations for the dev preview harness only. When present
   * they replace the device's stored threads and are never written back, so
   * a screenshot of a conversation costs nobody their real history.
   */
  seed?: { threads: Thread[]; thinking?: boolean };
  /** The lines the chat draws, from the page, in the reader's language. */
  t: AssistantCopy;
}) {
  const copy = t.home.assistant;
  const frame = workspace ? WORKSPACE_FRAMES[workspace] : null;
  /* The opening prompts: the workspace's own inside one, the finder's here. */
  const starters = frame
    ? frame.starters
    : STARTERS.map((starter) => ({ icon: starter.icon, text: copy.chips[starter.key] }));
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [streamingThread, setStreamingThread] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AssistantPrefs>(DEFAULT_PREFS);
  /* Always the latest, for the restore and visibility effects that run once. */
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* STORE-07: the first send records the agreement the server checks (see `send`). */
  const [consent, setConsent] = useState<"yes" | "ask" | "declined">(aiConsented ? "yes" : "ask");
  /* Which answer was just copied (its label says so for a moment), and
     whether the reader has scrolled away from the newest part of the thread,
     which is when a streaming answer gets its island. */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /* Which answer this phone is reading aloud, if any (Web Speech, on the
     device: nothing is sent anywhere to read it). */
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  useEffect(() => () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* Nothing was being read. */
    }
  }, []);
  const readAloud = useCallback((id: string, text: string) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (speakingId === id) {
      synth.cancel();
      setSpeakingId(null);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(plainAnswer(text));
    utterance.lang = "en-NG";
    utterance.onend = () => setSpeakingId((now) => (now === id ? null : now));
    utterance.onerror = () => setSpeakingId((now) => (now === id ? null : now));
    setSpeakingId(id);
    synth.speak(utterance);
  }, [speakingId]);
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  /* The same fact for the effects, which must not re-run on every scroll. */
  const awayRef = useRef(false);
  /* The next growth of the thread scrolls to the end whatever the reader was
     doing: a question just sent, or another conversation opened. */
  const forceEndRef = useRef(true);
  const answerWords = t.answer;
  const router = useRouter();
  /* The starter questions over the composer: open on a new chat, folded
     away once a conversation is going, and brought back with the plus. */
  const [chipsOpen, setChipsOpen] = useState(true);
  /* The More sheet of one answer, hung from the button that opened it. */
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const moreAnchorRef = useRef<HTMLElement | null>(null);

  // A question can arrive from anywhere on the platform via ?q=, e.g. the home
  // banner's quick-ask bar. It seeds the composer after mount, never auto-sends.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setDraft((d) => (d ? d : q));
    const about = params.get("about");
    if (about && /^[0-9a-f-]{36}$/i.test(about)) {
      aboutRef.current = about;
      setDraft((d) => (d ? d : "Tell me about this place."));
    }
  }, []);

  /* Mobile drawer: `historyOpen` mounts it, `historyShown` slides it in, so
     both directions of the transition get a frame to run. */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyShown, setHistoryShown] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const drawerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /* "Ask Vallo AI about this place": a listing id from the address, checked by the server. */
  const aboutRef = useRef<string | null>(null);
  const streamSeq = useRef(0);

  /* Restore saved conversations once on mount, then persist every change.
     A seeded preview restores the fixtures instead and persists nothing. */
  useEffect(() => {
    const stored = seed ? DEFAULT_PREFS : loadPrefs();
    if (!seed) {
      setPrefs(stored);
      prefsRef.current = stored;
    }
    const restored = seed ? seed.threads : stored.keep ? loadThreads() : [];
    setThreads(restored);
    const latest = [...restored].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    /* A conversation left for ten minutes stays in history; the screen opens on
       a fresh chat, the way the other assistants do. A seeded preview keeps its
       own. */
    if (latest && (seed || Date.now() - latest.updatedAt < FRESH_AFTER_MS[stored.freshAfter])) {
      setActiveId(latest.id);
      setChipsOpen(false);
    }
    if (seed?.thinking && latest) setStreamingThread(latest.id);
    setHydrated(true);
  }, [seed]);

  /* Coming back to a page left open for ten minutes or more: a new chat. */
  useEffect(() => {
    if (seed) return;
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= FRESH_AFTER_MS[prefsRef.current.freshAfter]) setActiveId(null);
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [seed]);

  useEffect(() => {
    if (!hydrated || seed) return;
    if (prefs.keep) saveThreads(threads);
    else clearStoredThreads();
  }, [threads, hydrated, seed, prefs.keep]);

  /* The settings are stored on this device, and travel with every question. */
  useEffect(() => {
    if (!hydrated || seed) return;
    savePrefs(prefs);
  }, [prefs, hydrated, seed]);

  const active = activeId ? threads.find((t) => t.id === activeId) : undefined;
  const messages = active?.messages ?? [];
  const streamingHere = streamingThread !== null && streamingThread === activeId;

  /* Keep the newest words in view as the thread grows, unless the reader has
     scrolled up to read something earlier: then the thread stays where they
     are and the round arrow over the composer takes them back down. A new
     question or another conversation always lands at the end. */
  const shownThread = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (shownThread.current !== activeId) {
      shownThread.current = activeId;
      forceEndRef.current = true;
    }
    if (forceEndRef.current || !awayRef.current) {
      el.scrollTo({ top: el.scrollHeight });
      awayRef.current = false;
      setAwayFromEnd(false);
    }
    forceEndRef.current = false;
  }, [messages, streamingHere, activeId]);

  const scrollToLatest = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const still =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
        /^(calm|off)$/.test(document.documentElement.dataset.motion ?? ""));
    el.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : "smooth" });
  }, []);

  /* Dictation, where the browser can turn speech into words itself. What is
     heard is added after whatever was already typed, and nothing is sent
     until the member presses Send. */
  const dictationBase = useRef("");
  const dictation = useDictation({
    onText: (spoken) => {
      const base = dictationBase.current;
      setDraft(base && spoken ? `${base} ${spoken}` : base || spoken);
    },
    onRefused: () => banner.error(answerWords.micBlocked),
  });
  const stopDictation = dictation.stop;

  /* Abort any in-flight stream on navigation away from the page. */
  useEffect(() => {
    return () => {
      if (drawerTimer.current) clearTimeout(drawerTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  /* Slide the drawer in one frame after it mounts. */
  useEffect(() => {
    if (!historyOpen) return;
    const frame = requestAnimationFrame(() => setHistoryShown(true));
    return () => cancelAnimationFrame(frame);
  }, [historyOpen]);

  const openHistory = () => {
    if (drawerTimer.current) clearTimeout(drawerTimer.current);
    setHistoryOpen(true);
  };

  const closeHistory = useCallback(() => {
    setHistoryShown(false);
    if (drawerTimer.current) clearTimeout(drawerTimer.current);
    drawerTimer.current = setTimeout(() => setHistoryOpen(false), DRAWER_EXIT_MS);
  }, []);

  /* The history drawer had Escape only: the page scrolled behind it and Tab
     walked straight out into the conversation it was covering. */
  useOverlay({ open: historyOpen, onClose: closeHistory, panelRef: historyRef });

  /** Patch one message inside one thread, bumping the thread's activity time. */
  const patchMessage = useCallback(
    (threadId: string, messageId: string, patch: (m: Message) => Message) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                updatedAt: Date.now(),
                messages: t.messages.map((m) => (m.id === messageId ? patch(m) : m)),
              }
            : t,
        ),
      );
    },
    [],
  );

  const dropMessageIfEmpty = useCallback((threadId: string, messageId: string) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: t.messages.filter(
                (m) =>
                  m.id !== messageId ||
                  m.text.trim().length > 0 ||
                  (m.listings?.length ?? 0) > 0,
              ),
            }
          : t,
      ),
    );
  }, []);

  /**
   * Stream one assistant turn into `threadId`. `history` already ends with
   * the user's newest message. Any previous stream is aborted first.
   */
  const runAssistant = useCallback(
    async (threadId: string, history: AssistantTurn[], serverId?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++streamSeq.current;

      const assistantId = makeId();
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  { id: assistantId, role: "assistant", text: "", at: Date.now() },
                ],
              }
            : t,
        ),
      );
      setStreamingThread(threadId);

      const setText = (text: string, error = false) =>
        patchMessage(threadId, assistantId, (m) => ({ ...m, text, error }));
      const appendText = (text: string) =>
        patchMessage(threadId, assistantId, (m) => ({ ...m, text: m.text + text }));
      const addListings = (items: AssistantListingItem[]) =>
        patchMessage(threadId, assistantId, (m) => {
          const seen = new Set((m.listings ?? []).map((l) => l.id));
          const merged = [...(m.listings ?? []), ...items.filter((l) => !seen.has(l.id))];
          return { ...m, listings: merged };
        });

      const addBlock = (block: AssistantBlock) =>
        patchMessage(threadId, assistantId, (m) => ({ ...m, blocks: [...(m.blocks ?? []), block] }));

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            prefs: prefsRef.current,
            ...(aboutRef.current ? { about: aboutRef.current } : {}),
            ...(serverId ? { threadId: serverId } : {}),
            ...(workspace ? { workspace } : {}),
          }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          const j = (await res.json().catch(() => null)) as { message?: string } | null;
          setText(j?.message ?? PACE_FALLBACK_MESSAGE);
          return;
        }
        if (res.status === 403) {
          /* STORE-07: the route holds the line when the screen did not ask.
             Nothing was sent to the AI; ask now. */
          const j = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
          if (j?.code === AI_CONSENT_REQUIRED_CODE) {
            /* The record did not reach the server: ask again quietly on the next send. */
            setText(j.message ?? "Something went wrong. Send it again.");
            setConsent("ask");
            return;
          }
        }
        if (!res.ok || !res.body) {
          setText(NETWORK_ERROR_MESSAGE, true);
          return;
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          // The graceful no-key answer renders as an ordinary assistant bubble.
          const j = (await res.json().catch(() => null)) as { message?: string } | null;
          setText(j?.message ?? NETWORK_ERROR_MESSAGE, !j?.message);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let split: number;
          while ((split = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data:")) continue;
              let event: AssistantStreamEvent;
              try {
                event = JSON.parse(line.slice(5).trim()) as AssistantStreamEvent;
              } catch {
                continue;
              }
              if (event.type === "text") {
                appendText(event.text);
              } else if (event.type === "listings") {
                addListings(event.items);
              } else if (isBlockEvent(event)) {
                addBlock(event);
              } else if (event.type === "thread") {
                const id = event.id;
                setThreads((prev) =>
                  prev.map((t) => (t.id === threadId ? { ...t, serverId: id } : t)),
                );
              } else if (event.type === "error") {
                const message = event.message;
                patchMessage(threadId, assistantId, (m) =>
                  m.text.trim() ? m : { ...m, text: message, error: true },
                );
              }
            }
          }
        }

        // A stream that ended with nothing to show still deserves an answer.
        patchMessage(threadId, assistantId, (m) =>
          m.text.trim() || (m.listings?.length ?? 0) > 0 || (m.blocks?.length ?? 0) > 0
            ? m
            : { ...m, text: NETWORK_ERROR_MESSAGE, error: true },
        );
      } catch {
        if (controller.signal.aborted) {
          /* Stopped, or superseded by a new question: what arrived stays and
             says it was stopped; an answer with nothing in it goes away. */
          patchMessage(threadId, assistantId, (m) => (m.text.trim() ? { ...m, stopped: true } : m));
          dropMessageIfEmpty(threadId, assistantId);
          return;
        }
        setText(NETWORK_ERROR_MESSAGE, true);
      } finally {
        if (streamSeq.current === seq) setStreamingThread(null);
      }
    },
    [dropMessageIfEmpty, patchMessage, workspace],
  );

  const send = useCallback(
    (raw: string, decided?: "yes") => {
      /* `decided` is the sheet's fresh yes, passed in because the state set
         beside it is not visible until the next render. */
      const text = raw.trim();
      if (!text) return;
      if ((decided ?? consent) !== "yes") {
        /* SENDING IS AGREEING (29 October 2026, the founder: no "Before you
           ask" card in the chat). The quiet line under the box says answers
           are written by AI; the first send records the agreement the server
           checks, then goes. The draft stays put if it cannot be recorded. */
        setConsent("yes");
        void recordAiConsent()
          .then((result) => {
            if (result.ok) send(text, "yes");
            else setConsent("ask");
          })
          .catch(() => setConsent("ask"));
        return;
      }
      setDraft("");
      stopDictation();
      setChipsOpen(false);
      forceEndRef.current = true;

      const userMessage: Message = { id: makeId(), role: "user", text, at: Date.now() };
      let targetId: string;
      let history: AssistantTurn[];
      let serverId: string | undefined;

      const existing = activeId ? threads.find((t) => t.id === activeId) : undefined;
      if (!existing) {
        targetId = makeId();
        const now = Date.now();
        const fresh: Thread = {
          id: targetId,
          title: deriveTitle(text),
          createdAt: now,
          updatedAt: now,
          messages: [userMessage],
        };
        setThreads((prev) => [fresh, ...prev]);
        setActiveId(targetId);
        history = toTurns([userMessage]);
      } else {
        targetId = existing.id;
        serverId = existing.serverId;
        setThreads((prev) =>
          prev.map((t) =>
            t.id === existing.id
              ? { ...t, updatedAt: Date.now(), messages: [...t.messages, userMessage] }
              : t,
          ),
        );
        history = toTurns([...existing.messages, userMessage]);
      }

      void runAssistant(targetId, history, serverId);
    },
    [activeId, threads, runAssistant, consent, stopDictation],
  );


  /** Re-run the last turn after a failure: drop the failed bubble, resend. */
  const retry = useCallback(
    (threadId: string, failedMessageId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      const remaining = thread.messages.filter((m) => m.id !== failedMessageId);
      const history = toTurns(remaining);
      if (history.length === 0 || history[history.length - 1]?.role !== "user") return;
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, messages: remaining } : t)),
      );
      void runAssistant(threadId, history, thread.serverId);
    },
    [threads, runAssistant],
  );

  const selectThread = (id: string) => {
    setActiveId(id);
    setChipsOpen(false);
    closeHistory();
    inputRef.current?.focus();
  };

  const newChat = () => {
    setActiveId(null);
    setChipsOpen(true);
    closeHistory();
    inputRef.current?.focus();
  };

  const deleteThread = (id: string) => {
    if (streamingThread === id) {
      abortRef.current?.abort();
      setStreamingThread(null);
    }
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const clearAll = () => {
    abortRef.current?.abort();
    setStreamingThread(null);
    setThreads([]);
    setActiveId(null);
    if (!seed) clearStoredThreads();
    closeHistory();
    inputRef.current?.focus();
  };


  const empty = hydrated && messages.length === 0;
  /* Read aloud is offered only where the phone has a voice. Answers appear
     after the device's threads are read, so this never differs from the
     server's HTML. */
  const canSpeak = hydrated && typeof window !== "undefined" && "speechSynthesis" in window;
  const lastMessage = messages[messages.length - 1];
  const showThinking =
    streamingHere &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      (lastMessage.text === "" && (lastMessage.listings?.length ?? 0) === 0 && (lastMessage.blocks?.length ?? 0) === 0));

  const sidebar = () => (
    <AssistantSidebar
      threads={threads}
      activeId={activeId}
      prefs={prefs}
      onSelect={selectThread}
      onNew={newChat}
      onDelete={deleteThread}
      onClearAll={clearAll}
      onPrefsChange={setPrefs}
    />
  );

  const handOff = () =>
    saveHandoff(buildHandoff(messages.map((m) => ({ role: m.role, text: m.text })), draft));

  /* The More sheet's rows for the answer it was opened on. */
  const moreIndex = moreFor ? messages.findIndex((m) => m.id === moreFor) : -1;
  const canAskAgain =
    moreIndex >= 0 &&
    moreIndex === messages.length - 1 &&
    messages[moreIndex - 1]?.role === "user" &&
    !streamingHere;
  const moreRows: ActionSheetRow[] = [
    ...(canAskAgain && activeId && moreFor
      ? [
          {
            id: "again",
            label: answerWords.askAgain,
            hint: answerWords.askAgainHint,
            icon: "repost-loop" as const,
            onSelect: () => retry(activeId, moreFor),
          },
        ]
      : []),
    {
      id: "person",
      label: PERSON_WORDS.label,
      hint: PERSON_WORDS.hint,
      icon: "headset",
      chevron: true,
      onSelect: () => {
        handOff();
        router.push("/assistant/person");
      },
    },
  ];

  /* History (on a phone) and settings: in the surface's own bar on
     `/assistant`, beside the name pair inside a workspace. */
  const barActions = (
    <div className="nf-ai__bar-actions">
      {/* GRADE 1 (P1.4, R70): a person, always one tap away and never
          behind a failed answer. What the member was asking goes with them
          (`lib/assistant/handoff.ts`), so the support team starts from it;
          Back returns here. In the bar, so it is there on every screen of
          the conversation without a line of its own under the composer. */}
      <ButtonLink
        href="/assistant/person"
        variant="icon"
        leadingIcon="headset"
        aria-label={PERSON_WORDS.label}
        title={PERSON_WORDS.hint}
        data-testid="assistant-talk-to-person"
        onClick={handOff}
      >
        <span className="sr-only">{PERSON_WORDS.label}</span>
      </ButtonLink>
      <Button
        variant="icon"
        leadingIcon="history"
        aria-label="Conversation history"
        aria-expanded={historyOpen}
        onClick={openHistory}
        className="lg:hidden"
      />
      <Button
        variant="icon"
        leadingIcon="settings-gear"
        aria-label="Assistant settings"
        aria-haspopup="dialog"
        onClick={() => setSettingsOpen(true)}
      />
    </div>
  );

  return (
    <div className="nf-assistant px-md pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-lg lg:px-xl">
      {/* --------------------------------------------------------- header */}
      {/* On `/assistant` the route is immersive, so this bar is the whole
          chrome: back, the lockup, history on a phone, settings; then the
          name pair beneath. */}
      {frame ? (
        /* Inside a workspace the shell's bar is the chrome and already names
           the screen, so the name stays for a screen reader and what shows is
           the workspace's line, with history and settings beside it. */
        <div className="nf-ai__ident nf-ai__ident--row">
          <div className="min-w-0 flex-1">
            <h1 className="sr-only">{copy.title}</h1>
            <p className="nf-ai__sub">{frame.sub}</p>
          </div>
          {barActions}
        </div>
      ) : (
        <>
          <div className="nf-ai__bar">
            <BackControl fallback="/home" surface="plate" />
            <Link href="/home" aria-label={t.a11y.logoHome} className="nf-ai__lockup nf-tap">
              <LogoMark size={32} />
              {/* 72 by 16: the artwork is 758 by 167, so at 72 wide it draws 15.9
                  tall. Declared as 15, the browser's rounded 16 read to Next
                  as a height changed without the width (integration QA O4). */}
              <LogoWordmark width={wordmarkWidth(16)} height={16} priority className="nf-ai__word" />
            </Link>
            {barActions}
          </div>
          {/* The name pair greets a new chat. Once a conversation is going
              the thread has the room, as in the chat apps people know; the
              page keeps its name for a screen reader either way. */}
          {empty || !hydrated ? (
            <div className="nf-ai__ident">
              <h1 className="nf-ai__title">{copy.title}</h1>
              <p className="nf-ai__sub">{copy.sub}</p>
            </div>
          ) : (
            <h1 className="sr-only">{copy.title}</h1>
          )}
        </>
      )}

      <div className="flex min-h-0 flex-1 gap-lg">
        {/* --------------------------------------------- desktop sidebar */}
        <aside
          aria-label="Assistant navigation"
          className="nf-panel nf-panel--card hidden w-72 shrink-0 overflow-hidden p-0 lg:block"
        >
          {sidebar()}
        </aside>

        {/* ------------------------------------------------- thread area */}
        <section className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col lg:mx-0 lg:max-w-none">
          <div
            ref={scrollerRef}
            className="nf-ai__thread"
            /* A named region, so the label is read (axe aria-prohibited-attr:
               a plain div may not carry aria-label). Not a live log: the
               answer streams, and a log would read every token aloud. */
            role="region"
            aria-label="Conversation"
            onScroll={(e) => {
              const el = e.currentTarget;
              const away = el.scrollHeight - el.scrollTop - el.clientHeight > 160;
              awayRef.current = away;
              setAwayFromEnd(away);
            }}
          >
            <ChatWatermark hidden={!empty} />
            {empty && (
              <div className="flex flex-1 flex-col items-center justify-center gap-md py-section-tight text-center">
                {/* Track M: the assistant settles in with a small spring, its
                    greeting arrives word by word out of depth, and the line
                    under it rises after. All of it waits for the app-open
                    door and is still under reduced motion. */}
                {/* The founder's 3D assistant (30 September), 88px in a
                    fixed box; the title beside it names it, so it is
                    decorative. */}
                <span className="nf-ai-hello-bot grid size-[5.5rem] place-items-center">
                  <Icon3D name="assistant" size={88} priority />
                </span>
                <div>
                  {/* Both of these were English constants in the markup, on a
                      screen whose composer, chips and thinking pill all come
                      from the dictionary. Three of four languages read the
                      assistant's own description of itself in a fourth. */}
                  <p className="nf-h3">
                    <DepthWords text={copy.emptyTitle} />
                  </p>
                  <p className="nf-rise nf-rise-4 nf-body-sm mx-auto mt-2xs max-w-[36ch] text-[var(--nf-content-muted)]">
                    {copy.emptyBody}
                  </p>
                </div>
                {/* A person, in words, on every new chat (the founder, 16
                    November 2026): the headset in the bar is one tap away, but
                    an icon alone is not enough for somebody who needs help. */}
                <ButtonLink
                  href="/assistant/person"
                  variant="secondary"
                  size="sm"
                  leadingIcon="headset"
                  className="nf-rise nf-rise-5"
                  data-testid="assistant-person-intro"
                  onClick={handOff}
                >
                  {PERSON_WORDS.label}
                </ButtonLink>
                {picks.length > 0 ? (
                  <div className="w-full text-left" data-testid="assistant-picks">
                    <AssistantBlocks blocks={[{ type: "cards", title: "Picked for you by VALLO AI", items: picks }]} onAsk={(prompt) => send(prompt)} />
                  </div>
                ) : null}
              </div>
            )}

            {messages.map((m, index) => {
              const stamp = m.at ? TIME.format(new Date(m.at)) : "";
              if (m.role === "user") {
                /* The ticks say the assistant has answered this one: a reply
                   follows it in the thread. Nothing here claims "read". */
                const answered = messages.slice(index + 1).some((n) => n.role === "assistant");
                return (
                  <div key={m.id} className="nf-rise nf-ai__turn nf-ai__turn--mine">
                    <div className="nf-ai__bubble nf-ai__bubble--mine">
                      {m.text}
                      {(stamp || answered) && (
                        <span className="nf-ai__stamp nf-numeric">
                          {stamp}
                          {answered && (
                            <span className="nf-ai__ticks" role="img" aria-label="Answered">
                              <UiIcon name="verified" size={12} />
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {viewer && (
                      <span className="nf-ai__me" aria-hidden="true">
                        {viewer.avatarUrl ? (
                          /* A storage URL signed for this reader, so next/image
                             would only add a hop to a link that expires. */
                          <RemoteImage
                            src={viewer.avatarUrl}
                            alt=""
                            width={72}
                            height={72}
                            sizes="36px"
                          />
                        ) : (
                          viewer.initials
                        )}
                      </span>
                    )}
                  </div>
                );
              }
              // An assistant answer appears once it has something to show.
              if (!m.text.trim() && (m.listings?.length ?? 0) === 0 && (m.blocks?.length ?? 0) === 0) return null;
              const thisStreaming = streamingHere && m.id === lastMessage?.id;
              /* The answer card's state is a fact about the turn, never a
                 guess: streaming while the stream is open, error when the
                 turn failed, stopped when it was cut, done otherwise. */
              const status: AIResponseStatus = m.error
                ? "error"
                : thisStreaming
                  ? "streaming"
                  : m.stopped
                    ? "stopped"
                    : "done";
              return (
                <div key={m.id} className="nf-rise flex flex-col gap-xs">
                  {m.text.trim() && (
                    <div className="nf-ai__turn">
                      {/* The answer is words on the page, as in the chat apps
                          people know: no card, no name over it on screen. It is
                          still announced as Vallo AI's (the article's name).
                          Stop lives in the composer, where Send was. */}
                      <AIResponse
                        className="nf-ai-answer"
                        status={status}
                        label={answerWords.answerLabel}
                        thinkingLabel={answerWords.thinking}
                        statusLabels={{
                          done: answerWords.statusDone,
                          stopped: answerWords.statusStopped,
                          error: answerWords.statusError,
                        }}
                        {...(m.error ? { errorMessage: m.text } : {})}
                        data-testid="assistant-answer"
                      >
                        {m.error ? null : (
                          <AnswerMarkdown
                            text={m.text}
                            streaming={thisStreaming}
                            onEditMessage={(words) => {
                              setDraft(words);
                              window.requestAnimationFrame(() => inputRef.current?.focus());
                            }}
                          />
                        )}
                        {status === "stopped" ? (
                          <span className="nf-ai-answer__stopped">{answerWords.stoppedNote}</span>
                        ) : null}
                      </AIResponse>
                    </div>
                  )}
                  {/* THE QUIET ROW UNDER A FINISHED ANSWER: icons only, each
                      named and titled, each doing its thing. No thumbs: nothing
                      would receive them. */}
                  {(status === "done" || status === "stopped") && m.text.trim() ? (
                    <div className="nf-ai-acts" role="group" aria-label={answerWords.actionsLabel}>
                      <ActButton
                        icon={copiedId === m.id ? "check" : "clipboard-list"}
                        label={copiedId === m.id ? answerWords.copied : answerWords.copy}
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(plainAnswer(m.text))
                            .then(() => {
                              setCopiedId(m.id);
                              banner.quick(answerWords.copied);
                              window.setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1600);
                            })
                            .catch(() => undefined);
                        }}
                      />
                      {/* Read on this phone, by the phone's own voice. Offered
                          only where the phone can do it. */}
                      {canSpeak ? (
                        <ActButton
                          icon="volume"
                          label={speakingId === m.id ? answerWords.stopReading : answerWords.readAloud}
                          pressed={speakingId === m.id}
                          onClick={() => readAloud(m.id, m.text)}
                        />
                      ) : null}
                      <ActButton
                        icon="share"
                        label={answerWords.share}
                        onClick={() => {
                          const words = plainAnswer(m.text);
                          if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                            void navigator.share({ text: words }).catch(() => undefined);
                            return;
                          }
                          void navigator.clipboard
                            ?.writeText(words)
                            .then(() => banner.quick(answerWords.copied))
                            .catch(() => undefined);
                        }}
                      />
                      <ActButton
                        icon="more"
                        label={answerWords.more}
                        expanded={moreFor === m.id}
                        onClick={(el) => {
                          moreAnchorRef.current = el;
                          setMoreFor(m.id);
                        }}
                      />
                    </div>
                  ) : null}
                  {m.error && activeId && m.text.trim() && (
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon="arrow-right"
                      onClick={() => {
                        if (activeId) retry(activeId, m.id);
                      }}
                      className="self-start"
                    >
                      Retry
                    </Button>
                  )}
                  {m.blocks && m.blocks.length > 0 && <AssistantBlocks blocks={m.blocks} onAsk={(prompt) => send(prompt)} />}
                  {/* NEXT QUESTIONS, under the newest finished answer only (the
                      ChatGPT reference): each is sent exactly as it reads. */}
                  {status === "done" && m.id === lastMessage?.id && m.text.trim() ? (
                    <ul className="nf-ai-follow" aria-label={answerWords.followLabel} data-testid="assistant-follow">
                      {[answerWords.followSimpler, answerWords.followShorter, answerWords.followNext].map((prompt) => (
                        <li key={prompt}>
                          <button type="button" className="nf-ai-follow__btn" onClick={() => send(prompt)}>
                            <UiIcon name="arrow-up-right" size={16} />
                            <span>{prompt}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {m.listings && m.listings.length > 0 && (
                    <ul className="nf-ai__results" aria-label="Matching listings">
                      {m.listings.map((l, i) => (
                        <li
                          key={l.id}
                          className="nf-listing-fold-in min-w-0"
                          style={{ "--i": i } as React.CSSProperties}
                        >
                          <ThreadListingCard listing={l} locale={locale} t={t} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {showThinking && (
              /* THE ONE PERMITTED LOOP: the answer card's thinking state, three
                 shaped lines breathing beside an orb that breathes with them
                 (opacity and scale only). It stands while the model works and
                 is replaced by the first words; a spinner is never drawn. */
              <div className="nf-rise nf-ai__turn">
                <AIResponse
                  className="nf-ai-answer"
                  status="thinking"
                  label={answerWords.answerLabel}
                  thinkingLabel={answerWords.thinking}
                  statusLabels={{
                    done: answerWords.statusDone,
                    stopped: answerWords.statusStopped,
                    error: answerWords.statusError,
                  }}
                  data-testid="assistant-thinking"
                />
              </div>
            )}
          </div>

          {/* ------------------------------------------------------- dock */}
          <div className="nf-ai__dock">
            {/* BACK TO THE NEWEST, while the reader has scrolled up away from
                it. Gone at the end of the thread. While an answer is still
                arriving it says so, so nobody misses it. */}
            {awayFromEnd && messages.length > 0 ? (
              <button
                type="button"
                className="nf-ai__latest nf-tap"
                aria-label={streamingHere ? `${answerWords.islandTitle}. ${answerWords.latest}` : answerWords.latest}
                title={answerWords.latest}
                data-streaming={streamingHere || undefined}
                data-testid="assistant-latest"
                onClick={scrollToLatest}
              >
                <UiIcon name="arrow-down" size={20} />
              </button>
            ) : null}

            {/* ---------------------------------------------- suggestions */}
            {chipsOpen ? (
              <div id="assistant-suggestions" className="nf-ai__chips" role="group" aria-label={answerWords.suggestions}>
                {starters.map((s, i) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => send(s.text)}
                    disabled={streamingHere}
                    className={`nf-ai__chip nf-tap ${empty ? "nf-rise-seq" : ""}`}
                    style={empty ? ({ "--nf-rise-i": i + 2 } as React.CSSProperties) : undefined}
                  >
                    <UiIcon name={s.icon} size={20} />
                    {/* The label is its own element so it can clamp. A bare text
                        node inside the flex row had nothing to clamp ON, which is
                        why a long starter was cut by the rail rather than ended
                        by an ellipsis (R1 A4). */}
                    <span className="nf-ai__chip-label">{s.text}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* ----------------------------------------------------- composer */}
            {/* One floating pill: the plus that brings the suggested questions
                back, the words, the microphone where the browser can take
                dictation, and the round send that becomes Stop while an
                answer is arriving. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="nf-ai__composer"
            >
              <button
                type="button"
                className="nf-ai__tool nf-tap"
                aria-label={answerWords.suggestions}
                title={answerWords.suggestions}
                aria-expanded={chipsOpen}
                {...(chipsOpen ? { "aria-controls": "assistant-suggestions" } : {})}
                onClick={() => setChipsOpen((open) => !open)}
                data-testid="assistant-suggest-toggle"
              >
                <UiIcon name="plus" size={22} />
              </button>
              <label htmlFor="assistant-input" className="sr-only">
                Message Vallo AI
              </label>
              <div className="nf-ai__well">
                <input
                  id="assistant-input"
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={copy.placeholder}
                  autoComplete="off"
                  enterKeyHint="send"
                  className="nf-ai__input"
                />
              </div>
              {dictation.supported ? (
                <button
                  type="button"
                  className="nf-ai__tool nf-ai__mic nf-tap"
                  aria-label={answerWords.dictate}
                  title={dictation.listening ? answerWords.stopDictating : answerWords.dictate}
                  aria-pressed={dictation.listening}
                  data-testid="assistant-dictate"
                  onClick={() => {
                    if (!dictation.listening) {
                      dictationBase.current = draft.trim();
                      /* Once per device: where the words come from (the founder
                         kept the microphone in Chrome, 16 November 2026, on
                         the condition that people are told). */
                      try {
                        if (!window.localStorage.getItem("nf_ai_mic_note")) {
                          window.localStorage.setItem("nf_ai_mic_note", "1");
                          banner.info(answerWords.micNote);
                        }
                      } catch {
                        /* Blocked storage: the note may show again next time, which is harmless. */
                      }
                    }
                    dictation.toggle();
                  }}
                >
                  <UiIcon name={dictation.listening ? "mic-off" : "mic"} size={22} />
                </button>
              ) : null}
              {streamingHere ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  iconOnly
                  aria-label={answerWords.stopAnswer}
                  title={answerWords.stopAnswer}
                  onClick={() => abortRef.current?.abort()}
                  className="nf-ai__send nf-ai__send--stop"
                  data-testid="assistant-stop"
                >
                  <span className="nf-ai__stop-mark" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  iconOnly
                  leadingIcon="arrow-up"
                  aria-label={answerWords.send}
                  disabled={!draft.trim()}
                  className="nf-ai__send"
                />
              )}
            </form>
          </div>
          {privateAccess ? (
            <p className="nf-ai__note" data-testid="ai-private-banner">
              Private access is on. <Link href="/settings/ai-assistant">Settings</Link>
            </p>
          ) : null}
          <p className="nf-ai__note" data-testid="ai-note">
            Answers are written by AI and can be wrong. Never share passwords or card numbers.
          </p>
        </section>
      </div>

      {/* MORE, for one answer: ask the same question again (the newest answer
          only, by the same retry the failed answer uses), and the way to a
          person with this conversation. */}
      <ActionSheet
        open={moreFor !== null}
        onOpenChange={(open) => {
          if (!open) setMoreFor(null);
        }}
        title={answerWords.moreTitle}
        anchor={moreAnchorRef}
        testId="assistant-more"
        rows={moreRows}
      />

      <AssistantSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefs}
        onPrefsChange={setPrefs}
        onClearAll={clearAll}
        threadCount={threads.length}
      />

      {/* ------------------------------------------------- mobile drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close conversation history"
            onClick={closeHistory}
            className={`absolute inset-0 bg-[var(--nf-overlay-backdrop)] transition-opacity duration-[var(--nf-duration-base)] ease-[var(--nf-ease-standard)] ${
              historyShown ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            ref={historyRef}
            role="dialog"
            aria-modal="true"
            aria-label="Conversation history"
            className={`nf-panel nf-panel--card nf-panel--glass absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col rounded-l-none p-0 pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-[var(--nf-duration-base)] ease-[var(--nf-ease-entrance)] ${
              historyShown ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[var(--nf-panel-hair)] pb-xs pl-md pr-xs pt-[calc(var(--nf-space-xs)+env(safe-area-inset-top,0px))]">
              <p className="text-[length:var(--nf-text-body-sm)] font-semibold">Conversations</p>
              <Button variant="icon" leadingIcon="close" aria-label="Close conversation history" onClick={closeHistory} />
            </div>
            <div className="min-h-0 flex-1">{sidebar()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A real catalogue result inside the thread, in the render's card anatomy:
 * the photograph with the Verified mark and a working save on it, the title,
 * where it is, the price, then beds, baths and floor area on a rule, and
 * beneath them what the place is and its rating. Every fact is one the route
 * streamed off the row; an absent one leaves no gap, the row just shrinks.
 */
function ThreadListingCard({
  listing,
  locale,
  t,
}: {
  listing: AssistantListingItem;
  locale: Locale;
  t: AssistantCopy;
}) {
  const save = useSaveControl(listing.id);
  const facts: { key: string; icon: UiIconName; label: string }[] = [];
  if (listing.bedrooms !== undefined && listing.bedrooms > 0) {
    facts.push({
      key: "beds",
      icon: "bed",
      label: countOf(listing.bedrooms, "beds", locale),
    });
  }
  if (listing.bathrooms !== undefined && listing.bathrooms > 0) {
    facts.push({
      key: "baths",
      icon: "bath",
      label: countOf(listing.bathrooms, "baths", locale),
    });
  }
  if (listing.sizeSqm !== undefined && listing.sizeSqm > 0) {
    facts.push({
      key: "size",
      icon: "grid",
      label: `${formatNumber(listing.sizeSqm, locale)} ${t.catalogue.card.sqm}`,
    });
  }
  return (
    <article className="nf-ai__result">
      <div className="nf-ai__result-media">
        {listing.photo && (
          <Image src={listing.photo} alt="" fill sizes="(max-width: 640px) 45vw, 240px" />
        )}
        {/* The mark means a person at Vallo checked the lister, and the wire
            carries it off the row, so it is never drawn from anything else. */}
        {listing.verified && (
          <span className="nf-ai__result-mark">
            <UiIcon name="verified" size={12} />
            {t.common.verified}
          </span>
        )}
        <SaveButton
          saved={save.saved}
          pending={save.pending}
          onToggle={save.toggle}
          title={listing.title}
          className="nf-ai__result-save h-9 w-9"
        />
      </div>
      <Link href={destinationFor(listing)} className="nf-ai__result-body">
        {/* The render draws a chevron in its own ring beside the title, and
            the card had none: nothing on it said it was a way through, so two
            results inside a reply read as an illustration of the answer
            rather than as the two doors they are (ledger 10.2). Decorative,
            because the whole body is already the link. */}
        <span className="nf-ai__result-head">
          <span className="nf-ai__result-title" title={listing.title}>
            {listing.title}
          </span>
          <span className="nf-ai__result-go" aria-hidden="true">
            <UiIcon name="chevron-down" size={16} className="-rotate-90" />
          </span>
        </span>
        <span className="nf-ai__result-where">
          <UiIcon name="location" size={12} className="shrink-0" />
          <span className="truncate">{listing.city}</span>
        </span>
        <span className="nf-ai__result-price nf-numeric">{listing.price}</span>
        {facts.length > 0 && (
          <span className="nf-ai__result-facts">
            {facts.map((f) => (
              <span key={f.key} className="nf-ai__result-fact nf-numeric">
                <UiIcon name={f.icon} size={12} />
                {f.label}
              </span>
            ))}
          </span>
        )}
        <span className={`nf-ai__result-meta ${facts.length === 0 ? "nf-ai__result-facts" : ""}`}>
          <span className="nf-ai__result-fact nf-ai__result-kind">
            {KIND_NOUN[listing.kind] ?? listing.kind}
          </span>
          {listing.rating > 0 && (
            <span className="nf-ai__result-fact nf-numeric">
              <UiIcon name="star" size={12} className="text-[var(--nf-rating)]" />
              {formatRating(listing.rating, locale)}
            </span>
          )}
        </span>
      </Link>
    </article>
  );
}

/**
 * One of the quiet icons under an answer: a 44px target round a small glyph,
 * named for a screen reader and titled for a pointer.
 */
function ActButton({
  icon,
  label,
  onClick,
  pressed,
  expanded,
}: {
  icon: UiIconName;
  label: string;
  onClick: (el: HTMLButtonElement) => void;
  pressed?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className="nf-ai-acts__btn nf-tap"
      aria-label={label}
      title={label}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      {...(expanded !== undefined ? { "aria-haspopup": "dialog" as const, "aria-expanded": expanded } : {})}
      onClick={(e) => onClick(e.currentTarget)}
    >
      <UiIcon name={icon} size={18} />
    </button>
  );
}
