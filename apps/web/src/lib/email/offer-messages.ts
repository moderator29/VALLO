import { appUrl, button, compose, fitSubject, heading, hello, money, note, paragraph, rows, type Block } from "./render";
import type { EmailMessage } from "./messages";

/**
 * THE OFFER AND DEAL ROOM EMAILS (10 November 2026). One builder for the
 * whole family, so every one says the same careful things about money:
 * nothing has been charged, Vallo does not take money for a purchase, and an
 * agreed offer is not a sale. Each carries one action, into the Deal Room.
 */
export type OfferTemplate =
  | "offer.received"
  | "offer.countered"
  | "offer.agreed"
  | "offer.declined"
  | "offer.withdrawn"
  | "offer.expired"
  | "offer.reminder"
  | "offer.info_requested"
  | "offer.info_provided"
  | "offer.stage"
  | "offer.document"
  | "offer.disputed"
  | "offer.cancelled";

export type OfferEmailData = {
  name: string | null;
  listingTitle: string | null;
  amountMinor: number | null;
  reference: string | null;
  agreementId: string;
};

const WORDS: Record<OfferTemplate, { subject: string; lead: string; line: string; action: string }> = {
  "offer.received": { subject: "New offer", lead: "You have a new offer", line: "Read it in the Deal Room and answer: accept, decline, counter, or ask a question.", action: "Open the Deal Room" },
  "offer.countered": { subject: "New terms proposed", lead: "New terms were proposed", line: "Nothing is agreed until one side accepts the version on the table.", action: "Read the terms" },
  "offer.agreed": { subject: "Terms agreed", lead: "Terms are agreed", line: "This is not a sale yet. The inspection, the documents, the solicitors and the transfer still have to happen. Vallo records the deal and takes no money for it.", action: "Open the Deal Room" },
  "offer.declined": { subject: "Offer declined", lead: "The offer was declined", line: "You can look at other properties, or message the agent from the Deal Room.", action: "Open the Deal Room" },
  "offer.withdrawn": { subject: "Offer withdrawn", lead: "The offer was withdrawn", line: "Nothing was charged and nothing is owed through Vallo.", action: "Open the Deal Room" },
  "offer.expired": { subject: "Offer expired", lead: "The offer reached its expiry date", line: "No terms were agreed. A new offer can be made if the property is still available.", action: "Open the Deal Room" },
  "offer.reminder": { subject: "An offer is waiting", lead: "An offer is waiting for your answer", line: "Answering, even to say no, lets the other side plan.", action: "Open the Deal Room" },
  "offer.info_requested": { subject: "A question about the offer", lead: "The seller has a question", line: "Answer it in the Deal Room so the offer can move.", action: "Answer the question" },
  "offer.info_provided": { subject: "The buyer answered", lead: "The buyer answered your question", line: "Read the answer in the Deal Room and respond.", action: "Open the Deal Room" },
  "offer.stage": { subject: "Please confirm", lead: "Please confirm a step", line: "The other side recorded a step on this deal. Confirm it if it is right.", action: "Open the Deal Room" },
  "offer.document": { subject: "Deal document update", lead: "A document was updated", line: "Uploaded is not the same as checked. Read it before you rely on it. Vallo does not verify title.", action: "Open the documents" },
  "offer.disputed": { subject: "A concern was raised", lead: "The other side raised a concern", line: "Vallo will look at it. Keep your messages in the Deal Room.", action: "Open the Deal Room" },
  "offer.cancelled": { subject: "A deal was cancelled", lead: "Vallo cancelled this deal", line: "The reason is in the Deal Room. Nothing was charged.", action: "Open the Deal Room" },
};

export function offerEmail(template: OfferTemplate, data: OfferEmailData): EmailMessage {
  const w = WORDS[template];
  const place = data.listingTitle ?? "the property";
  const blocks: (Block | null)[] = [
    heading(w.lead),
    paragraph(`${hello(data.name)} ${place}.`),
    rows([
      ...(data.reference ? [{ label: "Reference", value: data.reference }] : []),
      ...(data.amountMinor !== null ? [{ label: "Current terms", value: money(data.amountMinor), strong: true }] : []),
    ]),
    paragraph(w.line),
    button(w.action, appUrl(`/offers/${data.agreementId}`)),
    note("Vallo does not take money for a purchase. Never pay anyone to secure a property through a message or a link."),
  ];
  const composed = compose({
    icon: "dealUpdate",
    preheader: w.line,
    blocks,
    footerLines: ["You are receiving this because you are a party to a deal on Vallo."],
  });
  return { subject: fitSubject(w.subject, data.listingTitle), preheader: composed.preheader, html: composed.html, text: composed.text };
}
