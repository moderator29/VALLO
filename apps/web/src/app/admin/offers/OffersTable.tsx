"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { UiIcon } from "@/design-system/icons/UiIcon";
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
type Dir = "ascending" | "descending";

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
  const [active, setActive] = useState(-1);
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "activity", dir: "descending" });

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
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = Math.min(shown.length - 1, Math.max(0, active + (event.key === "ArrowDown" ? 1 : -1)));
    setActive(next);
    document.querySelectorAll<HTMLElement>('[data-testid="offers-desk-table"] a[data-offer-link]')[next]?.focus();
  };

  return (
    <div className="grid gap-md" data-testid="offers-desk-table">
      <div className="nf-dt-bar">
        <div className="min-w-[14rem] flex-1">
          <TextField
            label="Search"
            hideLabel
            placeholder="Search reference, property or person (press /)"
            leadingIcon="search"
            inputMode="search"
            enterKeyHint="search"
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
        <div className="nf-ofr-scroll" onKeyDown={onKey}>
          <table className="nf-dt">
            <caption className="sr-only">Offers and deals</caption>
            <thead>
              <tr>
                <th scope="col">Deal</th>
                <th scope="col">Buyer</th>
                <th scope="col">Seller</th>
                <SortTh label="Offer" k="amount" sort={sort} onSort={toggle} end />
                <th scope="col">Against asking</th>
                <th scope="col">Payment</th>
                <th scope="col">State</th>
                <th scope="col">Stage</th>
                <SortTh label="Submitted" k="submitted" sort={sort} onSort={toggle} end />
                <SortTh label="Last activity" k="activity" sort={sort} onSort={toggle} end />
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const diff = differenceOf(r.amountMinor, r.askingMinor);
                const chip = chipFor(r);
                return (
                  <tr key={r.id} data-active={active === i ? "" : undefined} onFocus={() => setActive(i)}>
                    <td>
                      <div className="nf-dt__cell-title">
                        <span className="nf-ofr-thumb" aria-hidden="true">
                          <UiIcon name="house" size={20} />
                        </span>
                        <div className="min-w-0">
                          <Link href={adminDealHref(r.id)} className="nf-dt__title" data-testid="deal-link" data-offer-link>
                            {r.listingTitle}
                          </Link>
                          <div className="nf-dt__ref">
                            {r.reference}
                            {!r.mandateHeld ? " · No signed sale mandate on record" : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{r.buyerName}</td>
                    <td>
                      {r.sellerName}
                      {r.agentName ? <div className="nf-dt__ref">Agent: {r.agentName}</div> : null}
                    </td>
                    <td data-end="">
                      <Naira minor={r.amountMinor} className="font-semibold text-[var(--nf-content-primary)]" />
                    </td>
                    <td>
                      <span className="nf-ofr-diff" data-dir={diff.direction}>
                        {diff.direction !== "at" ? <UiIcon name={diff.direction === "above" ? "arrow-up" : "arrow-down"} size={12} /> : <UiIcon name="check" size={12} />}
                        {diff.word}
                        {diff.direction !== "at" ? ` ${formatPct(diff.pct)}` : ""}
                      </span>
                    </td>
                    <td>{PAYMENT_LABEL[r.paymentPreference]}</td>
                    <td>
                      <StatusChip state={chip.state} size="xs">
                        {chip.word}
                      </StatusChip>
                    </td>
                    <td>{STAGE_LABEL[r.stage]}</td>
                    <td data-end="">{formatWhen(r.submittedAt)}</td>
                    <td data-end="">{r.state === "open" ? `${waitingFor(r.lastActivityAt, nowMs)} ago` : formatWhen(r.lastActivityAt)}</td>
                    <td>
                      <span className="nf-dt__open">
                        Open <UiIcon name="arrow-right" size={14} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortTh({ label, k, sort, onSort, end }: { label: string; k: SortKey; sort: { key: SortKey; dir: Dir }; onSort: (k: SortKey) => void; end?: boolean }) {
  const on = sort.key === k;
  return (
    <th scope="col" aria-sort={on ? sort.dir : "none"} {...(end ? { "data-end": "" } : {})}>
      <button type="button" className="nf-dt__sort" data-dir={on ? sort.dir : "none"} onClick={() => onSort(k)}>
        {label}
        <span className="nf-dt__arrow" aria-hidden="true">
          <UiIcon name="arrow-down" size={12} />
        </span>
      </button>
    </th>
  );
}
