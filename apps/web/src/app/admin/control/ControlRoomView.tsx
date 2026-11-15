import Link from "next/link";
import type { ControlRoom } from "@/lib/admin/control/read";
import { setupFileHref, type SetupState } from "@/lib/admin/control/setup";
import { Badge, type BadgeTone } from "../_components/Badge";
import { PageHead, Panel } from "../_components/panels";

/**
 * THE CONTROL ROOM, DRAWN (the founder, 15 November 2026). Takes what
 * `readControlRoom` read and draws it; it reads nothing itself, so the
 * preview can draw it from recorded answers.
 */

const SETUP_WORDS: Record<SetupState, { label: string; tone: BadgeTone }> = {
  ready: { label: "Ready", tone: "success" },
  waiting: { label: "Waiting to be run", tone: "pending" },
  unknown: { label: "Could not be read", tone: "info" },
};

const LINK = "font-semibold text-[var(--nf-content-link)] underline underline-offset-2";
const ROW = "flex flex-col gap-2xs border-t border-[var(--nf-border-subtle)] py-sm first:border-t-0 first:pt-0 last:pb-0";
const TITLE = "nf-body font-semibold text-[var(--nf-content-primary)] break-words";
const WORDS = "nf-body-sm text-[var(--nf-content-secondary)] break-words";

export function ControlRoomView({ room }: { room: Extract<ControlRoom, { state: "ok" }> }) {
  const waitingSetup = room.setup.filter((r) => r.state === "waiting");
  const attention = room.setup.filter((r) => r.state !== "ready");
  const ready = room.setup.filter((r) => r.state === "ready");
  const setupRow = ({ item, state }: (typeof room.setup)[number]) => (
    <li key={item.key} className={ROW} data-testid={`control-setup-${item.key}`} data-state={state}>
      <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs">
        <p className={TITLE}>{item.title}</p>
        <Badge tone={SETUP_WORDS[state].tone}>{SETUP_WORDS[state].label}</Badge>
      </div>
      <p className={WORDS}>{item.unlocks}</p>
      {state !== "ready" ? (
        <p className={WORDS}>
          The file to run:{" "}
          <a href={setupFileHref(item.file)} className={LINK} target="_blank" rel="noreferrer">
            {item.file}
          </a>
        </p>
      ) : null}
    </li>
  );
  return (
    <div className="nf-console nf-admin-stack" data-testid="control-room">
      <PageHead
        title="Control room"
        lede="What is waiting on you, what the database has in place, how the main switches stand and which services are set up. This page only reads; nothing here changes anything."
      />

      <Panel title="Waiting on you" id="waiting">
        {room.waiting.length === 0 ? (
          <p className={WORDS} data-testid="control-nothing-waiting">
            Nothing is waiting on you right now.
          </p>
        ) : (
          <ul role="list" data-testid="control-waiting">
            {room.waiting.map((line) => (
              <li key={line.key} className={ROW}>
                <p className={TITLE}>{line.words}</p>
                <p className={WORDS}>
                  <Link href={line.href} className={LINK}>
                    Open them
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Database setup" id="setup">
        <p className={`${WORDS} mb-sm`} data-testid="control-setup-summary">
          {waitingSetup.length === 0
            ? "Every part listed here is in place on the live database."
            : waitingSetup.length === 1
              ? "1 part is waiting for its SQL to be run. Open the file, copy all of it, and run it in the Supabase SQL editor. It is safe to run twice."
              : `${waitingSetup.length} parts are waiting for their SQL to be run. Open each file, copy all of it, and run it in the Supabase SQL editor. Each is safe to run twice.`}
        </p>
        {attention.length > 0 ? <ul role="list">{attention.map(setupRow)}</ul> : null}
        {ready.length > 0 ? (
          <details className="mt-sm" data-testid="control-setup-ready" open={attention.length === 0}>
            <summary className={`${TITLE} cursor-pointer`}>
              {ready.length === 1 ? "1 part is in place" : `${ready.length} parts are in place`}
            </summary>
            <ul role="list" className="mt-sm">
              {ready.map(setupRow)}
            </ul>
          </details>
        ) : null}
      </Panel>

      <Panel
        title="Main switches"
        id="switches"
        action={
          <Link href="/admin/switches" className={LINK}>
            Change a switch
          </Link>
        }
      >
        <ul role="list">
          {room.switches.map(({ note, state }) => (
            <li key={note.key} className={ROW} data-testid={`control-switch-${note.key}`} data-state={state}>
              <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs">
                <p className={TITLE}>{note.title}</p>
                <Badge tone={state === "on" ? "success" : "info"}>{state === "on" ? "On" : state === "off" ? "Off" : "Not set"}</Badge>
              </div>
              <p className={WORDS}>{state === "on" ? note.on : note.off}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Services this site can reach"
        id="connections"
        action={
          <Link href="/admin/operations/providers" className={LINK}>
            Test them
          </Link>
        }
      >
        <ul role="list">
          {room.connections.map((c) => (
            <li key={c.key} className={ROW} data-testid={`control-connection-${c.key}`} data-ready={c.ready ? "yes" : "no"}>
              <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs">
                <p className={TITLE}>{c.title}</p>
                <Badge tone={c.ready ? "success" : "pending"}>{c.ready ? "Set up" : "Not set up"}</Badge>
              </div>
              <p className={WORDS}>{c.meaning}</p>
            </li>
          ))}
        </ul>
        <p className={`${WORDS} mt-sm`}>Each service is connected in Vercel, never here. This page shows only whether it is connected, never a secret.</p>
      </Panel>

      <Panel title="Go to" id="go">
        <ul role="list" className="grid gap-xs sm:grid-cols-2">
          {[
            { href: "/admin/escalations", label: "Escalations" },
            { href: "/admin/staff", label: "Staff access" },
            { href: "/admin/switches", label: "Switches" },
            { href: "/admin/alerts", label: "Alerts" },
            { href: "/admin/audit", label: "Audit log" },
            { href: "/admin/copilot", label: "Copilot" },
          ].map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={LINK}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
