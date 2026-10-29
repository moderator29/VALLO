"use client";

import { useCallback } from "react";
import { endReasonWords, durationWords } from "@/lib/calls/lifecycle";
import { callMarkerView, clockWords } from "@/lib/calls/screen";
import {
  EndedView,
  IncomingCallView,
  InCallView,
  OutgoingView,
  PermissionView,
  RecoveryView,
  ConfirmEnd,
  type CallsCopy,
} from "@/components/calls/views";
import { CallHistoryRow } from "@/components/calls/CallHistoryRow";
import type { CallPillWords } from "@/components/calls/call-pill-words";
import { ReviewDesk } from "@/components/calls/admin/ReviewDesk";
import { ReviewOutcomeForm } from "@/components/calls/admin/ReviewOutcomeForm";
import { RequestReviewCall } from "@/components/calls/admin/RequestReviewCall";
import { ReviewTable } from "@/components/calls/admin/ReviewTable";
import { SubjectReviewCard } from "@/components/calls/SubjectReviewCard";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { AUDIT, ENTRIES, NOW, STAFF_REVIEW, STAFF_REVIEWS, SUBJECT_REVIEW, snapshot, type CallPreviewState } from "./fixtures";

const noop = () => undefined;

/**
 * A picture in place of a camera: a canvas stream, so the in-call screen's
 * real <video> elements play something in a sandbox with no camera and no
 * call. Painted once (a still frame is all a screenshot needs).
 */
function useFakeVideo(label: string, tone: "remote" | "self") {
  return useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el || el.srcObject) return;
      const canvas = document.createElement("canvas");
      canvas.width = 540;
      canvas.height = 960;
      const g = canvas.getContext("2d");
      if (!g) return;
      /* Painted from the theme's own tokens: no colour is invented here. */
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(name).trim();
      const top = token(tone === "remote" ? "--nf-brand-primary" : "--nf-spark-fill-solid");
      const bottom = token("--nf-surface-artwork");
      const figure = token("--nf-content-on-media-muted");
      const words = token("--nf-content-on-media");
      const paint = () => {
        const grad = g.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, top);
        grad.addColorStop(1, bottom);
        g.fillStyle = grad;
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.globalAlpha = 0.55;
        g.fillStyle = figure;
        g.beginPath();
        g.arc(canvas.width / 2, canvas.height * 0.42, canvas.width * 0.2, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(canvas.width / 2, canvas.height * 0.86, canvas.width * 0.38, canvas.height * 0.22, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.8;
        g.fillStyle = words;
        g.font = "600 28px system-ui";
        g.textAlign = "center";
        g.fillText(label, canvas.width / 2, 80);
        g.globalAlpha = 1;
      };
      paint();
      const stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(5);
      const timer = window.setInterval(paint, 400);
      el.srcObject = stream;
      el.muted = true;
      void el.play().catch(() => undefined);
      el.addEventListener("emptied", () => window.clearInterval(timer), { once: true });
    },
    [label, tone],
  );
}

export function CallsPreview({ state, copy, words }: { state: CallPreviewState; copy: CallsCopy; words: CallPillWords }) {
  const remote = useFakeVideo("Preview: their camera", "remote");
  const local = useFakeVideo("You", "self");
  const base = snapshot();
  const inCall = {
    copy,
    name: base.otherName!,
    kind: "VIDEO" as const,
    clock: clockWords(252),
    quality: 3 as const,
    banner: null,
    remoteVideoOn: true,
    remoteMicMuted: false,
    remoteVideoRef: remote,
    localVideoRef: local,
    micOn: true,
    cameraOn: true,
    canCamera: true,
    canSwitchCamera: true,
    canChooseOutput: false,
    onToggleMic: noop,
    onToggleCamera: noop,
    onSwitchCamera: noop,
    onNextOutput: noop,
    onEnd: noop,
  };
  const context = "2 bedroom flat, Lekki Phase 1";

  switch (state) {
    case "outgoing-video":
      return <OutgoingView copy={copy} name={base.otherName!} kind="VIDEO" context={context} status={copy.outgoing.ringing} localVideoRef={local} localVideoOn onCancel={noop} />;
    case "outgoing-voice":
      return <OutgoingView copy={copy} name={base.otherName!} kind="AUDIO" context={context} status={copy.outgoing.ringing} onCancel={noop} />;
    case "incoming-video":
      return <IncomingCallView copy={copy} name="Tunde Bakare" kind="VIDEO" context={context} secondsLeft={38} onAccept={noop} onDecline={noop} />;
    case "incoming-voice":
      return <IncomingCallView copy={copy} name="Tunde Bakare" kind="AUDIO" context="Stay booking" secondsLeft={21} onAccept={noop} onDecline={noop} />;
    case "incoming-review":
      return <IncomingCallView copy={copy} name="Vallo review team" kind="VIDEO" review context="Your agent application" secondsLeft={40} onAccept={noop} onDecline={noop} />;
    case "connecting":
      return <OutgoingView copy={copy} name={base.otherName!} kind="VIDEO" context={context} status={copy.connecting.title} onCancel={noop} />;
    case "active-video":
      return <InCallView {...inCall} />;
    case "active-voice":
      return <InCallView {...inCall} kind="AUDIO" remoteVideoOn={false} canCamera={false} cameraOn={false} quality={2} canChooseOutput speakerOn />;
    case "active-muted":
      return <InCallView {...inCall} micOn={false} remoteMicMuted cameraOn={false} />;
    case "reconnecting":
      return <InCallView {...inCall} banner="reconnecting" quality={1} />;
    case "remote-left":
      return <InCallView {...inCall} banner="remote_left" remoteVideoOn={false} quality={2} />;
    case "confirm-end":
      return <InCallView {...inCall} name="Vallo review team" confirm={<ConfirmEnd copy={copy} onConfirm={noop} onCancel={noop} />} />;
    case "permission-ios":
      return <PermissionView copy={copy} error="denied" wantedVideo platform="iosApp" onRetry={noop} onVoiceOnly={noop} onKeepMessaging={noop} />;
    case "permission-android-web":
      return <PermissionView copy={copy} error="denied" wantedVideo={false} platform="androidWeb" onRetry={noop} onKeepMessaging={noop} />;
    case "permission-desktop":
      return <PermissionView copy={copy} error="denied" wantedVideo platform="desktop" onRetry={noop} onVoiceOnly={noop} onKeepMessaging={noop} />;
    case "ended": {
      const s = snapshot({ state: "ENDED", endReason: "hangup", connectedAt: "2026-10-08T13:10:00.000Z", durationSeconds: 252, endedAt: NOW });
      return <EndedView copy={copy} name={s.otherName!} kind="VIDEO" words={endReasonWords(s)} duration={durationWords(252)} backLabel={copy.ended.back} onBack={noop} onCallBack={noop} onClose={noop} />;
    }
    case "ended-missed": {
      const s = snapshot({ state: "MISSED", isInitiator: false, role: "CALLEE", kind: "AUDIO" });
      return <RecoveryView copy={copy} name={s.otherName!} title={copy.recovery.missedTitle} body={endReasonWords(s)} primaryLabel={copy.ended.back} onPrimary={noop} onCallBack={noop} onClose={noop} />;
    }
    case "gone":
      return <RecoveryView copy={copy} title={copy.recovery.goneTitle} body={copy.recovery.goneBody} primaryLabel={copy.recovery.openMessages} onPrimary={noop} onClose={noop} />;
    case "history":
      return <HistoryPreview copy={copy} words={words} />;
    case "admin-list":
      return (
        <Page title={copy.staff.title}>
          <p className="nf-review-call__disclaimer">{copy.review.notVerificationStaff}</p>
          <ReviewTable reviews={STAFF_REVIEWS} copy={copy} />
        </Page>
      );
    case "admin-detail":
      return (
        <Page title={copy.staff.caseKinds[STAFF_REVIEW.caseKind]}>
          <ReviewDesk
            review={STAFF_REVIEW}
            entries={ENTRIES}
            audit={AUDIT}
            subjectName="Chinedu Eze"
            liveCallId={null}
            caseLink="/admin/agents"
            nowIso={NOW}
            copy={copy}
          />
        </Page>
      );
    case "admin-outcome":
      return (
        <Page title={copy.staff.outcome}>
          <ReviewOutcomeForm reviewId={STAFF_REVIEW.id} copy={copy} />
        </Page>
      );
    case "admin-request":
      return (
        <Page title={copy.staff.caseKinds.listing}>
          <RequestReviewCall caseKind="listing" caseId={STAFF_REVIEW.caseId} copy={copy} startOpen />
        </Page>
      );
    case "member-review":
      return (
        <Page title={copy.review.listTitle}>
          <SubjectReviewCard review={SUBJECT_REVIEW} copy={copy} preview />
        </Page>
      );
    case "member-review-live":
      return (
        <Page title={copy.review.listTitle}>
          <SubjectReviewCard review={{ ...SUBJECT_REVIEW, status: "IN_CALL", liveCallId: base.id }} copy={copy} preview />
        </Page>
      );
  }
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid max-w-2xl gap-md px-gutter py-lg">
      <h1 className="nf-h1">{title}</h1>
      {children}
    </main>
  );
}

/** A conversation with its call rows between ordinary bubbles, as the thread draws them. */
function HistoryPreview({ copy, words }: { copy: CallsCopy; words: CallPillWords }) {
  const talked = callMarkerView({ body: "Video call, 4 min 12 s", mine: true });
  const missed = callMarkerView({ body: "Voice call, missed", mine: false });
  const noAnswer = callMarkerView({ body: "Video call, missed", mine: true });
  const declined = callMarkerView({ body: "Voice call, declined", mine: false });
  return (
    <main className="mx-auto grid max-w-xl gap-xs px-gutter py-lg">
      <h1 className="nf-h2">Adaeze Okafor</h1>
      <div className="nf-msg">
        <div className="nf-bubble nf-bubble--theirs">
          <p className="nf-bubble__body">Can we do a quick video walkthrough this afternoon?</p>
        </div>
      </div>
      {talked ? <CallHistoryRow view={talked} name="Adaeze" timeLabel="13:02" words={words} onCallBack={noop} /> : null}
      {missed ? <CallHistoryRow view={missed} name="Adaeze" timeLabel="15:40" words={words} onCallBack={noop} /> : null}
      {noAnswer ? <CallHistoryRow view={noAnswer} name="Adaeze" timeLabel="16:05" words={words} onCallBack={noop} /> : null}
      {declined ? <CallHistoryRow view={declined} name="Adaeze" timeLabel="16:30" words={words} /> : null}
      <div className="nf-msg nf-msg--mine">
        <div className="nf-bubble nf-bubble--mine">
          <p className="nf-bubble__body">Sorry I missed you, calling back now.</p>
        </div>
      </div>
      <h2 className="nf-h3 mt-lg">Inbox</h2>
      <div className="nf-inbox-row">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Tunde Bakare</span>
          <span className="inline-flex items-center gap-inline-tight text-[var(--nf-state-error)]">
            <UiIcon name="phone-missed" size={16} filled />
            {copy.history.inboxMissedVideo}
          </span>
        </span>
        <span className="nf-inbox-row__when nf-numeric">15:40</span>
      </div>
    </main>
  );
}
