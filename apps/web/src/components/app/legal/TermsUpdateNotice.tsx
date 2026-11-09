"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import { acknowledgeTermsUpdate } from "@/lib/legal/terms-update-actions";

/**
 * THE NEW TERMS, SHOWN ONCE (founder, 9 November 2026). A sheet with what
 * changed in plain words, links to the full documents, and one button. Closing
 * the sheet without the button only hides it for this visit; "Got it" records
 * it and it never comes back.
 */
export function TermsUpdateNotice() {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();

  const acknowledge = () =>
    start(async () => {
      const result = await acknowledgeTermsUpdate();
      if (result.ok) {
        setOpen(false);
        banner.success("Thanks. You are on the new Terms.");
      } else {
        banner.error(result.error);
      }
    });

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="We have updated our Terms"
      description="One change matters most, and we want you to see it."
      closeLabel="Close"
      detents={[0.7, 0.92]}
      testId="terms-update-notice"
      footer={
        <Button onClick={acknowledge} loading={pending} full>
          Got it
        </Button>
      }
    >
      <div className="grid gap-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        <p>
          The Vallo Guarantee is retired. In its place, section 14 of the Terms says plainly what Vallo does and what it
          does not do:
        </p>
        <ul className="grid list-disc gap-2xs ps-md">
          <li>We check members&rsquo; identity and review listings before they go live.</li>
          <li>Vallo never holds your money.</li>
          <li>Vallo is not a party to your tenancy or sale and does not guarantee the transaction.</li>
          <li>
            If something goes wrong we investigate, act on members who break the rules, give you the evidence we hold,
            and refund anything Vallo itself charged.
          </li>
        </ul>
        <p>
          Read the full <Link className="font-semibold text-[var(--nf-content-link)] underline underline-offset-4" href="/terms">Terms</Link> and{" "}
          <Link className="font-semibold text-[var(--nf-content-link)] underline underline-offset-4" href="/privacy">Privacy policy</Link>.
        </p>
      </div>
    </Sheet>
  );
}
