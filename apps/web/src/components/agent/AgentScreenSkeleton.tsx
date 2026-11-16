import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";

/**
 * Agent Mode's frame, for the wait.
 *
 * Personal Mode and the admin console both put their chrome in a `layout.tsx`,
 * so it survives a navigation and a `loading.tsx` only has to draw the content.
 * Agent Mode does not: every agent page renders `AgentShell` itself, because the
 * shell needs the dictionary and the agent's own profile, both of which are
 * awaited inside the page.
 *
 * The consequence for loading states is concrete. If an agent `loading.tsx`
 * drew only its content, the rail and the header would VANISH for the length of
 * the wait and then reappear, and the content would slide 264px sideways when
 * they did. So the frame is reproduced here: same rail width token, same header
 * height, same content padding.
 *
 * This is a stand-in, not the shell, and it should be deleted the day
 * `AgentShell` becomes the layout under `app/agent/` - which is the real fix,
 * and is an edit to existing files rather than a new one. Named as a directory
 * rather than as a file on purpose: a full path with an extension asserts the
 * file is there to be opened, and this one is a prediction.
 */
export function AgentScreenSkeleton({
  label,
  children,
  inner = true,
}: {
  label: string;
  children: ReactNode;
  /** False for an immersive page (the assistant), which draws no inner navigation. */
  inner?: boolean;
}) {
  return (
    <div className="flex min-h-dvh">
      {/* The rail: present from lg up, exactly as `AgentRail` is. */}
      <aside
        aria-hidden="true"
        className="sticky top-0 hidden h-dvh w-[var(--nf-rail-width)] shrink-0 flex-col border-r border-[var(--nf-border-subtle)] bg-[var(--nf-surface-primary)] px-md py-5 lg:flex"
      >
        <Skeleton className="mb-5" width="8.5rem" height="2.375rem" radius="md" />
        <div className="space-y-xs">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} height="2.75rem" radius="md" />
          ))}
        </div>
      </aside>

      {/* The same bottom the shell now leaves for the main dock below lg
          (`AgentShell`, `nf-main--docked`), so the page does not grow a foot
          when it lands. An immersive page (`inner` false) has no dock. */}
      <main id="main" className={inner ? "nf-main--docked min-w-0 flex-1 lg:pb-0" : "min-w-0 flex-1"}>
        {/* Real chrome, not a skeleton: the header is glass and sticky whether
            or not the page beneath it has arrived, and drawing a grey slab in
            its place would be a bigger change than leaving it empty. */}
        {/* The same bar AgentShell draws now: `WorkspaceHeader`, one
            `nf-ws-bar__row` at the small header height at every width. */}
        <header
          data-theme="dark"
          className="nf-ws-bar nf-glass nf-glass--chrome nf-safe-top sticky top-0 z-40"
        >
          <div className="nf-ws-bar__row">
            <Skeleton circle width="2.25rem" className="shrink-0 sm:hidden" />
            <Skeleton circle width="2.5rem" className="hidden shrink-0 sm:block" />
            <Skeleton width="9rem" height="1rem" radius="sm" className="max-w-[40%]" />
          </div>
          {/* The desk's chip row (`AgentInnerNav`), the bar's second row below
              lg, held here so the page does not drop by a row when it lands.
              The same placeholder the host skeleton draws for `HostNav`. */}
          {inner ? (
            <div aria-hidden="true" className="flex gap-xs overflow-hidden px-gutter pb-xs lg:hidden">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} width="6rem" height="2.25rem" radius="pill" className="shrink-0" />
              ))}
            </div>
          ) : null}
        </header>

        <LoadingShell
          label={label}
          className={`px-md pt-lg sm:px-5 md:px-xl md:pt-7 lg:pb-10 ${inner ? "pb-lg" : "pb-[calc(2.5rem+env(safe-area-inset-bottom))]"}`}
        >
          {children}
        </LoadingShell>
      </main>
    </div>
  );
}

/** The `mb-6` title + lede block every agent workspace opens with. */
export function AgentTitleSkeleton() {
  return (
    <div className="mb-lg flex flex-wrap items-end justify-between gap-md">
      <div>
        <Skeleton width="12rem" height="1.75rem" radius="sm" />
        <Skeleton className="mt-xs max-w-full" width="20rem" height="0.9375rem" radius="sm" />
      </div>
      <Skeleton width="9rem" height="3rem" radius="pill" />
    </div>
  );
}
