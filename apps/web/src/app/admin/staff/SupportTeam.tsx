"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { addToSupport, removeFromSupport } from "@/lib/admin/staff-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE SUPPORT TEAM, on the team console. Who answers members, what else
 * each of them holds, how active they have been on the desk, and the two
 * one-step changes: put somebody on support (a new person gets the Support
 * Agent position, which opens the support desk and nothing else), or take
 * somebody off it (their other desks stay; if support was all they had, their
 * access ends and they read the reason).
 */
export type SupportMember = {
  userId: string;
  name: string;
  /** "Super admin", "Admin", or the position title. */
  role: string;
  /** Everything else they hold, in words; empty for support only. */
  alsoHolds: string[];
  /** Admins hold support through their role and cannot be taken off it here. */
  viaRole: boolean;
  lastActive: string;
  supportActions: number;
  handbookAcknowledged: boolean;
};

export function SupportTeam({ members }: { members: SupportMember[] }) {
  const people = members.filter((m) => !m.viaRole);
  const admins = members.filter((m) => m.viaRole);
  return (
    <div className="grid gap-md" data-testid="support-team">
      <AddToSupport />
      {people.length === 0 ? (
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">
          Nobody holds the support desk yet besides the admins. Add the first person above: they are told by email and in
          the app, and the desk opens for them once they acknowledge the handbook and prove their security key.
        </p>
      ) : (
        <ul className="grid gap-xs">
          {people.map((m) => (
            <li key={m.userId} className="nf-admin-plate p-sm">
              <div className="flex flex-wrap items-baseline gap-x-xs">
                <p className="font-semibold">{m.name}</p>
                <p className="nf-caption text-[var(--nf-content-secondary)]">{m.role}</p>
                <p className="nf-caption nf-numeric ml-auto text-[var(--nf-content-muted)]">
                  {m.supportActions} on the desk in 30 days · last active {m.lastActive}
                </p>
              </div>
              <p className="mt-3xs nf-caption text-[var(--nf-content-secondary)]">
                {m.alsoHolds.length === 0 ? "Support only." : `Also holds: ${m.alsoHolds.join(", ")}.`}
                {m.handbookAcknowledged ? "" : " Has not acknowledged the handbook yet, so the desk is still locked for them."}
              </p>
              <RemoveFromSupport userId={m.userId} ends={m.alsoHolds.length === 0} />
            </li>
          ))}
        </ul>
      )}
      {admins.length > 0 ? (
        <p className="nf-caption text-[var(--nf-content-muted)]">
          Also on support through their role: {admins.map((a) => `${a.name} (${a.role})`).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

function AddToSupport() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await addToSupport({ email });
            if (!r.ok) setMessage({ ok: false, text: r.error });
            else {
              setMessage({
                ok: true,
                text:
                  r.data.scopes.join(",") === "support"
                    ? "Added as a Support Agent. They have been told by email and in the app."
                    : "Support added to their access. They have been told.",
              });
              setEmail("");
              router.refresh();
            }
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      {/* basis-64: the field keeps 16rem before the button wraps under it; at
          390 the two shared a line and the field showed "The email on th". */}
      <label className="grid min-w-0 flex-1 basis-64 gap-2xs">
        <span className="nf-label">Put somebody on support</span>
        <input
          className="nf-field w-full"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="The email on their Vallo account"
        />
      </label>
      <Button type="submit" variant="primary" size="md" loading={pending} disabled={!email.includes("@")}>
        Add to support
      </Button>
      <p className="basis-full nf-caption text-[var(--nf-content-muted)]">
        Somebody new becomes a Support Agent: the support desk and nothing else. Somebody who already has access keeps it
        and gains support.
      </p>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className="basis-full nf-body-sm">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

function RemoveFromSupport({ userId, ends }: { userId: string; ends: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <div className="mt-2xs">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Take off support
        </Button>
      </div>
    );
  }
  return (
    <form
      className="mt-xs flex flex-wrap items-end gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await removeFromSupport({ userId, reason });
            if (!r.ok) setError(r.error);
            else router.refresh();
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <label className="grid min-w-0 flex-1 gap-2xs">
        <span className="nf-label">{ends ? "Reason (they read it; support was all their access)" : "Reason (kept on the record)"}</span>
        <input className="nf-field w-full" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button type="submit" variant={ends ? "dangerQuiet" : "secondary"} size="sm" loading={pending} disabled={reason.trim().length < 5}>
        {ends ? "End their access" : "Take off support"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Keep them
      </Button>
      {error ? (
        <p role="alert" className="basis-full nf-caption text-[var(--nf-state-warning)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
