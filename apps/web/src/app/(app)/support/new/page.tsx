import type { Metadata } from "next";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyActions } from "@/components/app/EmptyActions";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { resolveSession } from "@/lib/actions/session";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { loadMyRelatedRecords } from "@/lib/support/related-records";
import type { QueryKind, RelatedRecord } from "@/lib/support/new-query";
import { NewQueryForm } from "./NewQueryForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceInbox.support.pages.writeToSupport };
}

/**
 * A new question or problem for the support team.
 *
 * `?kind=problem` opens it as a problem report and `?topic=<code>` preselects
 * a topic, so a screen that knows what went wrong (a failed payment, a
 * booking page) can link here with the right door already open. The member's
 * own records are read here on their own client and handed to the form as the
 * optional "link a record" list.
 */
export default async function NewSupportQueryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const kindParam = typeof params.kind === "string" ? params.kind : undefined;
  const kind: QueryKind | undefined = kindParam === "problem" ? "problem" : kindParam === "question" ? "question" : undefined;
  const topic = typeof params.topic === "string" ? params.topic : null;

  const session = await resolveSession();
  const w = getDictionary(await getLocale()).experienceInbox.support.pages;
  const title = kind === "problem" ? w.reportProblem : w.writeToSupport;

  if (session.state !== "signed-in") {
    return (
      <PageFrame title={title} fallback="/support" width="narrow">
        <div>
        <EmptyState
          icon="support-chat"
          title={w.newSignedOutTitle}
          body={w.newSignedOutBody}
          action={<EmptyActions primary={{ label: w.signIn, href: "/sign-in?next=%2Fsupport%2Fnew" }} />}
          secondary={
            <ButtonLink href="/contact" variant="ghost" size="lg">
              {w.contactForm}
            </ButtonLink>
          }
        />
        </div>
      </PageFrame>
    );
  }

  let records: RelatedRecord[] = [];
  try {
    records = await loadMyRelatedRecords(session.supabase, session.user.id, await getLocale());
  } catch {
    records = [];
  }

  return (
    <PageFrame title={title} subtitle={w.newSub} fallback="/support" width="narrow">
      <div className="pb-[env(safe-area-inset-bottom)]">
      <NewQueryForm initialKind={kind} initialTopic={topic} records={records} copy={getDictionary(await getLocale()).experienceInbox.support.form} />
      </div>
    </PageFrame>
  );
}
