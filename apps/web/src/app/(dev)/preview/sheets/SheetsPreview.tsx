"use client";

import { useRef, useState } from "react";
import { CountTabs } from "@/components/ui/CountTabs";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { Button } from "@/components/ui/Button";
import { IconPlate } from "@/components/ui/IconPlate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CardMenu } from "@/components/app/listing/CardMenu";
import { ProfileMenu } from "@/components/social/profile/ProfileMenu";
import { ActionSheet as PostMenu, actionsForPost } from "@/components/social/ActionSheet";
import type { ReportWords, SheetWords } from "@/components/social/sheet-words";
import { CollectionsBar } from "@/app/(app)/saved/Collections";
import { TYPE } from "@/components/app/Screen";

/* Fixtures for the screenshot harness: the real parts, invented data. */

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-section-tight" data-preview-block="">
      <h2 className={`${TYPE.caption} mb-xs text-[var(--nf-content-secondary)]`}>{title}</h2>
      {children}
    </section>
  );
}

type InboxView = "all" | "unread" | "requests" | "support" | "archived" | "reported";
type Shelf = "homes" | "stays" | "restaurants" | "searches" | "compare" | "roommates" | "lists";

export function TabsDemo() {
  const [view, setView] = useState<InboxView>("unread");
  const [shelf, setShelf] = useState<Shelf>("lists");
  const [list, setList] = useState("all");
  const [plain, setPlain] = useState("upcoming");
  return (
    <div data-testid="tabs-demo">
      <Block title="A filter over a list (radios): counts, 9+ past nine, nothing at zero">
        <CountTabs<InboxView>
          label="Show"
          value={view}
          onChange={setView}
          countLabel={(n) => `${n} waiting`}
          items={[
            { key: "all", label: "All" },
            { key: "unread", label: "Unread", count: 3 },
            { key: "requests", label: "Requests", count: 12 },
            { key: "support", label: "Support", count: 0 },
            { key: "archived", label: "Archived" },
            { key: "reported", label: "Reported and blocked", count: 1 },
          ]}
          testId="demo-filter"
        />
      </Block>
      <Block title="Tabs that swap a panel, the chosen one off the edge on load, brought into view">
        <CountTabs<Shelf>
          label="Saved"
          mode="tabs"
          idPrefix="demo-shelf"
          panelId="demo-shelf-panel"
          value={shelf}
          onChange={setShelf}
          items={[
            { key: "homes", label: "Homes", count: 4 },
            { key: "stays", label: "Stays", count: 2 },
            { key: "restaurants", label: "Restaurants", count: 1 },
            { key: "searches", label: "Searches" },
            { key: "compare", label: "Compare", count: 3 },
            { key: "roommates", label: "Roommates" },
            { key: "lists", label: "Lists", count: 27 },
          ]}
          testId="demo-tabs"
        />
        <div id="demo-shelf-panel" role="tabpanel" aria-labelledby={`demo-shelf-${shelf}`} className="nf-body-sm mt-sm text-[var(--nf-content-secondary)]">
          The panel for {shelf}.
        </div>
      </Block>
      <Block title="Plain totals on a quiet plate, an icon, and a control that scrolls with the row">
        <CountTabs
          label="Lists"
          mode="tabs"
          value={list}
          onChange={setList}
          countTone="quiet"
          items={[
            { key: "all", label: "All", icon: "stack" },
            { key: "a", label: "Lagos shortlist", count: 6 },
            { key: "b", label: "Weekend stays", count: 14 },
            { key: "c", label: "For Mum", count: 1 },
          ]}
          trailing={
            <Button variant="quiet" size="md" leadingIcon="plus">
              New list
            </Button>
          }
          testId="demo-lists"
        />
      </Block>
      <Block title="No counts at all">
        <CountTabs
          label="Bookings"
          value={plain}
          onChange={setPlain}
          items={[
            { key: "upcoming", label: "Upcoming" },
            { key: "now", label: "Now" },
            { key: "past", label: "Past" },
            { key: "cancelled", label: "Cancelled" },
          ]}
          testId="demo-plain"
        />
      </Block>
    </div>
  );
}

export function SheetDemo({ open: openAtStart, end }: { open: boolean; end: boolean }) {
  const [open, setOpen] = useState(openAtStart);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(true);
  const [show, setShow] = useState<"all" | "unread">("all");
  const [said, setSaid] = useState("Nothing chosen yet.");
  const trigger = useRef<HTMLButtonElement>(null);
  const did = (what: string) => () => setSaid(what);
  return (
    <div data-testid="sheet-demo">
      <div className={`flex ${end ? "justify-end" : "justify-start"}`}>
        <Button
          ref={trigger}
          variant="icon"
          leadingIcon="more"
          aria-label="More actions for Adaeze Okafor"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          data-testid="sheet-demo-trigger"
        />
      </div>
      <p className="nf-body-sm mt-sm text-[var(--nf-content-secondary)]" data-testid="sheet-demo-said">
        {said}
      </p>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title="Actions for Adaeze Okafor"
        anchor={trigger}
        testId="demo-sheet"
        header={{
          title: "Adaeze Okafor",
          subtitle: "2 bedroom serviced apartment, Lekki Phase 1",
          media: (
            <IconPlate size="md" shape="round" tone="brand">
              <UiIcon name="user" size={20} />
            </IconPlate>
          ),
          onOpen: did("Opened the conversation."),
        }}
        quick={[
          { id: "save", label: saved ? "Saved" : "Save", icon: "heart", active: saved, keepOpen: true, onSelect: () => setSaved((v) => !v) },
          { id: "share", label: "Share", icon: "share", onSelect: did("Share.") },
          { id: "compare", label: "Compare", icon: "scale", onSelect: did("Compare.") },
          { id: "message", label: "Message", icon: "chat-bubble", onSelect: did("Message.") },
        ]}
        rows={[
          { id: "pin", label: "Pin", icon: "bookmark", onSelect: did("Pinned.") },
          { id: "media", label: "Shared media", hint: "Photos and files in this conversation", icon: "stack", chevron: true, onSelect: did("Shared media.") },
          { id: "for", label: "Mute for", icon: "bell", value: "8 hours", chevron: true, onSelect: did("Mute for.") },
          { id: "mute", kind: "switch", label: "Mute", hint: "No sound or banner for new messages", icon: "mute", checked: muted, onChange: setMuted },
          { id: "all", kind: "radio", group: "Show", label: "All messages", checked: show === "all", onSelect: () => setShow("all") },
          { id: "unread", kind: "radio", group: "Show", label: "Unread only", checked: show === "unread", onSelect: () => setShow("unread") },
          { id: "report", kind: "danger", label: "Report", icon: "flag", confirm: "own", onSelect: did("Report: the caller's own form would open.") },
          {
            id: "delete",
            kind: "danger",
            label: "Delete conversation",
            icon: "trash",
            onSelect: did("Deleted, after the question."),
            confirm: { title: "Delete this conversation?", line: "It is removed for you only. Adaeze still has her copy.", confirmLabel: "Delete", cancelLabel: "Keep it" },
          },
        ]}
      />
    </div>
  );
}

export function CardMenuDemo() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  return (
    <div data-testid="card-demo">
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="card-demo-trigger">
        Hold a card (opens its menu)
      </Button>
      <CardMenu
        open={open}
        onOpenChange={setOpen}
        listingId="00000000-0000-4000-8000-0000000000a1"
        title="Luxury 2 bedroom serviced apartment with a sea view, Lekki Phase 1"
        thumb="/brand/photos/bedroom-01.jpg"
        saved={saved}
        onToggleSave={() => setSaved((v) => !v)}
        mint={() => Promise.resolve(null)}
        shareable
      />
    </div>
  );
}

export function ProfileMenuDemo({ end, reportWords }: { end: boolean; reportWords: ReportWords }) {
  return (
    <div className={`flex ${end ? "justify-end" : "justify-start"} pt-section-tight`} data-testid="profile-demo">
      <ProfileMenu
        handle="ada_lekki"
        userId="00000000-0000-4000-8000-0000000000aa"
        displayLabel="Adaeze Okafor-Williamson"
        isOwner={false}
        signedIn
        reportWords={reportWords}
      />
    </div>
  );
}

export function PostMenuDemo({ mine, words }: { mine: boolean; words: SheetWords }) {
  const [up, setUp] = useState(true);
  const [said, setSaid] = useState("Nothing chosen yet.");
  return (
    <div data-testid="post-demo">
      <Button variant="secondary" onClick={() => setUp(true)} data-testid="post-demo-trigger">
        Open the post menu
      </Button>
      <p className="nf-body-sm mt-sm text-[var(--nf-content-secondary)]" data-testid="post-demo-said">
        {said}
      </p>
      {up ? (
        <PostMenu
          label="What would you like to do?"
          actions={actionsForPost(
            { isMine: mine, isAgentAuthor: !mine, hasListing: !mine, saved: false, reposted: false, repostCount: 3, editable: mine, hasAuthor: true, who: "@ada_lekki" },
            words.menu,
          )}
          onChoose={(key) => setSaid(`Chosen: ${key}`)}
          onClose={() => setUp(false)}
          body={words.body}
          dismissLabel={words.dismissLabel}
        />
      ) : null}
    </div>
  );
}

export function SavedListsDemo() {
  return (
    <div data-testid="saved-demo">
      <CollectionsBar
        active="00000000-0000-4000-8000-0000000000b2"
        collections={[
          { id: "00000000-0000-4000-8000-0000000000b1", name: "Lagos shortlist", keys: ["listing:1", "listing:2", "listing:3", "listing:4", "listing:5", "listing:6"] },
          { id: "00000000-0000-4000-8000-0000000000b2", name: "Weekend stays", keys: Array.from({ length: 14 }, (_, i) => `accommodation:${i}`) },
          { id: "00000000-0000-4000-8000-0000000000b3", name: "For Mum", keys: ["listing:9"] },
          { id: "00000000-0000-4000-8000-0000000000b4", name: "Restaurants to try in Abuja", keys: [] },
        ]}
      />
    </div>
  );
}
