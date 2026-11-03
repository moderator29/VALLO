"use client";

import { useState, useTransition } from "react";
import type { RespondCopy } from "./agent-copy";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { TYPE } from "@/components/app/Screen";
import { UploadCard, newBatchId, type UploadState } from "@/components/supply/UploadCard";
import { respondToReview } from "@/lib/agent/application-respond";
import { RESPONSE_MAX_CHARS } from "@/lib/agent/application-respond-model";
import { WorkspaceAcceptance } from "@/components/legal/WorkspaceAcceptance";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * SUP-05: the way forward from "Needs more information".
 *
 * An answer in words, an identity document and a proof of address (each
 * optional, but not all of them empty), sent back to the reviewer in one step. The reviewer's note is shown above this on the status page, so the
 * question and the answer sit together.
 *
 * A BUSINESS ALSO GETS A SLOT FOR ITS REGISTRATION. The commonest thing a
 * reviewer asks a business for is the CAC certificate, and with only an
 * identity and an address slot the applicant could send it only mislabelled
 * as one of those, or not at all.
 */
export function RespondToReview({ t, business = false }: { t: RespondCopy; business?: boolean }) {
  const copy = t.agent.status.respond;
  const [batchId] = useState(newBatchId);
  const [answer, setAnswer] = useState("");
  const [identity, setIdentity] = useState<UploadState | null>(null);
  const [address, setAddress] = useState<UploadState | null>(null);
  const [registration, setRegistration] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPay, setAcceptPay] = useState(false);
  const [askedTicks, setAskedTicks] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p role="status" className={`nf-panel nf-panel--card p-md ${TYPE.body}`}>
        {copy.sent}
      </p>
    );
  }

  function send() {
    setError(null);
    /* Ruling 6: the resubmission records the Terms, the Privacy Policy and
       the pay-on-Vallo statement, as the first submission did. */
    if (!acceptTerms || !acceptPay) {
      setAskedTicks(true);
      return;
    }
    const documents = [
      ...(identity ? [{ kind: "identity" as const, path: identity.path }] : []),
      ...(address ? [{ kind: "address" as const, path: address.path }] : []),
      ...(business && registration ? [{ kind: "business" as const, path: registration.path }] : []),
    ];
    startTransition(async () => {
      try {
        const result = await respondToReview({ answer, documents, acceptTerms, acceptPayOnVallo: acceptPay });
        if (result.ok) setSent(true);
        else setError(result.error);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <section aria-labelledby="respond-title" className="nf-panel nf-panel--card flex flex-col gap-md p-md sm:p-lg">
      <div>
        <h2 id="respond-title" className={TYPE.sectionTitle}>
          {copy.title}
        </h2>
        <p className={`mt-xs ${TYPE.body}`}>{copy.body}</p>
      </div>

      <TextArea
        label={copy.answerLabel}
        hint={copy.answerHint}
        value={answer}
        maxLength={RESPONSE_MAX_CHARS}
        onChange={(event) => setAnswer(event.target.value)}
        rows={5}
      />

      <UploadCard
        t={t}
        object="doc-shield"
        title={copy.attachIdentityTitle}
        body={copy.attachBody}
        slot="response-identity"
        batchId={batchId}
        value={identity}
        onChange={setIdentity}
      />
      <UploadCard
        t={t}
        object="doc-shield"
        title={copy.attachAddressTitle}
        body={copy.attachBody}
        slot="response-address"
        batchId={batchId}
        value={address}
        onChange={setAddress}
      />
      {business ? (
        <UploadCard
          t={t}
          object="doc-shield"
          title={copy.attachBusinessTitle}
          body={copy.attachBody}
          slot="response-business"
          batchId={batchId}
          value={registration}
          onChange={setRegistration}
        />
      ) : null}

      <WorkspaceAcceptance
        copy={t.payChoice}
        terms={acceptTerms}
        pay={acceptPay}
        onTerms={setAcceptTerms}
        onPay={setAcceptPay}
        showError={askedTicks}
      />

      {error ? (
        <p role="alert" className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-state-error)]">
          {error}
        </p>
      ) : null}

      <Button variant="primary" size="lg" onClick={send} disabled={pending}>
        {pending ? copy.sending : copy.send}
      </Button>
    </section>
  );
}
