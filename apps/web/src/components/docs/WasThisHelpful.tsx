"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { reportPageNotHelpful } from "@/lib/docs/helpful-actions";
import { CopyControl } from "./CopyControl";
import "./docs-kit.css";

/**
 * WAS THIS HELPFUL. A yes is thanked and nothing more (no count is kept, and
 * the page does not pretend one is). A no asks what was missing and, for a
 * signed-in reader, files it as an ordinary support ticket, so the help centre
 * tells the desk which pages are failing, and the reader gets a reference to
 * quote. A signed-out reader is sent to the contact form instead.
 */
export function WasThisHelpful({ path, title }: { path: string; title: string }) {
  const [stage, setStage] = useState<"ask" | "yes" | "no" | "sent" | "signed-out" | "failed">("ask");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const result = await reportPageNotHelpful({ path, title, note });
      if (result.ok) {
        setReference(result.reference);
        setStage("sent");
      } else {
        setMessage(result.message);
        setStage(result.reason === "signed-out" ? "signed-out" : "failed");
      }
    });

  return (
    <section className="nf-dk-helpful" aria-label="Was this page helpful">
      {stage === "ask" && (
        <div className="nf-dk-helpful__row">
          <p className="nf-dk-helpful__q">Was this page helpful?</p>
          <Button variant="secondary" size="sm" onClick={() => setStage("yes")}>
            Yes
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setStage("no")}>
            No
          </Button>
        </div>
      )}
      {stage === "yes" && <p role="status">Thank you. Glad it helped.</p>}
      {(stage === "no" || stage === "failed") && (
        <>
          <label htmlFor="dk-helpful-note" className="nf-dk-helpful__q">
            What was missing or wrong?
          </label>
          <textarea
            id="dk-helpful-note"
            className="nf-field"
            value={note}
            maxLength={1500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="A sentence is enough."
          />
          {stage === "failed" && <p role="alert">{message}</p>}
          <div className="nf-dk-helpful__row">
            <Button variant="primary" size="sm" loading={pending} onClick={send}>
              Send to the support desk
            </Button>
          </div>
        </>
      )}
      {stage === "sent" && (
        <div role="status">
          <p>Thank you. A person on the support desk will read it. Your reference:</p>
          <CopyControl value={reference} />
        </div>
      )}
      {stage === "signed-out" && (
        <p role="status">
          {message} <Link href="/contact">Open the contact form</Link>.
        </p>
      )}
    </section>
  );
}
