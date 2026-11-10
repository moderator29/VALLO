"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Table, TBody, TD, TH, THead, TR, type SortDirection } from "@/components/ui/Table";
import { TextField } from "@/components/ui/Field";
import { State } from "@/components/ui/State";
import { StatusChip } from "@/components/ui/StatusChip";
import { Naira } from "@/components/app/offers/OfferParts";
import { differenceOf, formatPct, formatWhen, waitingFor } from "@/lib/offers/format";
import { PAYMENT_LABEL, STAGE_LABEL, STATE_FILTER_LABEL } from "@/lib/offers/words";
import { adminDealHref } from "@/lib/offers/routes";
import type { OfferState } from "@/lib/offers/types";
import type { AdminOfferRow } from "./model";
import "@/components/app/offers/offers.css";

type SortKey = "submitted" | "activity" | "amount";

const STATES: readonly (OfferState | "all")[] = ["all", "open", "agreed", "declined", "withdrawn", "expired", "cancelled"];

function chipFor(row: AdminOfferRow) {
  if (row.disputed) return { state: "disputed" as const, word: "Disputed" };
  switch (row.state) {
    case "agreed":
      return { state: "success" as const, word: "Terms agreed" };
    case "declined":
      return { state: "failed" as const, word: "Declined" };
    case "open":
      return { state: "protected" as const, word: "Open" };
    default:
      return { state: "neutral" as const, word: STATE_FILTER_LABEL[row.state] };
  }
}

/**
 * The deals table. Filter by state, search by reference, property or person,
 * sort by what arrived, what moved or the figure. Press / to jump to search.
 * Every row opens the deal. Read only: changes go through the deal's
 * intervention panel, which cannot rewrite agreed terms.
 */
export function OffersTable({ rows, nowMs }: { rows: AdminOfferRow[]; nowMs: number }) {
  const [state, setState] = useState<OfferState | "all">("all");
  const [onlyDisputed, setOnlyDisputed] = useState(false);
  const [noMandate, setNoMandate] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: "activity", dir: "descending" });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (event.key === "/" && el && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[data-testid="desk-search"]')?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (state !== "all" && r.state !== state) return false;
      if (onlyDisputed && !r.disputed) return false;
      if (noMandate && r.mandateHeld) return false;
      if (!q) return true;
      return [r.reference, r.listingTitle, r.buyerName, r.sellerName, r.agentName ?? ""].some((x) => x.toLowerCase().includes(q));
    });
    const val = (r: AdminOfferRow) => (sort.key === "amount" ? r.amountMinor : Date.parse(sort.key === "submitted" ? r.submittedAt : r.lastActivityAt));
    return out.sort((a, b) => (sort.dir === "ascending" ? val(a) - val(b) : val(b) - val(a)));
  }, [rows, state, onlyDisputed, noMandate, query, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "descending" ? "ascending" : "descending" } : { key, dir: "descending" }));
  const dirOf = (key: SortKey): SortDirection => (sort.key === key ? sort.dir : "none");

  return (
    <div className="grid gap-md" data-testid="offers-desk-table">
      <div className="nf-ofr-filters">
        <div className="min-w-[14rem] flex-1">
          <TextField
            label="Search"
            hideLabel
            placeholder="Search reference, property or person (press /)"
            leadingIcon="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            clearable="Clear search"
            onClear={() => setQuery("")}
            data-testid="desk-search"
          />
        </div>
        <div className="flex flex-wrap gap-xs" role="group" aria-label="Filter by state">
          {STATES.map((s) => (
            <Chip key={s} behaviour="filter" selected={state === s} onSelectedChange={() => setState(s)} data-testid={`desk-state-${s}`}>
              {STATE_FILTER_LABEL[s]}
            </Chip>
          ))}
          <Chip behaviour="filter" selected={onlyDisputed} onSelectedChange={setOnlyDisputed}>
            Disputed
          </Chip>
          <Chip behaviour="filter" selected={noMandate} onSelectedChange={setNoMandate}>
            No sale mandate
          </Chip>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {shown.length} of {rows.length} deals shown
      </p>
      {shown.length === 0 ? (
        <State kind="empty" compact title="No deals match" body="Change a filter or clear the search to see more." />
      ) : (
        <div className="nf-ofr-scroll">
          <Table caption="Offers and deals" density="compact">
            <THead>
              <TR>
                <TH>Reference</TH>
                <TH>Property</TH>
                <TH>Buyer</TH>
                <TH>Seller</TH>
                <TH align="end" sortable sort={dirOf("amount")} onSortChange={() => toggle("amount")}>
                  Offer
                </TH>
                <TH>Against asking</TH>
                <TH>Payment</TH>
                <TH>State</TH>
                <TH>Stage</TH>
                <TH align="end" sortable sort={dirOf("submitted")} onSortChange={() => toggle("submitted")}>
                  Submitted
                </TH>
                <TH align="end" sortable sort={dirOf("activity")} onSortChange={() => toggle("activity")}>
                  Last activity
                </TH>
              </TR>
            </THead>
            <TBody>
              {shown.map((r) => {
                const diff = differenceOf(r.amountMinor, r.askingMinor);
                const chip = chipFor(r);
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link href={adminDealHref(r.id)} className="font-semibold" data-testid="deal-link">
                        {r.reference}
                      </Link>
                    </TD>
                    <TD>
                      {r.listingTitle}
                      {!r.mandateHeld ? <div className="nf-ofr-define">No signed sale mandate on record</div> : null}
                    </TD>
                    <TD>{r.buyerName}</TD>
                    <TD>
                      {r.sellerName}
                      {r.agentName ? <div className="nf-ofr-define">Agent: {r.agentName}</div> : null}
                    </TD>
                    <TD align="end">
                      <Naira minor={r.amountMinor} />
                    </TD>
                    <TD>
                      {diff.word}
                      {diff.direction !== "at" ? ` ${formatPct(diff.pct)}` : ""}
                    </TD>
                    <TD>{PAYMENT_LABEL[r.paymentPreference]}</TD>
                    <TD>
                      <StatusChip state={chip.state} size="xs">
                        {chip.word}
                      </StatusChip>
                    </TD>
                    <TD>{STAGE_LABEL[r.stage]}</TD>
                    <TD align="end">{formatWhen(r.submittedAt)}</TD>
                    <TD align="end">{r.state === "open" ? `${waitingFor(r.lastActivityAt, nowMs)} ago` : formatWhen(r.lastActivityAt)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
