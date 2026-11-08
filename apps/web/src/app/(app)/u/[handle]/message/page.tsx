import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";
import { withNext } from "@/lib/auth/next-link";
import { readDirectTarget } from "@/lib/messages/direct";
import { DirectFirstMessage } from "./DirectFirstMessage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceInbox.direct.metaTitle };
}

/**
 * `/u/<handle>/message`: write to a member from their profile.
 *
 * Signed in, an existing chat with them opens at once; otherwise the first
 * message makes it. Every other state is a plain screen with a way forward,
 * never a blank page: signed out (sign in and come straight back), nobody by
 * that name (or a block in either direction, which hides them), yourself.
 */
export default async function MessagePersonPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params;
  const t = getDictionary(await getLocale());
  const w = t.experienceInbox.direct;
  const read = await readDirectTarget(rawHandle);

  if (read.state === "ready") {
    if (read.conversationId) redirect(`/messages/${read.conversationId}`);
    const name = read.target.displayLabel;
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={w.title.replace("{name}", name)} fallback={`/u/${read.target.handle}`} />
        <DirectFirstMessage
          handle={read.target.handle}
          name={name}
          avatarUrl={read.target.avatarUrl}
          copy={{
            placeholder: w.placeholder.replace("{name}", name),
            hint: w.hint,
            send: w.send,
            sending: w.sending,
          }}
        />
      </div>
    );
  }

  const back = read.state === "unconfigured" ? "/u" : `/u/${read.handle}`;

  /* The profile's own rule (`message-door.ts`): this person takes a new chat
     only from somebody who follows them, so the way on is their profile, where
     Follow is. */
  if (read.state === "follow-first") {
    const name = read.target.displayLabel;
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={w.metaTitle} fallback={back} />
        <EmptyState
          icon="chat-duo"
          title={t.social.followFirst.title.replace("{name}", name)}
          body={t.social.followFirst.body}
          action={<EmptyActions primary={{ label: w.back, href: back }} />}
          data-testid="direct-follow-first"
        />
      </div>
    );
  }

  if (read.state === "signed-out") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={w.metaTitle} fallback={back} />
        <EmptyState
          icon="chat-duo"
          title={w.signedOutTitle.replace("{name}", `@${read.handle}`)}
          body={w.signedOutBody}
          action={
            <EmptyActions
              primary={{ label: w.signIn, href: withNext("/sign-in", `/u/${read.handle}/message`) }}
              secondary={{ label: w.back, href: back }}
            />
          }
        />
      </div>
    );
  }

  if (read.state === "self") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={w.metaTitle} fallback={back} />
        <EmptyState
          icon="chat-duo"
          title={w.selfTitle}
          body={w.selfBody}
          action={<EmptyActions primary={{ label: w.inbox, href: "/messages" }} secondary={{ label: w.findPeople, href: "/u" }} />}
        />
      </div>
    );
  }

  if (read.state === "unconfigured") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={w.metaTitle} fallback="/u" />
        <EmptyState
          icon="chat-duo"
          title={w.unreachableTitle}
          body={w.unreachableBody}
          action={<EmptyActions primary={{ label: w.inbox, href: "/messages" }} />}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={w.metaTitle} fallback="/u" />
      <EmptyState
        icon="chat-duo"
        title={w.notFoundTitle}
        body={w.notFoundBody}
        action={<EmptyActions primary={{ label: w.findPeople, href: "/u" }} />}
      />
    </div>
  );
}
