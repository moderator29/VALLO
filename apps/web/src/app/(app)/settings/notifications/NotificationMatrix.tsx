"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "./notification-settings.css";
import { updateSettings } from "@/lib/profile/actions";
import type {
  NotificationTopic,
  ResolvedProfileSettings,
} from "@/lib/profile/model";
import type { Dictionary } from "@vallo/i18n/core";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * NOTIFICATION SETTINGS AS A REAL MATRIX (R3-14): event by channel, and quiet
 * hours.
 *
 * Every cell is a preference delivery actually reads, and no cell is a control
 * that does nothing:
 *
 *   Email  the topic's own boolean in `profiles.settings.notifications`,
 *          which `lib/email/recipients.ts` reads for email and
 *          `private.notify` for the in-app row. Payments' is stored under
 *          `wallet` until Session 2's rename (R3-31).
 *   Push   `notifications.channels.<topic>.push`, which `wantsPush` reads
 *          first (lib/push/preferences.ts, rule 1). Shown as the policy would
 *          decide it today: the explicit answer, else the topic's boolean,
 *          else on (marketing: off).
 *   Quiet  `notifications.quiet_hours`, read by `readQuietHours`; payments are
 *          the one kind that ignores it (`isUrgentKind`).
 *
 * Price drops are push-only (B13), so their email cell is a sentence, not a
 * switch. Optimistic, reverting on refusal, like every settings toggle.
 *
 * Its words are `experienceSettings.notifications`, handed down by the page.
 * The `wallet` above is the storage key only (D48); the row reads "Payments".
 */
export type NotificationMatrixCopy =
  Dictionary["experienceSettings"]["notifications"];

type Row =
  | "bookings"
  | "messages"
  | "payments"
  | "savedPriceDrops"
  | "marketing";
type Flags = ResolvedProfileSettings["notifications"];

const STORED_FLAG = {
  bookings: "bookings",
  messages: "messages",
  payments: "wallet",
  marketing: "marketing",
} as const;
const PUSH_TOPIC: Partial<Record<Row, NotificationTopic>> = {
  bookings: "bookings",
  messages: "messages",
  payments: "wallet",
  marketing: "marketing",
};
const ROWS: readonly Row[] = [
  "bookings",
  "messages",
  "payments",
  "savedPriceDrops",
  "marketing",
];

/* The soft plate beside each event (the founder's reference 1: a rounded
   square icon plate, a plain label, a wide capsule toggle). The same glyphs
   the inbox files these events under, so the two screens agree. */
const ROW_GLYPH: Record<Row, UiIconName> = {
  bookings: "calendar-booking",
  messages: "chat-bubble",
  payments: "receipt",
  savedPriceDrops: "price-tag",
  marketing: "mail",
};

/** The push answer as `wantsPush` would give it for this row today. */
export function pushFor(row: Row, flags: Flags): boolean {
  if (row === "savedPriceDrops") return flags.savedPriceDrops ?? true;
  const topic = PUSH_TOPIC[row] as NotificationTopic;
  const explicit = flags.channels?.[topic]?.push;
  if (typeof explicit === "boolean") return explicit;
  const legacy = flags[STORED_FLAG[row as keyof typeof STORED_FLAG]];
  if (typeof legacy === "boolean") return legacy;
  return row !== "marketing";
}

export function NotificationMatrix({
  initial,
  copy,
}: {
  initial: Flags;
  copy: NotificationMatrixCopy;
}) {
  const [flags, setFlags] = useState<Flags>(initial);
  const [quiet, setQuiet] = useState(
    initial.quiet_hours ?? {
      enabled: false,
      from: "22:00",
      to: "07:00",
      timezone: "Africa/Lagos",
    }
  );
  const [note, setNote] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [pending, start] = useTransition();

  const save = (
    patch: Parameters<typeof updateSettings>[0],
    revert: () => void
  ) => {
    setNote(null);
    start(async () => {
      try {
        const result = await updateSettings(patch);
        if (result.ok) {
          setFlags(result.data.notifications);
          setNote({ tone: "ok", text: copy.saved });
          return;
        }
        revert();
        setNote({ tone: "error", text: result.error });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const setEmail = (row: Exclude<Row, "savedPriceDrops">, next: boolean) => {
    const previous = flags;
    const key = STORED_FLAG[row];
    setFlags({ ...flags, [key]: next });
    save({ notifications: { [key]: next } }, () => setFlags(previous));
  };

  const setPush = (row: Row, next: boolean) => {
    const previous = flags;
    if (row === "savedPriceDrops") {
      setFlags({ ...flags, savedPriceDrops: next });
      save({ notifications: { savedPriceDrops: next } }, () =>
        setFlags(previous)
      );
      return;
    }
    const topic = PUSH_TOPIC[row] as NotificationTopic;
    setFlags({
      ...flags,
      channels: { ...(flags.channels ?? {}), [topic]: { push: next } },
    });
    save({ notifications: { channels: { [topic]: { push: next } } } }, () =>
      setFlags(previous)
    );
  };

  return (
    <div className="nf-nset" data-testid="notification-matrix">
      <section className="nf-nset__group" aria-labelledby="nf-matrix-title">
        <h2 id="nf-matrix-title" className="nf-section-label nf-nset__label">
          {copy.title}
        </h2>
        {/* Still a table (R3-14): an event by channel grid read cell by cell
            by a screen reader. Drawn as the grouped list's card, each event a
            row with its plate, each channel a capsule toggle. */}
        <table className="nf-nset__table">
          <caption className="sr-only">{copy.caption}</caption>
          <thead>
            <tr className="nf-nset__head">
              <th scope="col" className="nf-nset__col nf-nset__col--event">
                {copy.colEvent}
              </th>
              <th scope="col" className="nf-nset__col">
                {copy.colEmail}
              </th>
              <th scope="col" className="nf-nset__col">
                {copy.colPush}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const words = copy.rows[row];
              const headId = `nf-matrix-${row}`;
              return (
                <tr
                  key={row}
                  className="nf-nset__row"
                  data-testid={`matrix-row-${row}`}
                >
                  <th scope="row" id={headId} className="nf-nset__event">
                    <span className="nf-nset__event-inner">
                      <IconPlate size="sm" tone="neutral">
                        <UiIcon
                          name={ROW_GLYPH[row]}
                          size={ICON_PLATE_GLYPH.sm}
                        />
                      </IconPlate>
                      <span className="nf-nset__words">
                        <span className="nf-nset__title">{words.label}</span>
                        <span className="nf-nset__sub">{words.sub}</span>
                      </span>
                    </span>
                  </th>
                  <td className="nf-nset__cell">
                    {row === "savedPriceDrops" ? (
                      <span className="nf-nset__none">{copy.notEmailed}</span>
                    ) : (
                      <span className="inline-flex justify-center">
                        <Switch
                          checked={
                            flags[STORED_FLAG[row]] ?? row !== "marketing"
                          }
                          onCheckedChange={(next) => setEmail(row, next)}
                          aria-label={`${words.label}: ${copy.colEmail}`}
                          disabled={pending}
                          data-testid={`matrix-${row}-email`}
                        />
                      </span>
                    )}
                  </td>
                  <td className="nf-nset__cell">
                    <span className="inline-flex justify-center">
                      <Switch
                        checked={pushFor(row, flags)}
                        onCheckedChange={(next) => setPush(row, next)}
                        aria-label={`${words.label}: ${copy.colPush}`}
                        disabled={pending}
                        data-testid={`matrix-${row}-push`}
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="nf-nset__note">{copy.note}</p>
      </section>

      <section
        className="nf-nset__group"
        aria-labelledby="nf-quiet-title"
        data-testid="quiet-hours"
      >
        <h2 id="nf-quiet-title" className="nf-section-label nf-nset__label">
          {copy.quiet.title}
        </h2>
        <div className="nf-nset__card">
          <div className="nf-nset__quiet-row">
            <IconPlate size="sm" tone="neutral">
              <UiIcon name="moon" size={ICON_PLATE_GLYPH.sm} />
            </IconPlate>
            <Switch
              label={copy.quiet.switch}
              description={copy.quiet.sub}
              checked={quiet.enabled}
              onCheckedChange={(next) => setQuiet({ ...quiet, enabled: next })}
              disabled={pending}
            />
          </div>
          <div className="nf-nset__times">
            <label className="grid gap-2xs">
              <span className="nf-caption text-[var(--nf-content-muted)]">
                {copy.quiet.from}
              </span>
              <input
                type="time"
                className="nf-field"
                value={quiet.from}
                onChange={(e) =>
                  setQuiet({ ...quiet, from: e.currentTarget.value })
                }
                disabled={pending}
              />
            </label>
            <label className="grid gap-2xs">
              <span className="nf-caption text-[var(--nf-content-muted)]">
                {copy.quiet.to}
              </span>
              <input
                type="time"
                className="nf-field"
                value={quiet.to}
                onChange={(e) =>
                  setQuiet({ ...quiet, to: e.currentTarget.value })
                }
                disabled={pending}
              />
            </label>
          </div>
          <p className="nf-nset__zone">{copy.quiet.zone}</p>
          <div className="nf-nset__save">
            <Button
              variant="secondary"
              size="md"
              loading={pending}
              onClick={() => {
                const previous = flags.quiet_hours;
                save(
                  {
                    notifications: {
                      quiet_hours: { ...quiet, timezone: "Africa/Lagos" },
                    },
                  },
                  () =>
                    setQuiet(
                      previous ?? {
                        enabled: false,
                        from: "22:00",
                        to: "07:00",
                        timezone: "Africa/Lagos",
                      }
                    )
                );
              }}
              data-testid="quiet-save"
            >
              {copy.quiet.save}
            </Button>
          </div>
        </div>
      </section>

      {note ? (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          className={`nf-body-sm ${
            note.tone === "error"
              ? "text-[var(--nf-state-error)]"
              : "text-[var(--nf-state-success)]"
          }`}
        >
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
