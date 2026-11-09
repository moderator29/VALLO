import { PageHead } from "../_components/panels";

/** The one honest answer a case desk gives when it cannot show anything. */
export function DeskRefusal({ title, state }: { title: string; state: "not-open" | "forbidden" | "signed-out" }) {
  const body =
    state === "not-open"
      ? "Trust and Safety is not open on this server yet. It opens when its database update is run."
      : state === "signed-out"
        ? "Sign in to the console to continue."
        : "Your staff role does not open this desk. A super admin can grant Trust and Safety, Roommates or Circle moderation.";
  return (
    <div className="nf-console flex flex-col gap-xl">
      <PageHead title={title} />
      <div className="nf-panel nf-panel--card nf-admin-card p-lg">
        <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">{body}</p>
      </div>
    </div>
  );
}
