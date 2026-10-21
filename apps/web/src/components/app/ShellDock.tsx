"use client";

import type { ShellDictionary } from "@/lib/i18n/shell-dictionary";
import type { Side } from "@/lib/side.constants";
import type { ProfileSelection, Workspace } from "@/lib/supply/workspaces";
import { ProfileSwitcher, type ProfileSwitcherCopy } from "@/components/supply/ProfileSwitcher";
import { useHydrated } from "@/components/motion/useInView";
import { isDataSaver } from "@/lib/ui/data-saver";
import { useRootFlag } from "@/lib/ui/root-flag";
import { MobileTabBar } from "./MobileTabBar";
import { CreateDock } from "./CreateDock";

/**
 * THE MAIN BOTTOM DOCK, WITH EVERYTHING IT NEEDS TO STAND ON ITS OWN (13
 * October 2026).
 *
 * `AppShell` built this inline: the dock, the "+" and its Create sheet, and
 * the workspace sheet mounted beside it. The agent, owner and host workspaces
 * need the very same dock (the founder: a phone in a workspace had no way
 * back to Home or Feed), so the assembly lives here, once, and both shells
 * draw it. The workspace's own shell reads the account's facts on the server
 * (`WorkspaceDock`) and hands them down as plain data.
 *
 * The workspace sheet is mounted HERE, beside the "+", because the sheet needs
 * the account's own workspace list and the dock is a server component with no
 * business fetching one (see `MobileTabBar`).
 */
export function ShellDock({
  t,
  side,
  active,
  unreadNotifications = 0,
  signedIn,
  isAgent = false,
  isHost = false,
  socialOn = true,
  workspaces,
  currentProfile,
  avatarUrl = "",
}: {
  t: ShellDictionary;
  /** The side the dock is drawn for: the home and search tabs follow it. */
  side: Side;
  active: string;
  unreadNotifications?: number;
  signedIn: boolean;
  isAgent?: boolean;
  isHost?: boolean;
  socialOn?: boolean;
  workspaces: Workspace[];
  currentProfile: ProfileSelection;
  avatarUrl?: string;
}) {
  /* The dock prefetches its tabs whole once the page is live, and never under
     data saving (Track M performance; see MobileTabBar's prefetchFull). */
  const hydrated = useHydrated();
  /* `data-docked` on <html> while a dock is drawn: the floating controls
     (toasts, back to top, the live island, the batch tray) clear it by the
     tab bar's height (lib/ui/root-flag.ts). Every shell that sets
     `nf-main--docked` draws this dock. */
  useRootFlag("docked");

  /*
   * The copy is assembled from the dictionary rather than written inline,
   * because this is new copy and new copy is going to be edited.
   */
  const switchCopy: ProfileSwitcherCopy = {
    title: t.supply.switchTitle,
    personal: t.supply.personal,
    personalMeaning: t.supply.personalMeaning,
    addTitle: t.supply.addTitle,
    addMeaning: t.supply.addMeaning,
    current: t.supply.current,
    empty: t.supply.empty,
    triggerLabel: t.supply.switchTrigger,
    short: t.shape.workspace.short,
    kinds: t.supply.kinds,
    standings: t.supply.standings,
  };

  const createControl = (
    <>
      <CreateDock
        t={t}
        side={side}
        isHost={isHost}
        signedIn={signedIn}
        socialOn={socialOn}
        listHref={isAgent ? "/agent/list" : side === "stays" ? "/profile/setup?side=stays" : "/profile/setup"}
      />
      <ProfileSwitcher
        t={t}
        copy={switchCopy}
        workspaces={workspaces}
        current={currentProfile}
        side={side}
        avatarUrl={avatarUrl}
        /* The chooser is side dependent: three property doors or three stays
           doors, which is the founder's ruling for Track O on both sides. */
        addHref={side === "stays" ? "/profile/setup?side=stays" : "/profile/setup"}
        /* No trigger of its own: the dock's centre is the "+" (the founder,
           29 September 2026), and its sheet's Switch workspace row, like the
           profile's Switch role row, opens this one by the named event. */
        renderTrigger={() => null}
      />
    </>
  );

  return (
    <MobileTabBar
      t={t}
      side={side}
      active={active}
      unreadNotifications={unreadNotifications}
      signedIn={signedIn}
      createSlot={createControl}
      socialOn={socialOn}
      prefetchFull={hydrated && !isDataSaver()}
    />
  );
}
