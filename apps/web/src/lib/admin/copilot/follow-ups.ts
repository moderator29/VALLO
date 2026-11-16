/**
 * WHAT TO ASK NEXT (the founder, 16 November 2026: "more and more options as
 * the chat is going").
 *
 * Under the newest answer the copilot offers two or three next questions,
 * chosen from what it just read: after the support queue, reply to the
 * oldest ticket; after the alerts, resolve the worst one; and so on. Drawn
 * from the tool names the answer used, so they are always about the desk in
 * front of the person and never invented. Pure.
 */

const NEXT: Readonly<Record<string, readonly string[]>> = {
  get_support_queue: ["Reply to the oldest ticket", "Which tickets are past the promised time?"],
  get_support_ticket: ["Write a reply to this ticket", "Resolve this ticket"],
  reply_to_ticket: ["Show me the next oldest ticket", "Which tickets are past the promised time?"],
  set_ticket_status: ["Show me the next oldest ticket"],
  get_operations_overview: ["Resolve the oldest open alert", "Are any scheduled jobs failing?"],
  risk_alert_step: ["What other alerts are open?"],
  get_bookings_overview: ["Which bookings need a person today?"],
  get_moderation_queue: ["Show me the open message flags", "What is the oldest open report about?"],
  get_message_flags: ["Clear the oldest flag if it is harmless", "Which flag looks most serious?"],
  review_message_flag: ["Show me the next open flag"],
  get_escalations: ["Mark the oldest one as seen", "What would you do about the most urgent one?"],
  escalation_step: ["What else is waiting on me?"],
  get_listing_queue: ["What is the oldest listing waiting for?", "Summarise the next listing"],
  get_listing_review: ["What checks are still missing on it?"],
  get_kyc_queue: ["What is the oldest identity check waiting for?"],
  list_cases: ["What is the most urgent case about?", "Draft a note for that case"],
  get_case: ["Draft an internal note for this case"],
  get_my_tasks: ["Add a task for tomorrow", "What is overdue?"],
  get_platform_pulse: ["What changed this week?", "What needs me today?"],
  get_control_room: ["What SQL still has to run?", "Which switches are off?"],
  get_staff_overview: ["Which teams have nobody on them?", "Recommend who should get access"],
  get_what_changed: ["What needs me today?"],
  get_money_overview: ["Any chargebacks waiting?", "How do payments compare with last week?"],
  get_chargebacks: ["What is the oldest chargeback waiting for?"],
  where_do_i_go: ["Take me there"],
  search_manual: ["Show me the full playbook for that"],
};

const GENERAL = ["What should I do next?", "Make that shorter", "Explain that in more detail"];

/** Two or three next questions for an answer that used these tools, none repeated. */
export function followUpsFor(toolNames: readonly string[], max = 3): string[] {
  const out: string[] = [];
  for (const name of [...toolNames].reverse()) {
    for (const q of NEXT[name] ?? []) if (!out.includes(q)) out.push(q);
  }
  for (const q of GENERAL) if (out.length < max && !out.includes(q)) out.push(q);
  return out.slice(0, max);
}
