"use client";

import { useRef, useState } from "react";
import { StatusChip } from "@/components/ui/StatusChip";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Sheet } from "@/components/ui/Sheet";
import { TextArea } from "@/components/ui/Field";
import { State } from "@/components/ui/State";
import { Segmented } from "@/components/ui/Segmented";
import { formatWhen } from "@/lib/offers/format";
import { finishDocumentUpload, openDocument, requestDocument, reviewDocument, startDocumentUpload } from "@/lib/offers/actions";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, DOCUMENT_NOT_VERIFIED, DOCUMENT_STATE_DETAIL, DOCUMENT_STATE_WORD, TITLE_NOT_VERIFIED, documentChip } from "@/lib/offers/words";
import type { DealDocument, DealRoom, DocumentCategory } from "@/lib/offers/types";
import { banner } from "@/lib/ui/toast";
import { useAct } from "./act";

type Decision = "under_review" | "approved" | "rejected" | "more_information";
const DECISIONS: { value: Decision; label: string }[] = [
  { value: "under_review", label: "Mark under review" },
  { value: "approved", label: "Approve" },
  { value: "more_information", label: "Ask for more" },
  { value: "rejected", label: "Reject" },
];

/**
 * The checklist and the vault. Six document states are six different chips with
 * six different words: requested, uploaded, under review, approved, rejected and
 * more information needed. Nothing here says a document is verified because it
 * was uploaded, and approving one is not a check of title. Files go to private
 * storage through a short-lived signed address and every open is logged.
 */
export function DocumentsPanel({ room }: { room: DealRoom }) {
  const act = useAct();
  const [requesting, setRequesting] = useState(false);
  const [reviewing, setReviewing] = useState<DealDocument | null>(null);
  const live = room.offer.state === "open" || room.offer.state === "agreed";

  const requestedCats = new Set(room.documents.map((d) => d.category));
  const missing = DOCUMENT_CATEGORIES.filter((c) => !requestedCats.has(c) && c !== "inspection_report");

  return (
    <div className="grid gap-md" data-testid="panel-documents">
      <p className="nf-body text-[var(--nf-content-secondary)]">{DOCUMENT_NOT_VERIFIED}</p>
      {room.documents.length === 0 ? (
        <State kind="empty" compact title="No documents requested yet" body="Ask for the documents you want to see, such as the Certificate of Occupancy or the Deed of Assignment." />
      ) : (
        <Panel variant="card" className="p-card">
          {room.documents.map((d) => (
            <DocumentRow key={d.id} doc={d} room={room} live={live} onReview={() => setReviewing(d)} />
          ))}
        </Panel>
      )}
      {live ? (
        <Button variant="secondary" leadingIcon="plus" onClick={() => setRequesting(true)} data-testid="request-document">
          Request a document
        </Button>
      ) : null}
      <p className="nf-body-sm text-[var(--nf-content-muted)]">{TITLE_NOT_VERIFIED}</p>

      <Sheet open={requesting} onOpenChange={setRequesting} title="Request a document" detents={[0.8]}>
        <RequestForm room={room} options={missing.length ? missing : [...DOCUMENT_CATEGORIES]} onDone={() => setRequesting(false)} />
      </Sheet>
      <Sheet open={reviewing !== null} onOpenChange={(o) => !o && setReviewing(null)} title={reviewing ? `Review: ${DOCUMENT_CATEGORY_LABEL[reviewing.category]}` : "Review"} detents={[0.8]}>
        {reviewing ? <ReviewForm room={room} doc={reviewing} onDone={() => setReviewing(null)} /> : null}
      </Sheet>
      <span className="sr-only" aria-live="polite">
        {act.pending ? "Working" : ""}
      </span>
    </div>
  );
}

function DocumentRow({ doc, room, live, onReview }: { doc: DealDocument; room: DealRoom; live: boolean; onReview: () => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const act = useAct();
  const [busy, setBusy] = useState(false);
  const has = doc.state !== "requested";

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const start = await startDocumentUpload({ offerId: room.offer.id, documentId: doc.id, fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size });
      if (!start.ok) return void banner.error(start.error);
      const put = await fetch(start.data.uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
      if (!put.ok) return void banner.error("The upload did not finish. Try again.", { retry: () => void upload(file) });
      const done = await act.run(() => finishDocumentUpload({ offerId: room.offer.id, documentId: doc.id, path: start.data.path }), "Uploaded. It has not been checked yet.");
      void done;
    } catch {
      banner.error("The upload did not finish. Check your connection and try again.", { retry: () => void upload(file) });
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setBusy(true);
    try {
      const result = await openDocument({ offerId: room.offer.id, documentId: doc.id });
      if (result.ok) window.open(result.data.url, "_blank", "noopener,noreferrer");
      else banner.error(result.error);
    } catch {
      banner.error("We could not open that document. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nf-ofr-doc" data-testid="document-row" data-state={doc.state}>
      <span className="font-semibold text-[var(--nf-content-primary)]">{DOCUMENT_CATEGORY_LABEL[doc.category]}</span>
      <StatusChip state={documentChip(doc.state)} size="sm">
        {DOCUMENT_STATE_WORD[doc.state]}
      </StatusChip>
      <p className="nf-ofr-doc__line">
        {DOCUMENT_STATE_DETAIL[doc.state]}
        {doc.uploadedAt ? ` Uploaded by ${doc.uploadedByName ?? "a party"}, ${formatWhen(doc.uploadedAt)}, version ${doc.version}.` : ""}
        {doc.reviewedAt ? ` Reviewed by ${doc.reviewedByName ?? "a reviewer"}, ${formatWhen(doc.reviewedAt)}.` : ""}
        {doc.note ? ` Note: ${doc.note}` : ""}
      </p>
      {live ? (
        <div className="nf-ofr-doc__actions">
          {has ? (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void open()} data-testid="doc-open">
              Open
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()} data-testid="doc-upload">
            {has ? "Upload a new version" : "Upload"}
          </Button>
          {has && doc.uploadedBy !== room.viewerSide ? (
            <Button size="sm" variant="quiet" onClick={onReview} data-testid="doc-review">
              Review
            </Button>
          ) : null}
          <input ref={input} type="file" className="sr-only" tabIndex={-1} accept="application/pdf,image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        </div>
      ) : null}
    </div>
  );
}

function RequestForm({ room, options, onDone }: { room: DealRoom; options: readonly DocumentCategory[]; onDone: () => void }) {
  const [category, setCategory] = useState<DocumentCategory>(options[0]!);
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <Segmented
        label="Which document"
        semantics="radio"
        stack
        full
        value={category}
        onChange={setCategory}
        options={options.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABEL[c] }))}
      />
      <Button variant="primary" size="lg" full loading={pending} onClick={() => void run(() => requestDocument({ offerId: room.offer.id, category }), "Document requested.", onDone)} data-testid="confirm-request-document">
        Request it
      </Button>
    </div>
  );
}

function ReviewForm({ room, doc, onDone }: { room: DealRoom; doc: DealDocument; onDone: () => void }) {
  const [decision, setDecision] = useState<Decision>("under_review");
  const [note, setNote] = useState("");
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <p className="nf-body-sm text-[var(--nf-content-muted)]">Approving a document says you reviewed it. It does not verify the property&apos;s title.</p>
      <Segmented label="Your decision" semantics="radio" stack full value={decision} onChange={setDecision} options={DECISIONS} />
      <TextArea label="Note" optionalText="Optional" value={note} maxLength={400} rows={3} onChange={(e) => setNote(e.target.value)} hint="The uploader reads this." />
      <Button variant="primary" size="lg" full loading={pending} onClick={() => void run(() => reviewDocument({ offerId: room.offer.id, documentId: doc.id, decision, note: note.trim() || null }), "Your decision was recorded.", onDone)} data-testid="confirm-review">
        Record decision
      </Button>
    </div>
  );
}
