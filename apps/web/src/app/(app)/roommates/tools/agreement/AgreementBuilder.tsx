"use client";

import { useState } from "react";

import { agreementText } from "@/lib/features/roommates/tools";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { ChoiceChips, ToggleChips } from "@/components/roommates/ChoiceChips";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";

import "@/components/roommates/roommates-welcome.css";

type Split = "equal" | "room" | "other";

export function AgreementBuilder() {
  const copy = useScopedCopy("roommates");
  const T = copy.tools;
  const A = T.agreementPage;
  const [names, setNames] = useState("");
  const [where, setWhere] = useState("");
  const [split, setSplit] = useState<Split>("equal");
  const [rules, setRules] = useState<string[]>([A.rules[0]!, A.rules[3]!]);
  const [extra, setExtra] = useState("");
  const all = [...A.rules, ...rules.filter((r) => !(A.rules as readonly string[]).includes(r))];
  const text = agreementText({ heading: A.heading, who: A.who, where: A.where, split: A.split, rulesHead: A.rulesHead, note: A.note }, { names, where, splitLabel: A.rentOptions[split], rules });
  const add = () => {
    const v = extra.trim().slice(0, 120);
    if (!v || rules.includes(v)) return;
    setRules([...rules, v]);
    setExtra("");
  };
  return (
    <div className="nf-rmtp" data-testid="agreement-builder">
      <TextField label={A.names} hint={A.namesHint} value={names} maxLength={160} onChange={(e) => setNames(e.target.value)} />
      <TextField label={A.address} value={where} maxLength={80} onChange={(e) => setWhere(e.target.value)} />
      <ChoiceChips<Split>
        label={A.rent}
        value={split}
        options={(["equal", "room", "other"] as const).map((k) => ({ value: k, label: A.rentOptions[k] }))}
        onChange={(v) => setSplit(v ?? "equal")}
      />
      <h2 className="nf-rmtp__head">{A.rulesTitle}</h2>
      <ToggleChips
        label={A.rulesTitle}
        options={all.map((r) => ({ value: r, label: r }))}
        value={rules}
        onChange={(next: string[]) => {
          const removed = rules.filter((r) => !next.includes(r) && !(A.rules as readonly string[]).includes(r));
          setRules(next);
          if (removed.length) bannerWithUndo(A.removed, { label: A.undo, undone: copy.area.undone, undo: async () => ({ ok: true }), onUndone: () => setRules(rules) });
        }}
      />
      <div className="nf-rmtp__add">
        <TextField label={A.custom} value={extra} maxLength={120} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <Button variant="secondary" size="md" onClick={add} disabled={!extra.trim()}>
          {A.add}
        </Button>
      </div>
      <h2 className="nf-rmtp__head">{A.outputTitle}</h2>
      {rules.length ? <pre className="nf-rmtp__out" data-testid="agreement-text">{text}</pre> : <p className="nf-rmtp__progress">{A.empty}</p>}
      <div className="nf-rmtp__actions">
        <Button
          variant="primary"
          size="md"
          leadingIcon="link"
          disabled={!rules.length}
          onClick={async () => {
            const copied = await (navigator.clipboard ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false));
            if (copied) banner.success(T.copied);
            else banner.error(T.copyFailed);
          }}
        >
          {T.copy}
        </Button>
      </div>
    </div>
  );
}
