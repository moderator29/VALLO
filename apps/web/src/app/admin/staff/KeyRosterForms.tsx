"use client";

import { countOf } from "@vallo/i18n/core";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { clearConsoleKeys, markInternalByEmail, setInternalAccount } from "@/lib/admin/key-roster-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * C14 break-glass: a SECOND super admin revokes a person's keys FOR THE
 * CONSOLE after confirming who they are (docs/SUPPORT_STAFF.md, "A lost
 * console key"). The keys keep serving the money lock and passcode; the
 * console refuses them and offers the person a new key. Audited.
 */
export function ClearKeysForm({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) {
    return (
      <Button type="button" variant="quiet" size="sm" onClick={() => setOpen(true)}>
        Lost their key? Revoke it for the console
      </Button>
    );
  }
  return (
    <form
      className="mt-2xs grid gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const result = await clearConsoleKeys({ userId, reason });
            if (!result.ok) setMessage({ ok: false, text: result.error });
            else {
              setMessage({
                ok: true,
                text: `${countOf(result.data.removed, "keysRevoked", "en")} ${name} sets up a new key at their next console visit.`,
              });
              router.refresh();
            }
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <p className="nf-caption">
        Only after you have confirmed it is really {name}, on a call or in person. Their current keys stop opening the
        console at once; they still work for that person&apos;s own money lock and passcode.
      </p>
      <label className="grid gap-2xs nf-caption">
        <span>Reason (goes in the audit log)</span>
        <input className="nf-field" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="danger" size="sm" disabled={pending || reason.trim().length < 10}>
          Revoke for the console
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {message ? (
        <p className="nf-caption" role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

/** C10: "Leave out of figures" for one person. Staff are always left out; this is for anybody else. */
export function InternalSwitch({ userId, name, initial }: { userId: string; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2xs">
      <Switch
        checked={on}
        disabled={pending}
        label="Leave out of figures"
        description="QA and test accounts. Staff are left out already."
        aria-label={`Leave ${name} out of figures`}
        onCheckedChange={(next) => {
          setOn(next);
          start(async () => {
            try {
              const result = await setInternalAccount({ userId, internal: next, reason: next ? "Marked internal on the staff page" : "" });
              if (!result.ok) {
                setOn(!next);
                setError(result.error);
              } else setError(null);
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          });
        }}
      />
      {error ? (
        <p className="nf-caption" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** C10: add somebody to the list by email. */
export function MarkInternalForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="mt-row flex flex-wrap items-end gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const result = await markInternalByEmail({ email });
            if (!result.ok) setMessage({ ok: false, text: result.error });
            else {
              setMessage({ ok: true, text: "Left out of figures from now on." });
              setEmail("");
              router.refresh();
            }
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <label className="grid gap-2xs nf-caption">
        <span>Email address</span>
        <input className="nf-field" type="email" value={email} maxLength={320} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <Button type="submit" variant="secondary" size="sm" disabled={pending || email.trim().length < 5}>
        Leave out of figures
      </Button>
      {message ? (
        <p className="nf-caption" role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
