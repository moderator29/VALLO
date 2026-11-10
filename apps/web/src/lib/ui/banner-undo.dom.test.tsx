/**
 * UNDO ON THE BANNER, END TO END (founder, November 2026, "the banner
 * everywhere"). For each reversible action: the forward action is called with
 * the right arguments, the banner says what happened and offers Undo, and
 * Undo calls the real inverse and says so. Server actions are staged by the
 * harness (`window.__calls` records name and arguments).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

type Page = import("playwright-core").Page;
const calls = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __calls: unknown[][] }).__calls ?? []).map((c) => [c[0], c[1]]));
const OK = `async () => ({ ok: true, data: { note: null } })`;
const CASE = "00000000-0000-4000-8000-000000000001";

async function undoThrough(page: Page, said: string, back: string) {
  await page.getByText(said).waitFor();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByText(back).waitFor();
}

describe.skipIf(!hasBrowser && !process.env.CI)("Undo on the banner", () => {
  it("follow: unfollow is the inverse", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { FollowButton } from "@/components/social/profile/FollowButton";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><FollowButton handle="ada_o" initialFollowing={false} signedIn /><ToastHost /></>);`,
      css: productCss(),
      actions: { toggleFollow: `async (i) => ({ ok: true, data: { following: i.want } })` },
    });
    try {
      await page.getByRole("button", { name: /Follow @ada_o/ }).click();
      await undoThrough(page, "You follow @ada_o. Their posts are in your feed now.", "You do not follow @ada_o any more.");
      expect(await calls(page)).toEqual([
        ["toggleFollow", { handle: "ada_o", want: true }],
        ["toggleFollow", { handle: "ada_o", want: false }],
      ]);
    } finally {
      await close();
    }
  });

  it("ticket: taking it is undone by handing it back", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { TicketClaim } from "@/app/admin/support/TicketClaim";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><TicketClaim ticketId="t1" holder={null} /><ToastHost /></>);`,
      css: productCss(),
      actions: { takeTicket: `async () => ({ ok: true, data: null })`, releaseTicket: `async () => ({ ok: true, data: null })` },
    });
    try {
      await page.getByRole("button", { name: "Take it" }).click();
      await undoThrough(page, "You took this ticket. It is under Mine.", "You handed the ticket back.");
      expect(await calls(page)).toEqual([
        ["takeTicket", { ticketId: "t1" }],
        ["releaseTicket", { ticketId: "t1" }],
      ]);
    } finally {
      await close();
    }
  });

  it("case: awaiting information is undone by back under review", async () => {
    const can = { note: false, assign: false, status: true, escalate: false, resolve: false, restrict: false, suspend: false, message: false, documents: false };
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { CaseActions } from "@/app/admin/cases/[id]/CaseActions";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><CaseActions caseId="${CASE}" status="under_review" can={${JSON.stringify(can)}} targetType="roommate_listing" subject={null} reporters={[]} /><ToastHost /></>);`,
      css: productCss(),
      actions: { setCaseStatus: `async () => ({ ok: true, data: null })` },
    });
    try {
      await page.getByRole("button", { name: "Awaiting information" }).click();
      await undoThrough(page, "Marked as awaiting information.", "Back under review.");
      expect(await calls(page)).toEqual([
        ["setCaseStatus", { caseId: CASE, status: "awaiting_info" }],
        ["setCaseStatus", { caseId: CASE, status: "under_review" }],
      ]);
    } finally {
      await close();
    }
  });

  it("case: closing is undone by reopening", async () => {
    const can = { note: false, assign: false, status: false, escalate: false, resolve: true, restrict: false, suspend: false, message: false, documents: false };
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { CaseActions } from "@/app/admin/cases/[id]/CaseActions";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><CaseActions caseId="${CASE}" status="resolved" can={${JSON.stringify(can)}} targetType="roommate_listing" subject={null} reporters={[]} /><ToastHost /></>);`,
      css: productCss(),
      actions: { closeCase: `async () => ({ ok: true, data: null })`, reopenCase: `async () => ({ ok: true, data: null })` },
    });
    try {
      await page.getByRole("button", { name: /Close/ }).first().click();
      await undoThrough(page, "Case closed. It stays on record under Closed.", "Case reopened.");
      const log = await calls(page);
      expect(log[0]).toEqual(["closeCase", { caseId: CASE }]);
      expect(log[1]?.[0]).toBe("reopenCase");
    } finally {
      await close();
    }
  });

  it("my desk: a status change is undone by the previous status", async () => {
    const task = { id: "tk1", title: "Check payouts", detail: "", assignedTo: "me", createdBy: "me", dueDate: null, status: "todo", priority: "normal", relatedDesk: null, relatedLink: null, createdAt: "2026-11-01", completedAt: null };
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { TaskCard } from "@/app/admin/my-desk/TaskControls";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><ul><TaskCard task={${JSON.stringify(task)}} comments={[]} viewerId="me" names={{}} overdue={false} canAssign={false} people={[]} canComment={false} /></ul><ToastHost /></>);`,
      css: productCss(),
      actions: { setTaskStatus: OK },
    });
    try {
      await page.getByLabel("Status").selectOption("done");
      await undoThrough(page, "Status changed to Done", "Status is back to To do");
      expect(await calls(page)).toEqual([
        ["setTaskStatus", "tk1"],
        ["setTaskStatus", "tk1"],
      ]);
      const full = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls.map((c) => c[2]));
      expect(full).toEqual(["done", "todo"]);
    } finally {
      await close();
    }
  });

  it("social media: a cancelled post is restored as a draft", async () => {
    const post = { id: "p1", platform: "instagram", category: "tips", format: "image", slot: null, campaign: null, caption: "x", plannedAt: "2026-11-12", status: "awaiting_approval", mediaUrls: [], approvedBy: null, approvedAt: null, postedAt: null, liveUrl: null, rejectionReason: null, createdBy: null, createdAt: "2026-11-01", updatedAt: "2026-11-01" };
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { ApprovalActions } from "@/app/admin/social-media/SocialMediaControls";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><ApprovalActions post={${JSON.stringify(post)}} /><ToastHost /></>);`,
      css: productCss(),
      actions: { cancelPost: OK, restoreCancelledPost: OK },
    });
    try {
      await page.getByRole("button", { name: "Cancel" }).click();
      await undoThrough(page, "Post cancelled. It is under Cancelled.", "Post restored as a draft. It needs approval again.");
      expect(await calls(page)).toEqual([
        ["cancelPost", "p1"],
        ["restoreCancelledPost", "p1"],
      ]);
    } finally {
      await close();
    }
  });

  it("circle: leaving a public community is undone by joining; a follow on a question by unfollowing", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { JoinControl, FollowToggle } from "@/app/(app)/circle/_parts/CircleActions";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><JoinControl communityId="c1" slug="lekki" name="Lekki" visibility="public" initial="active" signedIn /><FollowToggle questionId="q1" initial={false} /><ToastHost /></>);`,
      css: productCss(),
      actions: {
        leaveCommunity: `async () => ({ ok: true, data: null })`,
        joinCommunity: `async () => ({ ok: true, data: { status: "active" } })`,
        followQuestion: `async (i) => ({ ok: true, data: { on: i.on } })`,
      },
    });
    try {
      await page.getByTestId("circle-leave").click();
      await undoThrough(page, "You left. Nobody was told.", "You are back in Lekki.");
      await page.getByTestId("circle-follow").click();
      await undoThrough(page, "You will be told when this question gets a new answer.", "Done. That is back as it was.");
      expect(await calls(page)).toEqual([
        ["leaveCommunity", { communityId: "c1", slug: "lekki" }],
        ["joinCommunity", { communityId: "c1", slug: "lekki" }],
        ["followQuestion", { questionId: "q1", on: true }],
        ["followQuestion", { questionId: "q1", on: false }],
      ]);
    } finally {
      await close();
    }
  });
});
