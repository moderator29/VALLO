"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { setRoommateGallery } from "@/lib/features/roommates/actions";
import { LIMITS } from "@/lib/features/roommates/model";
import { uploadToStorage } from "@/lib/media/upload";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { counted } from "./format";
import "./roommates-welcome.css";

const BUCKET = "roommate-photos";
const MAX_BYTES = 10 * 1024 * 1024;
type Item = { path: string; url: string };
const extOf = (type: string) => (type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/heic" ? "heic" : "jpg");
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

/**
 * THE PROFILE GALLERY EDITOR (the owner's, in the profile editor): up to six
 * photos of their room, their space or how they live, on the existing photo
 * upload and the same public bucket as room posts. Each add and each remove
 * is saved at once (the whole list is the answer), says what happened in a
 * banner, and a removal can be undone.
 */
export function GalleryEditor({ initial }: { initial: Item[] }) {
  const copy = useScopedCopy("roommates");
  const G = copy.gallery;
  const input = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState(0);
  const [pending, start] = useSafeTransition();

  const save = (next: Item[], previous: Item[], done: string, undoable: boolean) =>
    start(async () => {
      try {
        const r = await setRoommateGallery(next.map((i) => i.path));
        if (!r.ok) {
          setItems(previous);
          feedback("error");
          banner.error(r.error);
          return;
        }
        feedback("confirm");
        if (undoable) {
          bannerWithUndo(done, {
            label: copy.area.undo,
            undone: copy.area.undone,
            undo: async () => {
              const back = await setRoommateGallery(previous.map((i) => i.path));
              return back.ok ? { ok: true } : { ok: false, error: back.error };
            },
            onUndone: () => setItems(previous),
          });
        } else banner.success(done);
      } catch (error) {
        setItems(previous);
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = LIMITS.galleryMax - items.length;
    if (room <= 0) {
      banner.error(G.tooMany);
      return;
    }
    const supabase = await loadBrowserClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!supabase || !user) {
      banner.error(G.uploadFailed);
      return;
    }
    const added: Item[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        banner.error(G.notImage);
        continue;
      }
      if (file.size > MAX_BYTES) {
        banner.error(G.tooBig);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const path = `${user.id}/gallery-${newId()}.${extOf(file.type)}`;
        const result = await uploadToStorage({ supabase, bucket: BUCKET, path, body: file, contentType: file.type || "image/jpeg" });
        if (result.ok) added.push({ path, url: URL.createObjectURL(file) });
        else banner.error(G.uploadFailed);
      } catch {
        banner.error(G.uploadFailed);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
    if (added.length) {
      const previous = items;
      const next = [...items, ...added];
      setItems(next);
      save(next, previous, counted(added.length, G.added), false);
    }
  };

  return (
    <section className="nf-rmf-pcard" aria-labelledby="rm-gallery-edit" data-testid="gallery-editor">
      <h2 id="rm-gallery-edit" className="nf-rmf-pcard__title">
        <span className="nf-rm-plate" aria-hidden="true">
          <UiIcon name="picture" size={18} />
        </span>
        {G.title}
      </h2>
      <div className="nf-rmf-pcard__body">
        <p className="nf-rm-note">{G.hint}</p>
        <ul className="nf-rmf-photos">
          {items.map((it) => (
            <li key={it.path} className="nf-rmf-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- a just-uploaded blob or a storage URL, at thumbnail size */}
              <img src={it.url} alt="" loading="lazy" />
              <span className="nf-rmf-photo__tools">
                <button
                  type="button"
                  aria-label={G.remove}
                  disabled={pending}
                  onClick={() => {
                    const previous = items;
                    const next = items.filter((x) => x.path !== it.path);
                    setItems(next);
                    save(next, previous, G.removed, true);
                  }}
                >
                  <UiIcon name="trash" size={16} />
                </button>
              </span>
            </li>
          ))}
          {Array.from({ length: busy }).map((_, i) => (
            <li key={`b-${i}`} className="nf-rmf-photo nf-rmf-photo--busy" aria-label={G.uploading}>
              <UiIcon name="hourglass" size={20} />
            </li>
          ))}
          {items.length + busy < LIMITS.galleryMax ? (
            <li>
              <Button variant="secondary" size="md" className="nf-rmf-photo nf-rmf-photo--add" leadingIcon="camera" onClick={() => input.current?.click()} data-testid="gallery-add">
                {G.add}
              </Button>
            </li>
          ) : null}
        </ul>
        <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files)} />
        <p className="nf-rm-note">{counted(items.length, G.count)}</p>
      </div>
    </section>
  );
}
