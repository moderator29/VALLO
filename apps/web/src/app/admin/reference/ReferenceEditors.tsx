"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useActionBanner } from "@/components/ui/use-action-banner";
import { useRouter } from "next/navigation";
import { saveLocalGovernment, saveOccupation } from "@/lib/admin/reference-actions";
import { matchesSearch, type StateOption } from "@/lib/places/reference";
import type { ActionResult } from "@/lib/actions/envelope";
import { TextField, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/**
 * The two reference tables, edited in place.
 *
 * Both editors work the same way: a filter over what is already there, an
 * inline form on any row you open, and one form at the top for adding a row
 * that does not exist yet. The list is rendered from the server's own read, so
 * a save followed by a refresh shows the database's answer rather than the
 * form's hope.
 *
 * The code of an existing row is never editable. It is the value stored on
 * every profile that chose it, so changing it would silently orphan them all.
 */

type Occupation = { code: string; name: string; category: string; sortOrder: number };
type LocalGovernment = { code: string; stateCode: string; name: string };

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  error,
  readOnly = false,
  inputMode,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string | undefined;
  readOnly?: boolean;
  inputMode?: "numeric";
}) {
  /*
   * `aria-invalid` on a `.nf-field` paints nothing. That class draws its border
   * with a border-box gradient, so the error rule beside it colours a surface
   * the gradient sits on top of - the reference editors were computing field
   * errors, setting the attribute, and rendering a field that looked untouched.
   * TextField replaces the gradient's own border-box layer and adds a ring.
   */
  return (
    <TextField
      name={name}
      label={label}
      defaultValue={defaultValue}
      placeholder={placeholder}
      readOnly={readOnly}
      inputMode={inputMode}
      error={error}
      inputClassName="read-only:opacity-60"
    />
  );
}

/* ------------------------------------------------------------ occupations */

function OccupationForm({
  mode,
  initial,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: Occupation;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ code: string }> | null,
    FormData
  >(saveOccupation, null);

  /* Said by the one banner at the top of the screen (Grade 1), which stays
     when the form closes; a field's own error stays under that field. */
  useActionBanner(state, { ok: "Saved. It is on the picker now." });
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="grid gap-sm sm:grid-cols-2">
      <input type="hidden" name="mode" value={mode} />
      <Field
        name="code"
        label="Code"
        defaultValue={initial?.code}
        placeholder="site_engineer"
        readOnly={mode === "edit"}
        error={errors?.code}
      />
      <Field
        name="name"
        label="Name"
        defaultValue={initial?.name}
        placeholder="Site engineer"
        error={errors?.name}
      />
      <Field
        name="category"
        label="Category"
        defaultValue={initial?.category}
        placeholder="Engineering"
        error={errors?.category}
      />
      <Field
        name="sortOrder"
        label="Sort order"
        defaultValue={String(initial?.sortOrder ?? 0)}
        inputMode="numeric"
        error={errors?.sortOrder}
      />
      <div className="sm:col-span-2">
        <Button variant="primary" size="sm" type="submit" loading={pending}>
          {pending ? "Saving" : mode === "edit" ? "Save this occupation" : "Add occupation"}
        </Button>
      </div>
    </form>
  );
}

/* C1 sweep: a list row is a Plate (north star 4, tier 1), not a Card per row,
   so the two editors read as lists inside the page rather than a stack of
   glass panels; each count is the console's own badge. */
export function OccupationEditor({ rows }: { rows: Occupation[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return rows.slice(0, 60);
    return rows
      .filter((row) => matchesSearch(`${row.name} ${row.category} ${row.code}`, query))
      .slice(0, 60);
  }, [rows, query]);

  const saved = () => {
    setOpenCode(null);
    setAdding(false);
    router.refresh();
  };

  return (
    <section>
      <div className="mb-sm flex flex-wrap items-center gap-sm">
        <h2 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">Occupations</h2>
        <span className="nf-badge nf-badge--brand nf-numeric">
          {rows.length}
        </span>
        <Button variant="quiet" size="sm" className="ml-auto" type="button" onClick={() => setAdding((open) => !open)}>
          {adding ? "Close" : "Add one"}
        </Button>
      </div>

      {adding && (
        <div className="nf-panel nf-panel--card nf-admin-card mb-sm p-md">
          <OccupationForm mode="create" onSaved={saved} />
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by name, category or code"
        aria-label="Filter occupations"
        className="nf-field mb-sm w-full text-[length:var(--nf-text-body-sm)]"
      />

      <ul className="flex flex-col gap-xs">
        {filtered.map((row) => (
          <li key={row.code} className="nf-admin-plate p-md">
            <button
              type="button"
              onClick={() => setOpenCode(openCode === row.code ? null : row.code)}
              className="flex min-h-11 w-full items-center gap-sm text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                  {row.name}
                </span>
                {/* The code and the sort number are both schema, and both
                    genuinely matter here (the code is the stored value and
                    cannot be changed; the number decides where the row sits
                    in a picker). So they are named rather than run together
                    as "Built environment · quantity_surveyor · 20", which
                    read as three facts of the same kind and was none. */}
                <span className="nf-numeric mt-3xs block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                  {row.category} &middot; code {row.code} &middot; order {row.sortOrder}
                </span>
              </span>
              <span className="shrink-0 text-[length:var(--nf-text-overline)] text-[var(--nf-brand-secondary)]">
                {openCode === row.code ? "Close" : "Edit"}
              </span>
            </button>
            {openCode === row.code && (
              <div className="mt-sm border-t border-[var(--nf-border-subtle)] pt-sm">
                <OccupationForm mode="edit" initial={row} onSaved={saved} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {rows.length > filtered.length && (
        <p className="mt-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          Showing {filtered.length} of {rows.length}. Filter to reach the rest.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------ local governments */

function LocalGovernmentForm({
  mode,
  states,
  initial,
  onSaved,
}: {
  mode: "create" | "edit";
  states: StateOption[];
  initial?: LocalGovernment;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ code: string }> | null,
    FormData
  >(saveLocalGovernment, null);

  /* Said by the one banner at the top of the screen (Grade 1), which stays
     when the form closes; a field's own error stays under that field. */
  useActionBanner(state, { ok: "Saved. It is on the picker now." });
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="grid gap-sm sm:grid-cols-2">
      <input type="hidden" name="mode" value={mode} />
      <Field
        name="code"
        label="Code"
        defaultValue={initial?.code}
        placeholder="la_ikeja"
        readOnly={mode === "edit"}
        error={errors?.code}
      />
      <SelectField
        name="stateCode"
        label="State"
        defaultValue={initial?.stateCode ?? ""}
        error={errors?.stateCode}
      >
        <option value="" style={{ background: "var(--nf-surface-elevated)" }}>
          Choose a state
        </option>
        {states.map((option) => (
          <option
            key={option.code}
            value={option.code}
            style={{ background: "var(--nf-surface-elevated)" }}
          >
            {option.name}
          </option>
        ))}
      </SelectField>
      <Field
        name="name"
        label="Name"
        defaultValue={initial?.name}
        placeholder="Ikeja"
        error={errors?.name}
      />
      <div className="sm:col-span-2">
        <Button variant="primary" size="sm" type="submit" loading={pending}>
          {pending ? "Saving" : mode === "edit" ? "Save this local government" : "Add local government"}
        </Button>
      </div>
    </form>
  );
}

export function LocalGovernmentEditor({
  rows,
  states,
}: {
  rows: LocalGovernment[];
  states: StateOption[];
}) {
  const router = useRouter();
  const [stateFilter, setStateFilter] = useState("");
  const [query, setQuery] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    let out = rows;
    if (stateFilter) out = out.filter((row) => row.stateCode === stateFilter);
    if (query.trim().length > 0) {
      out = out.filter((row) => matchesSearch(`${row.name} ${row.code}`, query));
    }
    return out.slice(0, 80);
  }, [rows, stateFilter, query]);

  const nameByCode = useMemo(
    () => new Map(states.map((option) => [option.code, option.name])),
    [states],
  );

  const saved = () => {
    setOpenCode(null);
    setAdding(false);
    router.refresh();
  };

  return (
    <section>
      <div className="mb-sm flex flex-wrap items-center gap-sm">
        <h2 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          Local governments
        </h2>
        <span className="nf-badge nf-badge--brand nf-numeric">
          {rows.length}
        </span>
        <Button variant="quiet" size="sm" className="ml-auto" type="button" onClick={() => setAdding((open) => !open)}>
          {adding ? "Close" : "Add one"}
        </Button>
      </div>

      {adding && (
        <div className="nf-panel nf-panel--card nf-admin-card mb-sm p-md">
          <LocalGovernmentForm mode="create" states={states} onSaved={saved} />
        </div>
      )}

      <div className="mb-sm grid gap-xs sm:grid-cols-2">
        <select
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
          aria-label="Filter by state"
          className="nf-field w-full text-[length:var(--nf-text-body-sm)]"
        >
          <option value="" style={{ background: "var(--nf-surface-elevated)" }}>
            Every state
          </option>
          {states.map((option) => (
            <option
              key={option.code}
              value={option.code}
              style={{ background: "var(--nf-surface-elevated)" }}
            >
              {option.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name or code"
          aria-label="Filter local governments"
          className="nf-field w-full text-[length:var(--nf-text-body-sm)]"
        />
      </div>

      <ul className="flex flex-col gap-xs">
        {filtered.map((row) => (
          <li key={row.code} className="nf-admin-plate p-md">
            <button
              type="button"
              onClick={() => setOpenCode(openCode === row.code ? null : row.code)}
              className="flex min-h-11 w-full items-center gap-sm text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                  {row.name}
                </span>
                <span className="nf-numeric mt-3xs block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                  {nameByCode.get(row.stateCode) ?? row.stateCode} &middot; {row.code}
                </span>
              </span>
              <span className="shrink-0 text-[length:var(--nf-text-overline)] text-[var(--nf-brand-secondary)]">
                {openCode === row.code ? "Close" : "Edit"}
              </span>
            </button>
            {openCode === row.code && (
              <div className="mt-sm border-t border-[var(--nf-border-subtle)] pt-sm">
                <LocalGovernmentForm
                  mode="edit"
                  states={states}
                  initial={row}
                  onSaved={saved}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {rows.length > filtered.length && (
        <p className="mt-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          Showing {filtered.length} of {rows.length}. Choose a state or filter to reach the rest.
        </p>
      )}
    </section>
  );
}
