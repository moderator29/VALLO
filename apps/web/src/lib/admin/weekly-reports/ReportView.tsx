import { FORM_HELP, type NumberRow, type Proof, type WeeklyReport } from "./model";

/** A proof as it is shown: a link's own address, or a file's short signed URL (null when it could not be signed). */
export type ProofView = Proof & { href: string | null };

export function withHrefs(proofs: readonly Proof[], signed: ReadonlyMap<string, string>): ProofView[] {
  return proofs.map((p) => ({ ...p, href: p.kind === "link" ? p.url : (signed.get(p.id) ?? null) }));
}

const prose = "nf-body whitespace-pre-wrap";

export function NumbersTable({ rows }: { rows: readonly NumberRow[] }) {
  if (rows.length === 0) return <p className="nf-body-sm text-[var(--nf-content-secondary)]">No numbers were added.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full nf-body-sm">
        <thead>
          <tr className="text-left text-[var(--nf-content-secondary)]">
            <th className="py-3xs pr-sm font-semibold">Figure</th>
            <th className="py-3xs pr-sm font-semibold">Reported</th>
            <th className="py-3xs pr-sm font-semibold">Target</th>
            <th className="py-3xs font-semibold">Where it came from</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.label}-${i}`}>
              <td className="py-3xs pr-sm">{r.label}</td>
              <td className="py-3xs pr-sm">{r.value}</td>
              <td className="py-3xs pr-sm">{r.target ?? ""}</td>
              <td className="py-3xs">
                {r.source === "desk"
                  ? r.deskValue !== null && r.deskValue !== r.value
                    ? `Prefilled from the desk (counted ${r.deskValue}), edited`
                    : "Prefilled from the desk"
                  : "Typed by the person"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProofList({ proofs }: { proofs: readonly ProofView[] }) {
  if (proofs.length === 0) return <p className="nf-body-sm text-[var(--nf-content-secondary)]">No proof was added.</p>;
  return (
    <ul className="grid gap-sm" data-testid="report-proofs">
      {proofs.map((p) => (
        <li key={p.id} className="grid gap-3xs">
          {p.kind === "file" && p.href && p.contentType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.href} alt={p.caption || p.name || "Proof"} className="max-h-64 rounded object-contain" />
          ) : null}
          {p.kind === "file" && p.href && p.contentType?.startsWith("video/") ? <video src={p.href} controls className="max-h-64 rounded" /> : null}
          <p className="nf-body-sm">
            {p.href ? (
              <a href={p.href} target="_blank" rel="noreferrer noopener" className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2">
                {p.kind === "link" ? p.url : (p.name ?? "Open the file")}
              </a>
            ) : (
              <span>{p.name ?? "File"} (the viewing link could not be made just now)</span>
            )}
            {p.caption ? <span className="text-[var(--nf-content-secondary)]">{` · ${p.caption}`}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** A report, read-only, section by section. The reviewer opens it here and a reviewed report is shown through it. */
export function ReportView({ report, proofs }: { report: WeeklyReport; proofs: readonly ProofView[] }) {
  return (
    <div className="grid gap-md" data-testid="report-view">
      <section className="grid gap-3xs">
        <h3 className="nf-body font-semibold">{FORM_HELP.accomplishments.title}</h3>
        <p className={prose}>{report.accomplishments || "Nothing written."}</p>
      </section>
      <section className="grid gap-3xs">
        <h3 className="nf-body font-semibold">{FORM_HELP.numbers.title}</h3>
        <NumbersTable rows={report.numbers} />
      </section>
      <section className="grid gap-3xs">
        <h3 className="nf-body font-semibold">{FORM_HELP.blockers.title}</h3>
        <p className={prose}>{report.blockers || "Nothing written."}</p>
      </section>
      <section className="grid gap-3xs">
        <h3 className="nf-body font-semibold">{FORM_HELP.nextWeek.title}</h3>
        <p className={prose}>{report.nextWeek || "Nothing written."}</p>
      </section>
      <section className="grid gap-3xs">
        <h3 className="nf-body font-semibold">{FORM_HELP.proofs.title}</h3>
        <ProofList proofs={proofs} />
      </section>
    </div>
  );
}
