"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { COPILOT_COMMANDS, matchCommands, type CopilotCommand } from "@/lib/admin/copilot/commands";
import { followUpsFor } from "@/lib/admin/copilot/follow-ups";
import { COPILOT_ASK_EVENT } from "./CopilotCapabilities";
import { CopilotAnswer } from "./CopilotAnswer";
import { ProposalCard } from "./ProposalCard";
import { DEFAULT_SETTINGS, readSettings, useCopilotChat, writeSettings, type CopilotSettings, type ThreadSummary } from "./use-copilot-chat";
import "./admin-copilot.css";

/**
 * THE COPILOT CONVERSATION, used by the desk sheet and the full page.
 *
 * Rebuilt for the phone on 16 November 2026, and grown the same day (the
 * founder: "add more and more things for the AI copilot: history, different
 * tools and settings and flow ... prefixes like 'what needs me today' ...
 * more and more options as the chat is going").
 *
 *   The bar      History, Settings and New chat; a quiet line while it works.
 *   Commands     Type "/" for the quick commands this person's desks open
 *                (`lib/admin/copilot/commands.ts`), filtered as you type,
 *                arrows and Enter to choose.
 *   The thread   Your questions in a Vallo-blue bubble; answers on the page,
 *                full width; under each, Copy and (on the newest) Ask again;
 *                the steps it took, if you want them; the cards it offers,
 *                each with its preview and its own button; and two or three
 *                next questions drawn from what it just read.
 *   History      Every conversation, newest first, to open again or delete.
 *   Settings     Answer length, steps shown or not, history saved or not,
 *                and whether Enter sends. Kept on this device.
 *   Composer     A floating pill that grows as you write; Send becomes Stop
 *                while an answer is being written.
 *
 * The answer list is a polite live region so a screen reader hears the answer
 * as it is written.
 */

type Panel = "chat" | "history" | "settings";

function ago(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

function deskLabel(desk: string): string {
  const words = desk.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Console";
}

/** Until the server answers, only the commands every member of staff holds. */
const EVERYONE: readonly CopilotCommand[] = COPILOT_COMMANDS.filter((c) => !c.scopes && !c.superAdmin);

const STYLE_WORDS: Record<CopilotSettings["style"], { name: string; hint: string }> = {
  short: { name: "Short", hint: "The figure and the button" },
  balanced: { name: "Balanced", hint: "A few lines, as it fits" },
  detailed: { name: "Detailed", hint: "Headings, every figure, next steps" },
};

function Toggle({ on, onChange, label, hint, testId }: { on: boolean; onChange: (next: boolean) => void; label: string; hint: string; testId: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="nf-copilot-toggle nf-tap" onClick={() => onChange(!on)} data-testid={testId}>
      <span className="nf-copilot-toggle__words">
        <span className="nf-copilot-toggle__label">{label}</span>
        <span className="nf-copilot-toggle__hint">{hint}</span>
      </span>
      <span className="nf-copilot-toggle__track" aria-hidden="true">
        <span className="nf-copilot-toggle__thumb" />
      </span>
    </button>
  );
}

export function CopilotChat({
  scope,
  deskName,
  context,
  greeting,
  starters,
  storageKey,
  variant = "sheet",
  autoFocus = false,
  onNavigate,
}: {
  scope: string | null;
  deskName: string;
  context?: string | null;
  greeting?: string;
  starters: readonly string[];
  storageKey: string;
  variant?: "sheet" | "page";
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const [settings, setSettings] = useState<CopilotSettings>(DEFAULT_SETTINGS);
  const chat = useCopilotChat({ storageKey, scope, deskName, context: context ?? null, settings });
  const { turns, pending, tool, send, stop, askAgain, confirm, dismiss, newChat, threadId, history, threads, listing, loadThreads, openThread, deleteThread } = chat;
  const [draft, setDraft] = useState("");
  const [panel, setPanel] = useState<Panel>("chat");
  const [now, setNow] = useState(0);
  const [commands, setCommands] = useState<readonly CopilotCommand[]>(EVERYONE);
  const [picked, setPicked] = useState(0);
  const [menuClosed, setMenuClosed] = useState(false);
  const inputId = useId();
  const menuId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this device after mount
    setSettings(readSettings());
  }, []);

  /* The commands this person's own desks open, from the server. */
  useEffect(() => {
    let live = true;
    void fetch("/api/admin/copilot/commands", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((out: { ok?: boolean; commands?: CopilotCommand[] } | null) => {
        if (live && out?.ok && Array.isArray(out.commands) && out.commands.length > 0) setCommands(out.commands);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    if (panel === "chat") end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, tool, panel]);

  /* The composer grows with what is written, up to about six lines. */
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft]);

  const submitRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    const onAsk = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail;
      if (typeof prompt === "string") submitRef.current(prompt);
    };
    window.addEventListener(COPILOT_ASK_EVENT, onAsk);
    return () => window.removeEventListener(COPILOT_ASK_EVENT, onAsk);
  }, []);

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setDraft("");
    setPanel("chat");
    void send(message);
    input.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    submitRef.current = submit;
  });

  const menu = useMemo(() => (menuClosed ? null : matchCommands(draft, commands)), [draft, commands, menuClosed]);
  const menuOpen = Boolean(menu && menu.length > 0);

  /* The clock for "2 h ago", read once each time History opens. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of the clock per opening
    if (panel === "history") setNow(Date.now());
  }, [panel]);

  const openHistory = () => {
    setPanel("history");
    void loadThreads();
  };

  const choose = (command: CopilotCommand) => {
    setPicked(0);
    if (command.action) {
      setDraft("");
      if (command.action === "new") {
        newChat();
        setPanel("chat");
      } else if (command.action === "history") openHistory();
      else setPanel("settings");
      return;
    }
    if (command.prompt) {
      submit(command.prompt);
      return;
    }
    if (command.template) {
      setDraft(command.template);
      setMenuClosed(true);
      window.requestAnimationFrame(() => {
        const el = input.current;
        if (el) {
          el.focus({ preventScroll: true });
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen && menu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPicked((i) => (i + 1) % menu.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPicked((i) => (i - 1 + menu.length) % menu.length);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        const command = menu[Math.min(picked, menu.length - 1)];
        if (command) choose(command);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuClosed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && settings.enterSends) {
      e.preventDefault();
      submit(draft);
    }
  };

  const changeSettings = (patch: Partial<CopilotSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      writeSettings(next);
      return next;
    });
  };

  const copyAnswer = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\*\*/g, ""));
      banner.quick("Answer copied");
    } catch {
      banner.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  const pick = async (thread: ThreadSummary) => {
    const opened = await openThread(thread.id);
    if (opened) setPanel("chat");
  };

  const last = turns[turns.length - 1];
  const writing = pending && last?.role === "assistant" && last.text === "";
  const newestAnswer = !pending && last?.role === "assistant" && last.text ? last : null;
  const nextQuestions = newestAnswer ? followUpsFor((newestAnswer.tools ?? []).map((t) => t.name)) : [];

  return (
    <div className="nf-copilot" data-variant={variant}>
      <div className="nf-copilot__bar">
        <button type="button" className="nf-copilot-barbtn nf-tap" onClick={panel === "chat" ? openHistory : () => setPanel("chat")} aria-pressed={panel === "history"} data-testid="copilot-history">
          <UiIcon name={panel === "chat" ? "history" : "arrow-left"} size={18} weight="lean" />
          <span>{panel === "chat" ? "History" : "Back to chat"}</span>
        </button>
        <p className="nf-copilot__hint" aria-live="polite">
          {pending ? (
            <>
              <span className="nf-copilot-dot" aria-hidden="true" />
              Working on it
            </>
          ) : history === "on" && threadId && settings.saveHistory ? (
            "Saved"
          ) : null}
        </p>
        <button
          type="button"
          className="nf-copilot-baricon nf-tap"
          onClick={() => setPanel(panel === "settings" ? "chat" : "settings")}
          aria-pressed={panel === "settings"}
          aria-label="Copilot settings"
          data-testid="copilot-settings"
        >
          <UiIcon name="sliders" size={18} weight="lean" />
        </button>
        <button
          type="button"
          className="nf-copilot-barbtn nf-copilot-barbtn--icon nf-tap"
          onClick={() => {
            newChat();
            setPanel("chat");
            input.current?.focus({ preventScroll: true });
          }}
          disabled={turns.length === 0 && !pending && panel === "chat"}
          data-testid="copilot-new-chat"
        >
          <UiIcon name="pencil" size={18} weight="lean" />
          <span>New chat</span>
        </button>
      </div>

      {panel === "history" ? (
        <section className="nf-copilot-history" aria-label="Your conversations" data-testid="copilot-history-list">
          <h3 className="nf-copilot-history__title">Your conversations</h3>
          {history === "off" ? (
            <p className="nf-copilot-history__note">Saved history is not switched on for this console yet. This conversation is kept until you close the browser.</p>
          ) : !settings.saveHistory ? (
            <p className="nf-copilot-history__note">Saving is off in your settings, so new conversations are not kept here.</p>
          ) : null}
          {history !== "off" && listing === "failed" ? (
            <p className="nf-copilot-history__note">
              Your conversations could not be loaded just now.{" "}
              <button type="button" className="nf-copilot-history__retry" onClick={() => void loadThreads()}>
                Try again
              </button>
            </p>
          ) : history !== "off" && threads.length === 0 ? (
            <p className="nf-copilot-history__note">{listing === "ready" ? "Nothing saved yet. Every conversation is kept here after the first answer." : "Loading your conversations"}</p>
          ) : history !== "off" ? (
            <ul className="nf-copilot-history__list">
              {threads.map((thread) => (
                <li key={thread.id} className="nf-copilot-history__item" data-current={thread.id === threadId || undefined}>
                  <button type="button" className="nf-copilot-history__open nf-tap" onClick={() => void pick(thread)}>
                    <span className="nf-copilot-history__name">{thread.title}</span>
                    <span className="nf-copilot-history__meta">
                      {deskLabel(thread.desk)}
                      {now ? ` · ${ago(thread.updatedAt, now)}` : ""}
                    </span>
                  </button>
                  <button type="button" className="nf-copilot-history__delete nf-tap" onClick={() => void deleteThread(thread.id)} aria-label={`Delete "${thread.title}"`}>
                    <UiIcon name="trash" size={18} weight="lean" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : panel === "settings" ? (
        <section className="nf-copilot-history" aria-label="Copilot settings" data-testid="copilot-settings-panel">
          <h3 className="nf-copilot-history__title">Settings</h3>
          <fieldset className="nf-copilot-seg">
            <legend className="nf-copilot-seg__legend">How long answers run</legend>
            <div className="nf-copilot-seg__row">
              {(["short", "balanced", "detailed"] as const).map((style) => (
                <button key={style} type="button" className="nf-copilot-seg__btn nf-tap" aria-pressed={settings.style === style} onClick={() => changeSettings({ style })}>
                  <span className="nf-copilot-seg__name">{STYLE_WORDS[style].name}</span>
                  <span className="nf-copilot-seg__hint">{STYLE_WORDS[style].hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Toggle on={settings.showSteps} onChange={(showSteps) => changeSettings({ showSteps })} label="Show the steps it took" hint="What it read or prepared, under each answer" testId="copilot-setting-steps" />
          <Toggle on={settings.saveHistory} onChange={(saveHistory) => changeSettings({ saveHistory })} label="Save conversations" hint="Kept in History, on every device you sign in on" testId="copilot-setting-history" />
          <Toggle on={settings.enterSends} onChange={(enterSends) => changeSettings({ enterSends })} label="Enter sends" hint="Off: Enter starts a new line and the arrow sends" testId="copilot-setting-enter" />
          <p className="nf-copilot-history__note">Type / in the message box for quick commands. Every change I offer shows a preview first and happens only when you press its button.</p>
        </section>
      ) : (
        <div className="nf-copilot-thread" aria-live="polite" aria-busy={pending} data-testid="admin-copilot-thread">
          {turns.length === 0 ? (
            <div className="nf-copilot-empty">
              <span className="nf-copilot-empty__mark" aria-hidden="true">
                <UiIcon name="bot" size={26} weight="lean" />
              </span>
              <p className="nf-copilot-greeting">{greeting ?? `Ask me anything about your ${deskName.toLowerCase()} work.`}</p>
              <p className="nf-copilot-empty__can">I read your desks, write replies and notes, and do the work for you. Every change shows you a preview first and happens only when you press its button. Type / for quick commands.</p>
              <div className="nf-copilot-chips" role="group" aria-label="Suggested questions">
                {starters.map((prompt) => (
                  <button key={prompt} type="button" className="nf-copilot-chip nf-tap" onClick={() => submit(prompt)} disabled={pending}>
                    <span>{prompt}</span>
                    <UiIcon name="arrow-up-right" size={16} weight="lean" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn, i) => {
              const isNewest = i === turns.length - 1;
              const steps = turn.tools ?? [];
              return (
                <div key={turn.id} className="nf-copilot-row" data-role={turn.role}>
                  {turn.role === "user" ? (
                    <p className="nf-copilot-turn" data-role="user">
                      {turn.text}
                    </p>
                  ) : (
                    <>
                      {turn.text ? (
                        <div className="nf-copilot-turn" data-role="assistant">
                          <CopilotAnswer text={turn.text} destinations={turn.destinations ?? []} {...(onNavigate ? { onNavigate } : {})} />
                          {settings.showSteps && steps.length > 0 && !(pending && isNewest) ? (
                            <details className="nf-copilot-steps">
                              <summary>
                                <UiIcon name="clipboard-list" size={14} weight="lean" />
                                {steps.length === 1 ? "One step" : `${steps.length} steps`}
                              </summary>
                              <ol>
                                {steps.map((step) => (
                                  <li key={step.name}>{step.label}</li>
                                ))}
                              </ol>
                            </details>
                          ) : null}
                          {!(pending && isNewest) ? (
                            <div className="nf-copilot-acts">
                              <button type="button" className="nf-copilot-act nf-tap" onClick={() => void copyAnswer(turn.text)}>
                                <UiIcon name="clipboard-list" size={16} weight="lean" />
                                Copy
                              </button>
                              {isNewest ? (
                                <button type="button" className="nf-copilot-act nf-tap" onClick={askAgain} data-testid="copilot-ask-again">
                                  <UiIcon name="repost-loop" size={16} weight="lean" />
                                  Ask again
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {turn.proposals.map((p) => (
                        <ProposalCard key={p.proposal.id} state={p} onConfirm={(typed) => void confirm(p.proposal, typed)} onDismiss={() => dismiss(p.proposal.id)} {...(onNavigate ? { onNavigate } : {})} />
                      ))}
                    </>
                  )}
                </div>
              );
            })
          )}
          {pending ? (
            <p className="nf-copilot-status" role="status" data-testid="copilot-status">
              <span className="nf-copilot-typing" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {tool ? `${tool.label}` : writing ? "Thinking" : "Writing"}
            </p>
          ) : null}
          {nextQuestions.length > 0 ? (
            <ul className="nf-copilot-next" aria-label="Ask next" data-testid="copilot-next">
              {nextQuestions.map((q) => (
                <li key={q}>
                  <button type="button" className="nf-copilot-next__btn nf-tap" onClick={() => submit(q)}>
                    <UiIcon name="arrow-up-right" size={16} weight="lean" />
                    <span>{q}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div ref={end} />
        </div>
      )}

      <div className="nf-copilot-dock">
        {menuOpen && menu ? (
          <ul className="nf-copilot-menu" id={menuId} role="listbox" aria-label="Quick commands" data-testid="copilot-commands">
            {menu.slice(0, 8).map((command, i) => (
              <li key={command.key} role="option" aria-selected={i === Math.min(picked, menu.length - 1)}>
                <button
                  type="button"
                  className="nf-copilot-menu__item nf-tap"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(command)}
                >
                  <span className="nf-copilot-menu__key">/{command.key}</span>
                  <span className="nf-copilot-menu__hint">{command.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="nf-copilot-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) stop();
            else submit(draft);
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Ask the assistant
          </label>
          <textarea
            id={inputId}
            ref={input}
            className="nf-copilot-input"
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setPicked(0);
              setMenuClosed(false);
            }}
            onKeyDown={onKey}
            placeholder={`Ask, or type / for commands`}
            maxLength={2000}
            enterKeyHint={settings.enterSends ? "send" : "enter"}
            role="combobox"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-autocomplete="list"
          />
          {pending ? (
            <button type="submit" className="nf-copilot-send nf-tap" aria-label="Stop the answer" data-testid="copilot-stop">
              <span className="nf-copilot-send__stop" aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className="nf-copilot-send nf-tap" disabled={!draft.trim()} data-testid="admin-copilot-send" aria-label="Send">
              <UiIcon name="arrow-up" size={20} weight="lean" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
