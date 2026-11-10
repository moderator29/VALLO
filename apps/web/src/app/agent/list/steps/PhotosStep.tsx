"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { ShotList } from "@/components/agent/ShotList";
import { MediaViewer, type ViewerCopy, type ViewerItem } from "@/components/app/messages/MediaViewer";
import { MAX_PHOTOS, MAX_VIDEOS, MIN_MEDIA, MIN_PHOTO_WIDTH, RECOMMENDED_MEDIA } from "@/lib/agent/listings-model";
import { canMove } from "@/lib/listings/media-order";
import { fill } from "../../_copy";
import { Note } from "./parts";
import { WIZARD_WORDS } from "./copy";
import { clockOf, type Media, type Values } from "./model";

const W = WIZARD_WORDS.photos;

/**
 * PHOTOS (R18.10, R34): the readiness line at the top ("Add 2 more photos, 1
 * ready"), the grid with the cover crowned, a pair of real move controls on
 * every tile (a reorder that needs a pointer is a photo an agent on a phone
 * cannot move), and the add tile last. The upload pipeline itself (metadata
 * stripped, 1600px, the bucket's own ceiling, retries) stays in the wizard;
 * this step only draws the row and asks for files.
 */
export function PhotosStep({
  copy,
  values,
  media,
  listingId,
  uploading,
  busy,
  nativeCamera,
  problems,
  canRetry,
  videoProgress,
  viewerCopy,
  shotsCopy,
  onPick,
  onCamera,
  onRetry,
  onCancelVideo,
  onMove,
  onDrop,
}: {
  copy: Dictionary["agentListings"];
  values: Values;
  media: Media[];
  listingId: string | null;
  uploading: boolean;
  /** A save, reorder or removal in flight: one change at a time. */
  busy: boolean;
  nativeCamera: boolean;
  problems: string[];
  canRetry: boolean;
  videoProgress: { name: string; percent: number } | null;
  viewerCopy?: ViewerCopy | null;
  shotsCopy?: Dictionary["afterTheGate"]["shots"];
  onPick: () => void;
  onCamera: () => void;
  onRetry: () => void;
  onCancelVideo: () => void;
  onMove: (from: number, to: number) => void;
  onDrop: (index: number) => void;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const photos = media.filter((item): item is Media & { kind: "photo" } => item.kind === "photo");
  const videos = media.filter((item) => item.kind === "video");
  const ready = media.length;
  const more = Math.max(0, MIN_MEDIA - ready);
  return (
    <>
      <div className="nf-lw2-ready" data-ready={more === 0 ? "" : undefined} role="status" data-testid="photos-ready">
        <UiIcon name={more === 0 ? "circle-check" : "picture"} size={20} />
        <span>
          {more === 0
            ? fill(W.enough, { ready, recommended: RECOMMENDED_MEDIA })
            : fill(more === 1 ? W.needOne : W.needMore, { more, ready })}
        </span>
      </div>

      <Note>
        {fill(copy.photos.intro, { min: MIN_MEDIA, recommended: RECOMMENDED_MEDIA, max: MAX_PHOTOS, videos: MAX_VIDEOS })}{" "}
        {fill(copy.photos.tooNarrow, { width: MIN_PHOTO_WIDTH })}
      </Note>

      {/* The refusals are said by the banner; one line per refused file stays here. */}
      {problems.length > 0 && (
        <Note glyph="flag" role="status">
          <span className="block space-y-inline-tight" data-testid="photo-problems">
            {problems.map((line, index) => (
              <span key={`${index}-${line}`} className="block">
                {line}
              </span>
            ))}
          </span>
        </Note>
      )}
      {canRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={uploading} loading={uploading} data-testid="photo-retry">
          {copy.photos.retry}
        </Button>
      )}

      <ul className="nf-lw-shots">
        {media.map((item, index) => {
          const face =
            item.kind === "photo" ? (
              <RemoteImage
                src={item.url}
                alt=""
                width={640}
                height={480}
                sizes="(max-width: 40rem) 50vw, 14rem"
                className="nf-lw-shot__img"
              />
            ) : (
              /* Muted and still: its poster, or its first frame. */
              <video
                src={`${item.url}#t=0.1`}
                poster={item.posterUrl ?? undefined}
                preload="metadata"
                muted
                playsInline
                controls={false}
                className="nf-lw-shot__img"
                aria-label={item.durationSeconds === null ? copy.photos.video : `${copy.photos.video}, ${clockOf(item.durationSeconds)}`}
              />
            );
          return (
            <li key={`${item.kind}-${item.id}`} className="nf-lw-shot" data-cover={index === 0 ? "" : undefined} data-kind={item.kind}>
              {viewerCopy ? (
                <button
                  type="button"
                  className="nf-lw-shot__open"
                  aria-label={item.kind === "photo" ? viewerCopy.openPhoto : viewerCopy.openVideo}
                  onClick={() => setViewerId(`${item.kind}-${item.id}`)}
                >
                  {face}
                </button>
              ) : (
                face
              )}
              {index === 0 && (
                <span className="nf-lw-shot__cover">
                  <UiIcon name="crown" size={12} />
                  {copy.photos.cover}
                </span>
              )}
              {item.kind === "video" && (
                <span className="nf-lw-shot__kind" aria-hidden="true">
                  <UiIcon name="circle-play" size={16} />
                  {item.durationSeconds === null ? null : clockOf(item.durationSeconds)}
                </span>
              )}
              <button
                type="button"
                className="nf-lw-shot__drop"
                aria-label={copy.photos.remove}
                disabled={busy || uploading}
                onClick={() => onDrop(index)}
              >
                <UiIcon name="close" size={16} />
              </button>
              <span className="nf-lw-shot__moves">
                <button
                  type="button"
                  className="nf-lw-shot__move"
                  aria-label={copy.drawn.photos.earlier}
                  disabled={!canMove(media, index, index - 1) || busy || uploading}
                  onClick={() => onMove(index, index - 1)}
                >
                  <UiIcon name="arrow-left" size={16} />
                </button>
                <button
                  type="button"
                  className="nf-lw-shot__move"
                  aria-label={copy.drawn.photos.later}
                  disabled={!canMove(media, index, index + 1) || busy || uploading}
                  onClick={() => onMove(index, index + 1)}
                >
                  <UiIcon name="arrow-right" size={16} />
                </button>
              </span>
            </li>
          );
        })}
        {(photos.length < MAX_PHOTOS || videos.length < MAX_VIDEOS) && (
          <li className="contents">
            <button type="button" className="nf-lw-add" onClick={onPick} disabled={uploading}>
              <span className="nf-lw-add__plus" aria-hidden="true">
                <UiIcon name="plus" size={20} />
              </span>
              <span>{uploading ? copy.photos.uploading : copy.drawn.photos.add}</span>
            </button>
          </li>
        )}
        {photos.length < MAX_PHOTOS && nativeCamera && (
          <li className="contents">
            <button type="button" className="nf-lw-add" data-testid="listing-photo-camera" onClick={onCamera} disabled={uploading}>
              <span className="nf-lw-add__plus" aria-hidden="true">
                <UiIcon name="camera" size={20} />
              </span>
              <span>{copy.photos.takePhoto}</span>
            </button>
          </li>
        )}
      </ul>
      {viewerCopy && viewerId ? (
        <MediaViewer
          items={media.map<ViewerItem>((item) => ({
            id: `${item.kind}-${item.id}`,
            kind: item.kind,
            src: item.url,
            alt: "",
            name: values.title.trim() || copy.photos.cover,
            when: "",
          }))}
          startId={viewerId}
          copy={viewerCopy}
          onClose={() => setViewerId(null)}
        />
      ) : null}
      {/* V-70: say what each photo shows. Additive; drawn only with its copy. */}
      {shotsCopy && (
        <ShotList
          listingId={listingId}
          photos={photos.map((photo) => ({ id: photo.id, url: photo.url }))}
          claims={{ prepaidMeter: values.prepaidMeter, waterSupply: values.waterSupply || null, powerBackup: values.powerBackup || null }}
          copy={shotsCopy}
        />
      )}
      {videoProgress && (
        <div className="flex flex-wrap items-center gap-sm">
          <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status" data-testid="video-progress">
            {fill(copy.photos.videoUploading, { name: videoProgress.name, percent: videoProgress.percent })}
          </p>
          <Button variant="secondary" size="sm" onClick={onCancelVideo} data-testid="video-cancel">
            {copy.photos.videoCancel}
          </Button>
        </div>
      )}
      {/* The count, then the nudge from the minimum to the recommendation. */}
      <p className="nf-numeric text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]" data-testid="media-count">
        {fill(copy.photos.progress, { count: media.length, min: MIN_MEDIA })}
        {media.length >= MIN_MEDIA && media.length < RECOMMENDED_MEDIA
          ? ` ${fill(copy.photos.recommend, { more: RECOMMENDED_MEDIA - media.length })}`
          : null}
      </p>
      {media.length === 0 && <Note>{copy.photos.empty}</Note>}
    </>
  );
}
