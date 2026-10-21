import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { SAFETY_EDUCATION_COPY } from "@/lib/messages/education";

/**
 * ENGLISH THAT LEFT SHARED CODE FOR THE DICTIONARY, PINNED (C9, after the route sweep).
 *
 * `/payments` wrote its title and signed-out door as literals, and
 * `lib/app/home-queries.ts` held the daypart greeting that `/stays` and the
 * home screen print over a name, with "there" for an account with no first
 * name. They read the dictionary now. These pin the English to what the code
 * spelled, so the move changed no byte, and check that every locale has a line
 * (English, through `withFallback`, until a translator supplies one).
 */
const en = getDictionary("en");

describe("words moved out of shared code", () => {
  it("/payments says what the page spelled", () => {
    expect(en.experienceMoney.payments).toEqual({
      title: "Payments",
      signInTitle: "Sign in to see your payments",
      signIn: "Sign in",
      seeAgreements: "See your agreements",
      listHeading: "Your payments and refunds",
    });
  });

  it("the home greeting says what DAYPART_GREETING and the two screens spelled", () => {
    expect(en.experienceDiscover.home.greeting).toEqual({
      morning: "Good morning,",
      afternoon: "Good afternoon,",
      evening: "Good evening,",
      night: "Good evening,",
    });
    expect(en.experienceDiscover.home.there).toBe("there");
    expect(en.experienceDiscover.home.welcome).toBe("Welcome to Vallo");
  });

  it("the rental panel's safety line is the owner's canon, verbatim (language audit, 17 October 2026)", () => {
    expect(en.memberFlows.rental.keepInside).toBe(SAFETY_EDUCATION_COPY);
  });

  it("the booking panels say what the components spelled", () => {
    expect(en.memberFlows.table.promise).toBe("The restaurant confirms it. Nothing is held until they do.");
    expect(en.memberFlows.stayReserve.nothingAdded).toBe("Vallo adds nothing of its own. Every figure here is the host's.");
    expect(en.memberFlows.stayReserve.payAfterInspecting).toBe("Pay only after you have inspected the property");
  });

  it("reaches every locale", () => {
    for (const locale of ["ha", "ig", "yo"] as const) {
      const t = getDictionary(locale);
      expect(t.experienceMoney.payments.title, locale).toBeTruthy();
      expect(t.experienceDiscover.home.greeting.morning, locale).toBeTruthy();
      expect(t.experienceDiscover.home.there, locale).toBeTruthy();
      expect(t.experienceLabels.kinds.land.many, locale).toBeTruthy();
      expect(t.experienceDetail.hours.unknown, locale).toBeTruthy();
      expect(t.experienceHost.refusals.schema.timeLike, locale).toBeTruthy();
    }
  });
});
