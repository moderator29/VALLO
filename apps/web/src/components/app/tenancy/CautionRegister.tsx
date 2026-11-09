import type { ReactNode } from "react";
import type { Dictionary } from "@vallo/i18n";
import type { TenancyCaution } from "@/lib/tenancy/queries";
import { ROOM_COPY } from "@/lib/inspections/report";
import { StatusChip } from "@/components/ui/StatusChip";
import { DocHead, DocNote, DocSection, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { CAUTION_CHIP, cautionExchange, type ExchangeEntry, type ExchangeMark } from "./caution-exchange";
import "./caution.css";

type Copy = Dictionary["afterTheGate"]["tenancy"];
type Words = Dictionary["experienceMoney"]["caution"];

/** An entry, worded: what was said, by whom (when the sentence does not already say), and any detail. */
type Worded = { text: string; who: string | null; meta: string | null; mark: ExchangeMark };

/**
 * M2: THE CAUTION REGISTER, AS A DOCUMENTED EXCHANGE (north star 10 D:
 * "register, deductions, returns, a dispute as a documented exchange").
 *
 * The register is a record two people rely on months after move-out, so it
 * is drawn as a document on the member's own theme (D28.1): the caution and
 * the date it is owed back by, what has been returned, deducted and is still
 * owed, then one thread per deduction and per return, each entry saying who
 * said what, in order. The sheet is not the page's printable one (the money
 * receipt above is), so it carries no print mark.
 *
 * WHAT IT GUARANTEES, from `caution-exchange.ts`: both parties see the same
 * entries (the exchange never takes the viewer), and no ruling appears
 * before Vallo staff make it (a disputed line ends on "waiting for Vallo
 * staff to rule", with no figure). Every figure is the tenancy read's own,
 * formatted there through formatMoney; every sentence about the money is
 * the one this section already used (afterTheGate.tenancy).
 *
 * THE STATE sits above the paper as a StatusChip (word, shape, colour),
 * in the member's theme. Inside the paper each entry's mark speaks the same
 * shape grammar in the paper's own inks.
 *
 * THE CONTROLS (answer, contest, propose, record, escalate) are the page's
 * own, passed as `children` and drawn under the sheet in the member's theme,
 * never on the paper: the document is what was said, the controls are how
 * the reader says the next thing.
 */
export function CautionRegister({
  caution,
  copy,
  words,
  children,
}: {
  caution: TenancyCaution;
  copy: Copy;
  words: Words;
  children?: ReactNode;
}) {
  const exchange = cautionExchange(caution);
  const empty = exchange.deductions.length === 0 && exchange.returns.length === 0;
  return (
    <div className="grid gap-md" data-testid="tenancy-caution">
      <div>
        <StatusChip state={CAUTION_CHIP[caution.state]}>{copy.cautionStates[caution.state]}</StatusChip>
      </div>
      <DocumentSheet aria-labelledby="caution-register-title" data-testid="caution-register">
        <DocHead
          label={words.register}
          title={<span className="nf-numeric">{copy.cautionOwed.replace("{amount}", caution.amount).replace("{date}", caution.dueOnLabel)}</span>}
          id="caution-register-title"
        >
          <p className="nf-caution__covered nf-numeric">
            {copy.cautionCovered
              .replace("{returned}", caution.returned)
              .replace("{deducted}", caution.deducted)
              .replace("{outstanding}", caution.outstanding)}
          </p>
          {caution.guaranteed ? (
            <p className="nf-caution__covered nf-numeric">{copy.cautionGuaranteed.replace("{amount}", caution.guaranteed)}</p>
          ) : null}
          {caution.inDoubt ? (
            <p className="nf-caution__covered nf-numeric">{copy.cautionInDoubt.replace("{amount}", caution.inDoubt)}</p>
          ) : null}
        </DocHead>

        {exchange.deductions.length > 0 ? (
          <DocSection title={words.deductions} id="caution-deductions-title">
            <ol className="nf-exchange" data-testid="caution-deductions">
              {exchange.deductions.map((thread) => {
                const d = thread.deduction;
                const item = ROOM_COPY[d.item].title;
                return (
                  <li key={thread.key} className="nf-exchange__thread" data-testid={`caution-deduction-${d.id}`}>
                    <p className="nf-exchange__head">
                      <span className="nf-exchange__n">{words.deduction.replace("{n}", String(thread.n))}</span>
                      <span className="nf-numeric">{copy.deductionLine.replace("{item}", item).replace("{amount}", d.amount)}</span>
                    </p>
                    {d.note ? <p className="nf-exchange__quote">{d.note}</p> : null}
                    {d.photoUrl ? (
                      // A signed, short-lived URL to a private object: the photograph the line was proposed against.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.photoUrl} alt={words.photo.replace("{item}", item)} className="nf-exchange__photo" loading="lazy" decoding="async" />
                    ) : null}
                    <Entries entries={thread.entries.map((e) => wordEntry(e, copy, words))} />
                  </li>
                );
              })}
            </ol>
          </DocSection>
        ) : null}

        {exchange.returns.length > 0 ? (
          <DocSection title={words.returns} id="caution-returns-title">
            <ol className="nf-exchange" data-testid="tenancy-caution-returns">
              {exchange.returns.map((thread) => (
                <li key={thread.key} className="nf-exchange__thread" data-testid={`caution-return-${thread.record.id}`}>
                  <p className="nf-exchange__head">
                    <span className="nf-exchange__n">{words.return.replace("{n}", String(thread.n))}</span>
                    <span className="nf-numeric">{thread.record.amount}</span>
                  </p>
                  <Entries entries={thread.entries.map((e) => wordEntry(e, copy, words, thread.record))} />
                </li>
              ))}
            </ol>
          </DocSection>
        ) : null}

        {empty ? <p className="nf-doc__note">{words.nothingYet}</p> : null}
        <DocNote>
          {copy.cautionNotHeld} {words.sameEntries}
        </DocNote>
      </DocumentSheet>
      {children}
    </div>
  );
}

function Entries({ entries }: { entries: Worded[] }) {
  return (
    <ol className="nf-exchange__entries">
      {entries.map((entry, i) => (
        <li key={i} className="nf-exchange__entry" data-mark={entry.mark}>
          <span className="nf-exchange__mark" aria-hidden="true" />
          <span className="nf-exchange__body">
            <span className="nf-exchange__what nf-numeric">{entry.text}</span>
            {entry.who ? <span className="nf-exchange__who">{entry.who}</span> : null}
            {entry.meta ? <span className="nf-exchange__meta nf-numeric">{entry.meta}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The words for one entry. Where an existing sentence already names who
 * acted (a ruling, a recorded return), no separate actor is printed.
 */
function wordEntry(
  e: ExchangeEntry,
  copy: Copy,
  words: Words,
  record?: { amount: string; method: "bank_transfer" | "cash" | "other"; reference: string | null },
): Worded {
  const actor = words.actor[e.actor];
  switch (e.kind) {
    case "proposed":
      return { text: words.proposed, who: actor, meta: null, mark: e.mark };
    case "accepted":
      return { text: copy.deductionAccepted, who: actor, meta: null, mark: e.mark };
    case "disputed":
      return { text: words.disputed, who: actor, meta: null, mark: e.mark };
    case "awaiting-answer":
      return { text: words.awaitingAnswer, who: actor, meta: null, mark: e.mark };
    case "ruled":
      return {
        text: copy.deductionRuled.replace("{amount}", e.allowed).replace("{reason}", e.reason ?? ""),
        who: null,
        meta: null,
        mark: e.mark,
      };
    case "awaiting-ruling":
      return { text: words.awaitingRuling, who: actor, meta: null, mark: e.mark };
    case "returned":
    case "received": {
      const how = record ? [copy.returnMethods[record.method], record.reference].filter(Boolean).join(" · ") : null;
      return {
        text: `${copy.returnedLine.replace("{amount}", record?.amount ?? "").replace("{date}", e.date)} · ${
          e.kind === "returned" ? copy.returnedByLister : copy.returnedByTenant
        }`,
        who: null,
        meta: how || null,
        mark: e.mark,
      };
    }
    case "contested":
      return { text: words.contested, who: actor, meta: null, mark: e.mark };
    case "found":
      return {
        text: copy.returnRuled
          .replace("{outcome}", e.outcome === "received" ? copy.returnRuledReceived : copy.returnRuledNotReceived)
          .replace("{reason}", e.reason ?? ""),
        who: null,
        meta: null,
        mark: e.mark,
      };
  }
}
