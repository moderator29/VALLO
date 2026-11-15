"use client";

import { banner } from "@/lib/ui/toast";
import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { messageVenue } from "@/lib/venue-messages/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * "Message" on a hotel or a restaurant: the same first-message box a property
 * listing opens at `/messages/new`, in a sheet over the venue so the guest
 * never loses the page they were reading. Sending opens (or finds) the thread
 * and lands in it; nothing is created until the first message is sent. The
 * sign-in gate is the caller's `AuthGate`, as it is for "Message agent".
 */
export function MessageVenue({
  businessId,
  venueName,
  label,
}: {
  businessId: string;
  venueName: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [phoneGate, setPhoneGate] = useState(false);
  const [pending, startTransition] = useSafeTransition();
  const field = useRef<HTMLTextAreaElement | null>(null);

  function send() {
    setPhoneGate(false);
    startTransition(async () => {
      try {
        const result = await messageVenue({ businessId, body });
        if (result.ok) {
          setOpen(false);
          router.push(`/messages/${result.data.conversationId}`);
        } else {
          /* Said by the one banner (Grade 1), above this sheet; the phone
             step, when that is what stands in the way, stays here as its link. */
          banner.error(result.error, { "data-testid": "venue-message-error" });
          setPhoneGate(isPhoneGate(result));
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0"
        data-testid="host-message"
      >
        {label}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`Message ${venueName}`}
        detents={[0.6, 0.92]}
        closeLabel="Close"
        initialFocus={field}
        apply={{
          label: "Send",
          onClick: send,
          disabled: pending || body.trim().length === 0,
          loading: pending,
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="grid gap-sm"
          data-testid="venue-first-message"
        >
          <label className="grid gap-3xs">
            <span className="nf-label">Your first message to {venueName}</span>
            <textarea autoCapitalize="sentences" enterKeyHint="enter"
              ref={field}
              name="body"
              required
              maxLength={2000}
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ask about rooms, dates, a table, parking or anything else before you book."
              className="nf-field"
            />
          </label>
          <PhoneGateLink show={phoneGate} full />
          <p className="nf-caption">Keep every chat and payment inside Vallo so it stays on the record.</p>
        </form>
      </Sheet>
    </>
  );
}
