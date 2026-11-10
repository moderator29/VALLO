"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ActionTile } from "@/components/ui/ActionTile";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { toast } from "@/lib/ui/toast";
import type { ReceiptModel } from "@/components/app/money/receipt-model";
import { canvasBlob, receiptCanvas, receiptPdf, saveFile, shareOrSave } from "@/lib/money/receipt-image";
import { PROTECTED_RECEIPT_HELP } from "@/lib/money/copy";
import "@/app/css/money-layer.css";

/**
 * Under a receipt (PREMIUM-STANDARD references 4, 7 and 8; ONE-PRODUCT-
 * DECISIONS recommendation 2). One filled "Download receipt", which saves the
 * receipt as a PDF; under it reference 8's equal tiles: save it as an image,
 * share it (the phone's own share sheet with the file where it takes files,
 * a download otherwise), and print where the page has a printable sheet;
 * then one quiet way on.
 *
 * Every file is the one receipt design, drawn from the same `ReceiptModel`
 * the sheet on screen draws (`lib/money/receipt-image.ts`), so the PDF, the
 * picture and the screen cannot disagree.
 */
export function ReceiptActions({
  receipt,
  back,
  print = true,
  testId,
  help,
}: {
  /** The model the sheet drew. Without it only printing is offered. */
  receipt?: ReceiptModel;
  back?: { href: string; label: string };
  /** Offer the browser's print, where the page carries a printable sheet. */
  print?: boolean;
  testId?: string;
  /**
   * Help inside the receipt (BUILD 7.4), for a protected payment: the
   * problem path with the payment attached, where the money is now, and who
   * is holding it. Each is a link the page supplies; absent, nothing is drawn.
   */
  help?: { wrong: string; where: string; who: string };
}) {
  const [busy, setBusy] = useState<"pdf" | "image" | "share" | null>(null);
  const name = receipt ? `vallo-receipt-${(receipt.reference?.value ?? receipt.title).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 48)}` : "vallo-receipt";

  const run = async (what: "pdf" | "image" | "share") => {
    if (!receipt) return;
    setBusy(what);
    try {
      const canvas = receiptCanvas(receipt);
      if (what === "pdf") {
        saveFile(await receiptPdf(canvas), `${name}.pdf`);
        toast("Receipt saved as a PDF", { tone: "success" });
      } else if (what === "image") {
        saveFile(await canvasBlob(canvas, "image/png"), `${name}.png`);
        toast("Receipt saved as an image", { tone: "success" });
      } else {
        const outcome = await shareOrSave(await canvasBlob(canvas, "image/png"), `${name}.png`, receipt.title);
        if (outcome === "saved") toast("Sharing is not available here, so the receipt was saved", { tone: "success" });
      }
    } catch {
      toast("The receipt could not be made just now. Try again, or print it.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nf-receipt-actions" data-testid={testId}>
      {receipt ? (
        <Button variant="primary" size="lg" full loading={busy === "pdf"} onClick={() => void run("pdf")} data-testid={testId ? `${testId}-download` : undefined}>
          <UiIcon name="document" size={18} />
          Download receipt
        </Button>
      ) : print ? (
        <Button variant="primary" size="lg" full onClick={() => window.print()} data-testid={testId ? `${testId}-download` : undefined}>
          <UiIcon name="document" size={18} />
          Download receipt
        </Button>
      ) : null}
      {receipt ? (
        <div className="nf-receipt-actions__tiles" role="group" aria-label="More ways to keep this receipt">
          <ActionTile icon="picture" label="Save image" onClick={() => void run("image")} data-testid={testId ? `${testId}-image` : undefined} />
          <ActionTile icon="share" label="Share" onClick={() => void run("share")} data-testid={testId ? `${testId}-share` : undefined} />
          {print ? <ActionTile icon="document" label="Print" onClick={() => window.print()} data-testid={testId ? `${testId}-print` : undefined} /> : null}
        </div>
      ) : null}
      {help ? (
        <ul className="nf-pp-help" aria-label={PROTECTED_RECEIPT_HELP.wrong} data-testid={testId ? `${testId}-help` : undefined}>
          {(["wrong", "where", "who"] as const).map((key) => (
            <li key={key}>
              <Link href={help[key]}>
                {PROTECTED_RECEIPT_HELP[key]}
                <UiIcon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {back ? (
        <ButtonLink href={back.href} variant="ghost" size="lg" full>
          {back.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
