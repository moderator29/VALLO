"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { feedback } from "@/lib/ui/feedback";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import {
  approveDraft,
  cancelPost,
  createDraft,
  deleteMedia,
  markPosted,
  sendBack,
  submitForApproval,
  updateDraft,
  uploadMedia,
  type DraftInput,
} from "@/lib/admin/social-media/actions";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  FORMATS,
  FORMAT_LABEL,
  PLATFORMS,
  PLATFORM_LABEL,
  SLOT_LABEL,
  SLOTS,
  type SocialPost,
} from "@/lib/admin/social-media/model";
import type { MediaItem } from "@/lib/admin/social-media/queries";

/**
 * THE SOCIAL MEDIA DESK'S CONTROLS. English throughout, a banner for every
 * outcome, nothing optimistic, the same conventions every other staff desk's
 * client controls already use. Nothing here ever speaks to a social
 * platform; every call goes to this desk's own server actions and nowhere
 * else.
 */

type Outcome = { ok: true; data: { note?: string | null } & Record<string, unknown> } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function useDesk() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const run = (task: () => Promise<Outcome>, done: string, after?: (r: Outcome & { ok: true }) => void, onFail?: (f: Record<string, string>) => void) =>
    start(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          onFail?.(result.fieldErrors ?? {});
          banner.error(result.error, { retry: () => run(task, done, after, onFail) });
          return;
        }
        feedback("confirm");
        if (result.data.note) banner.warning(result.data.note);
        else banner.success(done);
        after?.(result);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { pending, run };
}

const EMPTY: DraftInput = { platform: "instagram", category: "property", format: "feed_post", slot: "", campaign: "", caption: "", plannedAt: "", mediaUrls: [] };

function field(draft: SocialPost | null): DraftInput {
  if (!draft) return EMPTY;
  return {
    platform: draft.platform,
    category: draft.category,
    format: draft.format,
    slot: draft.slot ?? "",
    campaign: draft.campaign ?? "",
    caption: draft.caption,
    plannedAt: draft.plannedAt,
    mediaUrls: draft.mediaUrls,
  };
}

/** Create a post, or edit one still a draft or awaiting approval. */
export function DraftForm({ editing, media, onDone }: { editing?: SocialPost | null; media: MediaItem[]; onDone?: () => void }) {
  const { pending, run } = useDesk();
  const [input, setInput] = useState<DraftInput>(field(editing ?? null));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = <K extends keyof DraftInput>(key: K, value: DraftInput[K]) => setInput((v) => ({ ...v, [key]: value }));

  const toggleMedia = (path: string) => {
    set(
      "mediaUrls",
      input.mediaUrls.includes(path) ? input.mediaUrls.filter((p) => p !== path) : [...input.mediaUrls, path],
    );
  };

  const save = () =>
    run(
      () => (editing ? updateDraft(editing.id, input) : createDraft(input)),
      editing ? "Draft saved" : "Draft created",
      () => {
        if (!editing) setInput(EMPTY);
        onDone?.();
      },
      setProblems,
    );

  return (
    <div className="grid gap-sm" data-testid="social-media-draft-form">
      <div className="grid gap-sm sm:grid-cols-2">
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Platform</span>
          <select className="nf-field" value={input.platform} onChange={(e) => set("platform", e.target.value)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
          <FieldProblem id="platform-problem" message={problems.platform} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Category</span>
          <select className="nf-field" value={input.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <FieldProblem id="category-problem" message={problems.category} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Format</span>
          <select className="nf-field" value={input.format} onChange={(e) => set("format", e.target.value)}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Slot</span>
          <select className="nf-field" value={input.slot} onChange={(e) => set("slot", e.target.value)}>
            <option value="">No fixed slot</option>
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Planned date</span>
          <input type="date" className="nf-field" value={input.plannedAt} onChange={(e) => set("plannedAt", e.target.value)} />
          <FieldProblem id="plannedAt-problem" message={problems.plannedAt} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Campaign (optional)</span>
          <input type="text" className="nf-field" placeholder="e.g. December shortlet push" value={input.campaign} onChange={(e) => set("campaign", e.target.value)} />
        </label>
      </div>
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Caption</span>
        <textarea
          className="nf-field min-h-[100px] resize-y"
          maxLength={5000}
          value={input.caption}
          onChange={(e) => set("caption", e.target.value)}
          placeholder="Write the caption here, ready to copy onto the platform."
        />
        <FieldProblem id="caption-problem" message={problems.caption} />
      </label>
      {media.length > 0 ? (
        <div className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Attach media</span>
          <div className="flex flex-wrap gap-xs" data-testid="media-picker">
            {media.map((m) => (
              <button
                key={m.path}
                type="button"
                onClick={() => toggleMedia(m.path)}
                className={`nf-btn nf-btn--sm ${input.mediaUrls.includes(m.path) ? "nf-btn--primary" : "nf-btn--quiet"}`}
                aria-pressed={input.mediaUrls.includes(m.path)}
              >
                {m.isVideo ? "Video" : "Image"}: {m.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="nf-caption text-[var(--nf-content-secondary)]">No media in the library yet. Upload one below first.</p>
      )}
      <div>
        <button type="button" className="nf-btn nf-btn--primary" disabled={pending} onClick={save}>
          {editing ? "Save draft" : "Create draft"}
        </button>
      </div>
    </div>
  );
}

const Act = {
  submit: (id: string) => submitForApproval(id),
  approve: (id: string) => approveDraft(id),
  cancel: (id: string) => cancelPost(id),
};

/** The approval and record-keeping buttons a post's status offers. */
export function ApprovalActions({ post }: { post: SocialPost }) {
  const { pending, run } = useDesk();
  const [reason, setReason] = useState("");
  const [reasonProblem, setReasonProblem] = useState<string | undefined>();
  const [liveUrl, setLiveUrl] = useState("");
  const [postedAt, setPostedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [postedProblem, setPostedProblem] = useState<Record<string, string>>({});

  if (post.status === "draft") {
    return (
      <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => Act.submit(post.id), "Sent for approval")}>
        Send for approval
      </button>
    );
  }
  if (post.status === "awaiting_approval") {
    return (
      <div className="grid gap-xs">
        <div className="flex flex-wrap gap-xs">
          <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => Act.approve(post.id), "Approved")}>
            Approve
          </button>
          <button type="button" className="nf-btn nf-btn--sm nf-btn--secondary" disabled={pending} onClick={() => run(() => cancelPost(post.id), "Cancelled")}>
            Cancel
          </button>
        </div>
        <label htmlFor={`reason-${post.id}`} className="nf-caption text-[var(--nf-content-secondary)]">
          Send back with a reason
        </label>
        <textarea
          id={`reason-${post.id}`}
          className="nf-field min-h-[56px] resize-y"
          placeholder="Why it is going back, at least five characters."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <FieldProblem id={`reason-${post.id}-problem`} message={reasonProblem} />
        <button
          type="button"
          className="nf-btn nf-btn--sm nf-btn--quiet"
          disabled={pending}
          onClick={() =>
            run(
              () => sendBack(post.id, reason),
              "Sent back",
              () => setReason(""),
              (fe) => setReasonProblem(fe.reason),
            )
          }
        >
          Send back
        </button>
      </div>
    );
  }
  if (post.status === "approved") {
    return (
      <div className="grid gap-xs">
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Posted on, by hand, at (date and time)</span>
          <input type="datetime-local" className="nf-field" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Live post link (optional)</span>
          <input type="url" className="nf-field" placeholder="https://..." value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
          <FieldProblem id={`liveurl-${post.id}-problem`} message={postedProblem.liveUrl} />
        </label>
        <div className="flex flex-wrap gap-xs">
          <button
            type="button"
            className="nf-btn nf-btn--sm nf-btn--primary"
            disabled={pending}
            onClick={() => run(() => markPosted(post.id, { liveUrl, postedAt }), "Recorded as posted", undefined, setPostedProblem)}
          >
            Mark as posted
          </button>
          <button type="button" className="nf-btn nf-btn--sm nf-btn--secondary" disabled={pending} onClick={() => run(() => cancelPost(post.id), "Cancelled")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return null;
}

/** Upload one image or short video into the media library. */
export function MediaUploader() {
  const { pending, run } = useDesk();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);

  const upload = () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      banner.error("Choose a file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    run(
      () => uploadMedia(formData),
      "Uploaded",
      () => {
        if (inputRef.current) inputRef.current.value = "";
        setName(null);
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-sm" data-testid="media-uploader">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
        className="nf-field"
      />
      <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={upload}>
        Upload
      </button>
      {name ? <span className="nf-caption text-[var(--nf-content-secondary)]">{name}</span> : null}
    </div>
  );
}

/** Remove a library file that is not attached to any post. */
export function MediaDelete({ path }: { path: string }) {
  const { pending, run } = useDesk();
  return (
    <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" disabled={pending} onClick={() => run(() => deleteMedia(path), "Removed")}>
      Remove
    </button>
  );
}
