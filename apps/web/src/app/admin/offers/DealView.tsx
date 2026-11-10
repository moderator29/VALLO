import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import { Naira, OfferFigures, Receipt } from "@/components/app/offers/OfferParts";
import { describeDifference, differenceOf, formatWhen, proposedDate } from "@/lib/offers/format";
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
      <div className="nf-ofr-admin-cols">
        <div className="grid min-w-0 gap-md">
          <Panel title="Terms now" id="terms">
            <OfferFigures amountMinor={row.amountMinor} askingMinor={row.askingMinor} label={`Offer, version ${row.version}`} />
            <div className="mt-md">
              <Receipt
                rows={[
                  { label: "Against asking", value: describeDifference(diff) },
                  { label: "Payment", value: PAYMENT_LABEL[row.paymentPreference] },
                  { label: "Stage", value: STAGE_LABEL[row.stage] },
                  { label: "Sale mandate", value: deal.mandate.held ? `Held, reviewed ${deal.mandate.reviewedOn ?? ""}, expires ${deal.mandate.expiresOn ?? ""}` : "None on record" },
                  { label: "Buyer eligible", value: `${deal.buyerEligible ? "Yes" : "No"} (outcome only)` },
                ]}
              />
            </div>
          </Panel>
          <Panel title={`Versions (${deal.versions.length})`} id="versions">
            <ol className="nf-tl">
              {deal.versions.map((v, i) => {
                const before = i > 0 ? deal.versions[i - 1]! : null;
                const dir = before ? (v.amountMinor > before.amountMinor ? "up" : v.amountMinor < before.amountMinor ? "down" : "flat") : "flat";
                return (
                  <li key={v.version} className="nf-tl__item" data-current={i === deal.versions.length - 1 ? "" : undefined}>
                    <span className="nf-tl__node" aria-hidden="true">
                      {v.version}
                    </span>
                    <div className="grid gap-xs">
                      <p className="font-semibold text-[var(--nf-content-primary)]">
                        <Naira minor={v.amountMinor} /> · {PAYMENT_LABEL[v.terms.paymentPreference]}
                      </p>
                      <p className="nf-tl__who">
                        Proposed by the {v.proposedBy}, {formatWhen(v.at)} · {proposedDate(v.terms.targetClosing)}
                      </p>
                      {v.changes.length ? (
                        <ul className="nf-tl__diffs">
                          {v.changes.map((c) => (
                            <li key={c} className="nf-tl__diff" data-dir={c.startsWith("Amount") ? dir : "flat"}>
                              {c}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="nf-body-sm text-[var(--nf-content-muted)]">
                        Buyer {v.buyerConfirmed ? "confirmed" : "has not confirmed"}. Seller {v.sellerConfirmed ? "confirmed" : "has not confirmed"}.
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>
        <div className="grid min-w-0 gap-md">
          <Panel title="Intervene" id="intervene">
            <Intervention offerId={row.id} disputed={row.disputed} caseHref={caseHref} canCancel={row.state === "open" || row.state === "agreed"} />
          </Panel>
          <Panel title="Documents" id="documents">
            {deal.documents.length === 0 ? (
              <p className="nf-body">No documents requested.</p>
            ) : (
              <Receipt
                rows={deal.documents.map((d) => ({
                  label: DOCUMENT_CATEGORY_LABEL[d.category],
                  value: (
                    <StatusChip state={documentChip(d.state)} size="xs">
                      {DOCUMENT_STATE_WORD[d.state]}
                    </StatusChip>
                  ),
                }))}
              />
            )}
            <p className="nf-body-sm mt-sm text-[var(--nf-content-muted)]">States only. Staff do not open the files here, and approval is not a check of title.</p>
          </Panel>
          <Panel title="Activity" id="activity">
            <Receipt
              rows={[...deal.events].reverse().map((e) => ({
                label: formatWhen(e.at),
                value: `${eventWord(e.action)} · ${e.actorName ?? e.actor}${e.note ? ` · ${e.note}` : ""}`,
              }))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
