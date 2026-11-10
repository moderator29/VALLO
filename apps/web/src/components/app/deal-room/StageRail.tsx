import type { CSSProperties } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { fourAnswers, type TrackModel } from "./model";
import type { DealRoom } from "@/lib/offers/types";
import "@/components/app/offers/offers.css";

const SPOKEN = { done: "done", current: "in progress", upcoming: "not yet", failed: "stopped here" } as const;

/**
 * THE STAGE RAIL. Stages advance on recorded events only. The fill glides to the
 * current stage and the current node pops, once on arrival; done nodes check in.
 * Vertical on a phone, horizontal on a desktop. Under reduced motion, Calm and
 * Off the rail simply draws its final state. A shape differs per state (check,
 * ring, hollow, square) so colour is never the only signal.
 */
export function StageRail({ steps, label = "Deal progress", testId }: { steps: TrackModel[]; label?: string; testId?: string }) {
  const at = steps.findIndex((s) => s.state === "current" || s.state === "failed");
  const reached = at >= 0 ? at : steps.every((s) => s.state === "done") ? steps.length - 1 : 0;
  const p = steps.length > 1 ? reached / (steps.length - 1) : 0;
  return (
    <ol className="nf-rail" aria-label={label} data-testid={testId} style={{ "--nf-rail-p": p } as CSSProperties}>
      <span className="nf-rail__line" aria-hidden="true" />
      <span className="nf-rail__fill" aria-hidden="true" />
      {steps.map((s, i) => (
        <li key={s.key} className="nf-rail__step" data-state={s.state} aria-current={s.state === "current" ? "step" : undefined} style={{ "--nf-i": i } as CSSProperties}>
          <span className="nf-rail__node" aria-hidden="true">
            {s.state === "done" ? (
              <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
                <path className="nf-rail__tick" d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
              </svg>
            ) : s.state === "failed" ? (
              <UiIcon name="close" size={12} />
            ) : null}
          </span>
          <span className="nf-rail__label">
            {s.label}
            <span className="sr-only">, {SPOKEN[s.state]}</span>
          </span>
          <span className="nf-rail__when">{s.note ?? s.when ?? ""}</span>
        </li>
      ))}
    </ol>
  );
}

const STRIP: { key: keyof ReturnType<typeof fourAnswers>; label: string; icon: UiIconName }[] = [
  { key: "happened", label: "What has happened", icon: "history" },
  { key: "waiting", label: "What is waiting", icon: "hourglass" },
  { key: "turn", label: "Whose turn it is", icon: "user" },
  { key: "deadline", label: "Deadline", icon: "calendar-clock" },
];

/** The four answers as one compact strip: a column each on a desktop, stacked rows on a phone. */
export function FourStrip({ room, nowMs }: { room: DealRoom; nowMs: number }) {
  const a = fourAnswers(room, nowMs);
  const yourMove = room.offer.state === "open" && room.offer.turn === room.viewerSide;
  return (
    <dl className="nf-strip" data-testid="four-questions">
      {STRIP.map((item) => (
        <div key={item.key} className="nf-strip__item" data-hot={item.key === "turn" && yourMove ? "" : undefined}>
          <span aria-hidden="true" className="text-[var(--nf-brand-primary)]">
            <UiIcon name={item.icon} size={20} />
          </span>
          <div className="min-w-0">
            <dt className="nf-strip__label">{item.label}</dt>
            <dd className="nf-strip__value">{a[item.key]}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
