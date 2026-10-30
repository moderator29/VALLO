/** Reply templates, the pure half. Client-safe. */
export const TEMPLATE_TITLE_MAX = 40;
export const TEMPLATE_BODY_MAX = 1000;
export const TEMPLATE_LIMIT = 12;

export type ReplyTemplate = { id: string; title: string; body: string };

/** A tidy title and body, or null when either is empty once trimmed. */
export function cleanTemplate(input: { title: string; body: string }): { title: string; body: string } | null {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, TEMPLATE_TITLE_MAX).trim();
  const body = input.body.replace(/\r\n/g, "\n").trim().slice(0, TEMPLATE_BODY_MAX).trim();
  return title && body ? { title, body } : null;
}

/** The shape the thread's quick-reply tray draws. */
export function templatesAsReplies(templates: ReplyTemplate[]): { key: string; label: string; text: string }[] {
  return templates.map((t) => ({ key: `tpl-${t.id}`, label: t.title, text: t.body }));
}
