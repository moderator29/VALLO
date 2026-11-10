"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Check";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { shareOrCopy } from "@/lib/ui/clipboard";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";

import { fill } from "@/components/roommates/format";
import "@/components/roommates/roommates-welcome.css";

const KEY = "vallo.roommates.checklist.v1";

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function write(v: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* No storage: the ticks last for this visit. */
  }
}

export function Checklist() {
  const copy = useScopedCopy("roommates");
  const T = copy.tools;
  const P = T.checklistPage;
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's ticks are read after hydration, so server and first client render agree
    setDone(read());
  }, []);
  const all = P.groups.flatMap((g) => g.items);
  const set = (next: string[]) => {
    setDone(next);
    write(next);
  };
  const text = P.groups.map((g) => `${g.title}\n${g.items.map((i) => `${done.includes(i) ? "[x]" : "[ ]"} ${i}`).join("\n")}`).join("\n\n");
  return (
    <div className="nf-rmtp" data-testid="move-in-checklist">
      <p className="nf-rmtp__progress" aria-live="polite">
        {fill(P.progress, { done: done.filter((d) => all.includes(d)).length, total: all.length })}
      </p>
      {P.groups.map((g) => (
        <section key={g.title} className="nf-rmtp__group">
          <h2 className="nf-rmtp__head">{g.title}</h2>
          <ul className="nf-rmtp__list">
            {g.items.map((i) => (
              <li key={i}>
                <Checkbox checked={done.includes(i)} onChange={(e) => set(e.target.checked ? [...done, i] : done.filter((d) => d !== i))}>
                  {i}
                </Checkbox>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="nf-rmtp__actions">
        <Button
          variant="primary"
          size="md"
          leadingIcon="link"
          onClick={async () => {
            const r = await shareOrCopy({ text, title: P.title });
            if (r === "copied") banner.success(T.copied);
            else if (r === "shared") banner.success(T.shared);
            else if (r === "failed") banner.error(T.copyFailed);
          }}
        >
          {T.copy}
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={done.length === 0}
          onClick={() => {
            const before = done;
            set([]);
            bannerWithUndo(T.resetDone, { label: copy.area.undo, undone: copy.area.undone, undo: async () => ({ ok: true }), onUndone: () => set(before) });
          }}
        >
          {T.reset}
        </Button>
      </div>
    </div>
  );
}
