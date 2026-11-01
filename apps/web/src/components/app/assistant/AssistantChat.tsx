"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOverlay } from "@/lib/ui/use-overlay";
import Image from "next/image";
import Link from "next/link";
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
import { BackControl } from "@/components/ui/BackControl";
import { Button } from "@/components/ui/Button";
import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
import {
  AssistantSidebar,
  type Language,
  type Tone,
} from "./AssistantSidebar";
import { AssistantSettingsSheet } from "./AssistantSettingsSheet";
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
import { LiveIsland } from "@/components/ui/LiveIsland";
import "./assistant-answer.css";
import "@/app/css/home.css";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

/**
 * Vallo AI, to its governing image (`docs/design/references/BF49B814`).
 *
 * The header pair under the chrome (the name and "Always here. Ask
 * anything."), the thread as bubbles (mine brand blue on the right with the
 * time and the ticks, the assistant's glass on the left with the concierge
 * object beside it), the real catalogue results as two-up cards inside the
 * thread, the thinking pill while the model works, the suggestion chips on a
 * rail above the composer, and the composer with the assistant's `bot` glyph in its well.
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

/** How long away before the assistant opens on a new chat; the old one stays in history. */
const FRESH_CHAT_AFTER_MS = 10 * 60 * 1000;

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
  const [tone, setTone] = useState<Tone>("Concise");
  const [language, setLanguage] = useState<Language>("English");
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* STORE-07: the first send records the agreement the server checks (see `send`). */
  const [consent, setConsent] = useState<"yes" | "ask" | "declined">(aiConsented ? "yes" : "ask");
  /* Which answer was just copied (its label says so for a moment), and
     whether the reader has scrolled away from the newest part of the thread,
     which is when a streaming answer gets its island. */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  const answerWords = t.answer;

  // A question can arrive from anywhere on the platform via ?q=, e.g. the home
  // banner's quick-ask bar. It seeds the composer after mount, never auto-sends.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setDraft((d) => (d ? d : q));
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
  const streamSeq = useRef(0);

  /* Restore saved conversations once on mount, then persist every change.
     A seeded preview restores the fixtures instead and persists nothing. */
  useEffect(() => {
    const restored = seed ? seed.threads : loadThreads();
    setThreads(restored);
    const latest = [...restored].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    /* A conversation left for ten minutes stays in history; the screen opens on
       a fresh chat, the way the other assistants do. A seeded preview keeps its
       own. */
    if (latest && (seed || Date.now() - latest.updatedAt < FRESH_CHAT_AFTER_MS)) setActiveId(latest.id);
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
      if (hiddenAt !== null && Date.now() - hiddenAt >= FRESH_CHAT_AFTER_MS) setActiveId(null);
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [seed]);

  useEffect(() => {
    if (!hydrated || seed) return;
    saveThreads(threads);
  }, [threads, hydrated, seed]);

  const active = activeId ? threads.find((t) => t.id === activeId) : undefined;
  const messages = active?.messages ?? [];
  const streamingHere = streamingThread !== null && streamingThread === activeId;

  /* Keep the newest bubble in view as the thread grows or switches. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages, streamingHere, activeId]);

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

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
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
          m.text.trim() || (m.listings?.length ?? 0) > 0
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
    [activeId, threads, runAssistant, consent],
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
    closeHistory();
    inputRef.current?.focus();
  };

  const newChat = () => {
    setActiveId(null);
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
  const lastMessage = messages[messages.length - 1];
  const showThinking =
    streamingHere &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      (lastMessage.text === "" && (lastMessage.listings?.length ?? 0) === 0));

  const sidebar = () => (
    <AssistantSidebar
      threads={threads}
      activeId={activeId}
      tone={tone}
      language={language}
      onSelect={selectThread}
      onNew={newChat}
      onDelete={deleteThread}
      onClearAll={clearAll}
      onToneChange={setTone}
      onLanguageChange={setLanguage}
    />
  );

  /* History (on a phone) and settings: in the surface's own bar on
     `/assistant`, beside the name pair inside a workspace. */
  const barActions = (
    <div className="nf-ai__bar-actions">
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
      {/* An answer that is still streaming while the reader has scrolled up
          through the thread: a status island that says so and takes them
          back to it. It exists only while that is true (a real stream, a
          real scroll position), carries no progress it does not have, and
          sits below the header, never over the dock. */}
      {streamingHere && awayFromEnd ? (
        <LiveIsland
          label={answerWords.answerLabel}
          title={answerWords.islandTitle}
          detail={answerWords.islandDetail}
          icon="bot"
          action={{
            label: answerWords.islandOpen,
            onClick: () => {
              const el = scrollerRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight });
            },
          }}
          expandLabel={answerWords.expand}
          collapseLabel={answerWords.collapse}
          data-testid="assistant-island"
        />
      ) : null}
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
          <div className="nf-ai__ident">
            <h1 className="nf-ai__title">{copy.title}</h1>
            <p className="nf-ai__sub">{copy.sub}</p>
          </div>
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
              setAwayFromEnd(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
            }}
          >
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
              if (!m.text.trim() && (m.listings?.length ?? 0) === 0) return null;
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
                        stopLabel={answerWords.stop}
                        onStop={() => abortRef.current?.abort()}
                        {...(m.error ? { errorMessage: m.text } : {})}
                        actions={[
                          {
                            id: "copy",
                            label: copiedId === m.id ? answerWords.copied : answerWords.copy,
                            icon: copiedId === m.id ? "check" : "clipboard-list",
                            onSelect: () => {
                              void navigator.clipboard
                                ?.writeText(m.text)
                                .then(() => {
                                  setCopiedId(m.id);
                                  window.setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1600);
                                })
                                .catch(() => undefined);
                            },
                          },
                        ]}
                        data-testid="assistant-answer"
                      >
                        {m.error ? null : m.text}
                        {status === "stopped" ? (
                          <span className="nf-ai-answer__stopped">{answerWords.stoppedNote}</span>
                        ) : null}
                        {stamp ? <span className="nf-ai__stamp nf-numeric">{stamp}</span> : null}
                      </AIResponse>
                    </div>
                  )}
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
                  stopLabel={answerWords.stop}
                  onStop={() => abortRef.current?.abort()}
                  data-testid="assistant-thinking"
                />
              </div>
            )}
          </div>

          {/* ---------------------------------------------- suggestions */}
          <div className="nf-ai__chips" role="group" aria-label="Suggested questions">
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

          {/* ----------------------------------------------------- composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="nf-ai__composer"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Message Vallo AI
            </label>
            <div className="nf-ai__well nf-focus-well">
              <UiIcon name="bot" size={20} />
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
            <Button
              type="submit"
              variant="primary"
              size="lg"
              iconOnly
              leadingIcon="arrow-up"
              aria-label="Send message"
              disabled={!draft.trim()}
              className="nf-ai__send"
            />
          </form>
          <p className="nf-ai__note" data-testid="ai-note">
            Answers are written by AI and can be wrong. Never share passwords or card numbers.
          </p>
        </section>
      </div>

      <AssistantSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tone={tone}
        language={language}
        onToneChange={setTone}
        onLanguageChange={setLanguage}
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
