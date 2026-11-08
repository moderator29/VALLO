"use client";

import "@/app/welcome/onboarding-motion.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { BackControl } from "@/components/ui/BackControl";
import { isInPageStep } from "@/lib/nav/in-page-step";
import { Button, ButtonLink } from "@/components/ui/Button";
import { markWelcomeSeen, skipInterests } from "@/lib/interests/actions";
import { useMotionGate } from "@/components/motion/useMotionGate";
import { releaseVelocity } from "@/components/site/landing/spring";
import { InterestChoices } from "./InterestChoices";
import { PushPrompt } from "@/components/app/push/PushPrompt";
import { ArrivalAsks } from "./ArrivalAsks";
import { Lockup, RiseWords } from "./StepArt";
import {
  forgetFirstInterest,
  rememberFirstInterest,
  rememberFirstRunSeen,
  withPassedFlag,
  isAuthDoor,
  isSignUpForm,
} from "./first-run-seen";
import type { Arrival } from "@/app/welcome/plan";
import { wallHeading } from "./wall-heading";
import { destinationOf, withNext } from "@/lib/auth/next-link";
import { KnowScene, MoveInScene, TalkScene, WorldsScene } from "./OnboardingScenes";
import {
  dragPose,
  keyStep,
  motionPlan,
  sceneState,
  skipPlan,
  swipeStep,
} from "./onboarding-flow";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * Get started IN MOTION (30 September), to the founder's onboarding video
 * (`docs/design/references/2026-09-29/51` to `53`) inside the full-page steps
 * of `42` and `43`.
 *
 * THE ONE ONBOARDING (the founder, 7 October 2026: "I'm seeing 2 different
 * types... Keep THESE ones"). This carousel is the only get-started there is:
 * the four-card intro that used to open a cold start (`WelcomeIntro`,
 * `get-started.css`) is retired, and every way in (Sign in, Sign up, Get
 * started, the app's first open, an invite link) reaches this, once per
 * device, then goes straight to the page it asked for.
 *
 * THE SHAPE OF A STEP, top to bottom:
 *
 *   back (steps two on), the Vallo lockup, Skip
 *   the SCENE: the founder's clay art for the step in a rounded card, with
 *     chips in our components' style arriving over it one after another and
 *     then floating gently (`OnboardingScenes.tsx`)
 *   a small "1 of 4", a big two-line title and the body, arriving after the
 *     scene
 *   the step dots, the current one brand blue (the founder, 8 October 2026:
 *     "add those 1 of 4, 2 of 4 stuffs", to the Plasma onboarding,
 *     `docs/design/references/2026-10-05/IMG_7052` to `IMG_7058`)
 *   one full-width blue capsule: Continue, and on the last step the real call
 *
 * On a wide screen the scene takes the left and the words and the pill the
 * right. The rules (which step a key or a swipe lands on, what Skip does,
 * what moves under each motion setting) are pure functions in
 * `onboarding-flow.ts`, tested on their own.
 *
 *   1. Homes. Stays. Restaurants. Homes and Stays over the home and hotel.
 *   2. Know who you deal with.    The shield and the ID under a scan frame,
 *                                 the Verified agent badge and the Record.
 *   3. Talk first. Pay when sure. A question, then an Example Pay on Vallo.
 *   4. The ending.                The keys and an Example move-in total. A
 *                                 stranger: Create account (or Sign in).
 *                                 Somebody signed in: one Continue into the
 *                                 app, through the interests question only
 *                                 while it is unanswered.
 *
 * MOTION. A step change slides the scenes sideways and crossfades them
 * (transform and opacity only, `app/welcome/onboarding-motion.css`); a drag
 * moves them with the finger. Reduced motion, Calm and Off: every step lands
 * at once, nothing staggers, floats or counts. A still background (Living
 * backgrounds off, data saver) keeps the arrivals and drops the float.
 *
 * WHAT EACH CONTROL WRITES, because a first run with painted buttons is a
 * picture of onboarding:
 *
 *   Continue            moves one step on. Reaching the last step records
 *                       this device as shown (`rememberFirstRunSeen`).
 *   Skip, a stranger    records the device, then carries on to where they
 *                       were going (`?next=`), or lands on the ending.
 *   Skip, a member      records the opener on the profile AND skips the
 *                       question (`markWelcomeSeen` + `skipInterests`, the
 *                       real skip that never asks again), then home.
 *   Continue, a member  `onDone`: records the opener on the profile, then the
 *   (last step)         interests question if it is still unasked, else home.
 *   The two doors       real links to `/sign-up` and `/sign-in`, keeping the
 *                       address the person asked for.
 *   Back                every step is a history entry, so the drawn back
 *                       button, the browser's back and Android's hardware
 *                       back all step to the previous step; from step one
 *                       back leaves as it came.
 *
 * Swipe, the arrow keys (Home and End too) and the step dots all move
 * between steps; every change is announced in a polite live region and the
 * new step's title takes focus when the change came from inside the flow.
 * Only the step on screen is in the accessibility tree.
 */

type Viewer = "member" | "guest";

type Slide = {
  key: string;
  titleA: string;
  titleB: string;
  /** One short line, never a paragraph (the founder, 7 October). */
  body: string;
  /** One sentence for a reader: what the scene shows. */
  label: string;
};

/* Movement before a press becomes a horizontal drag rather than a tap or a
   vertical scroll. */
const DRAG_SLOP_PX = 8;

/** The welcome slides at sign up and sign in STAY (founder, 7 November 2026:
    only the intro slides inside features are removed). */
const WELCOME_SLIDES_OFF = false;

export function FirstRun({
  t,
  interests,
  showCards,
  asked = false,
  viewer = "member",
  next = null,
  arrival = null,
  atChoice = false,
  fromSignUpForm = false,
  catalogueOpen = false,
  asks = null,
  introSlides = !WELCOME_SLIDES_OFF,
}: {
  t: Dictionary;
  /** Tests switch the dormant intro slides back on (founder: off, 7 Nov 2026). */
  introSlides?: boolean;
  interests: ComponentProps<typeof InterestChoices>["initial"];
  /* False for a member who has already been shown the steps, on this
     device or another: they go straight to the question. */
  showCards: boolean;
  /* True when the question has been answered or skipped already. */
  asked?: boolean;
  viewer?: Viewer;
  /* A same-origin path the person was on their way to, already vetted. */
  next?: string | null;
  /**
   * What a stranger was stopped on the way to (V-18). Present, the last
   * slide is headed with it. Every stranger starts on slide one (the
   * founder, 7 October: the first Sign in or Sign up on a device shows the
   * carousel first, then the page they asked for).
   */
  arrival?: Arrival | null;
  /** A returning device going nowhere: open on the closing choice. */
  atChoice?: boolean;
  /**
   * The steps were opened from the sign-up form's "What Vallo is" link, and
   * `next` is that form. The control at the top then reads "Back to sign
   * up" rather than Skip (E2E audit L-5): it already returned to the form,
   * and nothing on the first-run path is labelled skip.
   */
  fromSignUpForm?: boolean;
  /**
   * The public catalogue is open to a stranger (`VALLO_PUBLIC_CATALOGUE`), so
   * the closing choice also offers "Look around first". Apple 5.1.1(v): a
   * person may not be made to register before they can browse. Off, the
   * choice is the two account doors only, as before.
   */
  catalogueOpen?: boolean;
  /**
   * A member only: what the one-screen sign-up no longer asks (A1), shown
   * beside the interests question. Null when there is nothing left to ask.
   */
  asks?: Omit<ComponentProps<typeof ArrivalAsks>, "t"> | null;
}) {
  const router = useRouter();
  const w = t.welcomeCards.twoWorlds;
  const f = t.welcomeCards.firstRun;
  const m = t.onboardingMotion;
  const words = m.slides;
  const guest = viewer === "guest";
  /* Only a guest with the form to go back to: `skip` sends a guest to `next`. */
  const backToForm = guest && fromSignUpForm && isSignUpForm(next);
  const askQuestion = !guest && !asked;
  const gate = useMotionGate();
  const motion = motionPlan(gate);

  const wall = guest && arrival ? wallHeading(arrival.reason, t.shape.wall) : null;

  const last: Slide = guest
    ? {
        key: "choice",
        titleA: wall ? wall.titleA : words.ready.titleA,
        titleB: wall ? wall.titleB : words.ready.titleB,
        body: wall ? words.ready.wallLine : words.ready.line,
        label: m.moveIn.label,
      }
    : {
        key: "member",
        titleA: words.member.titleA,
        titleB: words.member.titleB,
        body: askQuestion ? words.member.lineAsk : words.member.lineDone,
        label: m.moveIn.label,
      };

  const slide3 = (key: string, copy: { titleA: string; titleB: string; line: string }, label: string): Slide => ({
    key,
    titleA: copy.titleA,
    titleB: copy.titleB,
    body: copy.line,
    label,
  });
  const slides: Slide[] = [
    slide3("worlds", words.worlds, m.worlds.label),
    slide3("verified", words.know, m.know.label),
    slide3("safe", words.talk, m.talk.label),
    last,
  ];
  const total = slides.length;
  const lastIndex = total - 1;
  /* Every arrival starts on slide one; only a returning device going
     nowhere (the app reopened signed out) opens on the choice alone. */
  /* The welcome slides stay (founder, 7 November 2026, correcting his
     first word: only the intro slides inside features go). The switch
     remains so they can be turned off in one place if he asks. */
  const choiceOnly = guest && (atChoice || !introSlides);
  const initialIndex = choiceOnly ? lastIndex : 0;

  /* `notify` is the last beat (the founder, 7 Nov 2026): the notifications
     offer, after the account exists and the question is behind them. */
  const [beat, setBeat] = useState<"slides" | "question" | "notify">(
    !guest && (!showCards || !introSlides) ? "question" : "slides",
  );
  const [index, setIndex] = useState(initialIndex);
  /* Bumped on every arrival, so the move-in figure counts again each time. */
  const [visit, setVisit] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [pending, start] = useSafeTransition();
  /* Whether the device memory really stuck, so an exit can carry the flag
     instead when a browser refuses the cookie. */
  const stuck = useRef<boolean | null>(null);

  const remember = useCallback(() => {
    if (stuck.current === null) stuck.current = rememberFirstRunSeen();
    return stuck.current;
  }, []);

  /* Called from a handler only, never while rendering: it writes the cookie.
     A sign-in or sign-up door is ALWAYS handed the passed flag, whatever the
     cookie did (29 October 2026, the founder: Skip and the last slide sent him
     back here). A cookie can be refused, arrive late in a webview, or sit
     beside a stale copy the server reads instead; the flag in the address
     cannot, so the door never bounces the person back to the slides. */
  const onward = useCallback(
    (path: string) => (remember() && !isAuthDoor(path) ? path : withPassedFlag(path)),
    [remember],
  );

  /* A door is a real link (it middle-clicks, it prefetches). The click is
     taken over and sent with the passed flag, for the reason above. */
  const door = (path: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    /* Anywhere but a door (Look around first) needs the flag only when the cookie was refused. */
    if (remember() && !isAuthDoor(path)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    router.push(withPassedFlag(path));
  };

  /* Every move is announced from here, the one place a step changes, so
     the live region speaks for dots, buttons, swipes and keys alike and
     says nothing on first paint. */
  const titles = slides.map((s) => `${s.titleA} ${s.titleB}`).join("\n");

  const announceSlide = useCallback(
    (n: number) =>
      setAnnounce(
        f.slideLive
          .replace("{n}", String(n + 1))
          .replace("{total}", String(lastIndex + 1))
          .replace("{title}", titles.split("\n")[n] ?? ""),
      ),
    [f.slideLive, lastIndex, titles],
  );

  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  /* Focus follows a change made from inside the flow, never the first paint. */
  const moveFocus = useRef(false);

  const land = useCallback(
    (n: number) => {
      setIndex(n);
      setVisit((v) => v + 1);
      announceSlide(n);
      const active = document.activeElement;
      moveFocus.current =
        !active || active === document.body || !!rootRef.current?.contains(active);
    },
    [announceSlide],
  );

  /*
   * EVERY STEP IS A HISTORY ENTRY, so back means the previous step.
   *
   * A move pushes an entry on the same address carrying the step number, so
   * the browser's back, a swipe-back gesture and Android's hardware back
   * (Capacitor's default hands it to the web view's history) all step back a
   * step rather than leaving first run. From the first step back leaves as
   * it always did. The current history state is spread in, because the App
   * Router keeps its own tree in it and an entry without that tree makes it
   * reload on the way back.
   */
  const goTo = useCallback(
    (to: number) => {
      const clamped = Math.max(0, Math.min(lastIndex, to));
      if (clamped === index) return false;
      try {
        window.history.pushState({ ...(window.history.state ?? {}), nfGsSlide: clamped }, "");
      } catch {
        /* A sandbox that refuses history still moves the step. */
      }
      land(clamped);
      return true;
    },
    [lastIndex, index, land],
  );

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { nfGsSlide?: unknown } | null)?.nfGsSlide;
      land(typeof s === "number" ? s : initialIndex);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [initialIndex, land]);

  /* Marks the flow as live once hydrated, so a script driving it (the
     browser checks in tests/) knows a press will be heard. */
  useEffect(() => {
    rootRef.current?.setAttribute("data-hydrated", "");
  }, [beat]);

  /* The new step's title takes focus, so a keyboard or screen reader lands
     on what just arrived rather than on a button that moved. */
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    titleRef.current?.focus({ preventScroll: true });
  }, [index]);

  /* Reaching the end is having been shown it. Also covers the returning
     stranger who starts on the choice. */
  useEffect(() => {
    if (beat === "slides" && index === lastIndex) remember();
  }, [beat, index, lastIndex, remember]);

  /* A member who starts at the question was shown the steps already, maybe
     only on this device before they had an account. Put it on the profile so
     every other device knows too. Quiet and idempotent. */
  useEffect(() => {
    if (!guest && !showCards) void markWelcomeSeen();
  }, [guest, showCards]);

  /* The market a landing tile named, kept for the interests question after
     sign-up (V-18). A suggestion only; nothing is saved from it. */
  const carriedInterest = guest ? (arrival?.interest ?? null) : null;
  useEffect(() => {
    if (carriedInterest) rememberFirstInterest(carriedInterest);
  }, [carriedInterest]);

  useEffect(() => {
    if (beat !== "slides") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const to = keyStep(e.key, index, lastIndex);
      if (to === null) return;
      e.preventDefault();
      goTo(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beat, index, lastIndex, goTo]);

  /* ------------------------------------------------------------------ */
  /* THE DRAG                                                            */
  /* ------------------------------------------------------------------ */

  /* A press becomes a drag only once it has moved sideways more than up or
     down; a vertical move is left to the page. While it drags, the scenes
     follow the finger (`dragPose`) and the words lean with it; the release
     either turns the step (`swipeStep`) or lets everything settle back. */
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    axis: "x" | "y" | null;
    samples: { t: number; x: number; y: number }[];
  } | null>(null);

  const widthOf = () => rootRef.current?.getBoundingClientRect().width || window.innerWidth || 1;

  const paintDrag = (dx: number | null) => {
    const root = rootRef.current;
    if (!root) return;
    const scenes = root.querySelectorAll<HTMLElement>("[data-om-scene]");
    if (dx === null) {
      root.removeAttribute("data-dragging");
      root.style.removeProperty("--om-lean");
      scenes.forEach((el) => {
        el.style.removeProperty("--om-shift");
        el.style.removeProperty("--om-alpha");
      });
      return;
    }
    root.setAttribute("data-dragging", "");
    const width = widthOf();
    /* Past either end the scenes resist: a third of the pull. */
    const pastEnd = (dx > 0 && index === 0) || (dx < 0 && index === lastIndex);
    const share = (pastEnd ? dx / 3 : dx) / width;
    root.style.setProperty("--om-lean", `${(dx * (pastEnd ? 0.06 : 0.12)).toFixed(1)}px`);
    scenes.forEach((el) => {
      const pose = dragPose(Number(el.dataset.omScene) - index, share);
      el.style.setProperty("--om-shift", String(pose.shift));
      el.style.setProperty("--om-alpha", String(pastEnd && pose.shift === share ? 1 : pose.opacity));
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as Element).closest("button, a, input, label")) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, samples: [] };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (p.axis === null) {
      if (Math.abs(dx) > DRAG_SLOP_PX && Math.abs(dx) > Math.abs(dy)) {
        p.axis = "x";
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* A pointer that is already gone. */
        }
      } else if (Math.abs(dy) > DRAG_SLOP_PX) {
        p.axis = "y";
        return;
      } else {
        return;
      }
    }
    if (p.axis !== "x") return;
    p.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (p.samples.length > 8) p.samples.shift();
    /* Quiet: nothing follows the finger; the release still turns the step. */
    if (motion.follow) paintDrag(dx);
  };

  const endPress = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== e.pointerId || p.axis !== "x") return;
    paintDrag(null);
    if (cancelled) return;
    const to = swipeStep({
      dx: e.clientX - p.x,
      dy: e.clientY - p.y,
      vx: releaseVelocity(p.samples).vx,
      width: widthOf(),
      index,
      last: lastIndex,
    });
    goTo(to);
  };

  /* Leaving first run for the app is a full navigation, replacing this entry.
     Found in the final pass: a client-side replace to `/home` that the proxy
     answers with a redirect (a session that has lapsed, or the fixture
     harness signed out) hung mid-transition with the button busy. A document
     load follows any redirect, and the step entries this screen pushed are
     not left behind in the back stack of the app. */
  const leave = (path: string) => {
    window.location.replace(path);
  };

  /* A member finishing the steps. */
  const onDone = () => {
    start(async () => {
      try {
        remember();
        await markWelcomeSeen();
        if (askQuestion) {
          setBeat("question");
          return;
        }
        /* No question to ask: straight to the notifications offer, which
           settles itself at once wherever it cannot or should not show. */
        setBeat("notify");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const skip = () => {
    const plan = skipPlan({ guest, next });
    if (plan.kind === "go") {
      router.push(onward(plan.to));
      return;
    }
    if (plan.kind === "ending") {
      remember();
      goTo(lastIndex);
      return;
    }
    start(async () => {
      try {
        remember();
        const [, skipped] = await Promise.all([markWelcomeSeen(), skipInterests()]);
        if (!skipped.ok) {
          /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
          banner.error(skipped.error, { retry: skip });
          return;
        }
        forgetFirstInterest();
        leave(plan.to);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const slide = slides[index] ?? slides[0]!;
  const onLast = index === lastIndex;

  /*
   * The doors, keeping whatever the person was on their way to.
   *
   * CREATE ACCOUNT USED TO DROP IT (audit UX-02, R16). With `next` set to the
   * wall's `/sign-in?next=/search...`, the sign-in door kept it and the
   * sign-up door fell back to a bare `/sign-up`, so a stranger who chose to
   * make an account instead of signing in lost the thing that was shared with
   * them. Both doors now carry the destination: the door they came through
   * keeps its whole address (its notice included), and the other door is
   * built from the destination underneath it, through `withNext`, which drops
   * anything that is not a safe same-origin path.
   */
  const signUpHref =
    next && /^\/sign-up(?:[/?#]|$)/.test(next) ? next : withNext("/sign-up", destinationOf(next));
  const signInHref =
    next && /^\/sign-in(?:[/?#]|$)/.test(next)
      ? next
      : arrival
        ? withNext("/sign-in", arrival.destination)
        : "/sign-in";
  /* The primary door is the one the heading names (V-18). Without a heading,
     the one they came through: a tapped Sign in ends on Sign in (the founder,
     7 October), anything else on Create account. */
  const signInFirst = wall ? wall.primary === "sign-in" : Boolean(next && /^\/sign-in(?:[/?#]|$)/.test(next));

  /*
   * THE NOTIFICATIONS STEP (the founder, 7 November 2026): a default part of
   * joining, the way Hauslet asks right after sign-in. `PushPrompt` is the
   * whole offer: Vallo's own screen first, the one system prompt only after a
   * Yes, a No remembered for thirty days, and it settles itself immediately
   * (so this beat never traps anyone) when the permission is already granted,
   * already denied, declined recently, or push is unsupported here.
   */
  if (beat === "notify") {
    return (
      <div className="nf-gs-col nf-gs-col--question" data-testid="first-run-notify">
        <div className="nf-gs-question__sky" aria-hidden="true">
          <span className="nf-gs-orb nf-gs-orb--a" />
          <span className="nf-gs-orb nf-gs-orb--b" />
        </div>
        <Lockup onCanvas />
        <div className="nf-gs-question">
          <div className="nf-gs-notify nf-gs-rise">
            <PushPrompt moment="joined" onSettled={() => leave(next ?? "/home")} />
          </div>
        </div>
      </div>
    );
  }

  if (beat === "question") {
    return (
      <div className="nf-gs-col nf-gs-col--question" data-testid="first-run">
        <div className="nf-gs-question__sky" aria-hidden="true">
          <span className="nf-gs-orb nf-gs-orb--a" />
          <span className="nf-gs-orb nf-gs-orb--b" />
        </div>
        <Lockup onCanvas />
        <div className="nf-gs-question">
          <h1 className="nf-gs-title nf-gs-title--question">
            <RiseWords text={t.interests.question} />
          </h1>
          <p className="nf-gs-sub nf-gs-rise">
            {t.interests.screenSubtitle}. {t.interests.note}
          </p>
          <p className="nf-gs-note nf-gs-rise">{t.welcomeCards.three.body}</p>
          <div className="nf-gs-question__choices nf-gs-rise">
            <InterestChoices
              initial={interests}
              t={t}
              extra={asks ? <ArrivalAsks t={t} {...asks} /> : undefined}
              onFirstRunDone={() => setBeat("notify")}
            />
          </div>
        </div>
      </div>
    );
  }

  const stepName = (n: number) => w.step.replace("{n}", String(n + 1)).replace("{total}", String(total));
  /* "1 of 4": the visible counter over the title (the founder, 8 October). */
  const countOf = (n: number) => m.count.replace("{n}", String(n + 1)).replace("{total}", String(total));
  const tag = "en-NG";

  const primaryDoor = signInFirst
    ? { href: signInHref, label: f.choice.signIn, testId: "welcome-sign-in" }
    : { href: signUpHref, label: f.choice.create, testId: "welcome-create" };
  const secondDoor = signInFirst
    ? { href: signUpHref, label: f.choice.create, testId: "welcome-create" }
    : { href: signInHref, label: f.choice.signIn, testId: "welcome-sign-in" };

  const scene = (key: string, i: number): ReactNode => {
    const priority = i === initialIndex;
    switch (key) {
      case "worlds":
        return <WorldsScene copy={m} priority={priority} />;
      case "verified":
        return <KnowScene copy={m} priority={priority} />;
      case "safe":
        return <TalkScene copy={m} priority={priority} tag={tag} />;
      default:
        return (
          <MoveInScene
            copy={m}
            priority={priority}
            active={i === index}
            visit={visit}
            count={motion.count}
            tag={tag}
          />
        );
    }
  };

  const showBack = index > 0 && index !== initialIndex;

  return (
    <section
      ref={rootRef}
      className="nf-om"
      data-testid="first-run"
      aria-roledescription="carousel"
      aria-label={f.carousel}
      data-step={index + 1}
      data-last={onLast ? "" : undefined}
      data-choice={choiceOnly ? "" : undefined}
      data-quiet={motion.slide ? undefined : ""}
      data-still={motion.idle ? undefined : ""}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPress(e, false)}
      onPointerCancel={(e) => endPress(e, true)}
    >
      <span className="nf-om-glow" aria-hidden="true" />

      <div className="nf-om-top">
        <span className="nf-om-top__side">
          {/* Back, from step two on (reference 51 draws none on the first,
              where back leaves first run the way it came). It steps through
              the same history the hardware button does. */}
          {showBack && (
            <BackControl
              onBack={() => {
                /* A step entry always has the previous step behind it;
                   anything else (a restored tab) steps without history. */
                if (isInPageStep(window.history.state)) window.history.back();
                else land(index - 1);
              }}
              label={t.common.back}
              surface="round"
              className="nf-om-back"
              data-testid="welcome-back"
            />
          )}
        </span>
        {/* Follows the reader's theme: the night lockup, or the day one. */}
        <Lockup themed />
        <span className="nf-om-top__side nf-om-top__side--end">
          {!onLast && (
            <button
              type="button"
              className="nf-om-skip"
              onClick={skip}
              disabled={pending}
              data-testid={backToForm ? "welcome-back-to-sign-up" : "welcome-skip-all"}
            >
              {backToForm ? t.welcomeCards.backToSignUp : t.welcomeCards.skip}
            </button>
          )}
        </span>
      </div>

      <div className="nf-om-stage" aria-hidden="true">
        {slides.map((s, i) => {
          const state = sceneState(i, index);
          return (
            <div
              key={s.key}
              className="nf-om-scene"
              data-om-scene={i}
              data-state={state}
              data-scene={s.key}
              style={{ visibility: Math.abs(i - index) >= 2 ? "hidden" : undefined } as CSSProperties}
            >
              {scene(s.key, i)}
            </div>
          );
        })}
      </div>
      {/* What the scene on screen shows, for a reader. */}
      <p className="sr-only">{slide.label}</p>

      <div className="nf-om-copy">
        {/* Every step's words, invisible, in the same cell as the step on
            screen: the block is as tall as the longest step at this width, so
            the pill never jumps between steps. */}
        {slides.map((s) => (
          <div key={`size-${s.key}`} className="nf-om-words nf-om-words--sizer" aria-hidden="true">
            <p className="nf-om-count">{countOf(0)}</p>
            <p className="nf-om-title">
              <span className="nf-om-title__a">{s.titleA}</span> <span className="nf-om-title__b">{s.titleB}</span>
            </p>
            <p className="nf-om-body">{s.body}</p>
          </div>
        ))}
        <div
          key={`${slide.key}-${visit}`}
          className="nf-om-words"
          role="group"
          aria-roledescription="slide"
          aria-label={stepName(index)}
          data-slide={slide.key}
        >
          {/* Read with the step; each move is also announced by the polite
              live region below ("Slide 2 of 4: ..."). */}
          <p className="nf-om-count" hidden={choiceOnly} data-testid="welcome-count">
            {countOf(index)}
          </p>
          <h1 ref={titleRef} tabIndex={-1} className="nf-om-title">
            <span className="nf-om-title__a">{slide.titleA}</span>{" "}
            <span className="nf-om-title__b">{slide.titleB}</span>
          </h1>
          <p className="nf-om-body">{slide.body}</p>
        </div>
      </div>


      {/* THE STEP DOTS (the founder, 8 October 2026, to the Plasma
          reference: "add those 1 of 4, 2 of 4"): small and centred between
          the line and the button, the current one brand blue. Each is a 44px
          target. The choice alone (a returning device) is not a step of four. */}
      <div className="nf-om-progress" role="group" aria-label={m.progress} hidden={choiceOnly}>
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className="nf-om-dot"
            data-current={i === index ? "" : undefined}
            aria-label={stepName(i)}
            aria-current={i === index ? "step" : undefined}
            onClick={() => goTo(i)}
            data-testid={`welcome-dot-${i + 1}`}
          />
        ))}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>

      <div className="nf-om-foot">
        {!onLast ? (
          <Button
            variant="primary"
            size="lg"
            full
            className="nf-om-cta"
            onClick={() => goTo(index + 1)}
            data-testid={index === 0 ? "welcome-get-started" : "welcome-next"}
          >
            <span>{m.continue}</span>
            <span className="nf-om-cta__arrow" aria-hidden="true">
              <UiIcon name="arrow-right" size={18} />
            </span>
          </Button>
        ) : guest ? (
          <div className="nf-om-doors">
            <ButtonLink
              variant="primary"
              size="lg"
              full
              href={primaryDoor.href}
              onClick={door(primaryDoor.href)}
              className="nf-om-cta"
              data-testid={primaryDoor.testId}
            >
              <span>{primaryDoor.label}</span>
              <span className="nf-om-cta__arrow" aria-hidden="true">
                <UiIcon name="arrow-right" size={18} />
              </span>
            </ButtonLink>
            <ButtonLink
              variant="ghost"
              size="lg"
              full
              href={secondDoor.href}
              onClick={door(secondDoor.href)}
              className="nf-om-second"
              data-testid={secondDoor.testId}
            >
              {secondDoor.label}
            </ButtonLink>
            {catalogueOpen ? (
              <ButtonLink
                variant="ghost"
                size="lg"
                full
                href="/search"
                onClick={door("/search")}
                className="nf-om-second"
                data-testid="welcome-look-around"
              >
                {f.choice.lookAround}
              </ButtonLink>
            ) : null}
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            full
            className="nf-om-cta"
            onClick={onDone}
            loading={pending}
            data-testid="welcome-continue"
          >
            <span>{f.member.continue}</span>
            <span className="nf-om-cta__arrow" aria-hidden="true">
              <UiIcon name="arrow-right" size={18} />
            </span>
          </Button>
        )}

      </div>
    </section>
  );
}
