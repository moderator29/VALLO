"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { createCollection, deleteCollection, renameCollection, setInCollection } from "@/lib/saved/collections-actions";
import { COLLECTION_NAME_MAX, type SavedCollection } from "@/lib/saved/collections";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { banner } from "@/lib/ui/toast";

const WORDS = {
  all: "All",
  newList: "New list",
  name: "Name of the list",
  namePlaceholder: "Lagos shortlist",
  create: "Create",
  addTo: "Add to a list",
  addSheet: "Add to a list",
  none: "You have no lists yet. Name one below.",
  deleteList: "Delete this list",
  deleteNote: "Deleting a list never removes anything you saved.",
  done: "Done",
  renameList: "Rename this list",
  rename: "Rename",
  /* What each action did, said by the one banner (Grade 1). */
  created: "List created. Add places to it from any saved card.",
  deleted: "List deleted. Everything you saved is still here.",
  renamed: "List renamed",
  addedTo: "Added to {name}",
  takenOff: "Taken off {name}",
};

/** The lists strip above the shortlist: All, each list, and a way to make one. */
export function CollectionsBar({ collections, active }: { collections: SavedCollection[]; active: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  function go(id: string | null) {
    router.push(id ? `${pathname}?list=${id}` : pathname);
  }

  /* A refused name is the field's own error, under the field. */
  function create() {
    setError(null);
    start(async () => {
      const result = await createCollection({ name });
      if (result.ok) {
        setName("");
        setCreating(false);
        banner.success(WORDS.created);
        go(result.data.id);
      } else setError(result.error);
    });
  }

  function remove(id: string) {
    start(async () => {
      const result = await deleteCollection({ id });
      if (result.ok) {
        banner.success(WORDS.deleted);
        go(null);
      } else banner.error(result.error, { retry: () => remove(id) });
    });
  }

  function openRename() {
    if (current) {
      setRenameValue(current.name);
      setRenameError(null);
      setRenaming(true);
    }
  }

  function submitRename() {
    if (!current) return;
    setRenameError(null);
    start(async () => {
      const result = await renameCollection({ id: current.id, name: renameValue });
      if (result.ok) {
        setRenaming(false);
        banner.success(WORDS.renamed);
        router.refresh();
      } else setRenameError(result.error);
    });
  }

  const current = collections.find((c) => c.id === active) ?? null;
  return (
    <div className="mb-heading" data-testid="saved-collections">
      <div className="nf-scroll-x nf-scroll-x--gutter flex gap-xs" role="tablist" aria-label="Lists">
        {/* "All" leads with the App Store stack glyph (SHARE_AND_CONTROLS.md section 3): every saved thing in one place. */}
        <button type="button" role="tab" aria-selected={!current} className={`nf-chip inline-flex items-center gap-2xs${!current ? " nf-chip--on" : ""}`} onClick={() => go(null)}>
          <UiIcon name="stack" size={14} />
          {WORDS.all}
        </button>
        {collections.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={current?.id === c.id}
            className={`nf-chip whitespace-nowrap${current?.id === c.id ? " nf-chip--on" : ""}`}
            onClick={() => go(c.id)}
          >
            {c.name}
          </button>
        ))}
        <button type="button" className="nf-chip whitespace-nowrap" onClick={() => setCreating(true)} data-testid="new-list">
          <UiIcon name="plus" size={14} />
          {WORDS.newList}
        </button>
      </div>
      {current ? (
        <p className="nf-caption mt-inline-tight text-[var(--nf-content-secondary)]">
          {WORDS.deleteNote}{" "}
          <button type="button" className="underline" disabled={pending} onClick={() => remove(current.id)}>
            {WORDS.deleteList}
          </button>
          {" / "}
          <button type="button" className="underline" disabled={pending} onClick={openRename}>
            {WORDS.renameList}
          </button>
        </p>
      ) : null}
      <Sheet
        open={creating}
        onOpenChange={setCreating}
        title={WORDS.newList}
        detents={[0.4]}
        apply={{ label: WORDS.create, onClick: create, loading: pending }}
      >
        <TextField
          label={WORDS.name}
          value={name}
          maxLength={COLLECTION_NAME_MAX}
          placeholder={WORDS.namePlaceholder}
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          {...(error ? { error } : {})}
        />
      </Sheet>
      <Sheet
        open={renaming}
        onOpenChange={setRenaming}
        title={WORDS.renameList}
        detents={[0.4]}
        apply={{ label: WORDS.rename, onClick: submitRename, loading: pending }}
      >
        <TextField
          label={WORDS.name}
          value={renameValue}
          maxLength={COLLECTION_NAME_MAX}
          placeholder={WORDS.namePlaceholder}
          enterKeyHint="done"
          onChange={(e) => setRenameValue(e.target.value)}
          {...(renameError ? { error: renameError } : {})}
        />
      </Sheet>
    </div>
  );
}

/** Under each saved card: which lists this one is in, and a sheet to change that. */
export function AddToList({
  collections,
  itemKey,
  kind,
  id,
}: {
  collections: SavedCollection[];
  itemKey: string;
  kind: string;
  id: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useSafeTransition();
  const member = collections.filter((c) => c.keys.includes(itemKey));

  function toggle(collectionId: string, on: boolean) {
    start(async () => {
      const result = await setInCollection({ collectionId, kind, id, on });
      if (result.ok) {
        const name = collections.find((c) => c.id === collectionId)?.name ?? "";
        banner.success((on ? WORDS.addedTo : WORDS.takenOff).replace("{name}", name));
        router.refresh();
      } else banner.error(result.error, { retry: () => toggle(collectionId, on) });
    });
  }

  return (
    <>
      <button type="button" className="nf-caption nf-saved-lists" onClick={() => setOpen(true)} data-testid="add-to-list">
        <UiIcon name="plus" size={12} />
        {member.length > 0 ? member.map((c) => c.name).join(", ") : WORDS.addTo}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={WORDS.addSheet} detents={[0.5]}>
        {collections.length === 0 ? <p className="nf-body-sm text-[var(--nf-content-secondary)]">{WORDS.none}</p> : null}
        <ul className="nf-rows">
          {collections.map((c) => {
            const on = c.keys.includes(itemKey);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="nf-row nf-row--tap w-full text-left"
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() => toggle(c.id, !on)}
                >
                  <span className="min-w-0 flex-1 nf-body-sm font-semibold text-[var(--nf-content-primary)]">{c.name}</span>
                  {on ? <UiIcon name="check" size={16} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
