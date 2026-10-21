import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { readMyHostDraft } from "@/lib/host/queries";
import { doorFrom } from "@/lib/host/doors";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { HostWizard, type PolicyOption } from "@/components/host/HostWizard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).hostWorkspace.home.startTitle, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/** The preset code of a policy row, a column the generated types may not carry yet. */
function readPreset(row: unknown): string | null {
  const value = (row as { preset?: unknown }).preset;
  return typeof value === "string" ? value : null;
}

/**
 * /host/apply: the Host wizard.
 *
 * A thin server shell: the signed-in person's own draft (or an empty one),
 * the cancellation policies a rate can name, and the wizard. Signed out, the
 * way in carries the intent home so the person lands back here.
 *
 * `?door=` IS THE ANSWER TO THE FIRST QUESTION, given on the previous screen.
 * `/host/start` draws the three stays doors of `GOVERNING-09`, and a door
 * carries the host type and the business kind the wizard would otherwise ask
 * for. It is read here and never trusted: `doorFrom` returns null for anything
 * that is not one of the three, and the wizard's own first step is still there
 * behind the Back control for anybody whose door turned out to be wrong.
 */
export default async function HostApplyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const session = await resolveSession();

  const params = await searchParams;
  const askedDoor = params.door;
  const doorId = Array.isArray(askedDoor) ? askedDoor[0] : askedDoor;
  const door = doorFrom(doorId);

  if (session.state !== "signed-in") {
    /* The door travels through sign in, so a person who picked "we are a
       hotel", signed in and came back does not have to pick it again. */
    const next = returnHref(door ? `/host/apply?door=${door.id}` : "/host/apply", "", "list");
    return (
      <HostShell logoLabel={t.a11y.logoHome}>
        <EmptyState
          icon="hotel"
          title={t.hostWorkspace.apply.signedOutTitle}
          body={t.hostWorkspace.apply.signedOutBody}
          action={
            <ButtonLink href={authHref(next, "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const [draftRead, policiesRead] = await Promise.all([
    readMyHostDraft(),
    session.supabase
      .from("cancellation_policies")
      /* `*` so the preset code and its position come back once
         `20261013062641_four_preset_cancellation_policies.sql` has run, and
         nothing breaks before it has. `rules` are the refund tiers the
         wizard prints in plain words. */
      .select("*")
      .order("name")
      .limit(20),
  ]);
  const policies: PolicyOption[] = (policiesRead.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    summary: row.summary,
    isFreeUntilHours: row.is_free_until_hours,
    rules: row.rules,
    preset: readPreset(row),
  }));

  /* An application whose contact and registration details could not be read
     is not drawn as a form: an empty form would save blanks over them. */
  if (draftRead.state === "unavailable") {
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host">
        <EmptyState
          icon="hotel"
          title={t.hostWorkspace.apply.failedTitle}
          body={t.hostWorkspace.apply.failedBody}
          action={
            <ButtonLink href={door ? `/host/apply?door=${door.id}` : "/host/apply"} variant="primary" size="lg">
              {t.experienceHost.tryAgain}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false}>
      <HostWizard
        initial={draftRead.draft}
        userId={session.user.id}
        policies={policies}
        locale={locale}
        door={door}
        arrivalCopy={t.afterTheGate.arrival}
        acceptCopy={{ accept: t.payChoice.accept }}
      />
    </HostShell>
  );
}
