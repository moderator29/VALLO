/**
 * The pages "Was this helpful?" may name: a path under /help, /guides or
 * /docs, with an optional section. The same shape the database function
 * checks (`submit_doc_feedback`), so a page the app draws the control on is
 * one the table accepts. Client-safe.
 */
export const DOC_FEEDBACK_PAGE = /^\/(help|guides|docs)(\/[a-z0-9-]+)?(#[a-z0-9-]+)?$/;
