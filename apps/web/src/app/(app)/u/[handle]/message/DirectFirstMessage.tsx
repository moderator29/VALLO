"use client";

import { banner } from "@/lib/ui/toast";
import { useComposerClearance } from "@/lib/ui/composer-clearance";
import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackControl } from "@/components/ui/BackControl";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { initial } from "@/lib/text/initial";
import { sendDirectMessage } from "@/lib/messages/direct-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
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
  const [phoneGate, setPhoneGate] = useState(false);
  const [pending, start] = useSafeTransition();
  /* The quick pill sits just above this bar. */
  const composerRef = useRef<HTMLFormElement | null>(null);
  useComposerClearance(composerRef);

  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (body.trim().length === 0 || pending) return;
    setPhoneGate(false);
    start(async () => {
      try {
        const result = await sendDirectMessage({ handle, body });
        if (result.ok) router.replace(`/messages/${result.data.conversationId}`);
        else {
          /* Said by the one banner (Grade 1); the phone step, when that is
             what stands in the way, stays here as its link. */
          banner.error(result.error);
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
        <PhoneGateLink show={phoneGate} full />
      </div>

      {/*
        THE PLATFORM'S INPUT BAR, NOT THE ONE THIS SCREEN WAS BORN WITH (the
        founder, 12 November 2026: "it's like the old one ... even for new
        conversations with agent"). The input bar pass of 7 November 2026 gave
        the chat one floating rounded bar and left this screen on the shape it
        replaced: measured in WebKit at 390, a 314 by 44 field with a 14px
        corner, no glass, no shadow, beside the thread's 358 by 50 island with
        blur(26px) saturate(1.65) and the floating shadow. Same product, two
        composers, and this is the one a person meets FIRST.

        The `__box` wrapper is the whole fix: `input-bar.css` draws the bar off
        that one element, so this composer now takes the island, its blue send
        disc and its 16px field with no new rule of its own. It still sends
        one message with one control, because that is all this screen does.
      */}
      <form ref={composerRef} onSubmit={send} className="nf-composer nf-direct__composer" data-composer="">
        <div className="nf-composer__box">
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
            autoCapitalize="sentences"
            enterKeyHint="send"
            autoFocus
            className="nf-composer__field"
          />
          <div className="nf-composer__row">
            <button
              type="submit"
              aria-label={pending ? copy.sending : copy.send}
              disabled={pending || body.trim().length === 0}
              className="nf-composer__send"
            >
              <UiIcon name="arrow-right" size={20} className="-rotate-45" />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
