import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { ControlRoom } from "@/lib/admin/control/read";
import { earningsSentence, setupFileHref, type SetupState } from "@/lib/admin/control/setup";
import { Badge, type BadgeTone } from "../_components/Badge";
import { PageHead, Panel } from "../_components/panels";
import { formatMoney, plural } from "@vallo/i18n/core";

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
          /* Each line is the way to what it counts: one row, tapped anywhere. */
          <ul role="list" className="nf-admin-linkrows" data-testid="control-waiting">
            {room.waiting.map((line) => (
              <li key={line.key}>
                <Link href={line.href} className="nf-admin-linkrow">
                  <span className="nf-admin-linkrow__label">{line.words}</span>
                  <UiIcon name="chevron-right" size={18} className="nf-admin-linkrow__chev" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Who can read Vallo" id="reach">
        <div className={ROW} data-testid="control-reach" data-open={room.reach.open ? "yes" : "no"}>
          <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs">
            <p className={TITLE}>{room.reach.title}</p>
            <Badge tone={room.reach.open ? "success" : "info"}>{room.reach.open ? "Open to everybody" : "Account needed"}</Badge>
          </div>
          <p className={WORDS}>{room.reach.meaning}</p>
          {!room.reach.open ? <p className={WORDS}>{room.reach.howToChange}</p> : null}
        </div>
        <p className={`${WORDS} mt-sm`}>
          Nothing on Vallo is closed to a country. Somebody outside Nigeria can sign up, search, message, book a stay and pay by card today, and
          sees prices in their own currency beside the naira figure. A lister still needs a Nigerian bank account to be paid.
        </p>
      </Panel>

      <Panel title="Database setup" id="setup">
        <p className={`${WORDS} mb-sm`} data-testid="control-setup-summary">
          {waitingSetup.length === 0
            ? "Every part listed here is in place on the live database."
            : plural(waitingSetup.length, {
                one: "{count} part is waiting for its SQL to be run. Open the file, copy all of it, and run it in the Supabase SQL editor. It is safe to run twice.",
                other: "{count} parts are waiting for their SQL to be run. Open each file, copy all of it, and run it in the Supabase SQL editor. Each is safe to run twice.",
              })}
        </p>
        {attention.length > 0 ? <ul role="list">{attention.map(setupRow)}</ul> : null}
        {ready.length > 0 ? (
          <details className="mt-sm" data-testid="control-setup-ready" open={attention.length === 0}>
            <summary className={`${TITLE} cursor-pointer`}>
              {plural(ready.length, { one: "{count} part is in place", other: "{count} parts are in place" })}
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

      {room.earnings ? (
        <Panel title="Vallo's own earnings" id="earnings">
          <ul role="list" data-testid="control-earnings">
            <li className={ROW}>
              <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs">
                <p className={TITLE}>Still at the payment partner</p>
                <Badge tone={room.earnings.stuck ? "pending" : "info"} data-testid="control-earnings-at-partner">
                  {formatMoney(room.earnings.atPartnerMinor, "en")}
                </Badge>
              </div>
              <p className={WORDS}>
                {earningsSentence(
                  room.earnings,
                  room.switches.find((s) => s.note.key === "payments_escrowpay_sweep_on")?.state === "on",
                  room.connections.find((c) => c.key === "sweep_destination")?.ready === true,
                )}
              </p>
              <p className={WORDS}>This is Vallo&apos;s own money, never a member&apos;s. A lister is paid straight to their own bank when a payment is released.</p>
            </li>
            <li className={ROW}>
              <p className={TITLE}>Moved to the bank in the last 30 days</p>
              <p className={WORDS} data-testid="control-earnings-30d">
                {formatMoney(room.earnings.swept30dMinor, "en")}
              </p>
            </li>
            <li className={ROW} data-testid="control-earnings-last">
              <p className={TITLE}>The last sweep</p>
              {room.earnings.last ? (
                <p className={WORDS}>
                  {formatMoney(room.earnings.last.amountMinor, "en")}, {room.earnings.last.status}
                  {room.earnings.last.settledAt ? `, ${room.earnings.last.settledAt.slice(0, 10)}` : ""}.
                  {room.earnings.last.failure ? ` ${room.earnings.last.failure}` : ""}
                </p>
              ) : (
                <p className={WORDS}>Nothing has been swept yet.</p>
              )}
            </li>
          </ul>
        </Panel>
      ) : null}

      <Panel title="Go to" id="go">
        <ul role="list" className="nf-admin-linkrows">
          {[
            { href: "/admin/escalations", label: "Escalations" },
            { href: "/admin/staff", label: "Staff access" },
            { href: "/admin/switches", label: "Switches" },
            { href: "/admin/alerts", label: "Alerts" },
            { href: "/admin/audit", label: "Audit log" },
            { href: "/admin/copilot", label: "Copilot" },
          ].map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="nf-admin-linkrow">
                <span className="nf-admin-linkrow__label">{link.label}</span>
                <UiIcon name="chevron-right" size={18} className="nf-admin-linkrow__chev" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
