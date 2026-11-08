"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { panelClass } from "@/components/ui/Panel";
import { TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { verifyIdentityWithVnin } from "@/lib/identity/actions";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * THE vNIN ROUTE TO THE IDENTITY RUNG (V-49). Drawn by the verification page
 * only when `vnin_identity` is on and a merchant code is configured; the photo
 * route below it stays, as the fallback for a broken NIMC record. States:
 * typing, checking, passed, sent to a person, and every refusal in words.
 */
export function VninPanel({
  copy,
  merchantCode,
  success,
}: {
  copy: Dictionary["trustVisible"]["vnin"];
  /** The page's `t.success`, for "Identity matched". Absent, no sheet. */
  success?: SuccessWords;
  merchantCode: string;
}) {
  const [vnin, setVnin] = useState("");
  const [pending, startTransition] = useSafeTransition();
  const [matched, setMatched] = useState(false);
  const matchedWords = success ? successCopy(success, "identityMatched") : null;

  function submit() {
    startTransition(async () => {
      try {
        const result = await verifyIdentityWithVnin({ vnin });
        if (result.ok) {
          if (result.data.status === "passed") {
            setMatched(true);
          } else {
            banner.success(result.data.message);
          }
        } else {
          banner.error(result.error, { retry: submit });
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <section className={panelClass({ className: "mb-block grid gap-md p-card" })} aria-label={copy.title} data-testid="vnin-panel">
      <h2 className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.title}</h2>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.lede.replace("{code}", merchantCode)}</p>
      <TextField
        label={copy.label}
        value={vnin}
        autoComplete="off"
        enterKeyHint="go"
        maxLength={24}
        onChange={(event) => setVnin(event.target.value)}
      />
      <Button type="button" variant="primary" full loading={pending} onClick={submit} disabled={vnin.trim() === ""}>
        {pending ? copy.checking : copy.submit}
      </Button>
      {success && matchedWords ? (
        <SuccessSheet
          open={matched}
          onOpenChange={setMatched}
          variant={matchedWords.variant}
          object={matchedWords.object}
          title={matchedWords.title}
          body={matchedWords.body}
          primary={{ label: success.continue }}
        />
      ) : null}
    </section>
  );
}
