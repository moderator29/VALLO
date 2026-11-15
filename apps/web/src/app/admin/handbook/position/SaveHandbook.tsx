"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { toast } from "@/lib/ui/toast";
import {
  handbookFileName,
  handbookMarkdown,
  todayInLagos,
  type HandbookDocument,
} from "@/lib/admin/position-handbook/markdown";

/**
 * SAVE THIS HANDBOOK TO THIS DEVICE (15 November 2026, the founder: a person
 * reads it from their own desk and can save it from the web).
 *
 * TWO WAYS, BOTH WORKING, AND NO NEW PACKAGE.
 *
 *   Save as PDF   `window.print()` against `handbook-print.css`, so the
 *                 browser's own PDF writer makes the document. The same way
 *                 a receipt and a statement are saved, and the same reason:
 *                 there is no second renderer that could disagree with the
 *                 screen. On a phone it is the share sheet's "Save to Files"
 *                 or "Print", which both browsers offer from the print view.
 *   Save as file  A Markdown file built here in the browser from the plain
 *                 document the server handed down, which is the same
 *                 handbook flattened from the same JSX the page rendered.
 *                 A Blob, an object URL, a click, and the URL revoked again.
 *
 * The outcome is said by the one top banner, never beside the button.
 */
export function SaveHandbook({ document: handbook }: { document: HandbookDocument }) {
  const [busy, setBusy] = useState(false);

  const saveFile = () => {
    setBusy(true);
    let url: string | null = null;
    try {
      const markdown = handbookMarkdown(handbook);
      const name = handbookFileName(handbook, todayInLagos());
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = name;
      link.rel = "noopener";
      /* Safari on a phone follows a link only once it is in the document. */
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      toast(`Saved as ${name}`, { tone: "success" });
    } catch {
      toast("The file could not be made just now. Try Save as PDF instead.", { tone: "error" });
    } finally {
      /* The download has started by now; revoking frees the copy the browser
         made. Given a tick, because Safari reads the URL after the click. */
      if (url) {
        const made = url;
        window.setTimeout(() => URL.revokeObjectURL(made), 4_000);
      }
      setBusy(false);
    }
  };

  return (
    <div className="nf-hbp-noprint grid gap-sm sm:grid-cols-2" data-testid="handbook-save">
      <Button variant="primary" size="lg" full onClick={() => window.print()} data-testid="handbook-save-pdf">
        <UiIcon name="document" size={18} />
        Save as PDF
      </Button>
      <Button
        variant="secondary"
        size="lg"
        full
        loading={busy}
        onClick={saveFile}
        data-testid="handbook-save-file"
      >
        <UiIcon name="file-text" size={18} />
        Save as a file
      </Button>
    </div>
  );
}
