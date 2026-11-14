"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { changeStage, linkListing, logActivity, setNextFollowUp, updateProspect } from "@/lib/admin/business-development/actions";
import {
  FOLLOW_UP_WORD,
  activityByProspect,
  filterPipeline,
  followUpState,
  lagosToday,
  orderPipeline,
  pipelineCsv,
  stageCounts,
  type FollowUpState,
  type PipelineView,
} from "@/lib/admin/business-development/pipeline";
import {
  BD_CATEGORIES,
  BD_CATEGORY_LABEL,
  BD_STAGES,
  BD_STAGE_LABEL,
  type BdActivity,
  type BdProspect,
  type BdStage,
} from "@/lib/admin/business-development/types";
import { Badge, type BadgeTone } from "../_components/Badge";

/**
 * THE PIPELINE TABLE: every prospect in one place, in working order (what is
 * due first), searchable, filterable by stage and category, and exportable.
 * A row opens onto the whole record: how to reach the person, the stage, the
 * next follow-up, the history of what was said, and the form that adds to it.
 *
 * On a computer it is a table with columns; on a phone each row folds into a
 * card with the same facts. No drag and drop: the stage is a control on the
 * record, so it works the same with a mouse, a thumb or a keyboard.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "13 Nov 2026" from a date or a timestamp, written by hand so the server and the browser agree. */
function day(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

const STAGE_TONE: Record<BdStage, BadgeTone> = {
  new: "info",
  contacted: "pending",
  interested: "pending",
  meeting_scheduled: "pending",
  negotiation: "pending",
  proposal_sent: "pending",
  agreement_pending: "pending",
  onboarded: "success",
  rejected: "error",
};

const FOLLOW_TONE: Partial<Record<FollowUpState, BadgeTone>> = { overdue: "error", today: "pending", soon: "info" };

const KIND_WORD: Record<BdActivity["kind"], string> = {
  contact: "Contact",
  follow_up: "Follow-up",
  note: "Note",
  stage_change: "Stage",
};

const PAGE = 50;

export function ProspectBoard({
  prospects,
  activity = [],
  today = lagosToday(),
}: {
  prospects: BdProspect[];
  activity?: BdActivity[];
  /** Today in Lagos (YYYY-MM-DD), passed by the page so the server and the browser draw the same marks. */
  today?: string;
}) {
  const [query, setQuery] = useState("");
  const counts = useMemo(() => stageCounts(prospects), [prospects]);
  /* The working view is what is still open; a pipeline with nothing open shows everything. */
  const [view, setView] = useState<PipelineView>(counts.open > 0 ? "open" : "all");
  const [category, setCategory] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const history = useMemo(() => activityByProspect(activity), [activity]);
  const rows = useMemo(
    () => orderPipeline(filterPipeline(prospects, { query, view, category })),
    [prospects, query, view, category],
  );
  const visible = rows.slice(0, shown);

  function choose(next: PipelineView) {
    setView(next);
    setShown(PAGE);
  }

  function download() {
    /* The byte order mark makes a spreadsheet read names with accents correctly. */
    const blob = new Blob(["﻿", pipelineCsv(rows, activity)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vallo-pipeline-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const views: { key: PipelineView; label: string }[] = [
    { key: "open", label: "Open" },
    ...BD_STAGES.map((s) => ({ key: s as PipelineView, label: BD_STAGE_LABEL[s] })),
    { key: "all", label: "Everything" },
  ];

  return (
    <div className="nf-bd" data-testid="prospect-board">
      <div className="nf-bd__tools">
        <label className="nf-bd__search">
          <span className="sr-only">Search the pipeline</span>
          <input
            className="nf-field"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search a business, a person, a phone number or a place"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        <label className="nf-bd__category">
          <span className="sr-only">Category</span>
          <select className="nf-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Every category</option>
            {BD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BD_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="glass" size="md" onClick={download} disabled={rows.length === 0}>
          Download as a spreadsheet
        </Button>
      </div>

      <nav aria-label="Pipeline stages" className="nf-admin-tabs nf-bd__stages">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`nf-admin-chip${view === v.key ? " nf-admin-chip--on" : ""}${v.key === "open" || v.key === "all" ? " nf-admin-chip--all" : ""}`}
            aria-pressed={view === v.key}
            onClick={() => choose(v.key)}
          >
            {v.label} <span className="nf-numeric">({counts[v.key]})</span>
          </button>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="nf-body text-[var(--nf-content-secondary)]" role="status">
          {prospects.length === 0
            ? "Your pipeline is empty. Add the first business you are talking to above."
            : query.trim() || category !== "all"
              ? "Nothing matches that search. Clear it, or look under Everything."
              : "Nothing at this stage yet."}
        </p>
      ) : (
        <>
          <p className="nf-caption text-[var(--nf-content-secondary)]" role="status">
            Showing {visible.length} of {rows.length}. What is due comes first.
          </p>
          <div className="nf-panel nf-panel--flush nf-admin-table nf-bd-table" role="region" aria-label="Pipeline">
            <div className="nf-admin-table__head nf-bd-grid" aria-hidden="true">
              <span>Business</span>
              <span>Contact</span>
              <span>Stage</span>
              <span>Next follow-up</span>
              <span>Last activity</span>
              <span />
            </div>
            <ul className="m-0 list-none p-0">
              {visible.map((p) => (
                <li key={p.id}>
                  <ProspectRow
                    prospect={p}
                    history={history.get(p.id) ?? []}
                    today={today}
                    open={openIds.has(p.id)}
                    onToggle={(isOpen) =>
                      setOpenIds((held) => {
                        const next = new Set(held);
                        if (isOpen) next.add(p.id);
                        else next.delete(p.id);
                        return next;
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
          {rows.length > visible.length ? (
            <div>
              <Button type="button" variant="glass" size="md" onClick={() => setShown(shown + PAGE)}>
                Show {Math.min(PAGE, rows.length - visible.length)} more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProspectRow({
  prospect,
  history,
  today,
  open,
  onToggle,
}: {
  prospect: BdProspect;
  history: BdActivity[];
  today: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const due = followUpState(prospect, today);
  const dueTone = FOLLOW_TONE[due];
  const recent = history[0];

  return (
    <details className="nf-admin-row nf-bd-row" open={open} onToggle={(e) => onToggle(e.currentTarget.open)} data-testid="prospect-row">
      <summary>
        <div className="nf-bd-grid">
          <span className="nf-bd-cell nf-bd-cell--business">
            <span className="nf-bd-cell__main">{prospect.businessName}</span>
            <span className="nf-bd-cell__sub">
              {BD_CATEGORY_LABEL[prospect.category]}
              {prospect.location ? ` · ${prospect.location}` : ""}
            </span>
            {prospect.onboardedAt ? (
              <span className="nf-bd-cell__sub" data-testid="onboarded-mark">
                Onboarded {day(prospect.onboardedAt)}. {prospect.listingId ? "A listing is linked." : "No listing linked yet."}
              </span>
            ) : null}
          </span>
          <span className="nf-bd-cell nf-bd-cell--contact">
            <span className="nf-bd-cell__main nf-bd-cell__main--quiet">{prospect.contactName}</span>
            {prospect.phone ? <span className="nf-bd-cell__sub nf-numeric">{prospect.phone}</span> : null}
            {prospect.email ? <span className="nf-bd-cell__sub">{prospect.email}</span> : null}
          </span>
          <span className="nf-bd-cell nf-bd-cell--stage">
            <Badge tone={STAGE_TONE[prospect.stage]}>{BD_STAGE_LABEL[prospect.stage]}</Badge>
          </span>
          <span className="nf-bd-cell nf-bd-cell--due">
            <span className="nf-bd-cell__label">Next follow-up</span>
            {prospect.nextFollowUpAt && due !== "none" ? (
              <>
                <span className="nf-numeric">{day(prospect.nextFollowUpAt)}</span>
                {dueTone ? <Badge tone={dueTone}>{FOLLOW_UP_WORD[due]}</Badge> : null}
              </>
            ) : (
              <span className="text-[var(--nf-content-muted)]">Not set</span>
            )}
          </span>
          <span className="nf-bd-cell nf-bd-cell--last">
            <span className="nf-bd-cell__label">Last activity</span>
            {recent ? (
              <>
                <span className="nf-bd-cell__clip">{recent.outcome ? `${recent.body} (${recent.outcome})` : recent.body}</span>
                <span className="nf-bd-cell__sub nf-numeric">{day(recent.createdAt)}</span>
              </>
            ) : (
              <span className="text-[var(--nf-content-muted)]">Nothing logged</span>
            )}
          </span>
          <span className="nf-bd-cell nf-bd-cell--open" aria-hidden="true">
            {open ? "Close" : "Open"}
          </span>
        </div>
      </summary>
      {open ? <ProspectRecord prospect={prospect} history={history} /> : null}
    </details>
  );
}

function ProspectRecord({ prospect, history }: { prospect: BdProspect; history: BdActivity[] }) {
  const router = useRouter();
  const [stage, setStage] = useState(prospect.stage);
  const [follow, setFollow] = useState(prospect.nextFollowUpAt ?? "");
  const [kind, setKind] = useState<"contact" | "follow_up" | "note">("contact");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("");
  const [editing, setEditing] = useState(false);
  const [listingId, setListingId] = useState(prospect.listingId ?? "");
  const [pending, start] = useSafeTransition();

  function saveStage(next: string) {
    setStage(next as BdStage);
    start(async () => {
      const result = await changeStage({ prospectId: prospect.id, stage: next });
      if (!result.ok) {
        banner.error(result.error);
        setStage(prospect.stage);
        return;
      }
      banner.success(`Moved to ${BD_STAGE_LABEL[next as BdStage]}.`);
      router.refresh();
    });
  }

  function saveFollow(date: string | null) {
    start(async () => {
      const result = await setNextFollowUp({ prospectId: prospect.id, date });
      if (!result.ok) banner.error(result.error);
      else {
        if (!date) setFollow("");
        banner.success(date ? "Follow-up date saved." : "Follow-up date cleared.");
        router.refresh();
      }
    });
  }

  function logIt() {
    if (!body.trim()) {
      banner.error("Write what happened.");
      return;
    }
    if (kind === "contact" && !outcome.trim()) {
      banner.error("Record the outcome of the contact.");
      return;
    }
    start(async () => {
      const result = await logActivity({ prospectId: prospect.id, kind, body, outcome: kind === "contact" ? outcome : undefined });
      if (!result.ok) banner.error(result.error);
      else {
        banner.success("Logged.");
        setBody("");
        setOutcome("");
        router.refresh();
      }
    });
  }

  function saveListing() {
    start(async () => {
      const result = await linkListing({ prospectId: prospect.id, listingId: listingId.trim() || null });
      if (!result.ok) banner.error(result.error);
      else {
        banner.success(listingId.trim() ? "Listing linked." : "Listing link removed.");
        router.refresh();
      }
    });
  }

  return (
    <div className="nf-admin-row__body nf-bd-record" data-testid="prospect-record">
      <section className="nf-bd-record__col" aria-label="Details">
        <h3 className="nf-bd-record__title">Details</h3>
        {editing ? (
          <EditDetails prospect={prospect} onDone={() => setEditing(false)} />
        ) : (
          <>
            <dl className="nf-bd-facts">
              <div>
                <dt>Person</dt>
                <dd>{prospect.contactName}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  {prospect.phone ? (
                    <a href={`tel:${prospect.phone.replace(/[^\d+]/g, "")}`} className="nf-bd-link">
                      {prospect.phone}
                    </a>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  {prospect.email ? (
                    <a href={`mailto:${prospect.email}`} className="nf-bd-link break-words">
                      {prospect.email}
                    </a>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{prospect.location ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd className="nf-numeric">{day(prospect.createdAt)}</dd>
              </div>
              {prospect.notes ? (
                <div className="nf-bd-facts__wide">
                  <dt>Notes</dt>
                  <dd className="whitespace-pre-wrap break-words">{prospect.notes}</dd>
                </div>
              ) : null}
            </dl>
            <div>
              <Button type="button" variant="glass" size="sm" onClick={() => setEditing(true)}>
                Edit details
              </Button>
            </div>
          </>
        )}

        <div className="nf-bd-controls">
          <label className="grid gap-2xs nf-body">
            <span>Stage</span>
            <select className="nf-field" value={stage} onChange={(e) => saveStage(e.target.value)} disabled={pending}>
              {BD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {BD_STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2xs nf-body">
            <span>Next follow-up</span>
            <input className="nf-field" type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-xs">
            <Button type="button" variant="glass" size="sm" onClick={() => saveFollow(follow || null)} disabled={pending}>
              Save date
            </Button>
            {prospect.nextFollowUpAt ? (
              <Button type="button" variant="quiet" size="sm" onClick={() => saveFollow(null)} disabled={pending}>
                Clear date
              </Button>
            ) : null}
          </div>
        </div>

        <div className="nf-bd-controls">
          <label className="grid gap-2xs nf-body">
            <span>Listing this business produced</span>
            <input
              className="nf-field"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              placeholder="Paste the listing's ID from the Listings desk"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <div>
            <Button type="button" variant="glass" size="sm" onClick={saveListing} disabled={pending || listingId.trim() === (prospect.listingId ?? "")}>
              {listingId.trim() || !prospect.listingId ? "Save listing" : "Remove listing"}
            </Button>
          </div>
        </div>
      </section>

      <section className="nf-bd-record__col" aria-label="History">
        <h3 className="nf-bd-record__title">History</h3>
        <div className="grid gap-xs" data-testid="activity-form">
          <label className="grid gap-2xs nf-body">
            <span>What are you logging?</span>
            <select className="nf-field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="contact">A contact (a call, a message, a meeting)</option>
              <option value="follow_up">A follow-up</option>
              <option value="note">A note</option>
            </select>
          </label>
          <label className="grid gap-2xs nf-body">
            <span>What happened</span>
            <textarea className="nf-field" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
          </label>
          {kind === "contact" ? (
            <label className="grid gap-2xs nf-body">
              <span>Outcome</span>
              <input
                className="nf-field"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Interested, wants a call next week"
                maxLength={500}
              />
            </label>
          ) : null}
          <div>
            <Button type="button" variant="primary" size="sm" onClick={logIt} loading={pending}>
              Save to history
            </Button>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="nf-body text-[var(--nf-content-secondary)]">Nothing logged yet. Log the first contact above.</p>
        ) : (
          <ol className="nf-bd-history">
            {history.map((a) => (
              <li key={a.id}>
                <p className="nf-caption text-[var(--nf-content-secondary)]">
                  {KIND_WORD[a.kind] ?? "Note"} · <span className="nf-numeric">{day(a.createdAt)}</span>
                </p>
                <p className="nf-body whitespace-pre-wrap break-words">{a.body}</p>
                {a.outcome ? <p className="nf-body break-words">Outcome: {a.outcome}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function EditDetails({ prospect, onDone }: { prospect: BdProspect; onDone: () => void }) {
  const router = useRouter();
  const [contactName, setContactName] = useState(prospect.contactName);
  const [businessName, setBusinessName] = useState(prospect.businessName);
  const [category, setCategory] = useState<string>(prospect.category);
  const [email, setEmail] = useState(prospect.email ?? "");
  const [phone, setPhone] = useState(prospect.phone ?? "");
  const [location, setLocation] = useState(prospect.location ?? "");
  const [notes, setNotes] = useState(prospect.notes ?? "");
  const [pending, start] = useSafeTransition();

  function save() {
    start(async () => {
      const result = await updateProspect({ prospectId: prospect.id, contactName, businessName, category, email, phone, location, notes });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      banner.success("Details saved.");
      onDone();
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-xs"
      data-testid="edit-prospect-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="grid gap-2xs nf-body">
        <span>Business name</span>
        <input className="nf-field" required maxLength={160} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </label>
      <label className="grid gap-2xs nf-body">
        <span>Who you are talking to</span>
        <input className="nf-field" required maxLength={160} value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </label>
      <label className="grid gap-2xs nf-body">
        <span>Category</span>
        <select className="nf-field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {BD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {BD_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2xs nf-body">
        <span>Phone</span>
        <input className="nf-field" type="tel" inputMode="tel" autoComplete="off" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="grid gap-2xs nf-body">
        <span>Email</span>
        <input
          className="nf-field"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="grid gap-2xs nf-body">
        <span>Location</span>
        <input className="nf-field" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="grid gap-2xs nf-body">
        <span>Notes</span>
        <textarea className="nf-field" rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Save details
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
