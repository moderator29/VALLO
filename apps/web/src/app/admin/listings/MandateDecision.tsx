"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { decideListingMandate } from "@/lib/compliance/beneficial-ownership-actions";
import { ID_DOCUMENT_KINDS, RELATIONSHIPS, VERIFIED_HOW, looksLikeNin } from "@/lib/compliance/beneficial-ownership";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

type Copy = Dictionary["complianceBeneficialOwnership"];

/**
 * SCUML item 17: THE STAFF DECISION ON ONE WAITING MANDATE.
 *
 * Approving records how the reviewer confirmed the principal (a call back to
 * the number above, in person, a video call or documents), when, and against
 * their name, with an ID document's reference if one was seen. A NIN is
 * refused here before it is sent, and again by the database. Refusing asks
 * for the sentence the lister will read, behind a confirm step.
 */
export function MandateDecision({ mandateId, copy }: { mandateId: string; copy: Copy }) {
  const d = copy.decide;
  const a = copy.actingFor;
  const [relationship, setRelationship] = useState("");
  const [how, setHow] = useState("");
  const [idKind, setIdKind] = useState("");
  const [idRef, setIdRef] = useState("");
  const [reason, setReason] = useState("");
  const [refusing, setRefusing] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [pending, startTransition] = useSafeTransition();

  if (done) {
    return (
      <p className="nf-rv-msg" role="status" data-testid="mandate-decided">
        {done === "approved" ? d.approved : d.rejected}
      </p>
    );
  }

  const nin = idRef.trim().length > 0 && looksLikeNin(idRef);

  function run(decision: "approve" | "reject") {
    startTransition(async () => {
      try {
        const result = await decideListingMandate({
          mandateId,
          decision,
          relationship: relationship || null,
          verifiedHow: how || null,
          idDocumentKind: idKind || null,
          idDocumentRef: idRef.trim() || null,
          reason: decision === "reject" ? reason : null,
        });
        if (!result.ok) {
          banner.error(result.error, { retry: () => run(decision) });
          return;
        }
        /* The decided line stays as the card's record (nothing re-reads it
           here); the banner says it as it happens. */
        setDone(decision === "approve" ? "approved" : "rejected");
        banner.success(decision === "approve" ? d.approved : d.rejected);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="grid gap-xs" data-testid="mandate-decision">
      <p className="nf-rv-msg">
        <strong>{d.title}.</strong> {d.lede}
      </p>
      <label className="nf-label" htmlFor={`md-rel-${mandateId}`}>
        {d.relationship}
      </label>
      <select id={`md-rel-${mandateId}`} className="nf-field" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
        <option value="">{d.keep}</option>
        {RELATIONSHIPS.map((r) => (
          <option key={r} value={r}>
            {a.relationships[r]}
          </option>
        ))}
      </select>
      <label className="nf-label" htmlFor={`md-how-${mandateId}`}>
        {d.how}
      </label>
      <select id={`md-how-${mandateId}`} className="nf-field" value={how} onChange={(e) => setHow(e.target.value)}>
        <option value="">{d.pickHow}</option>
        {VERIFIED_HOW.map((h) => (
          <option key={h} value={h}>
            {a.how[h]}
          </option>
        ))}
      </select>
      <label className="nf-label" htmlFor={`md-idk-${mandateId}`}>
        {d.idKind}
      </label>
      <select id={`md-idk-${mandateId}`} className="nf-field" value={idKind} onChange={(e) => setIdKind(e.target.value)}>
        <option value="">{d.idNone}</option>
        {ID_DOCUMENT_KINDS.map((k) => (
          <option key={k} value={k}>
            {a.idKinds[k]}
          </option>
        ))}
      </select>
      {idKind && (
        <>
          <label className="nf-label" htmlFor={`md-idr-${mandateId}`}>
            {d.idRef}
          </label>
          <input
            id={`md-idr-${mandateId}`}
            className="nf-field"
            value={idRef}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setIdRef(e.target.value)}
            aria-describedby={`md-idr-hint-${mandateId}`}
          />
          <p id={`md-idr-hint-${mandateId}`} className="nf-rv-panel__note" style={nin ? { color: "var(--nf-state-error)" } : undefined}>
            {nin ? d.ninRefused : d.idRefHint}
          </p>
        </>
      )}
      {refusing && (
        <>
          <label className="nf-label" htmlFor={`md-reason-${mandateId}`}>
            {d.reason}
          </label>
          <textarea
            id={`md-reason-${mandateId}`}
            className="nf-field"
            rows={2}
            maxLength={600}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </>
      )}
      <div className="flex flex-wrap gap-sm">
        {!refusing ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={pending}
              disabled={!how || nin || (Boolean(idKind) && idRef.trim().length < 3)}
              onClick={() => run("approve")}
              data-testid="mandate-approve"
            >
              {d.approve}
            </Button>
            <Button type="button" variant="dangerQuiet" size="sm" onClick={() => setRefusing(true)} data-testid="mandate-refuse">
              {d.reject}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="dangerQuiet"
              size="sm"
              loading={pending}
              disabled={reason.trim().length < 8}
              onClick={() => run("reject")}
              data-testid="mandate-refuse-confirm"
            >
              {d.confirmReject}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setRefusing(false)}>
              {d.cancel}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
