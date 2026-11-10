import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import { Naira } from "@/components/app/offers/OfferParts";
import { differenceOf, formatPct, formatWhen, proposedDate } from "@/lib/offers/format";
import { adminOffersHref } from "@/lib/offers/routes";
import { DOCUMENT_CATEGORY_LABEL, DOCUMENT_STATE_WORD, PAYMENT_LABEL, STAGE_LABEL, documentChip, eventWord } from "@/lib/offers/words";
import { PageHead, Panel } from "../_components/panels";
import { Intervention } from "./Intervention";
import type { AdminDeal } from "./model";
import "@/components/app/offers/offers.css";

export function AdminDealView({ deal }: { deal: AdminDeal }) {
  const { row } = deal;
  const diff = differenceOf(row.amountMinor, row.askingMinor);
  const caseHref = row.caseId ? `/admin/cases/${row.caseId}` : "/admin/cases";
  return (
    <div className="nf-console" data-testid="admin-deal">
      <PageHead
        title={`${row.reference}: ${row.listingTitle}`}
        lede={`${row.buyerName} to ${row.sellerName}${row.agentName ? `, listed by ${row.agentName}` : ""}.`}
        lead={
          <Link href={adminOffersHref} className="nf-body-sm">
            All deals
          </Link>
        }
        trail={
          <StatusChip state={row.disputed ? "disputed" : row.state === "agreed" ? "success" : row.state === "open" ? "protected" : "neutral"} size="sm">
            {row.disputed ? "Disputed" : row.state === "agreed" ? "Terms agreed" : row.state === "open" ? "Open" : row.state}
          </StatusChip>
        }
      />
      <Panel title="Terms now" id="terms">
        <dl className="nf-ofr-facts">
          <div><dt>Offer</dt><dd><Naira minor={row.amountMinor} /></dd></div>
          <div><dt>Asking price</dt><dd><Naira minor={row.askingMinor} /></dd></div>
          <div><dt>Against asking</dt><dd>{diff.word}{diff.direction !== "at" ? ` ${formatPct(diff.pct)}` : ""}</dd></div>
          <div><dt>Payment</dt><dd>{PAYMENT_LABEL[row.paymentPreference]}</dd></div>
          <div><dt>Stage</dt><dd>{STAGE_LABEL[row.stage]}</dd></div>
          <div><dt>Version</dt><dd>{row.version}</dd></div>
          <div><dt>Sale mandate</dt><dd>{deal.mandate.held ? `Held, reviewed ${deal.mandate.reviewedOn ?? ""}, expires ${deal.mandate.expiresOn ?? ""}` : "None on record"}</dd></div>
          <div><dt>Buyer eligible</dt><dd>{deal.buyerEligible ? "Yes" : "No"} (outcome only)</dd></div>
        </dl>
      </Panel>
      <Panel title="Intervene" id="intervene">
        <Intervention offerId={row.id} disputed={row.disputed} caseHref={caseHref} canCancel={row.state === "open" || row.state === "agreed"} />
      </Panel>
      <Panel title={`Versions (${deal.versions.length})`} id="versions">
        <ol className="grid gap-md">
          {deal.versions.map((v) => (
            <li key={v.version} className="nf-ver">
              <p className="font-semibold">
                Version {v.version}, proposed by the {v.proposedBy}, {formatWhen(v.at)}
              </p>
              <p><Naira minor={v.amountMinor} /> · {PAYMENT_LABEL[v.terms.paymentPreference]} · {proposedDate(v.terms.targetClosing)}</p>
              {v.changes.length ? <ul className="nf-ver__changes">{v.changes.map((c) => <li key={c}>{c}</li>)}</ul> : null}
              <p className="nf-body-sm text-[var(--nf-content-muted)]">Buyer {v.buyerConfirmed ? "confirmed" : "has not confirmed"}. Seller {v.sellerConfirmed ? "confirmed" : "has not confirmed"}.</p>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Documents" id="documents">
        {deal.documents.length === 0 ? (
          <p className="nf-body">No documents requested.</p>
        ) : (
          <ul className="grid gap-sm">
            {deal.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-sm">
                <span>{DOCUMENT_CATEGORY_LABEL[d.category]}</span>
                <StatusChip state={documentChip(d.state)} size="xs">{DOCUMENT_STATE_WORD[d.state]}</StatusChip>
              </li>
            ))}
          </ul>
        )}
        <p className="nf-body-sm text-[var(--nf-content-muted)] mt-sm">States only. Staff do not open the files here, and approval is not a check of title.</p>
      </Panel>
      <Panel title="Activity" id="activity">
        <ol className="grid gap-xs">
          {[...deal.events].reverse().map((e) => (
            <li key={e.id}>
              <span className="font-semibold">{eventWord(e.action)}</span> · {e.actorName ?? e.actor} · {formatWhen(e.at)}
              {e.note ? ` · ${e.note}` : ""}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
