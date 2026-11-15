"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import { compareIdNumber, runCrossChecks, type CrossCheckReport } from "@/lib/identity/cross-check/actions";
import { nameFindings, type NamesOnRecord } from "@/lib/identity/cross-check/consistency";
import {
  ID_NUMBER_KINDS,
  ID_NUMBER_KIND_LABEL,
  ID_NUMBER_KIND_SHAPE,
  idNumberKindFor,
  idNumberShape,
  idNumberShapeFinding,
  type IdNumberKind,
} from "@/lib/identity/cross-check/formats";
import { CROSS_CHECK_SUMMARY, countFindings, levelWord, mergeFindings, orderFindings, type Finding } from "@/lib/identity/cross-check/signals";
import { CHECKLIST_CAVEAT, checklistFor } from "./id-checklists";
import { identityEscalationHref } from "./escalate-link";
import { MrzChecker } from "./MrzChecker";
import { plural } from "@vallo/i18n/core";

/**
 * CROSS-CHECKS (15 November 2026): what a reviewer can find out about an ID
 * for nothing, without anything leaving Vallo.
 *
 * It sits beside the ID and the selfie on each person and holds, in order:
 *   - one list of findings, worst first, in plain words. Some are worked out
 *     here in the browser (the names side by side, the passport's bottom
 *     lines, the shape of a typed number); the rest come from one server
 *     call (`runCrossChecks`) made when the person is opened, so the files of
 *     a whole queue are never read on a page load.
 *   - the passport checker, for the two lines at the bottom of the photo page.
 *   - a box for the number printed on the ID: its shape is judged as it is
 *     typed, and one button compares it with other accounts.
 *   - "What a real one looks like": a short list to tick through by eye.
 *   - what to do with a doubt: ask for a selfie holding the ID, or escalate.
 *
 * NOTHING HERE PROVES AN ID IS GENUINE, and the first line under the heading
 * says so. There is no free place to look a NIN or a BVN up, and a number is
 * never typed into any outside site: both are said on the panel itself.
 *
 * A check that cannot run says so in its own line and never blocks a decision.
 */

export type CrossChecksProps = {
  /** The person, or null for documents with no owner on record. */
  subjectId: string | null;
  displayName: string | null;
  /** Their newest ID document, which a typed number is recorded against. */
  identityDocumentId: string | null;
  idSubtype: string | null;
  issuingCountry: string | null;
  names: NamesOnRecord;
  /** True while a decision is still to be made on this person. */
  decidable: boolean;
  /** Findings handed in already (a preview or a test): no server call is made. */
  preloaded?: CrossCheckReport;
  /** The moment ages and expiry are judged at. Fixed in a preview or a test. */
  now?: Date;
};

const TAG: Record<string, string> = {
  Stop: "nf-badge--danger",
  "Look closer": "nf-badge--warning",
  Fine: "nf-badge--success",
  "Not run": "nf-badge--neutral",
};

function FindingRow({ item }: { item: Finding }) {
  const word = levelWord(item);
  return (
    <li className="grid gap-3xs border-t border-[var(--nf-border-subtle)] py-xs first:border-t-0" data-testid="cross-check-finding" data-key={item.key} data-level={item.notRun ? "not-run" : item.level}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-xs gap-y-3xs">
        <span className={`nf-badge ${TAG[word] ?? ""}`}>{word}</span>
        <span className="min-w-0 text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)] [overflow-wrap:break-word]">{item.title}</span>
      </div>
      <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)] [overflow-wrap:break-word]">{item.detail}</p>
      {item.links && item.links.length > 0 ? (
        <p className="flex flex-wrap gap-x-sm gap-y-3xs text-[length:var(--nf-text-caption)]">
          {item.links.map((link) => (
            <Link key={link.href} href={link.href} className="font-semibold underline">
              {link.label}
            </Link>
          ))}
        </p>
      ) : null}
    </li>
  );
}

const SERVER_FAILED: Finding = {
  key: "server",
  level: "look",
  notRun: true,
  title: "This check could not run: the comparisons with other accounts and the file checks",
  detail: "The console could not reach the platform data just now. The checks worked out on this page still stand. Carry on, and open the person again later to retry.",
};

export function CrossChecks(props: CrossChecksProps) {
  const { subjectId, displayName, identityDocumentId, idSubtype, issuingCountry, names, decidable, preloaded, now } = props;
  const root = useRef<HTMLElement | null>(null);
  const [report, setReport] = useState<CrossCheckReport | null>(preloaded ?? null);
  const [loading, setLoading] = useState(false);
  const [zone, setZone] = useState<Finding[]>([]);
  const [number, setNumber] = useState<Finding[]>([]);
  const asked = useRef(Boolean(preloaded) || !subjectId);

  const load = useCallback(() => {
    if (asked.current || !subjectId) return;
    asked.current = true;
    setLoading(true);
    runCrossChecks(subjectId)
      .then(
        (answer) => setReport(answer),
        () => setReport({ state: "failed" }),
      )
      .finally(() => setLoading(false));
  }, [subjectId]);

  /* The desk draws every waiting person inside a closed row. The server is
     asked only when this person's row is opened, and once. */
  useEffect(() => {
    if (asked.current) return;
    const row = root.current?.closest("details") ?? null;
    if (!row || row.open) {
      load();
      return;
    }
    const opened = () => {
      if (row.open) load();
    };
    row.addEventListener("toggle", opened);
    return () => row.removeEventListener("toggle", opened);
  }, [load]);

  const { onId, account, application, bank, business } = names;
  const findings = useMemo(() => {
    const fromNames = nameFindings({ onId, account, application, bank, business });
    const fromServer = report?.state === "ok" ? report.findings : report?.state === "failed" ? [SERVER_FAILED] : [];
    return orderFindings(mergeFindings(fromNames, fromServer, number, zone));
  }, [onId, account, application, bank, business, report, number, zone]);
  const counts = countFindings(findings);
  const attention = findings.filter((item) => item.notRun || item.level !== "ok");
  const fine = findings.filter((item) => !item.notRun && item.level === "ok");

  const passport = idSubtype === "passport";
  const mrzNames = useMemo(() => ({ onId, account, application }), [onId, account, application]);

  return (
    <section ref={root} className="min-w-0 rounded-md border border-[var(--nf-border-subtle)] p-sm" aria-label="Cross-checks" data-testid="cross-checks">
      <h4 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">Cross-checks</h4>
      <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]" data-testid="cross-checks-summary">
        {CROSS_CHECK_SUMMARY}
      </p>

      <p className="mt-xs flex flex-wrap gap-xs text-[length:var(--nf-text-overline)]" data-testid="cross-checks-counts" aria-live="polite">
        {counts.stop > 0 ? <span className="nf-badge nf-badge--danger">{counts.stop} to stop on</span> : null}
        {counts.look > 0 ? <span className="nf-badge nf-badge--warning">{counts.look} to look at</span> : null}
        {counts.notRun > 0 ? <span className="nf-badge nf-badge--neutral">{counts.notRun} not run</span> : null}
        {counts.ok > 0 ? <span className="nf-badge nf-badge--success">{counts.ok} fine</span> : null}
        {loading ? <span className="text-[var(--nf-content-muted)]" data-testid="cross-checks-loading">Reading their files and comparing with other accounts</span> : null}
      </p>

      {report?.state === "refused" ? (
        <p className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]" data-testid="cross-checks-refused">
          {report.message}
        </p>
      ) : null}
      {!subjectId ? (
        <p className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]" data-testid="cross-checks-no-owner">
          These documents have no owner on record, so they cannot be compared with other accounts.
        </p>
      ) : null}

      {attention.length > 0 ? (
        <ul className="mt-xs" data-testid="cross-check-findings">
          {attention.map((item) => (
            <FindingRow key={item.key} item={item} />
          ))}
        </ul>
      ) : null}
      {/* What found nothing wrong is one tap away when something else needs
          the reviewer's eye, and open when it is all there is. */}
      {fine.length > 0 ? (
        <details className="mt-xs" open={attention.length === 0} data-testid="cross-check-fine">
          <summary className="cursor-pointer text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
            {plural(fine.length, { one: "{count} check found nothing wrong", other: "{count} checks found nothing wrong" })}
          </summary>
          <ul className="mt-2xs">
            {fine.map((item) => (
              <FindingRow key={item.key} item={item} />
            ))}
          </ul>
        </details>
      ) : null}
      {findings.length === 0 && !loading ? (
        <p className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]" data-testid="cross-checks-empty">
          Nothing to compare yet.
        </p>
      ) : null}

      <details className="mt-sm" open={passport} data-testid="cross-checks-mrz">
        <summary className="cursor-pointer text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">Check a passport&apos;s bottom lines</summary>
        <div className="mt-xs">
          <MrzChecker names={mrzNames} onFindings={setZone} {...(now ? { now } : {})} />
        </div>
      </details>

      <details className="mt-sm" open={!passport} data-testid="cross-checks-number">
        <summary className="cursor-pointer text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">Check the number printed on the ID</summary>
        <IdNumberCheck documentId={decidable ? identityDocumentId : null} initialKind={idNumberKindFor(idSubtype, issuingCountry)} onFindings={setNumber} />
      </details>

      <ByEyeChecklist subtype={idSubtype} issuingCountry={issuingCountry} />

      <div className="mt-sm grid gap-2xs border-t border-[var(--nf-border-subtle)] pt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]" data-testid="cross-checks-next">
        <p>
          <span className="font-semibold text-[var(--nf-content-primary)]">Still doubt a document?</span> Ask for a selfie holding their ID, with the button
          under the photos. A person holding the real card can take that photo in a minute; a person with only a picture of one cannot.
        </p>
        <p>
          <span className="font-semibold text-[var(--nf-content-primary)]">Think it is forged, or on two accounts?</span> Do not approve, and do not tell the
          member what you suspect.
        </p>
        <p>
          <Link href={identityEscalationHref(subjectId, displayName)} className="font-semibold underline" data-testid="cross-checks-escalate">
            Escalate to Trust and Safety
          </Link>
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------- the number on the ID */

function IdNumberCheck({
  documentId,
  initialKind,
  onFindings,
}: {
  /** The document a compared number is recorded against; null when comparing is not offered. */
  documentId: string | null;
  initialKind: IdNumberKind | null;
  onFindings: (findings: Finding[]) => void;
}) {
  const [kind, setKind] = useState<IdNumberKind>(initialKind ?? "nin");
  const [value, setValue] = useState("");
  const [compared, setCompared] = useState<Finding[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();

  const shape = idNumberShape(kind, value);
  const shapeFinding = useMemo(() => idNumberShapeFinding(kind, value), [kind, value]);

  const report = useRef(onFindings);
  useEffect(() => {
    report.current = onFindings;
  });
  useEffect(() => {
    report.current([...(shapeFinding ? [shapeFinding] : []), ...compared]);
  }, [shapeFinding, compared]);

  function compare() {
    if (!documentId) return;
    setProblem(null);
    start(async () => {
      try {
        const result = await compareIdNumber({ documentId, kind, number: value });
        if (!result.ok) {
          /* Said by the one banner at the top of the screen, like every other outcome. */
          setProblem(result.error);
          banner.error(result.error, { "data-testid": "id-number-problem" });
          return;
        }
        setCompared(result.findings);
        /* The number has done its work: it does not stay on the screen. */
        setValue("");
      } catch {
        const words = "That number could not be compared just now. Nothing was saved. Try again in a moment.";
        setProblem(words);
        banner.error(words, { "data-testid": "id-number-problem" });
      }
    });
  }

  const digitsOnly = kind === "nin" || kind === "bvn";

  return (
    <div className="mt-xs grid gap-xs" data-testid="id-number-check">
      <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
        There is no free place to look a NIN or a BVN up, and a member&apos;s number is never typed into any other website, app or chat. Here its shape is
        judged in this browser as you type.
        {documentId ? " Compare sends it once to Vallo's own server, which keeps only a scrambled form of it." : ""}
      </p>
      {/* Side by side where the panel is wide enough for both, stacked where it is not. */}
      <div className="flex flex-wrap gap-xs">
        <label className="block min-w-0 flex-1 basis-[15rem]">
          <span className="nf-label">Kind of number</span>
          <select className="nf-field w-full" value={kind} onChange={(e) => setKind(e.target.value as IdNumberKind)} data-testid="id-number-kind">
            {ID_NUMBER_KINDS.map((option) => (
              <option key={option} value={option}>
                {ID_NUMBER_KIND_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-1 basis-[15rem]">
          <span className="nf-label">The number, as printed</span>
          <input
            id={`${id}-number`}
            type="text"
            inputMode={digitsOnly ? "numeric" : "text"}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            className="nf-field w-full font-mono"
            value={value}
            maxLength={40}
            onChange={(e) => setValue(e.target.value)}
            data-testid="id-number-input"
          />
        </label>
      </div>
      <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]" aria-live="polite" data-testid="id-number-shape" data-shape={shape.shape}>
        {shape.shape === "empty"
          ? `The genuine number is ${ID_NUMBER_KIND_SHAPE[kind]}.`
          : shape.shape === "right"
            ? "The shape looks right. That proves nothing by itself: anybody can type a number of the right length."
            : `The shape is unusual: ${shape.reason}. Read the document again.`}
      </p>
      {documentId ? (
        <div className="flex flex-wrap items-center gap-inline">
          <Button type="button" size="sm" variant="secondary" disabled={pending || shape.shape === "empty"} onClick={compare} data-testid="id-number-compare">
            {pending ? "Comparing" : "Compare with other accounts"}
          </Button>
          {compared.length > 0 && !problem ? (
            <span className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]" data-testid="id-number-compared">
              Compared. The result is in the list above, and the number has been cleared from this box.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------ what a real one looks like */

function ByEyeChecklist({ subtype, issuingCountry }: { subtype: string | null; issuingCountry: string | null }) {
  const list = checklistFor(subtype, issuingCountry);
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const toggle = (index: number) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  return (
    <details className="mt-sm" data-testid="cross-checks-checklist">
      <summary className="cursor-pointer text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
        What a real one looks like: {list.title}
      </summary>
      <ul className="mt-xs grid gap-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
        {list.items.map((item, index) => (
          <li key={item}>
            <label className="flex min-w-0 cursor-pointer items-start gap-xs">
              <input type="checkbox" className="mt-3xs shrink-0" checked={ticked.has(index)} onChange={() => toggle(index)} data-testid="checklist-tick" />
              <span className="min-w-0">{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]" data-testid="checklist-count" aria-live="polite">
        {ticked.size} of {list.items.length} ticked. Your ticks are working notes: they are not saved.
      </p>
      <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]" data-testid="checklist-caveat">
        {CHECKLIST_CAVEAT}
      </p>
    </details>
  );
}
