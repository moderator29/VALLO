"use client";

import { countOf } from "@vallo/i18n/core";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { clearConsoleKeys, markInternalByEmail, setInternalAccount } from "@/lib/admin/key-roster-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * C14 break-glass: a SECOND super admin revokes a person's keys FOR THE
 * CONSOLE after confirming who they are (docs/SUPPORT_STAFF.md, "A lost
 * console key"). The keys keep serving the money lock and passcode; the
 * console refuses them and offers the person a new key. Audited.
 */
export function ClearKeysForm({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  function revokeKeys() {
    start(async () => {
      try {
        const result = await clearConsoleKeys({ userId, reason });
        if (!result.ok) banner.error(result.error, { retry: revokeKeys });
        else {
          banner.success(`${countOf(result.data.removed, "keysRevoked", "en")} ${name} sets up a new key at their next console visit.`);
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

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
        revokeKeys();
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
    </form>
  );
}

/** C10: "Leave out of figures" for one person. Staff are always left out; this is for anybody else. */
export function InternalSwitch({ userId, name, initial }: { userId: string; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useSafeTransition();

  function flip(next: boolean) {
    setOn(next);
    start(async () => {
      try {
        const result = await setInternalAccount({ userId, internal: next, reason: next ? "Marked internal on the staff page" : "" });
        if (!result.ok) {
          setOn(!next);
          banner.error(result.error, { retry: () => flip(next) });
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="grid gap-2xs">
      <Switch
        checked={on}
        disabled={pending}
        label="Leave out of figures"
        description="QA and test accounts. Staff are left out already."
        aria-label={`Leave ${name} out of figures`}
        onCheckedChange={flip}
      />
    </div>
  );
}

/** C10: add somebody to the list by email. */
export function MarkInternalForm() {
  const [email, setEmail] = useState("");
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  function markInternal() {
    start(async () => {
      try {
        const result = await markInternalByEmail({ email });
        if (!result.ok) banner.error(result.error, { retry: markInternal });
        else {
          banner.success("Left out of figures from now on.");
          setEmail("");
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <form
      className="mt-row flex flex-wrap items-end gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        markInternal();
      }}
    >
      <label className="grid gap-2xs nf-caption">
        <span>Email address</span>
        <input className="nf-field" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} maxLength={320} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <Button type="submit" variant="secondary" size="sm" disabled={pending || email.trim().length < 5}>
        Leave out of figures
      </Button>
    </form>
  );
}
