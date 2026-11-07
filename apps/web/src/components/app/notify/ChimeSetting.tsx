"use client";

import { useState, useSyncExternalStore } from "react";
import { RowSwitch, SettingsGroup } from "@/components/app/account/rows";
import { chimeOn, setChimeOn } from "@/lib/platform/chime";

/**
 * "Sound for in-app alerts" (FEATURE_BACKLOG A9): the switch for the soft
 * chime the live banner plays (`lib/platform/chime.ts`). Kept on this device,
 * as the chime is: it never sounds in silent mode or more than once in 3 s
 * whatever this says. On until the member turns it off.
 */
const subscribe = () => () => undefined;

export function ChimeSetting() {
  /* The device's answer after hydration; the server draws it on. */
  const stored = useSyncExternalStore(subscribe, chimeOn, () => true);
  const [override, setOverride] = useState<boolean | null>(null);
  const on = override ?? stored;
  return (
    <SettingsGroup label="In-app alerts">
      <RowSwitch
        icon="volume"
        label="Sound for in-app alerts"
        sub="A soft chime when a banner arrives while you are in Vallo. Never in silent mode."
        value={on ? "On" : "Off"}
        checked={on}
        onChange={(next) => {
          setChimeOn(next);
          setOverride(next);
        }}
        testId="settings-chime"
      />
    </SettingsGroup>
  );
}
