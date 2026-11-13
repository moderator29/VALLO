/**
 * What the people search has typed, as the action reads it: no leading @, at
 * most 40 characters. A plain module, because the /around/people page (a server
 * component) calls it, and a function exported from a "use client" module
 * cannot be called on the server.
 */
export function typedOf(value: string): string {
  return value.trim().replace(/^@+/, "").slice(0, 40);
}
