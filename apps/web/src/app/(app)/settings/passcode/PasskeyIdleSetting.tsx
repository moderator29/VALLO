"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { Switch } from "@/components/ui/Switch";
import { readLongIdle, writeLongIdle } from "@/lib/passcode/idle-setting";
import { platformLockAvailable } from "@/lib/security/webauthn-client";
import { BIO_ENROL_HREF } from "@/components/passcode/biometric-offer";
import { deviceKeyState, type DeviceKeyState } from "@/lib/platform/device-keys";

type BioCopy = Pick<
  Dictionary["passcode"],
  "bioGroup" | "bioRowTitle" | "bioRowUnset" | "bioRowSet" | "bioRowUnsupported"
>;

/**
 * C14 in Settings, Passcode: Face ID or fingerprint (7 October 2026, the
 * founder: "set and build Face ID to work"). The key is the WebAuthn platform
 * key the money lock enrols; the passcode lock accepts the same key, verified
 * on the server, and offers it FIRST with the passcode as the fallback.
 *
 *   no key, device can     a row straight to the enrolment
 *                          (`/settings/privacy/money-lock`, which asks for the
 *                          password as it always has)
 *   no key, device cannot  says so, plainly, instead of a dead link
 *   a key                  says it is offered first, and this phone may wait
 *                          fifteen minutes idle before locking instead of five
 *                          (this device only, which the row says)
 */
export function PasskeyIdleSetting({ hasPasskey: accountHasKey, copy }: { hasPasskey: boolean; copy: BioCopy }) {
  const [on, setOn] = useState(false);
  /* The account may hold a key made on ANOTHER phone (the Face ID bug, 7
     November 2026): this row speaks for this phone (lib/platform/device-keys.ts).
     Until it has been read, it trusts the account, so nothing flashes. */
  const [here, setHere] = useState<DeviceKeyState | null>(null);
  /* Null until asked: the server cannot know what this device can do. */
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setOn(readLongIdle());
    setHere(deviceKeyState());
    let live = true;
    void platformLockAvailable().then((can) => {
      if (live) setSupported(can);
    });
    return () => {
      live = false;
    };
  }, []);

  const hasPasskey = accountHasKey && (here === null || here === "has");
  if (!hasPasskey) {
    return (
      <ListGroup label={copy.bioGroup}>
        {supported === false ? (
          <ListRow title={copy.bioRowTitle} sub={copy.bioRowUnsupported} data-testid="passcode-bio-unsupported" />
        ) : (
          <ListRow
            title={copy.bioRowTitle}
            sub={copy.bioRowUnset}
            href={BIO_ENROL_HREF}
            chevron
            data-testid="passcode-bio-enrol"
          />
        )}
      </ListGroup>
    );
  }

  return (
    <ListGroup label={copy.bioGroup}>
      <ListRow title={copy.bioRowTitle} sub={copy.bioRowSet} href={BIO_ENROL_HREF} chevron data-testid="passcode-bio-manage" />
      <ListRow
        title="Lock after 15 minutes idle"
        sub="Instead of 5, on this phone only. Getting back in is one touch, because this phone holds your key."
        trailing={
          <Switch
            checked={on}
            onCheckedChange={(next) => {
              setOn(next);
              writeLongIdle(next);
            }}
            aria-label="Lock after 15 minutes idle on this phone"
            data-testid="passcode-long-idle"
          />
        }
      />
    </ListGroup>
  );
}
