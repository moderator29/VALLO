"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { useMotionGate } from "@/components/motion/useMotionGate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  BOARD_MEASURE,
  BOARD_SHORT,
  CLIMB_ACTION,
  EMPTY_BODY,
  ERROR_BODY,
  ERROR_TITLE,
  GROUP_LABEL,
  LEADERBOARD_TITLE,
  NOT_LIVE_BODY,
  NOT_LIVE_TITLE,
  NOT_ON_BOARD,
  OPT_OUT_BODY,
  OPT_OUT_LABEL,
  PERIOD_LABEL,
  PRIVACY_LINE,
  emptyTitle,
  periodSubtitle,
  placeWord,
  youPill,
} from "@/lib/leaderboard/copy";
import {
  TOP_BOARDS,
  boardHref,
  groupOf,
  myRow,
  podium,
  restOf,
  type Board,
  type BoardGroup,
  type LeaderRow,
  type Period,
  type Scope,
  type TopBoard,
} from "@/lib/leaderboard/model";
import type { BoardRead, Visibility } from "@/lib/leaderboard/read";
import { BoardObject, ClimbExplainer, EarnedMoment, ShareRank } from "./overlays";
import { Beams, Podium, RankRows, ScopeToggle } from "./parts";
import "./leaderboard.css";
import "./leaderboard-motion.css";

export type SetHidden = (hidden: boolean, businessId?: string) => Promise<{ ok: boolean }>;

/**
 * /leaderboard (D76). The founder's reference, built to the Plasma level:
 * header with back and a "how to climb" circle, Referrals or Top on Vallo
 * (Agents, Hotels, Restaurants), the stage with its spotlights and podium,
 * the City / Global pill on the podium, ranks 4 and on in the sheet, the
 * floating "You, #rank" pill, the share card, and the earned moment when the
 * member is in the top three. Every figure is a count from the read; an
 * empty board says so and offers the next step.
 */
export function LeaderboardScreen({
  board,
  period,
  read,
  visibility,
  setHidden,
  base = "/leaderboard",
  nowIso,
  earnedOpen,
  initialScope = "city",
}: {
  board: Board;
  period: Period;
  read: BoardRead;
  visibility: Visibility;
  setHidden: SetHidden | null;
  /** The route the switches navigate within (the preview harness passes its own). */
  base?: string;
  /** The moment the subtitle names; the server's clock, so both renders agree. */
  nowIso: string;
  /** Opens the earned moment on first paint (the preview harness only). */
  earnedOpen?: boolean;
  initialScope?: Scope;
}) {
  const router = useRouter();
  const { quiet } = useMotionGate();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [explainer, setExplainer] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [earned, setEarned] = useState(earnedOpen === true);
  const [settled, setSettled] = useState(false);
  const [hidden, setHiddenState] = useState(visibility?.hidden ?? false);

  const rows: LeaderRow[] = useMemo(
    () => (read.state === "ready" ? (scope === "city" ? read.city : read.global) : []),
    [read, scope],
  );
  const me = useMemo(() => myRow(rows), [rows]);
  const top = podium(rows);
  const rest = restOf(rows);
  const place = placeWord(scope, read.place.name);
  const subtitle = periodSubtitle(period, new Date(nowIso));
  const group = groupOf(board);

  const go = useCallback(
    (nextBoard: Board, nextPeriod: Period) => {
      startTransition(() => router.replace(boardHref(nextBoard, nextPeriod, base), { scroll: false }));
    },
    [router, base],
  );

  /* The earned moment: once per board, period, scope, rank and month, after the podium settles. */
  const earnedKey = me && me.rank <= 3 ? `nf-lb-earned:${board}:${period}:${scope}:${me.rank}:${subtitle}` : null;
  useEffect(() => {
    /* After the entrance, rows that arrive on a re-rank rise without waiting for it. */
    const t = window.setTimeout(() => setSettled(true), 1800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (earnedOpen || !earnedKey) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(earnedKey) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    const t = window.setTimeout(() => setEarned(true), quiet ? 0 : 1700);
    return () => window.clearTimeout(t);
  }, [earnedKey, earnedOpen, quiet]);

  const closeEarned = useCallback(() => {
    setEarned(false);
    if (!earnedKey) return;
    try {
      window.localStorage.setItem(earnedKey, "1");
    } catch {
      /* A private window forgets; the moment shows again, which is harmless. */
    }
  }, [earnedKey]);

  const toMe = () => {
    if (!me) {
      setExplainer(true);
      return;
    }
    const target = me.rank <= 3 ? document.getElementById("lb-stage") : document.getElementById("lb-me");
    target?.scrollIntoView({ behavior: quiet ? "auto" : "smooth", block: "center" });
  };

  const shareUrl = typeof window === "undefined" ? boardHref(board, period, base) : `${window.location.origin}${boardHref(board, period, "/leaderboard")}`;

  const toggleHidden = async (show: boolean) => {
    if (!setHidden) return;
    setHiddenState(!show);
    const res = await setHidden(!show);
    if (!res.ok) setHiddenState(show);
  };

  const groupOptions = [
    { value: "referrals" as BoardGroup, label: GROUP_LABEL.referrals },
    { value: "top" as BoardGroup, label: GROUP_LABEL.top },
  ];
  const subOptions = TOP_BOARDS.map((b) => ({ value: b, label: BOARD_SHORT[b] }));
  const periodOptions = [
    { value: "month" as Period, label: PERIOD_LABEL.month },
    { value: "all" as Period, label: PERIOD_LABEL.all },
  ];

  const empty = read.state !== "ready" || rows.length === 0;

  return (
    <div
      className="nf-lb"
      data-testid="leaderboard"
      data-pending={pending ? "" : undefined}
      data-settled={settled ? "" : undefined}
      aria-busy={pending}
    >
      {/* Round 3: the page's one top (`PageHeader variant="large"`, what
          PageFrame draws): the round back, the large title, the board's line
          under it, "How to climb" as the round action. */}
      <div data-testid="lb-subtitle">
        <PageHeader
          variant="large"
          title={LEADERBOARD_TITLE}
          subtitle={subtitle}
          fallback="/rewards"
          actions={
            <button type="button" className="nf-tap nf-icon-btn nf-icon-btn--round" onClick={() => setExplainer(true)} aria-label="How to climb" data-testid="lb-explain">
              <UiIcon name="trending-up" size={20} />
            </button>
          }
        />
      </div>

      <div className="nf-lb__switches">
        <Segmented<BoardGroup>
          label="Board"
          options={groupOptions}
          value={group}
          onChange={(g) => go(g === "referrals" ? "referrals" : "property", period)}
          shape="pill"
          full
        />
        {group === "top" ? (
          <Segmented<TopBoard>
            label="Top on Vallo board"
            options={subOptions}
            value={board as TopBoard}
            onChange={(b) => go(b, period)}
            shape="pill"
            size="sm"
            variant="quiet"
            full
          />
        ) : null}
      </div>

      <div key={`${board}-${period}`}>
        <section className="nf-lb__stage" id="lb-stage" aria-label={`Top three, ${place}`}>
          <Beams />
          <Podium rows={top} board={board} emptyLabel={read.state === "ready" ? "Your place" : "Not open yet"} />
          <ScopeToggle scope={scope} onChange={setScope} placeName={read.place.name} />
        </section>

        <section className="nf-lb__sheet" aria-label="Ranks">
          <div className="nf-lb__sheet-head">
            <p className="nf-lb__measure">{BOARD_MEASURE[board]}</p>
            <Segmented<Period>
              label="Period"
              options={periodOptions}
              value={period}
              onChange={(p) => go(board, p)}
              shape="pill"
              size="sm"
              semantics="radio"
            />
          </div>

          {read.state === "not-live" ? (
            <EmptyBoard board={board} title={NOT_LIVE_TITLE} body={NOT_LIVE_BODY} onExplain={() => setExplainer(true)} action={false} />
          ) : read.state === "error" ? (
            <EmptyBoard board={board} title={ERROR_TITLE} body={ERROR_BODY} onExplain={() => setExplainer(true)} action={false} />
          ) : empty ? (
            <EmptyBoard
              board={board}
              title={emptyTitle(scope, read.place.name)}
              body={EMPTY_BODY[board]}
              onExplain={() => setExplainer(true)}
              action
            />
          ) : rest.length > 0 ? (
            <RankRows rows={rest} board={board} period={period} quiet={quiet} onShareMine={() => setSharing(true)} />
          ) : (
            <p className="nf-lb__measure">Only the top {rows.length} so far in {place}. Ranks 4 and on appear here.</p>
          )}

          <div className="nf-lb__foot">
            <Link href="/directory" className="nf-lb__dir-link">
              <UiIcon name="users" size={18} />
              <span>Browse everyone in the directory</span>
              <UiIcon name="chevron-right" size={16} />
            </Link>
            <p className="nf-lb__privacy">{PRIVACY_LINE}</p>
            {visibility && setHidden ? (
              <Switch
                checked={!hidden}
                onCheckedChange={(show) => void toggleHidden(show)}
                label={OPT_OUT_LABEL}
                description={OPT_OUT_BODY}
              />
            ) : null}
            {visibility && setHidden
              ? visibility.businesses.map((b) => (
                  <BusinessSwitch key={b.id} id={b.id} name={b.name} hidden={b.hidden} setHidden={setHidden} />
                ))
              : null}
          </div>
        </section>
      </div>

      {read.state === "ready" && read.signedIn && rows.length > 0 ? (
          <button
            type="button"
            className="nf-lb__you"
            data-testid="lb-you"
            onClick={toMe}
            aria-label={me ? `${youPill(me.rank)}, go to your row` : NOT_ON_BOARD}
          >
            <span>{me ? youPill(me.rank) : NOT_ON_BOARD}</span>
            <span className="nf-lb__you-arrow" aria-hidden="true">
              <UiIcon name={me ? (me.rank <= 3 ? "arrow-up" : "arrow-down") : "trending-up"} size={16} />
            </span>
          </button>
        ) : null}

      <ClimbExplainer open={explainer} onOpenChange={setExplainer} board={board} me={me} />
      <ShareRank
        open={sharing}
        onOpenChange={setSharing}
        me={me}
        board={board}
        place={place}
        period={period}
        periodLabel={subtitle}
        url={shareUrl}
      />
      <EarnedMoment
        open={earned}
        onClose={closeEarned}
        onShare={() => {
          closeEarned();
          setSharing(true);
        }}
        me={me}
        board={board}
        place={place}
      />
    </div>
  );
}

/** An owner's switch for one of their businesses; the database checks ownership again. */
function BusinessSwitch({ id, name, hidden, setHidden }: { id: string; name: string; hidden: boolean; setHidden: SetHidden }) {
  const [off, setOff] = useState(hidden);
  return (
    <Switch
      checked={!off}
      onCheckedChange={async (show) => {
        setOff(!show);
        const res = await setHidden(!show, id);
        if (!res.ok) setOff(show);
      }}
      label={`Show ${name} on leaderboards`}
    />
  );
}

function EmptyBoard({
  board,
  title,
  body,
  onExplain,
  action,
}: {
  board: Board;
  title: string;
  body: string;
  onExplain(): void;
  action: boolean;
}) {
  const climb = CLIMB_ACTION[board];
  return (
    <div className="nf-lb__empty" data-testid="lb-empty">
      <BoardObject board={board} />
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="nf-lb__empty-actions">
        {action ? (
          <ButtonLink href={climb.href} variant="primary" shape="pill" full className="nf-lb__capsule">
            {climb.label}
          </ButtonLink>
        ) : null}
        <button type="button" className="nf-link nf-lb__text-button" onClick={onExplain}>
          How to climb
        </button>
      </div>
    </div>
  );
}
