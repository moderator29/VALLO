"use client";

import { useActionState, useEffect, useState } from "react";
import { banner } from "@/lib/ui/toast";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import type { ActionResult } from "@/lib/actions/envelope";
import { saveEmailPreferences } from "@/lib/email/preferences-actions";
import { INVALID_PREFS_LINK } from "@/lib/email/preferences-refusals";

type Copy = Dictionary["publicDoors"]["prefs"];
type Channel = keyof Copy["channels"];
const ORDER: Channel[] = ["bookings", "messages", "wallet", "marketing"];

/** A12. The four email switches, saved on the authority of the link's token. */
export function PreferencesForm({
  copy,
  token,
  initial,
}: {
  copy: Copy;
  token: string;
  initial: Record<Channel, boolean>;
}) {
  const [values, setValues] = useState(initial);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveEmailPreferences, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) banner(copy.saved, { tone: "success", "data-testid": "prefs-saved" });
    else banner.error(state.error === INVALID_PREFS_LINK ? `${copy.invalidTitle}. ${copy.invalidBody}` : copy.failed);
    // Once per answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="grid gap-md">
      <input type="hidden" name="token" value={token} />
      <ul className="nf-list-group">
        {ORDER.map((channel) => (
          <li key={channel} className="nf-list-item">
            <div className="nf-list-row nf-list-row--two">
              <input type="hidden" name={channel} value={values[channel] ? "on" : "off"} />
              <Switch
                checked={values[channel]}
                onCheckedChange={(next) => setValues((prev) => ({ ...prev, [channel]: next }))}
                label={copy.channels[channel].title}
                description={copy.channels[channel].body}
                data-testid={`prefs-${channel}`}
                className="w-full"
              />
            </div>
          </li>
        ))}
      </ul>
      <Button type="submit" variant="primary" size="lg" full loading={pending} data-testid="prefs-save">
        {copy.save}
      </Button>
      {/* Saved or refused, said by the one banner at the top of the screen (founder, 7 November 2026). */}
    </form>
  );
}
