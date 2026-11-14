"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { MediaPill } from "@/components/ui/MediaPill";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { Sheet } from "@/components/ui/Sheet";
import { formatMoney, plural } from "@vallo/i18n/core";
import {
  addGroupExpense,
  answerGroupInvite,
  answerJoinRequest,
  deleteGroupExpense,
  deleteGroupPost,
  inviteToGroup,
  leaveGroup,
  postToGroup,
  removeFromGroupShortlist,
  removeGroupMember,
  requestToJoinGroup,
  setGroupExpenseStatus,
  setGroupStage,
  setMemberShare,
  voteOnShortlist,
} from "@/lib/features/roommates/actions";
import { LIMITS, ROOMMATES_ROUTES, splitCosts, type ExpenseStatus, type GroupStage, type PersonRef, type Vote } from "@/lib/features/roommates/model";
import type { GroupExpense, GroupMember, GroupPost, ShortlistItem } from "@/lib/features/roommates/queries";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { feedback } from "@/lib/ui/feedback";

import { ConfirmSheet, InviteCard } from "../../me/_parts/HubActions";
import { Face, fill } from "./kit";
import { koboOf, nairaDisplay } from "./money";
import { useRun } from "./use-run";

/**
 * THE GROUP'S CONTROLS (FE-B): join, the owner's stage, members (invite from
 * connections, join requests, remove, shares, leave), the shortlist with
 * votes and a side-by-side compare, the board and the household costs. Every
 * write waits for the server and says its outcome in the banner.
 */

export function JoinGroupButton({ groupId, initial = false }: { groupId: string; initial?: boolean }) {
  const G = useScopedCopy("roommates").groupsX;
  const [sent, setSent] = useState(initial);
  const { pending, run } = useRun();
  if (sent) {
    return (
      <Button variant="secondary" size="sm" disabled>
        {G.requested}
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      size="sm"
      loading={pending}
      data-testid="rm-group-join"
      onClick={() => run(() => requestToJoinGroup(groupId), { success: G.requestedDone, onOk: () => setSent(true) })}
    >
      {G.requestJoin}
    </Button>
  );
}

export function InvitedActions({ groupId, groupName, inviter }: { groupId: string; groupName: string; inviter: PersonRef | null }) {
  const R = useScopedCopy("roommates");
  const O = R.groupsX.outsider;
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <div className="nf-rmb-actions">
      <Button variant="primary" size="md" onClick={() => setOpen(true)} data-testid="rm-group-invited-accept">
        {O.accept}
      </Button>
      <Button variant="quiet" size="md" loading={pending && !open} onClick={() => run(() => answerGroupInvite({ groupId, accept: false }), { success: R.hubX.groups.declined })}>
        {O.decline}
      </Button>
      <InviteCard
        open={open}
        onOpenChange={setOpen}
        title={R.hubX.groups.inviteTitle}
        person={inviter}
        line={fill(R.hubX.groups.inviteLine, { name: inviter?.name ?? "", group: groupName })}
        acceptLabel={O.accept}
        cancelLabel={R.hubX.requests.cancel}
        pending={pending}
        testId="rm-group-invite-card"
        onAccept={() => run(() => answerGroupInvite({ groupId, accept: true }), { success: fill(R.hubX.groups.joined, { group: groupName }), onOk: () => setOpen(false) })}
      />
    </div>
  );
}

const STAGES: GroupStage[] = ["forming", "searching", "decided", "living", "closed"];

export function StageControl({ groupId, stage }: { groupId: string; stage: GroupStage }) {
  const R = useScopedCopy("roommates");
  const D = R.groupsX.dash;
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  return (
    <>
      {/* A selector pill that shows the current stage and opens the chooser (MediaPill, SHARE_AND_CONTROLS.md section 2). */}
      <MediaPill
        label={D.stage}
        sub={R.groups.stage[stage]}
        tone="light"
        media={<UiIcon name="flag" size={18} />}
        trailingIcon="chevron-down"
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onOpenChange={setOpen} title={D.changeStage} detents={[0.6]} testId="rm-group-stage-sheet">
        <div role="radiogroup" aria-label={D.stage} className="grid gap-sm">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === stage}
              className="nf-rmb-option"
              disabled={pending}
              onClick={() => {
                if (s === stage) return setOpen(false);
                feedback("select");
                run(() => setGroupStage(groupId, s), { success: fill(D.stageSaved, { stage: R.groups.stage[s] }), onOk: () => setOpen(false) });
              }}
            >
              {R.groups.stage[s]}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ members */

export function InvitePicker({ groupId, groupName, connections, memberIds }: { groupId: string; groupName: string; connections: PersonRef[]; memberIds: string[] }) {
  const R = useScopedCopy("roommates");
  const M = R.groupsX.membersX;
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const { pending, run } = useRun();
  const left = connections.filter((c) => !memberIds.includes(c.userId));
  return (
    <>
      <Button variant="primary" size="sm" leadingIcon="plus" onClick={() => setOpen(true)} data-testid="rm-group-invite">
        {M.invite}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={fill(M.pickTitle, { group: groupName })} detents={[0.7]} testId="rm-group-invite-sheet">
        {left.length === 0 ? (
          <div className="nf-rmb-empty">
            <p>{M.pickEmpty}</p>
            <ButtonLink href={ROOMMATES_ROUTES.discover} variant="secondary" size="sm">
              {R.hubX.requests.findPeople}
            </ButtonLink>
          </div>
        ) : (
          <ul className="nf-rmb-rows">
            {left.map((c) => (
              <li key={c.userId} className="nf-rmb-row">
                <Face person={c} size="sm" />
                <p className="nf-rmb-row__title">{c.name}</p>
                <Button
                  variant={sent.includes(c.userId) ? "secondary" : "primary"}
                  size="sm"
                  disabled={pending || sent.includes(c.userId)}
                  onClick={() =>
                    run(() => inviteToGroup({ groupId, userId: c.userId }), {
                      success: fill(M.invited, { name: c.name }),
                      onOk: () => setSent((s) => [...s, c.userId]),
                    })
                  }
                >
                  {sent.includes(c.userId) ? M.pending : M.pickInvite}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}

export function JoinRequestDecision({ groupId, person }: { groupId: string; person: PersonRef }) {
  const M = useScopedCopy("roommates").groupsX.membersX;
  const { pending, run } = useRun();
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        disabled={pending}
        onClick={() => run(() => answerJoinRequest({ groupId, userId: person.userId, accept: true }), { success: fill(M.accepted, { name: person.name }) })}
      >
        {M.accept}
      </Button>
      <Button variant="quiet" size="sm" disabled={pending} onClick={() => run(() => answerJoinRequest({ groupId, userId: person.userId, accept: false }), { success: M.declinedDone })}>
        {M.decline}
      </Button>
    </>
  );
}

export function RemoveMember({ groupId, person }: { groupId: string; person: PersonRef }) {
  const R = useScopedCopy("roommates");
  const M = R.groupsX.membersX;
  const [sure, setSure] = useState(false);
  const { pending, run } = useRun();
  return (
    <>
      <Button variant="dangerQuiet" size="sm" onClick={() => setSure(true)}>
        {M.remove}
      </Button>
      <ConfirmSheet
        open={sure}
        onOpenChange={setSure}
        title={fill(M.removeTitle, { name: person.name })}
        line={M.removeLine}
        yes={M.removeYes}
        cancel={R.hubX.requests.cancel}
        pending={pending}
        testId="rm-group-remove-sheet"
        onYes={() => run(() => removeGroupMember({ groupId, userId: person.userId }), { success: fill(M.removed, { name: person.name }), onOk: () => setSure(false) })}
      />
    </>
  );
}

export function LeaveGroup({ groupId, groupName }: { groupId: string; groupName: string }) {
  const R = useScopedCopy("roommates");
  const M = R.groupsX.membersX;
  const [sure, setSure] = useState(false);
  const { pending, run, router } = useRun();
  return (
    <>
      <Button variant="dangerQuiet" size="sm" onClick={() => setSure(true)} data-testid="rm-group-leave">
        {M.leave}
      </Button>
      <ConfirmSheet
        open={sure}
        onOpenChange={setSure}
        title={fill(M.leaveTitle, { group: groupName })}
        line={M.leaveLine}
        yes={M.leaveYes}
        cancel={R.hubX.requests.cancel}
        pending={pending}
        testId="rm-group-leave-sheet"
        onYes={() =>
          run(() => leaveGroup(groupId), {
            success: M.left,
            refresh: false,
            onOk: () => {
              setSure(false);
              router.push(ROOMMATES_ROUTES.groups);
            },
          })
        }
      />
    </>
  );
}

export function ShareEditor({ groupId, member }: { groupId: string; member: GroupMember }) {
  const R = useScopedCopy("roommates");
  const M = R.groupsX.membersX;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(member.sharePercent === null ? "" : String(member.sharePercent));
  const [problem, setProblem] = useState<string | null>(null);
  const { pending, run } = useRun();
  const fieldId = `rm-share-${member.userId}`;
  return (
    <>
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        {member.sharePercent === null ? `${M.share}: ${M.shareEqual}` : `${M.share}: ${member.sharePercent}%`}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={fill(M.shareTitle, { name: member.name })}
        detents={[0.5]}
        reset={{ label: M.shareClear, disabled: pending, onClick: () => run(() => setMemberShare({ groupId, userId: member.userId, percent: null }), { success: M.shareSaved, onOk: () => setOpen(false) }) }}
        apply={{
          label: M.shareSave,
          loading: pending,
          onClick: () => {
            const n = Number(value);
            if (!value.trim() || !Number.isFinite(n) || n < 0 || n > 100) {
              setProblem(M.shareField);
              return;
            }
            setProblem(null);
            run(() => setMemberShare({ groupId, userId: member.userId, percent: n }), { success: M.shareSaved, onOk: () => setOpen(false) });
          },
        }}
      >
        <div className="nf-rmb-field">
          <label htmlFor={fieldId}>{M.shareField}</label>
          <input
            id={fieldId}
            inputMode="decimal"
            value={value}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${fieldId}-problem` : undefined}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
          />
          <FieldProblem id={`${fieldId}-problem`} message={problem} />
        </div>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ shortlist */

/** The monthly cost each member would carry: the price split by the number of members. */
function perPersonMonthly(item: ShortlistItem, members: number): number | null {
  if (item.target.priceMinor === null) return null;
  const split = splitCosts([{ key: "rent", label: "rent", amountMinor: item.target.priceMinor, period: item.target.period ?? "year" }], Array.from({ length: Math.max(1, members) }, () => 1));
  return split.shares[0]?.monthlyMinor ?? null;
}

export function ShortlistPanel({ groupId, items, members, removable }: { groupId: string; items: ShortlistItem[]; members: number; removable: string[] }) {
  const R = useScopedCopy("roommates");
  const S = R.groupsX.shortlistX;
  const locale = useClientLocale();
  const [mine, setMine] = useState<Record<string, Vote | null>>(() => Object.fromEntries(items.map((i) => [i.id, i.votes.mine])));
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const vote = useRun();
  const remove = useRun();

  const tally = (item: ShortlistItem, v: Vote) => item.votes[v] - (item.votes.mine === v ? 1 : 0) + (mine[item.id] === v ? 1 : 0);
  const chosen = useMemo(() => items.filter((i) => picked.includes(i.id)), [items, picked]);
  const price = (item: ShortlistItem) =>
    item.target.priceMinor === null ? "" : `${formatMoney(item.target.priceMinor, locale)}${item.target.period ? R.perPeriod[item.target.period] : ""}`;

  if (items.length === 0) {
    return (
      <div className="nf-rmb-empty">
        <p>{S.empty}</p>
        <Link href={ROOMMATES_ROUTES.rooms} className="nf-link">
          {S.find}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-sm">
      <div className="nf-rmb-actions">
        <Button variant="primary" size="sm" disabled={chosen.length < 2} onClick={() => setComparing(true)} data-testid="rm-shortlist-compare">
          {chosen.length >= 2 ? fill(S.compareShow, { count: chosen.length }) : S.compare}
        </Button>
        {picked.length ? (
          <Button variant="quiet" size="sm" onClick={() => setPicked([])}>
            {S.clear}
          </Button>
        ) : (
          <span className="nf-rmb-row__line self-center">{S.compareHint}</span>
        )}
      </div>
      <ul className="nf-rmb-list" data-testid="rm-shortlist">
        {items.map((item) => {
          const each = perPersonMonthly(item, members);
          const isPicked = picked.includes(item.id);
          return (
            <li key={item.id} className="nf-rmb-card nf-rmg-shortcard">
              <div className="nf-rmg-shortcard__photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- a listing photo from a public bucket, small on purpose */}
                {item.target.photoUrl ? <img src={item.target.photoUrl} alt="" loading="lazy" /> : null}
              </div>
              <div className="grid min-w-0 gap-3xs">
                <span className="nf-rmb-row__line">{item.kind === "room" ? S.room : S.property}</span>
                <p className="nf-rmb-row__title">
                  <Link href={item.target.href}>{item.target.title}</Link>
                </p>
                <p className="nf-rmb-row__line">{[item.target.area, item.target.city].filter(Boolean).join(", ")}</p>
                <p className="nf-rmh-post__meta">
                  {price(item) ? <span className="nf-rmb-row__amount">{price(item)}</span> : null}
                  {each !== null ? <span>{`${S.perPerson}: ${formatMoney(each, locale)}`}</span> : null}
                </p>
                <p className="nf-rmb-row__line">{fill(S.addedBy, { name: item.addedBy.name })}</p>
              </div>
              <div className="nf-rmg-shortcard__votes" role="group" aria-label={S.votesLabel}>
                {(["yes", "maybe", "no"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="nf-rmb-chip"
                    aria-pressed={mine[item.id] === v}
                    disabled={vote.pending}
                    onClick={() => {
                      const before = mine[item.id] ?? null;
                      const next = before === v ? null : v;
                      feedback("select");
                      setMine((m) => ({ ...m, [item.id]: next }));
                      vote.run(() => voteOnShortlist({ groupId, shortlistId: item.id, vote: next }), {
                        success: next ? S.voted : S.unvoted,
                        onFail: () => setMine((m) => ({ ...m, [item.id]: before })),
                      });
                    }}
                  >
                    {`${R.groups.vote[v]} ${tally(item, v)}`}
                  </button>
                ))}
                <button
                  type="button"
                  className="nf-rmb-chip"
                  aria-pressed={isPicked}
                  disabled={!isPicked && picked.length >= 4}
                  onClick={() => {
                    feedback("select");
                    setPicked((p) => (isPicked ? p.filter((x) => x !== item.id) : [...p, item.id]));
                  }}
                >
                  {S.compare}
                </button>
                {removable.includes(item.id) ? (
                  <Button variant="dangerQuiet" size="sm" disabled={remove.pending} onClick={() => remove.run(() => removeFromGroupShortlist({ groupId, id: item.id }), { success: S.removed })}>
                    {S.remove}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Sheet open={comparing} onOpenChange={setComparing} title={S.compareTitle} detents={[0.92]} testId="rm-compare-sheet">
        <div className="nf-rmg-compare">
          {chosen.map((item) => {
            const each = perPersonMonthly(item, members);
            const v = (k: Vote) => tally(item, k);
            return (
              <article key={item.id} className="nf-rmg-compare__col">
                <p className="nf-rmb-row__title">
                  <Link href={item.target.href}>{item.target.title}</Link>
                </p>
                <dl>
                  <dt>{S.price}</dt>
                  <dd>{price(item) || "-"}</dd>
                  <dt>{S.bedrooms}</dt>
                  <dd>{item.target.bedrooms ?? "-"}</dd>
                  <dt>{S.perPerson}</dt>
                  <dd>{each !== null ? formatMoney(each, locale) : "-"}</dd>
                  <dt>{S.votes}</dt>
                  <dd>{`${R.groups.vote.yes} ${v("yes")} · ${R.groups.vote.maybe} ${v("maybe")} · ${R.groups.vote.no} ${v("no")}`}</dd>
                </dl>
                <ButtonLink href={item.target.href} variant="secondary" size="sm">
                  {S.open}
                </ButtonLink>
              </article>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ board */

export function BoardComposer({ groupId }: { groupId: string }) {
  const B = useScopedCopy("roommates").groupsX.boardX;
  const [body, setBody] = useState("");
  const { pending, run } = useRun();
  return (
    <form
      className="nf-rmb-field"
      data-testid="rm-board-compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        run(() => postToGroup({ groupId, body }), { success: B.posted, onOk: () => setBody("") });
      }}
    >
      <label htmlFor="rm-board-body" className="sr-only">
        {B.placeholder}
      </label>
      <textarea autoCapitalize="sentences" enterKeyHint="enter" id="rm-board-body" value={body} maxLength={LIMITS.postMax} placeholder={B.placeholder} onChange={(e) => setBody(e.target.value)} />
      <div className="flex items-center justify-between gap-sm">
        <span className="nf-rmb-field__hint nf-numeric">{body.length > LIMITS.postMax - 100 ? `${LIMITS.postMax - body.length}` : ""}</span>
        <Button type="submit" variant="primary" size="sm" trailingIcon="send" loading={pending} disabled={!body.trim()}>
          {B.post}
        </Button>
      </div>
    </form>
  );
}

export function DeletePost({ groupId, post }: { groupId: string; post: GroupPost }) {
  const B = useScopedCopy("roommates").groupsX.boardX;
  const { pending, run } = useRun();
  return (
    <Button variant="dangerQuiet" size="sm" loading={pending} onClick={() => run(() => deleteGroupPost({ groupId, id: post.id }), { success: B.deleted })}>
      {B.delete}
    </Button>
  );
}

/* ------------------------------------------------------------------ costs */

export function AddExpense({ groupId, members }: { groupId: string; members: PersonRef[] }) {
  const R = useScopedCopy("roommates");
  const C = R.groupsX.costsX;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<ExpenseStatus>("planned");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const { pending, run } = useRun();
  const submit = () => {
    const minor = koboOf(amount);
    run(
      () =>
        addGroupExpense({
          groupId,
          title,
          amountMinor: minor ?? 0,
          paidBy: paidBy || null,
          dueOn: due || null,
          status,
        }),
      {
        success: C.added,
        onFail: (r) => setProblems(r.fieldErrors ?? {}),
        onOk: () => {
          setProblems({});
          setTitle("");
          setAmount("");
          setPaidBy("");
          setDue("");
          setStatus("planned");
          setOpen(false);
        },
      },
    );
  };
  return (
    <>
      <Button variant="primary" size="sm" leadingIcon="plus" onClick={() => setOpen(true)} data-testid="rm-cost-add">
        {C.add}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={C.addTitle} detents={[0.92]} apply={{ label: C.save, loading: pending, onClick: submit }} testId="rm-cost-sheet">
        <div className="grid gap-md">
          <div className="nf-rmb-field">
            <label htmlFor="rm-cost-title">{C.titleField}</label>
            <input type="text" autoComplete="off" autoCapitalize="sentences"
              id="rm-cost-title"
              value={title}
              maxLength={80}
              placeholder={C.titlePlaceholder}
              aria-invalid={problems.title ? true : undefined}
              aria-describedby={problems.title ? "rm-cost-title-problem" : undefined}
              onChange={(e) => setTitle(e.target.value)}
            />
            <FieldProblem id="rm-cost-title-problem" message={problems.title} />
          </div>
          <div className="nf-rmb-field">
            <label htmlFor="rm-cost-amount">{C.amount}</label>
            <input
              id="rm-cost-amount"
              inputMode="numeric"
              value={amount}
              placeholder="0"
              aria-invalid={problems.amountMinor ? true : undefined}
              aria-describedby={problems.amountMinor ? "rm-cost-amount-problem" : undefined}
              onChange={(e) => setAmount(nairaDisplay(e.target.value))}
            />
            <FieldProblem id="rm-cost-amount-problem" message={problems.amountMinor} />
          </div>
          <div className="nf-rmb-grid2">
            <div className="nf-rmb-field">
              <label htmlFor="rm-cost-paid">{C.paidBy}</label>
              <select id="rm-cost-paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                <option value="">{C.nobody}</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="nf-rmb-field">
              <label htmlFor="rm-cost-due">{C.due}</label>
              <input id="rm-cost-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div className="nf-rmb-field">
            <span className="nf-rmb-field__label" id="rm-cost-status">
              {C.statusField}
            </span>
            <div role="radiogroup" aria-labelledby="rm-cost-status" className="nf-rmb-actions">
              {(["planned", "recorded", "settled"] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={status === s} className="nf-rmb-chip" onClick={() => setStatus(s)}>
                  {C.status[s]}
                </button>
              ))}
            </div>
          </div>
          <p className="nf-rmb-note">{R.groups.recordedNote}</p>
        </div>
      </Sheet>
    </>
  );
}

export function ExpenseControls({ groupId, expense }: { groupId: string; expense: GroupExpense }) {
  const C = useScopedCopy("roommates").groupsX.costsX;
  const { pending, run } = useRun();
  const next: ExpenseStatus | null = expense.status === "planned" ? "recorded" : expense.status === "recorded" ? "settled" : null;
  return (
    <>
      {next ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setGroupExpenseStatus({ groupId, id: expense.id, status: next }), { success: fill(C.changed, { status: C.status[next] }) })}
        >
          {C.status[next]}
        </Button>
      ) : null}
      <Button variant="dangerQuiet" size="sm" disabled={pending} onClick={() => run(() => deleteGroupExpense({ groupId, id: expense.id }), { success: C.deleted })}>
        {C.delete}
      </Button>
    </>
  );
}

/** Counted phrase for a client island, from the dictionary's own forms. */
export function useCounted() {
  const locale = useClientLocale();
  return (n: number, forms: { other: string; one?: string }) => plural(n, forms, locale);
}
