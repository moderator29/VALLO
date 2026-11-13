"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { acceptCommunityPromise, readMyPromise, type PromiseState } from "@/lib/trust/promise-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { proofDate } from "@/lib/trust/proof-strip";
import type { Locale } from "@vallo/i18n/core";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import "./trust-checks.css";

/**
 * "I ACCEPT THE COMMUNITY PROMISE", AT THE FOOT OF THE PROMISE ITSELF.
 *
 * The page is public and static, so this asks for the member's own state
 * after it mounts and draws nothing until it knows. Signed out, or when the
 * record cannot be read, it stays nothing: a visitor reads the promise, and
 * an action that could not be recorded is never offered. A member who has
 * accepted sees the day they did, in place of the button.
 */
export function PromiseFoot({
  words,
  locale,
}: {
  words: { accept: string; accepted: string; done: string; failed: string; signedOut: string; note: string };
  locale: Locale;
}) {
  const [state, setState] = useState<PromiseState | null>(null);
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    let live = true;
    readMyPromise()
      .then((next) => {
        if (live) setState(next);
      })
      .catch(() => {
        /* Unknown is drawn as nothing. */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!state || state.state === "signed-out" || state.state === "unavailable") return null;

  const accept = () =>
    start(async () => {
      try {
        const result = await acceptCommunityPromise();
        if (result.ok) {
          setState({ state: "accepted", at: result.at });
          banner.success(words.done);
        } else {
          banner.error(result.reason === "signed-out" ? words.signedOut : words.failed);
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  if (state.state === "accepted") {
    const date = proofDate(state.at, locale);
    return (
      <p className="nf-promise-foot nf-promise-foot--done" role="status" data-testid="promise-accepted">
        {words.accepted.replace("{date}", date)}
      </p>
    );
  }

  return (
    <div className="nf-promise-foot" data-testid="promise-foot">
      <p className="nf-promise-foot__note">{words.note}</p>
      <Button onClick={accept} loading={pending} size="lg" data-testid="promise-accept-foot">
        {words.accept}
      </Button>
    </div>
  );
}
