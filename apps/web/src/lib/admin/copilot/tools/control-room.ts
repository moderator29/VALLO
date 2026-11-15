import { z } from "zod";
import { STAFF_SCOPES } from "@/lib/admin/guard";
import { readControlRoom } from "@/lib/admin/control/read";
import { refused, unreadable } from "./common";
import { defineTool } from "./types";

/**
 * THE CONTROL ROOM, FOR THE SUPER ADMIN'S COPILOT (15 November 2026). One read
 * tool, offered to a super admin only, so the founder can ask "what is
 * waiting on me", "what SQL still has to run" or "why are members abroad not
 * asked for a phone" and be answered from the same read the Control room page
 * draws. It reads only: it runs no SQL, changes no switch and carries no key
 * or secret, only whether each service is connected.
 */
export const getControlRoom = defineTool({
  name: "get_control_room",
  description:
    "For a super admin: what is waiting on them (escalations, open alerts, staff access recommendations), which parts of the database are in place and which are waiting for their SQL to be run (with the file to run), how the main switches stand and what each means, and which outside services this site is connected to. Use for 'what needs me', 'what SQL is still to run', 'is X switched on' and 'is X connected'.",
  kind: "read",
  scopes: STAFF_SCOPES,
  allow: (viewer) => viewer.isSuperAdmin,
  status: "Reading the control room",
  input: z.object({}),
  handler: async (_input, ctx) => {
    if (!ctx.viewer.isSuperAdmin) return refused();
    const room = await readControlRoom();
    if (room.state === "forbidden") return refused();
    if (room.state !== "ok") return unreadable("The control room");
    return {
      ok: true,
      data: {
        waitingOnYou: room.waiting.map((line) => ({ words: line.words, link: line.href })),
        databaseSetup: {
          waiting: room.setup.filter((r) => r.state === "waiting").map((r) => ({ part: r.item.title, unlocks: r.item.unlocks, fileToRun: `supabase/migrations/${r.item.file}` })),
          couldNotBeRead: room.setup.filter((r) => r.state === "unknown").map((r) => r.item.title),
          inPlace: room.setup.filter((r) => r.state === "ready").length,
        },
        switches: room.switches.map((s) => ({ name: s.note.title, state: s.state, means: s.state === "on" ? s.note.on : s.note.off })),
        /* Added with the control room's own reading (16 November 2026): whether
           Vallo can be read without an account. It is a deploy setting, not a
           switch, so the answer has to say how it is changed. */
        readingValloWithoutAnAccount: { name: room.reach.title, open: room.reach.open, means: room.reach.meaning, howToChange: room.reach.howToChange },
        services: room.connections.map((c) => ({ name: c.title, connected: c.ready, means: c.meaning })),
        page: "/admin/control",
      },
      note: "Say it in plain words, what is waiting first. SQL is run by the founder in the Supabase SQL editor and a switch is changed on the Switches desk: you cannot do either, so name the file or the desk. Never state a key or a secret; you have none.",
      links: [
        { label: "Open the control room", href: "/admin/control", requires: "super_admin" },
        { label: "Open Switches", href: "/admin/switches", requires: "admin" },
        { label: "Open Escalations", href: "/admin/escalations" },
      ],
    };
  },
});

export const CONTROL_ROOM_TOOLS = [getControlRoom];
