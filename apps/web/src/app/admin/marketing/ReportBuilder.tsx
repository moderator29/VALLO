"use client";

import { useState } from "react";

import { CopyButton } from "@/components/docs/CopyButton";
import { createEntry } from "@/lib/admin/desk-entries/actions";

import { useDesk } from "../_components/useDesk";

/**
 * THE MONTHLY REPORT BUILDER. The server writes a first draft from the
 * campaigns and the numbers the manager logged; this lets the manager edit it,
 * copy it, or save it as a draft report to send for approval.
 */
export function ReportBuilder({ month, draft }: { month: string; draft: string }) {
  const { pending, run } = useDesk();
  const [text, setText] = useState(draft);
  return (
    <div className="grid gap-sm" data-testid="marketing-report-builder">
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Report for {month}</span>
        <textarea className="nf-field min-h-[240px] resize-y" value={text} maxLength={12000} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-xs">
        <button
          type="button"
          className="nf-btn nf-btn--primary"
          disabled={pending}
          onClick={() => run(() => createEntry("monthly_report", { title: `Marketing report, ${month}`, body: text, dueOn: "", linkUrl: "", subjectUser: "", fields: { month } }), "Saved as a draft report. Send it for approval below.")}
        >
          Save as draft report
        </button>
        <CopyButton text={text} label="Report" />
      </div>
    </div>
  );
}
