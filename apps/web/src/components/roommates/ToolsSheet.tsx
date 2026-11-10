"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";

import "./roommates-welcome.css";

/**
 * THE "VALLO TOOLS" SHEET on the home: only tools that exist, each one a link
 * to its own page (the cost splitter, the move-in checklist, the house
 * agreement, the safety guide).
 */
export function ToolsSheet() {
  const copy = useScopedCopy("roommates");
  const T = copy.tools;
  const [open, setOpen] = useState(false);
  const tiles: { href: string; icon: UiIconName; title: string; body: string }[] = [
    { href: ROOMMATES_ROUTES.split, icon: "coins", title: T.split.title, body: T.split.body },
    { href: ROOMMATES_ROUTES.checklist, icon: "clipboard-list", title: T.checklist.title, body: T.checklist.body },
    { href: ROOMMATES_ROUTES.agreement, icon: "file-check", title: T.agreement.title, body: T.agreement.body },
    { href: ROOMMATES_ROUTES.safety, icon: "shield-check", title: T.safety.title, body: T.safety.body },
  ];
  return (
    <>
      <Button variant="secondary" size="md" leadingIcon="sliders" onClick={() => setOpen(true)} data-testid="roommates-tools-open">
        {T.open}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={T.title} description={T.sheetBody} closeLabel={copy.ui.flow.close} detents={[0.7]} testId="roommates-tools-sheet">
        <ul className="nf-rmtl">
          {tiles.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="nf-rmtl__tile" onClick={() => setOpen(false)}>
                <span className="nf-rm-plate" aria-hidden="true">
                  <UiIcon name={t.icon} size={20} />
                </span>
                <span className="nf-rmtl__words">
                  <span className="nf-rmtl__title">{t.title}</span>
                  <span className="nf-rmtl__body">{t.body}</span>
                </span>
                <UiIcon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
