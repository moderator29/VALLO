"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { putSearchAlias, setSearchAliasActive } from "@/lib/admin/search-alias-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * Add a search alias, or switch one off and on. The database function decides
 * who may (an admin, or staff with Content or Marketing) and writes the audit
 * line; this only collects the three answers and says how it went.
 */
export function AliasForm() {
  const router = useRouter();
  const id = useId();
  const [fromText, setFrom] = useState("");
  const [toText, setTo] = useState("");
  const [kind, setKind] = useState<"word" | "place">("word");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useSafeTransition();

  function save() {
    start(async () => {
      try {
        const result = await putSearchAlias({ fromText, toText, kind });
        if (!result.ok) {
          const fields = result.fieldErrors ?? {};
          setErrors(fields);
          banner.error(result.error, Object.keys(fields).length === 0 ? { retry: save } : undefined);
          return;
        }
        banner.success("Alias saved. Search uses it within five minutes.");
        setFrom("");
        setTo("");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-row sm:grid-cols-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setErrors({});
        save();
      }}
    >
      <div>
        <label className="nf-label" htmlFor={`${id}-from`}>
          When people type
        </label>
        <input
          id={`${id}-from`}
          className="nf-field"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          value={fromText}
          maxLength={60}
          onChange={(e) => setFrom(e.target.value)}
          aria-invalid={errors["fromText"] ? true : undefined}
          aria-describedby={errors["fromText"] ? `${id}-from-problem` : undefined}
        />
        <FieldProblem id={`${id}-from-problem`} message={errors["fromText"]} />
      </div>
      <div>
        <label className="nf-label" htmlFor={`${id}-to`}>
          Read it as
        </label>
        <input
          id={`${id}-to`}
          className="nf-field"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          value={toText}
          maxLength={60}
          onChange={(e) => setTo(e.target.value)}
          aria-invalid={errors["toText"] ? true : undefined}
          aria-describedby={errors["toText"] ? `${id}-to-problem` : undefined}
        />
        <FieldProblem id={`${id}-to-problem`} message={errors["toText"]} />
      </div>
      <div>
        <label className="nf-label" htmlFor={`${id}-kind`}>
          Kind
        </label>
        <select id={`${id}-kind`} className="nf-field" value={kind} onChange={(e) => setKind(e.target.value === "place" ? "place" : "word")}>
          <option value="word">Word (for example buka to restaurant)</option>
          <option value="place">Place (must be a place Vallo knows)</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-inline sm:col-span-3">
        <Button type="submit" variant="primary" loading={pending} disabled={fromText.trim().length < 1 || toText.trim().length < 1}>
          Save alias
        </Button>
      </div>
    </form>
  );
}

export function AliasSwitch({ id, active, label }: { id: string; active: boolean; label: string }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();

  function flip() {
    start(async () => {
      try {
        const result = await setSearchAliasActive({ id, active: !active });
        if (!result.ok) {
          banner.error(result.error, { retry: flip });
          return;
        }
        banner.success(active ? "Alias switched off." : "Alias switched on.");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <Button type="button" variant="secondary" size="sm" loading={pending} onClick={flip} aria-label={`${active ? "Switch off" : "Switch on"} ${label}`}>
      {active ? "Switch off" : "Switch on"}
    </Button>
  );
}
