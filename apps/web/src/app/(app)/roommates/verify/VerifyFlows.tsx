"use client";

import { PasteCodeButton } from "@/components/ui/PasteCodeButton";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { confirmSchoolEmail, startSchoolEmailCheck, submitRoommateDocument } from "@/lib/features/roommates/actions";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { fill } from "../groups/_parts/kit";
import { useRun } from "../groups/_parts/use-run";

type School = { id: string; name: string };

/** The school email check: choose the school, send a code, type it back. */
export function EmailCheck({ schools }: { schools: School[] }) {
  const R = useScopedCopy("roommates");
  const E = R.verifyX.email;
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<{ verificationId: string; sentTo: string } | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const { pending, run } = useRun();
  const field = (key: string) => ({
    "aria-invalid": problems[key] ? true : undefined,
    "aria-describedby": problems[key] ? `rm-ve-${key}-problem` : undefined,
  });

  if (sent) {
    return (
      <form
        className="nf-rmb-card grid gap-md"
        data-testid="rm-verify-code"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => confirmSchoolEmail({ verificationId: sent.verificationId, code }), {
            success: E.confirmed,
            onFail: (r) => setProblems(r.fieldErrors ?? {}),
            onOk: () => {
              setSent(null);
              setCode("");
            },
          });
        }}
      >
        <p className="nf-rmb-row__line">{fill(R.verification.codeSent, { email: sent.sentTo })}</p>
        <div className="nf-rmb-field">
          <label htmlFor="rm-ve-code">{E.code}</label>
          <input
            id="rm-ve-code"
            className="nf-rmv-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            {...field("code")}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {/* Paste the emailed code in one tap (14 November 2026). */}
          <div className="nf-paste-code__row">
            <PasteCodeButton length={6} onCode={(pasted) => setCode(pasted.replace(/\D/g, "").slice(0, 6))} />
          </div>
          <FieldProblem id="rm-ve-code-problem" message={problems.code} />
        </div>
        <div className="nf-rmb-actions">
          <Button type="submit" variant="primary" size="md" loading={pending} disabled={code.length !== 6}>
            {E.confirm}
          </Button>
          <Button type="button" variant="quiet" size="md" disabled={pending} onClick={() => setSent(null)}>
            {E.again}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="nf-rmb-card grid gap-md"
      data-testid="rm-verify-email"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => startSchoolEmailCheck({ institutionId: school, email }), {
          success: E.sent,
          refresh: false,
          onFail: (r) => setProblems(r.fieldErrors ?? {}),
          onOk: (d) => {
            setProblems({});
            setSent(d);
          },
        });
      }}
    >
      <div className="nf-rmb-field">
        <label htmlFor="rm-ve-institutionId">{E.school}</label>
        <select id="rm-ve-institutionId" value={school} {...field("institutionId")} onChange={(e) => setSchool(e.target.value)}>
          <option value="">{E.pick}</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <FieldProblem id="rm-ve-institutionId-problem" message={problems.institutionId} />
      </div>
      <div className="nf-rmb-field">
        <label htmlFor="rm-ve-email">{E.field}</label>
        <input id="rm-ve-email" type="email" autoComplete="email" inputMode="email" value={email} placeholder={E.placeholder} {...field("email")} onChange={(e) => setEmail(e.target.value)} />
        <FieldProblem id="rm-ve-email-problem" message={problems.email} />
      </div>
      <Button type="submit" variant="primary" size="md" loading={pending} disabled={!school || !email.includes("@")} data-testid="rm-verify-send">
        {E.send}
      </Button>
    </form>
  );
}

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** The document check: the file goes to the member's own folder of the private bucket, then to review. */
export function DocumentCheck({ userId, schools }: { userId: string | null; schools: School[] }) {
  const R = useScopedCopy("roommates");
  const D = R.verifyX.document;
  const [kind, setKind] = useState<"student_id" | "nysc" | "workplace">("student_id");
  const [school, setSchool] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const input = useRef<HTMLInputElement | null>(null);

  const send = () =>
    start(async () => {
      if (!userId) return banner.error(R.signIn);
      if (!file) {
        setProblem(D.pickFile);
        return;
      }
      const ext = TYPES[file.type];
      if (!ext) return setProblem(D.wrongType);
      if (file.size > MAX_BYTES) return setProblem(D.tooBig);
      setProblem(null);
      try {
        const db = await loadBrowserClient();
        if (!db) return banner.error(R.notOpen);
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const up = await db.storage.from("roommate-evidence").upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) return banner.error(D.uploadFailed);
        const result = await submitRoommateDocument({ kind, institutionId: kind === "student_id" && school ? school : null, path });
        if (!result.ok) {
          /* The record was refused, so the file is not kept. */
          void db.storage.from("roommate-evidence").remove([path]);
          return banner.error(result.error);
        }
        feedback("confirm");
        banner.success(D.sent);
        setFile(null);
        if (input.current) input.current.value = "";
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <div className="nf-rmb-card grid gap-md" data-testid="rm-verify-document">
      <div className="nf-rmb-field">
        <span className="nf-rmb-field__label" id="rm-vd-kind">
          {D.kind}
        </span>
        <div role="radiogroup" aria-labelledby="rm-vd-kind" className="grid gap-xs">
          {(["student_id", "nysc", "workplace"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className="nf-rmb-option"
              onClick={() => {
                feedback("select");
                setKind(k);
              }}
            >
              {D.kinds[k]}
            </button>
          ))}
        </div>
      </div>
      {kind === "student_id" && schools.length > 0 ? (
        <div className="nf-rmb-field">
          <label htmlFor="rm-vd-school">{R.verifyX.email.school}</label>
          <select id="rm-vd-school" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">{R.verifyX.email.pick}</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="nf-rmb-field">
        <label htmlFor="rm-vd-file">{D.file}</label>
        <input
          ref={input}
          id="rm-vd-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "rm-vd-file-problem" : undefined}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setProblem(null);
          }}
        />
        <FieldProblem id="rm-vd-file-problem" message={problem} />
        {file ? <span className="nf-rmb-field__hint">{fill(D.chosen, { name: file.name })}</span> : null}
      </div>
      <Button variant="primary" size="md" loading={pending} disabled={!file} onClick={send} data-testid="rm-verify-upload">
        {pending ? D.sending : D.send}
      </Button>
    </div>
  );
}
