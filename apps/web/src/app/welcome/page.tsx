import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { FirstRun } from "@/components/app/welcome/FirstRun";
import { WelcomeStage } from "@/components/app/welcome/WelcomeStage";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  FIRST_INTEREST_COOKIE,
  firstRunCookieFrom,
  isAuthDoor,
  isFirstRunLeft,
  withPassedFlag,
  firstRunNext,
  isSignUpForm,
} from "@/components/app/welcome/first-run-seen";
import { isPropertyType } from "@/lib/interests/schema";
import { loadInterestsState } from "@/lib/interests/queries";
import { planFirstRun } from "./plan";
import { resolveSession } from "@/lib/actions/session";
import { listStates } from "@/lib/places/queries";
import { publicCatalogueEnabled } from "@/lib/catalogue/public-access";

export const metadata: Metadata = {
  title: "Get started",
  robots: { index: false, follow: false },
};

/**
 * Get started: the first thing a person sees.
 *
 * What opens on a first launch from the stores, the first time somebody taps
 * Get started on the landing page, and what a stranger meets the first time
 * they press Sign up or Sign in. ONCE: a device or an account that has seen
 * it goes straight on (the founder, 29 September; `planFirstRun`). Four slides on one stage (the two
 * sides and the coin, what verified means, talk first and pay on Vallo, and
 * the ending), skippable. A stranger ends on Create account and Sign in;
 * somebody signed in ends on one Continue into the app. Governing image:
 * `2A49E2F7` in docs/design/references/.
 *
 * REACHABLE SIGNED OUT. `planFirstRun` in `./plan.ts` (a pure function with
 * its own test) chooses between skipping and which ending to show.
 *
 * THE ONE ONBOARDING (the founder, 7 October 2026: "I'm seeing 2 different
 * types... Keep THESE ones"). Every stranger meets the same four slides
 * (`FirstRun`), from slide one, whatever way they came in: Get started, the
 * first Sign in or Sign up on a device (the doors send them here once,
 * `app/(auth)/sign-in/first-run-gate.ts`), the app's first open (`/open`) or an
 * invite link (`/join/<code>`). The end, or Skip, hands them to the page they
 * asked for. The four-card intro that used to open a cold start
 * (`WelcomeIntro`, `get-started.css`) is retired, and so is the jump straight
 * to the account choice for an arrival with a destination (V-18): the last
 * slide still names where they were going.
 *
 * A device that has seen it and is going nowhere (the app reopened signed
 * out) opens on the account choice alone.
 *
 * Rendered outside the app shell on purpose: a dock underneath would offer six
 * more ways out of a screen that has exactly the ones it names.
 */
export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = getDictionary(await getLocale());
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = firstRunNext(rawNext);
  const session = await loadInterestsState();

  /* The market a landing tile named before they had an account (V-18). */
  const jar = await cookies();
  const carriedRaw = jar.get(FIRST_INTEREST_COOKIE)?.value ?? "";
  const carried = isPropertyType(carriedRaw) ? carriedRaw : null;
  /* Only `seen` (the click that left the slides) skips them; the proxy's
     `shown` opens the doors but still shows the slides here. */
  const seen = isFirstRunLeft(firstRunCookieFrom((await headers()).get("cookie")));

  const tour = (Array.isArray(params.tour) ? params.tour[0] : params.tour) === "1";
  const plan = planFirstRun({ session, next, carried, seen, tour });
  /* Seen once, then out of the way (the founder, 29 September). */
  /* A door is always handed the passed flag, so it can never send the person
     back here whatever cookie it reads (29 October 2026). */
  if (plan.kind === "skip") redirect(isAuthDoor(plan.to) ? withPassedFlag(plan.to) : plan.to);

  if (plan.kind === "guest") {
    return (
      <WelcomeStage>
        <FirstRun
          t={t}
          interests={[]}
          showCards
          asked
          viewer="guest"
          next={plan.next}
          arrival={plan.arrival}
          atChoice={plan.choice === true}
          fromSignUpForm={tour && isSignUpForm(plan.next)}
          catalogueOpen={publicCatalogueEnabled()}
        />
      </WelcomeStage>
    );
  }

  /* A1: what the one-screen sign-up no longer asks, asked here once the
     account exists and only while the interests question is still open.
     Where somebody stays is skipped when the profile already holds it. */
  const asks = plan.intent.asked ? null : await arrivalAsks();

  return (
    <WelcomeStage>
      <FirstRun
        t={t}
        interests={plan.intent.interests}
        /* A17: a device that has already been shown the steps (the intro or
           the tour, before the account existed) goes straight to the
           question after sign-up rather than through the steps again; asked
           for (`?tour=1`), the steps show. */
        showCards={tour || !seen}
        asked={plan.intent.asked}
        viewer="member"
        next={plan.next}
        asks={asks}
      />
    </WelcomeStage>
  );
}

/** The member's answers so far, for `ArrivalAsks`; null when it cannot read. */
async function arrivalAsks() {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const { data: row } = await session.supabase
    .from("profiles")
    .select("state_code")
    .eq("id", session.user.id)
    .maybeSingle();
  const askPlace = !row?.state_code;
  const heard = session.user.user_metadata?.hear_about;
  return {
    states: askPlace ? await listStates() : [],
    askPlace,
    hearAbout: typeof heard === "string" && heard ? heard : null,
  };
}
