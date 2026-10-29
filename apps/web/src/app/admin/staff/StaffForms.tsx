"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Check";
import { grantStaff, revokeStaff } from "@/lib/admin/staff-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

export type PositionOption = { value: string; label: string; summary: string; scopes: string[] };

export function GrantStaffForm({
  scopes,
  positions,
}: {
  scopes: { value: string; label: string }[];
  positions: PositionOption[];
}) {
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  return (
    <form
      className="grid gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await grantStaff({ email, scopes: picked, position: position || null, note });
          if (!result.ok) setMessage({ ok: false, text: result.error });
          else {
            setMessage({ ok: true, text: "Access given. They have been told by email and in the app." });
            setEmail("");
            setPosition("");
            setPicked([]);
            setNote("");
            router.refresh();
          }
        });
      }}
    >
      <label className="grid gap-2xs nf-body">
        <span>Email on their Vallo account</span>
        <input className="nf-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="grid gap-2xs nf-body">
        <span>Position</span>
        <select
          className="nf-field"
          value={position}
          onChange={(e) => {
            const next = e.target.value;
            setPosition(next);
            /* A position sets its default bundle in one step; the boxes below
               stay editable so the bundle can be adjusted. */
            setPicked(positions.find((p) => p.value === next)?.scopes ?? []);
          }}
        >
          <option value="">No named position (choose access areas)</option>
          {positions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {position ? (
          <span className="nf-caption text-[var(--nf-content-secondary)]">
            {positions.find((p) => p.value === position)?.summary}
          </span>
        ) : null}
      </label>
      <fieldset className="grid gap-2xs">
        <legend className="nf-body">Access areas{position ? " (the position's defaults, adjust if needed)" : ""}</legend>
        {/* The shared Checkbox: its label is the 44px row (`.nf-check`); the
            hand-built label here was the text's height, so each access area was
            a 20px target (C1 sweep, measured). */}
        {scopes.map((s) => (
          <Checkbox
            key={s.value}
            checked={picked.includes(s.value)}
            onChange={(e) =>
              setPicked((prev) => (e.target.checked ? [...prev, s.value] : prev.filter((v) => v !== s.value)))
            }
          >
            {s.label}
          </Checkbox>
        ))}
      </fieldset>
      <label className="grid gap-2xs nf-body">
        <span>Note (only you see it)</span>
        <input className="nf-field" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div>
        <Button type="submit" variant="primary" size="md" disabled={pending || (picked.length === 0 && !position)}>
          Give access
        </Button>
      </div>
      {message ? (
        <p className="nf-body" role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

export function RevokeStaffForm({ userId }: { userId: string }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  return (
    <form
      className="mt-2xs flex flex-wrap items-end gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await revokeStaff({ userId, reason });
          if (!result.ok) setError(result.error);
          else router.refresh();
        });
      }}
    >
      <label className="grid gap-2xs nf-caption">
        <span>Reason (they read it)</span>
        <input className="nf-field" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button type="submit" variant="secondary" size="sm" disabled={pending || reason.trim().length < 5}>
        End access
      </Button>
      {error ? (
        <p className="nf-caption" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
