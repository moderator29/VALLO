"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { banner } from "@/lib/ui/toast";
import type { CopilotProposal } from "@/lib/admin/copilot/tools/types";

/**
 * The copilot's conversation state, shared by the desk sheet and the full
 * page. The stream has four kinds of event: `text` (the answer as it is
 * written), `tool` (a status line while a read runs), `proposal` (a card for
 * the person to confirm) and `done` or `error`. The conversation is kept for
 * the session in sessionStorage (every access in try/catch: private windows
 * and blocked storage must not break the chat).
 */

export type ProposalStatus = "pending" | "confirming" | "done" | "failed" | "dismissed" | "expired";
export type ProposalState = { proposal: CopilotProposal; status: ProposalStatus; message?: string; href?: string };
export type Turn = { id: string; role: "user" | "assistant"; text: string; proposals: ProposalState[] };
export type ToolLine = { id: string; label: string };

const MAX_TURNS = 40;

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; label: string; phase: "start" | "done" | "error" }
  | { type: "proposal"; proposal: CopilotProposal }
  | { type: "done" }
  | { type: "error"; message: string };

let counter = 0;
const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

function readStored(key: string): Turn[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Turn[];
    return Array.isArray(parsed) ? parsed.filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string").map((t) => ({ ...t, proposals: Array.isArray(t.proposals) ? t.proposals : [] })) : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, turns: Turn[]) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(turns.slice(-MAX_TURNS)));
  } catch {
    /* Storage can be blocked; the chat works without it. */
  }
}

export function useCopilotChat({ storageKey, scope, deskName, context }: { storageKey: string; scope: string | null; deskName: string; context: string | null }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [tool, setTool] = useState<ToolLine | null>(null);
  const [restored, setRestored] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  useEffect(() => {
    const stored = readStored(storageKey);
    if (stored.length) setTurns(stored);
    setRestored(true);
    return () => abortRef.current?.abort();
  }, [storageKey]);

  useEffect(() => {
    if (restored && !pending) writeStored(storageKey, turns);
  }, [turns, restored, pending, storageKey]);

  const patchLast = useCallback((fn: (turn: Turn) => Turn) => {
    setTurns((all) => {
      const next = [...all];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") next[next.length - 1] = fn(last);
      return next;
    });
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || pending) return;
      const history = turnsRef.current.filter((t) => t.text.trim()).map((t) => ({ role: t.role, text: t.text }));
      setTurns((t) => [...t, { id: newId(), role: "user", text: message, proposals: [] }, { id: newId(), role: "assistant", text: "", proposals: [] }]);
      setPending(true);
      setTool(null);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/admin/copilot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope, deskName, context, history, message }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const reason = res.status === 429 ? "You have asked a lot in the last hour. Try again a little later." : res.status === 403 ? "Your access does not include the copilot. Check with your lead." : "The assistant is not available just now. Try again in a moment.";
          banner.error(reason);
          patchLast((t) => ({ ...t, text: reason }));
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
            const line = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line.slice(5).trim()) as StreamEvent;
            } catch {
              continue;
            }
            if (event.type === "text") {
              patchLast((t) => ({ ...t, text: t.text + event.text }));
            } else if (event.type === "tool") {
              setTool(event.phase === "start" ? { id: event.id, label: event.label } : null);
            } else if (event.type === "proposal") {
              patchLast((t) => ({ ...t, proposals: [...t.proposals, { proposal: event.proposal, status: "pending" }] }));
            } else if (event.type === "error") {
              banner.error(event.message);
              patchLast((t) => (t.text ? t : { ...t, text: event.message }));
            }
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          banner.error("Could not reach the assistant just now. Try again in a moment.");
          patchLast((t) => (t.text ? t : { ...t, text: "I could not reach the assistant just now. Your question is still here; try again in a moment." }));
        }
      } finally {
        setPending(false);
        setTool(null);
      }
    },
    [pending, scope, deskName, context, patchLast],
  );

  const setProposal = useCallback((id: string, patch: Partial<ProposalState>) => {
    setTurns((all) => all.map((t) => ({ ...t, proposals: t.proposals.map((p) => (p.proposal.id === id ? { ...p, ...patch } : p)) })));
  }, []);

  const confirm = useCallback(
    async (proposal: CopilotProposal) => {
      if (!proposal.token) return;
      setProposal(proposal.id, { status: "confirming" });
      try {
        const res = await fetch("/api/admin/copilot/act", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: proposal.token }),
        });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; href?: string; code?: string } | null;
        const message = body?.message ?? "That did not go through. Try again, or make the change on the desk.";
        if (res.ok && body?.ok) {
          banner.success(message);
          setProposal(proposal.id, { status: "done", message, ...(body.href ? { href: body.href } : {}) });
        } else {
          banner.error(message);
          setProposal(proposal.id, { status: body?.code === "expired" ? "expired" : "failed", message });
        }
      } catch {
        const message = "Could not reach the console just now. Nothing was changed. Try again.";
        banner.error(message);
        setProposal(proposal.id, { status: "pending", message });
      }
    },
    [setProposal],
  );

  const dismiss = useCallback((id: string) => setProposal(id, { status: "dismissed" }), [setProposal]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setPending(false);
    setTool(null);
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { turns, pending, tool, send, confirm, dismiss, newChat };
}
