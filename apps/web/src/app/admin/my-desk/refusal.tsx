import { doorWords, type DeskDoor } from "@/lib/admin/my-desk/access";

import { PageHead, Panel } from "../_components/panels";

/** What a caller who is not admitted reads. Nothing about the desk is read first. */
export function DeskRefusal({ state, title }: { state: Exclude<DeskDoor["state"], "ok">; title: string }) {
  return (
    <div className="nf-console nf-admin-stack">
      <PageHead title={title} />
      <Panel>
        <p className="nf-body text-[var(--nf-content-secondary)]">{doorWords(state)}</p>
      </Panel>
    </div>
  );
}
