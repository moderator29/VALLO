"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mrzAgreementFindings } from "@/lib/identity/cross-check/consistency";
import { MRZ_LINE_LENGTH, mrzFindings, normaliseMrzLine, parseMrz, plainDay } from "@/lib/identity/cross-check/mrz";
import type { Finding } from "@/lib/identity/cross-check/signals";

/**
 * THE PASSPORT MRZ CHECKER (15 November 2026).
 *
 * The reviewer types the two lines printed along the bottom of a passport's
 * photo page. The answer comes at once, worked out in the browser by
 * `lib/identity/cross-check/mrz.ts`: which of the five check digits pass, and
 * the name, number, nationality, dates and sex the lines carry, to hold
 * against the printed page and the names on the account.
 *
 * NOTHING TYPED HERE GOES ANYWHERE. There is no server call in this file and
 * nothing is saved: the two lines live in this component's state and are gone
 * when the person is closed. A test holds that (`cross-checks.dom.test.tsx`).
 */

export type MrzNames = { onId: string | null; account: string | null; application: string | null };

const SEX_WORD: Record<string, string> = { M: "Male", F: "Female", X: "Not stated" };

/* Typed exactly as printed: no capitals guessed, no correction, no memory. */
const ZONE_KEYBOARD = {
  type: "text",
  inputMode: "text",
  autoCapitalize: "characters",
  autoCorrect: "off",
  autoComplete: "off",
  spellCheck: false,
  enterKeyHint: "next",
} as const;

/** A line cut into groups of eleven characters, so a place in it is easy to find. */
function elevens(line: string): string[] {
  return line.match(/.{1,11}/g) ?? [];
}

export function MrzChecker({
  names,
  onFindings,
  now,
}: {
  names: MrzNames;
  /** The checker's findings, for the panel's one list. Empty while a line is still being typed. */
  onFindings?: (findings: Finding[]) => void;
  /** The moment ages and expiry are judged at. Fixed in a preview or a test. */
  now?: Date;
}) {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const id = useId();
  const account = names.account;
  const application = names.application;
  const onId = names.onId;

  const { result, findings } = useMemo(() => {
    const at = now ?? new Date();
    const parsed = parseMrz(line1, line2, at);
    const own = mrzFindings(parsed);
    const agreement = parsed.state === "parsed" ? mrzAgreementFindings({ mrz: parsed.fields, names: { onId, account, application } }, at) : [];
    return { result: parsed, findings: [...own, ...agreement] };
  }, [line1, line2, onId, account, application, now]);

  /* The newest callback is kept in a ref, so the panel is told when the
     findings change and not each time it draws again. */
  const report = useRef(onFindings);
  useEffect(() => {
    report.current = onFindings;
  });
  useEffect(() => {
    report.current?.(findings);
  }, [findings]);

  const typed1 = normaliseMrzLine(line1).length;
  const typed2 = normaliseMrzLine(line2).length;
  const started = typed1 > 0 || typed2 > 0;

  return (
    <div className="grid gap-xs" data-testid="mrz-checker">
      <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
        Type the two lines printed along the bottom of the passport photo page, exactly as they are, with every chevron (&lt;). What you type
        stays in this browser: it is not sent anywhere and it is not saved.
      </p>
      {([
        [1, line1, setLine1, typed1],
        [2, line2, setLine2, typed2],
      ] as const).map(([n, value, set, typed]) => (
        <label key={n} className="block min-w-0">
          <span className="nf-label">
            {n === 1 ? "First line" : "Second line"}{" "}
            <span className="font-normal text-[var(--nf-content-muted)]" data-testid={`mrz-count-${n}`}>
              {typed} of {MRZ_LINE_LENGTH}
            </span>
          </span>
          <input
            {...ZONE_KEYBOARD}
            id={`${id}-line-${n}`}
            className="nf-field w-full font-mono uppercase tracking-[0.04em]"
            value={value}
            maxLength={80}
            placeholder={n === 1 ? "P<NGA..." : "A12345678..."}
            onChange={(e) => set(e.target.value)}
            data-testid={`mrz-line-${n}`}
          />
          {typed > 0 ? (
            /* The whole line in view at once, in elevens, on a screen too
               narrow for the box to show all 44 characters. */
            <span className="mt-3xs flex flex-wrap gap-x-xs font-mono text-[length:var(--nf-text-overline)] text-[var(--nf-content-secondary)]" data-testid={`mrz-echo-${n}`} aria-hidden="true">
              {elevens(normaliseMrzLine(value)).map((group, index) => (
                <span key={index}>{group}</span>
              ))}
            </span>
          ) : null}
        </label>
      ))}

      <div aria-live="polite" data-testid="mrz-result">
        {!started ? null : result.state === "incomplete" ? (
          <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]" data-testid="mrz-incomplete">
            Each line is {MRZ_LINE_LENGTH} characters. The first has {result.line1Length} and the second has {result.line2Length}. The digits are judged
            when both are complete.
          </p>
        ) : result.state === "invalid" ? (
          <ul className="list-disc space-y-3xs pl-lg text-[length:var(--nf-text-caption)] text-[var(--nf-status-rejected)]" data-testid="mrz-invalid">
            {result.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-xs">
            <p
              className={`text-[length:var(--nf-text-body-sm)] font-semibold ${
                result.failed === 0 ? "text-[var(--nf-status-approved)]" : "text-[var(--nf-status-rejected)]"
              }`}
              data-testid="mrz-verdict"
            >
              {result.failed === 0
                ? `All ${result.checks.length} check digits pass`
                : `${result.failed} of ${result.checks.length} check digits ${result.failed === 1 ? "fails" : "fail"}`}
            </p>
            <ul className="grid gap-3xs text-[length:var(--nf-text-caption)]" data-testid="mrz-digits">
              {result.checks.map((check) => (
                <li key={check.key} className="flex flex-wrap items-baseline gap-x-xs" data-testid={`mrz-digit-${check.key}`} data-pass={check.pass ? "yes" : "no"}>
                  <span className={`nf-badge ${check.pass ? "nf-badge--success" : "nf-badge--danger"}`}>{check.pass ? "Passes" : "Fails"}</span>
                  <span className="text-[var(--nf-content-primary)]">{check.label}</span>
                  {check.pass ? null : (
                    <span className="text-[var(--nf-content-secondary)]">
                      the zone says {check.found}, the characters work out to {check.expected}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-1 gap-x-sm gap-y-3xs text-[length:var(--nf-text-caption)] sm:grid-cols-2" data-testid="mrz-fields">
              {(
                [
                  ["Surname", result.fields.surname || "None"],
                  ["Given names", result.fields.givenNames || "None"],
                  ["Passport number", result.fields.documentNumber],
                  ["Issued by", result.fields.issuingState],
                  ["Nationality", result.fields.nationality],
                  ["Date of birth", result.fields.dateOfBirth.iso ? plainDay(result.fields.dateOfBirth.iso) : `Not a real date (${result.fields.dateOfBirth.raw})`],
                  ["Sex", SEX_WORD[result.fields.sex] ?? result.fields.sex],
                  ["Expires", result.fields.expiry.iso ? plainDay(result.fields.expiry.iso) : `Not a real date (${result.fields.expiry.raw})`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex min-w-0 flex-wrap gap-x-xs">
                  <dt className="text-[var(--nf-content-muted)]">{label}</dt>
                  <dd className="min-w-0 font-semibold text-[var(--nf-content-primary)] [overflow-wrap:break-word]">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
              Hold each of these against the printed page. They should be the same, letter for letter.
              {result.fields.nameTruncated ? " This name fills its whole space, so its end may be cut off in the zone." : ""}
              {result.failed > 0 ? " If you typed the lines correctly and a digit still fails, do not approve: escalate." : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
