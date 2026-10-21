import { NO_CUSTODY_SENTENCE, OFF_PLATFORM_SENTENCE, OWNER_PAID_WHEN } from "../money/copy";
import { appUrl, button, compose, fitSubject, heading, hello, money, note, paragraph, quoteLine, rows, type Block, type ReceiptRow } from "./render";
import type { EmailKind } from "./icons";
import type { EmailMessage } from "./messages";

/**
 * THE AGREEMENT AND GUARANTEE EMAILS (Track A, 25 September 2026).
 *
 * The admin gate between an agreement and payment tells both parties the
 * moment it decides, by email and in the app. These are the emails. Each one
 * says what was decided, what it means for money (nothing has moved; payment
 * opens now, or does not), and the one thing to do next.
 */

function message(icon: EmailKind, subject: string, preheader: string, blocks: readonly (Block | null | false)[], footer: string): EmailMessage {
  const composed = compose({ icon, preheader, blocks, footerLines: [footer] });
  return { subject, preheader: composed.preheader, html: composed.html, text: composed.text };
}

export type AgreementEmailData = {
  name: string | null;
  viewer: "renter" | "owner";
  kind: "rent" | "stay";
  listingTitle: string | null;
  amountMinor: number;
  agreementId: string;
  reason?: string | null;
};

function place(data: AgreementEmailData): string {
  return data.listingTitle ?? (data.kind === "rent" ? "the property" : "your stay");
}

function facts(data: AgreementEmailData): ReceiptRow[] {
  return [
    { label: "Property", value: place(data) },
    { label: "Total agreed", value: money(data.amountMinor), strong: true },
  ];
}

export function agreementApproved(data: AgreementEmailData): EmailMessage {
  const renter = data.viewer === "renter";
  return message(
    "agreementApproved",
    fitSubject("Approved, payment is open", data.listingTitle),
    renter
      ? `${money(data.amountMinor)} agreed. You can pay in the app now.`
      : `${money(data.amountMinor)} agreed. The renter can pay now.`,
    [
      heading("Agreement approved"),
      paragraph(
        /* Approval is usually the system's, on the second confirmation (D83); only a flagged card deal is approved by a person. */
        `${hello(data.name)} The agreement for ${place(data)} that both of you confirmed is approved.`,
      ),
      rows(facts(data)),
      paragraph(
        renter
          ? "Payment is open now, in the app. Pay through Vallo only."
          : `The renter can pay now. ${OWNER_PAID_WHEN}`,
      ),
      paragraph(NO_CUSTODY_SENTENCE),
      button(renter ? "Pay in the app" : "Open the agreement", appUrl(`/agreements/${data.agreementId}`)),
      note(OFF_PLATFORM_SENTENCE),
    ],
    "You are receiving this because you are a party to an agreement on Vallo.",
  );
}

export function agreementRejected(data: AgreementEmailData): EmailMessage {
  return message(
    "agreementRejected",
    fitSubject("Agreement sent back", data.listingTitle),
    data.reason ? quoteLine("Why", data.reason) : "Vallo did not approve it yet. Nothing has been charged.",
    [
      heading("Agreement sent back"),
      paragraph(`${hello(data.name)} Vallo reviewed the agreement for ${place(data)} and did not approve it yet.`),
      data.reason ? rows([{ label: "Why", value: data.reason, strong: true }]) : null,
      paragraph("Nothing has been charged. Change what the reason names, and both of you confirm the new version."),
      button("Open the agreement", appUrl(`/agreements/${data.agreementId}`)),
      note(OFF_PLATFORM_SENTENCE),
    ],
    "You are receiving this because you are a party to an agreement on Vallo.",
  );
}

export function agreementWaiting(data: AgreementEmailData): EmailMessage {
  return message(
    "agreementWaiting",
    fitSubject("Agreement to confirm", data.listingTitle),
    `${money(data.amountMinor)} in total. Read the terms and confirm them in the app.`,
    [
      heading("Agreement to confirm"),
      paragraph(
        `${hello(data.name)} An agreement for ${place(data)} has been drawn up. Read the terms and confirm them in the app. Once both of you confirm, Vallo reviews it and then payment opens.`,
      ),
      rows(facts(data)),
      button("Read the terms", appUrl(`/agreements/${data.agreementId}`)),
      note(OFF_PLATFORM_SENTENCE),
    ],
    "You are receiving this because you are a party to an agreement on Vallo.",
  );
}

export type ClaimDecidedData = {
  name: string | null;
  decision: "approve" | "reject";
  amountMinor: number | null;
  reason: string | null;
  agreementId: string;
};

export function guaranteeClaimDecided(data: ClaimDecidedData): EmailMessage {
  const approved = data.decision === "approve";
  return message(
    "guaranteeClaimDecided",
    approved ? "Vallo Guarantee claim approved" : "Vallo Guarantee claim not approved",
    approved
      ? data.amountMinor !== null
        ? `Vallo approved ${money(data.amountMinor)}. It will be paid to your bank account.`
        : "Vallo approved your claim. It will be paid to your bank account."
      : data.reason
        ? quoteLine("Why", data.reason)
        : "A person reviewed it against the inspection report.",
    [
      heading(approved ? "Claim approved" : "Claim not approved"),
      paragraph(
        approved
          ? `${hello(data.name)} Vallo approved ${data.amountMinor !== null ? money(data.amountMinor) : "your claim"} from the Vallo Guarantee. It will be paid to your bank account, and you will be told when it is sent.`
          : `${hello(data.name)} Vallo reviewed your claim against the inspection report and did not approve it.`,
      ),
      data.reason ? rows([{ label: approved ? "Note" : "Why", value: data.reason }]) : null,
      button("Open the agreement", appUrl(`/agreements/${data.agreementId}`)),
    ],
    "You are receiving this because you made a claim on the Vallo Guarantee.",
  );
}
