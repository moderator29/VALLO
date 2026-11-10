"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { openRoommateChat } from "@/lib/features/roommates/actions";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { fill } from "./format";
import { HandshakeArt } from "./RoommatesArt";
import "./roommates-welcome.css";

const PIECES = 22;

/**
 * "YOU'RE CONNECTED": the payoff when two people say yes to each other. A deep
 * blue night, confetti that plays once (never under reduced motion, Calm or
 * Off), Vallo's own clasp artwork, and two actions: Start chat (the normal
 * Messages thread, never a separate inbox) and View profile.
 */
export function ConnectedScreen({ interestId, userId, name }: { interestId: string; userId: string; name: string }) {
  const copy = useScopedCopy("roommates");
  const C = copy.connectedScreen;
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const first = name.split(" ")[0] ?? name;
  const chat = () =>
    start(async () => {
      try {
        const r = await openRoommateChat(interestId);
        if (!r.ok) {
          feedback("error");
          banner.error(r.error, { retry: chat });
          return;
        }
        feedback("confirm");
        router.push(`/messages/${r.data.conversationId}`);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return (
    <main className="nf-rmcn" data-theme="dark" aria-labelledby="rmcn-title" data-testid="roommates-connected">
      <span className="nf-rmcn__confetti" aria-hidden="true">
        {Array.from({ length: PIECES }, (_, i) => (
          <span key={i} className="nf-rmcn__piece" style={{ "--nf-rmcn-i": i, "--nf-rmcn-a": `${(360 / PIECES) * i}deg` } as CSSProperties} />
        ))}
      </span>
      <HandshakeArt className="nf-rmcn__art" />
      <h1 id="rmcn-title" className="nf-rmcn__title">
        {C.title}
      </h1>
      <p className="nf-rmcn__body">{fill(C.body, { name: first })}</p>
      <div className="nf-rmcn__actions">
        <Button variant="primary" size="lg" full glow leadingIcon="chat-bubble" loading={pending} onClick={chat} data-testid="connected-chat">
          {C.startChat}
        </Button>
        <ButtonLink href={ROOMMATES_ROUTES.person(userId)} variant="secondary" size="lg" full data-testid="connected-profile">
          {C.viewProfile}
        </ButtonLink>
      </div>
    </main>
  );
}
