import type { Metadata } from "next";
import { forApply } from "@/components/agent/agent-copy";
import { notFound } from "next/navigation";
import { requireSignedInPage } from "@/lib/actions/signed-in-page";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ApplyWizard, type SetupRole } from "@/components/agent/ApplyWizard";
import { ROLE_COPY } from "@/components/roles/roles";
import { PageFrame } from "@/components/app/PageFrame";
import { OpenApplicationNotice } from "@/components/supply/OpenApplicationNotice";
import { readMyApplication } from "@/lib/agent/application-status";
import { isOpenApplication } from "@/lib/agent/open-application";
import { myOtherSideHeld } from "@/lib/agent/role-lock-read";

export const metadata: Metadata = {
  title: "Set up your profile",
  robots: { index: false, follow: false },
};

/**
 * SETTING UP A PROFILE YOU SWITCHED INTO.
 *
 * This is where "Become an agent" went, and the move is the point rather than
 * a tidy-up. There is no longer a marketing destination called Become an Agent
 * with a hero, six step cards, an earnings tease and two call-to-action
 * buttons. There is one account with three profiles on it, a sheet that
 * switches between them, and this: the form that finishes a profile the person
 * has already chosen from that sheet.
 *
 * WHY THE ROLE IS IN THE PATH. `/agents/apply` asked, on its first step, which
 * kind of agent you are - the same question the sheet asks, one screen
 * earlier, with a better explanation attached. Two asks, one answer, and
 * nothing reconciling them. The segment carries the answer forward, the wizard
 * locks its type field to it, and the question is asked exactly once.
 *
 * WHY IT LIVES UNDER /profile. Because that is what it is. Switching profile
 * is a profile action, setting one up is the same action taking longer, and a
 * person who abandons this halfway should land back on the screen they started
 * from rather than on a marketing page in the public site chrome.
 *
 * ONE SEGMENT NOW, AND IT USED TO BE TWO. `owner` has its own route beside
 * this one, `profile/setup/owner`, which draws `GOVERNING-03`: four screens,
 * the honest answer on the ownership question, and a form a landlord can
 * finish. A static segment wins over a dynamic sibling in Next's router, so
 * that page serves the owner and nothing here has to know about it; the value
 * is dropped from this list so that a reader of this file is not told there is
 * an owner form here when there is not.
 *
 * `renter` was never one of them: there is no application to be a renter and
 * there never will be (see roles.ts), so it 404s here rather than rendering an
 * empty form.
 */
const SETUP_ROLES: readonly SetupRole[] = ["professional"] as const;

function isSetupRole(value: string): value is SetupRole {
  return (SETUP_ROLES as readonly string[]).includes(value);
}

export default async function ProfileSetupPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!isSetupRole(role)) notFound();
  await requireSignedInPage(`/profile/setup/${role}`);

  const [locale, mine, otherSide] = await Promise.all([
    getLocale(),
    readMyApplication(),
    myOtherSideHeld("agent"),
  ]);
  const t = getDictionary(locale);
  const copy = ROLE_COPY[role];

  /* The professional application makes an agent: not from an owner's account. */
  if (otherSide) {
    const r = t.supply.register;
    return (
      <OpenApplicationNotice
        heading={copy.setup.title}
        reference=""
        copy={{ title: r.otherSideTitle, body: r.ownerNotAgent, action: r.backToProfile }}
        href="/profile"
      />
    );
  }

  /* An application still open is followed, not filed again. */
  if (mine.state === "found" && isOpenApplication(mine.application.status)) {
    const r = t.supply.register;
    return (
      <OpenApplicationNotice
        heading={copy.setup.title}
        reference={mine.application.reference}
        copy={{ title: r.openTitle, body: r.openBody, action: r.trackIt }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* The heading is the profile being set up, not the word "application".
          Nobody set out to file an application; they set out to start selling
          or to start working as an agent, and the screen should say the thing
          they were doing. */}
      <PageFrame title={copy.setup.title} fallback="/profile">
      <div>

      <p className="nf-lede max-w-[52ch]">{copy.setup.involves}</p>

      <div className="mt-lg">
        <ApplyWizard t={forApply(t)} role={role} intro={copy.setup.involves} closeHref="/profile/setup" />
      </div>
      </div>
    </PageFrame>
    </div>
  );
}
