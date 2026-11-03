"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BackControl } from "@/components/ui/BackControl";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { initial } from "@/lib/text/initial";
import { sendDirectMessage } from "@/lib/messages/direct-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE FIRST MESSAGE TO A MEMBER, from their profile. It opens as a chat, not a
 * form: the person's name and avatar in the header, an empty conversation,
 * and the message box docked at the foot, ready to type in. Sending opens the
 * one chat between the two people and posts the message together; leaving
 * the screen writes nothing, so an abandoned tap leaves no empty chat behind.
 */
export function DirectFirstMessage({
  handle,
  name,
  avatarUrl,
  copy,
}: {
  handle: string;
  name: string;
  avatarUrl: string;
  copy: { placeholder: string; hint: string; send: string; sending: string };
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phoneGate, setPhoneGate] = useState(false);
  const [pending, start] = useTransition();

  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (body.trim().length === 0 || pending) return;
    setError(null);
    setPhoneGate(false);
    start(async () => {
      try {
        const result = await sendDirectMessage({ handle, body });
        if (result.ok) router.replace(`/messages/${result.data.conversationId}`);
        else {
          setError(result.error);
          setPhoneGate(isPhoneGate(result));
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <section className="nf-direct" data-testid="direct-first-message" aria-label={name}>
      <header className="nf-direct__head">
        <BackControl fallback={`/u/${handle}`} surface="round" />
        <span className="nf-direct__avatar" aria-hidden="true">
          {avatarUrl ? (
            <RemoteImage src={avatarUrl} alt="" width={96} height={96} sizes="40px" />
          ) : (
            <span>{initial(name)}</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="nf-direct__name">{name}</span>
          <span className="nf-direct__handle">@{handle}</span>
        </span>
      </header>

      <div className="nf-direct__body">
        <p className="nf-direct__hint">{copy.hint}</p>
        {error ? (
          <>
            <p role="alert" className="nf-caption text-[var(--nf-state-error)]">
              {error}
            </p>
            <PhoneGateLink show={phoneGate} full />
          </>
        ) : null}
      </div>

      <form onSubmit={send} className="nf-composer nf-direct__composer">
        <label htmlFor="direct-body" className="sr-only">
          {copy.placeholder}
        </label>
        <input
          id="direct-body"
          name="body"
          type="text"
          required
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={copy.placeholder}
          autoComplete="off"
          enterKeyHint="send"
          autoFocus
          className="nf-composer__field"
        />
        <button
          type="submit"
          aria-label={pending ? copy.sending : copy.send}
          disabled={pending || body.trim().length === 0}
          className="nf-composer__send"
        >
          <UiIcon name="arrow-right" size={20} className="-rotate-45" />
        </button>
      </form>
    </section>
  );
}
