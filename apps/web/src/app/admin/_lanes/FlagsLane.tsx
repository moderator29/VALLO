import { getDictionary, type Dictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { getMessageFlags, type FlagView, type PartyRole } from "@/lib/admin/queries";
import { FlagDecision } from "../_components/AdminActions";
import { fill, type AdminCommon } from "../_components/copy";
import { adminUi, type AdminUi } from "../_components/ui";
import { QueueTable, shortRef, type QueueRowData } from "../_components/QueueTable";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import {
  queueNoMatch,
  QueueFilters,
  QueuePager,
  queueNarrowed,
  readQueueQuery,
  type QueueStatusOption,
} from "../_components/QueueFilters";
import { Constants } from "@/lib/supabase/database.types";
import { dueChip } from "../_components/due";

/* V-88: this was the /admin/flags desk; it is the Flags lane of the
   unified queue now (`/admin/queue?tab=flags`), and the old address
   redirects there. */
const BASE = "/admin/queue?tab=flags";

type FlagCopy = Dictionary["admin"]["flags"];

/**
 * The flag queue: the only place the safety scanner is visible.
 *
 * The trigger in the database files a flag on every message carrying a ten
 * digit run or payment talk, and nothing in the app ever tells the sender. Here
 * a reviewer sees the matched fragment, the run-up to it in the conversation,
 * and takes one of two real decisions: clear it, or raise a risk alert that
 * keeps the case open on another queue.
 *
 * An account number carries the four-hour commitment /standards publishes,
 * because somebody has just been handed the details to pay into. Payment
 * wording alone carries the ordinary day: it is far more often two people
 * discussing how the platform works than a scam in progress.
 */
function Fragment({ text }: { text: string }) {
  return (
    <code
      className="nf-numeric rounded-xs px-xs py-3xs text-[length:var(--nf-text-caption)] font-semibold"
      style={{ background: "var(--nf-state-warning-surface)", color: "var(--nf-state-warning)" }}
    >
      {text}
    </code>
  );
}

/**
 * "The scan matched X in a message from the guest", with the fragment rendered
 * inline as code. The sentence is one dictionary entry rather than two halves,
 * so a language that puts the fragment somewhere else keeps its word order:
 * the copy is split on the placeholder, not on English grammar.
 */
function MatchLine({
  copy,
  matched,
  role,
}: {
  copy: FlagCopy;
  matched: string;
  role: string;
}) {
  // Split on the placeholder itself, never on a space: the halves either side
  // of the fragment are whatever the sentence puts there in this language.
  const [before = "", after = ""] = copy.matched.split("{fragment}");
  return (
    <p className="mt-sm flex flex-wrap items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
      <UiIcon name="search" size={16} className="shrink-0" />
      {fill(before, { role }).trim()}
      <Fragment text={matched} />
      {fill(after, { role }).trim()}
    </p>
  );
}

function FlagCard({
  flag,
  copy,
  common,
  ui,
  locale,
}: {
  flag: FlagView;
  copy: FlagCopy;
  common: AdminCommon;
  ui: AdminUi;
  locale: string;
}) {
  const roleLabel: Record<PartyRole, string> = copy.role;

  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
      <div className="flex flex-wrap items-center gap-xs">
        <ui.StatusChip status={flag.status} />
        <ui.StatusChip label={copy.reason[flag.reason]} tone="neutral" />
        {flag.status === "open" && (
          <ui.StatusChip
            {...dueChip(
              flag.createdAt,
              flag.reason === "account_number" ? "urgent" : "standard",
              common,
            )}
          />
        )}
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {ui.when(flag.createdAt)}
        </span>
      </div>

      <MatchLine
        copy={copy}
        matched={flag.matched}
        role={roleLabel[flag.senderRole].toLocaleLowerCase(locale)}
      />

      <div className="mt-sm rounded-md border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-raised)] p-sm">
        <p className="nf-overline text-[var(--nf-content-muted)]">
          {copy.context}
        </p>
        <ul className="mt-xs space-y-xs">
          {flag.context.length === 0 && (
            <li className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">{flag.body}</li>
          )}
          {flag.context.map((line) => (
            <li
              key={line.id}
              className="rounded-sm p-xs"
              style={
                line.flagged
                  ? {
                      background: "var(--nf-state-warning-surface)",
                      border: "1px solid color-mix(in oklab, var(--nf-state-warning) 40%, transparent)",
                    }
                  : { background: "color-mix(in oklab, var(--nf-content-primary) 5%, transparent)" }
              }
            >
              <span className="flex items-center gap-xs">
                <span className="nf-overline text-[var(--nf-content-muted)]">
                  {roleLabel[line.role]}
                </span>
                <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                  {ui.when(line.createdAt)}
                </span>
                {line.flagged && (
                  <span className="nf-overline text-[var(--nf-state-warning)]">
                    {copy.flagged}
                  </span>
                )}
              </span>
              <p className="mt-2xs whitespace-pre-wrap break-words text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-primary)]">
                {line.body}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {flag.status === "open" ? (
        <FlagDecision flagId={flag.id} copy={copy} common={common} />
      ) : (
        <p className="mt-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {copy.reviewed} {common.inAuditLog}
        </p>
      )}
    </li>
  );
}

/** `message_flag_status` is `open, reviewed`, read from the generated enum. */
function statusFilters(ui: AdminUi): readonly QueueStatusOption[] {
  return Constants.public.Enums.message_flag_status.map((value) => ({
    value,
    label: ui.statusLabel(value),
  }));
}

export async function FlagsLane({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.flags;
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  /* The shared queue frame. The search is over what the safety scan matched,
     which is what an operator is chasing when they come back to a flag. */
  const query = readQueueQuery(params);
  const flags = await getMessageFlags({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.offset ? { offset: query.offset } : {}),
  });

  if (flags.state !== "ok") {
    return (
      <div className="nf-console">
        <ui.QueueHeader title={copy.title} lede={copy.lede} />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const rows = flags.data.rows;
  const open = rows.filter((flag) => flag.status === "open");
  const reviewed = rows.filter((flag) => flag.status !== "open");
  /* A page past the first counts as narrowed for the empty copy. Landing on
     page three of a queue that has run out is a RESULT; "nothing has ever
     arrived here" would be a flat lie told to somebody looking at rows they
     have just paged past. `queueNarrowed` itself deliberately ignores the
     offset, because the Clear control is about the filters. */
  const narrowed = queueNarrowed(query) || (query.offset ?? 0) > 0;
  const noMatch = queueNoMatch(common);

  return (
    <div className="nf-console">
      <ui.QueueHeader title={copy.title} lede={copy.lede} count={open.length} />

      <QueueFilters
        base={BASE}
        query={query}
        common={common}
        statuses={statusFilters(ui)}
      />

      {rows.length === 0 ? (
        <ui.QueueEmpty
          title={narrowed ? noMatch.title : copy.emptyTitle}
          body={narrowed ? noMatch.body : copy.emptyBody}
          state={narrowed ? "no-match" : "never"}
        />
      ) : open.length === 0 ? null : (
        <QueueTable
          heads={t.uiCommon.console.table}
          label="Message flags"
          rows={open.map((flag) => ({
            ...flagRow(flag, ui),
            children: (
              <ul className="nf-queue-list">
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  copy={copy}
                  common={common}
                  ui={ui}
                  locale={locale}
                />
              </ul>
            ),
          }))}
        />
      )}

      {reviewed.length > 0 && (
        <section className="mt-xl">
          <h2 className="nf-h3 mb-sm text-[length:var(--nf-text-body)]">{common.recentlyReviewed}</h2>
          <QueueTable
          heads={t.uiCommon.console.table}
          label="Message flags"
          rows={reviewed.map((flag) => ({
            ...flagRow(flag, ui),
            children: (
              <ul className="nf-queue-list">
                <FlagCard
                    key={flag.id}
                    flag={flag}
                    copy={copy}
                    common={common}
                    ui={ui}
                    locale={locale}
                  />
              </ul>
            ),
          }))}
        />
        </section>
      )}

      <QueuePager
        base={BASE}
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={flags.data.full}
        count={rows.length}
      />
    </div>
  );
}

/** The dense row a flag takes in the console table. */
function flagRow(flag: FlagView, ui: AdminUi): QueueRowData {
  return {
    id: flag.id,
    reference: shortRef("FLG", flag.id),
    type: "Message",
    icon: "chat-bubble",
    title: ui.columnLabel("reason", flag.reason),
    sub: flag.matched,
    detail: flag.body,
    status: flag.status,
    statusLabel: ui.statusLabel(flag.status),
    submitted: ui.when(flag.createdAt),
  };
}
