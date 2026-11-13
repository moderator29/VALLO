"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconPlate } from "@/components/ui/IconPlate";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { acceptCommunityPromise } from "@/lib/trust/promise-actions";
import { COMMUNITY_PROMISE_HREF } from "@/lib/trust/promise";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import "./trust-checks.css";

/**
 * THE CHECKS A MEMBER CAN STILL ADD, ON THEIR OWN VIEW ONLY.
 *
 * A visitor never sees a check that has not happened. The member themselves
 * is the one person it is useful to: each row says what the check is and
 * leads to the real place it is done (identity, the mobile number), and the
 * Community Promise is accepted right here, in a sheet that shows what is
 * being accepted before the button that accepts it.
 *
 * The page decides which rows exist, and passes a row only when the read of
 * the member's checks succeeded and that check's date is absent. So a failed
 * read draws no "add this" for something the member already did.
 */

export type OwnCheckRow = {
  key: "identity" | "phone" | "promise";
  title: string;
  how: string;
  /** Where it is done. The promise has none: it opens its sheet. */
  href?: string;
};

export type OwnCheckWords = {
  addTitle: string;
  addLede: string;
  add: string;
  promiseSheetTitle: string;
  promiseSheetLede: string;
  promisePoints: readonly string[];
  promiseRead: string;
  promiseAccept: string;
  promiseDone: string;
  promiseFailed: string;
  promiseSignedOut: string;
  promiseNote: string;
  close: string;
};

const ICON: Record<OwnCheckRow["key"], UiIconName> = { identity: "id-card", phone: "phone", promise: "users" };

export function OwnChecks({ rows, words, testId = "own-checks" }: { rows: OwnCheckRow[]; words: OwnCheckWords; testId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useSafeTransition();
  if (rows.length === 0) return null;

  const accept = () =>
    start(async () => {
      try {
        const result = await acceptCommunityPromise();
        if (result.ok) {
          setOpen(false);
          banner.success(words.promiseDone);
          /* The server draws the dated line now, and this row leaves. */
          router.refresh();
        } else {
          banner.error(result.reason === "signed-out" ? words.promiseSignedOut : words.promiseFailed);
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const addMark = (
    <span className="nf-own-checks__add">
      {words.add}
      <UiIcon name="chevron-right" size={16} />
    </span>
  );

  return (
    <div className="nf-own-checks" data-testid={testId}>
      <ListGroup label={words.addTitle}>
        {rows.map((row) => (
          <ListRow
            key={row.key}
            className="nf-reasons__row"
            leading={
              <IconPlate size="md" shape="round" tone="neutral">
                <UiIcon name={ICON[row.key]} size={20} />
              </IconPlate>
            }
            title={row.title}
            sub={row.how}
            trailing={addMark}
            {...(row.href ? { href: row.href } : { onClick: () => setOpen(true) })}
            data-testid={`own-check-${row.key}`}
          />
        ))}
      </ListGroup>
      <p className="nf-own-checks__lede">{words.addLede}</p>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={words.promiseSheetTitle}
        description={words.promiseSheetLede}
        detents={[0.7, 0.92]}
        closeLabel={words.close}
        testId="promise-sheet"
        footer={
          <Button onClick={accept} loading={pending} full data-testid="promise-accept">
            {words.promiseAccept}
          </Button>
        }
      >
        <div className="nf-own-checks__promise">
          <ul className="nf-own-checks__points">
            {words.promisePoints.map((point) => (
              <li key={point}>
                <UiIcon name="check" size={16} className="nf-own-checks__tick" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Link href={COMMUNITY_PROMISE_HREF} className="nf-own-checks__read nf-tap">
            {words.promiseRead}
            <UiIcon name="chevron-right" size={16} />
          </Link>
          <p className="nf-own-checks__note">{words.promiseNote}</p>
        </div>
      </Sheet>
    </div>
  );
}
