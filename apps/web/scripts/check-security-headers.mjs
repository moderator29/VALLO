#!/usr/bin/env node
/**
 * THE HEADERS EVERY PAGE MUST CARRY (Agent D audit, 17 October 2026).
 *
 *   node scripts/check-security-headers.mjs http://localhost:3210 [/path ...]
 *
 * Fetches each path (default: the public front door) without following a
 * redirect and fails, naming the path and the header, when a page answers
 * without:
 *
 *   - a Content-Security-Policy with `frame-ancestors 'none'` and a script
 *     nonce (the proxy writes it per request, `src/lib/security/csp.ts`);
 *   - Strict-Transport-Security with a max-age of at least a year;
 *   - X-Content-Type-Options nosniff, X-Frame-Options DENY, a
 *     Referrer-Policy and a Permissions-Policy (`next.config.ts`).
 *
 * A redirect (a locale or a sign-in door) is checked on the headers it
 * answers with, which come from the same catch-all, minus the CSP, which is
 * written only on a page. Run in CI against the production server the
 * front-door job starts, and before promoting a preview.
 */
const [base, ...rest] = process.argv.slice(2);
if (!base) {
  console.error("usage: node scripts/check-security-headers.mjs <origin> [/path ...]");
  process.exit(2);
}
const paths = rest.length > 0 ? rest : ["/", "/about", "/sign-in", "/welcome", "/help", "/terms", "/privacy"];

const ALWAYS = [
  ["x-content-type-options", (v) => v.toLowerCase() === "nosniff"],
  ["x-frame-options", (v) => v.toUpperCase() === "DENY"],
  ["referrer-policy", (v) => v.length > 0],
  ["permissions-policy", (v) => v.length > 0],
  [
    "strict-transport-security",
    (v) => {
      const age = Number(/max-age=(\d+)/i.exec(v)?.[1] ?? 0);
      return age >= 31_536_000;
    },
  ],
];

let failed = 0;
let pages = 0;
for (const path of paths) {
  let res;
  try {
    res = await fetch(new URL(path, base), { redirect: "manual" });
  } catch (error) {
    console.error(`${path}: no answer (${error instanceof Error ? error.message : "fetch failed"})`);
    failed += 1;
    continue;
  }
  for (const [name, ok] of ALWAYS) {
    const value = res.headers.get(name) ?? "";
    if (!value || !ok(value)) {
      console.error(`${path}: ${name} is ${value ? `"${value}"` : "missing"}`);
      failed += 1;
    }
  }
  const isPage = res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/html");
  if (isPage) {
    pages += 1;
    const csp = res.headers.get("content-security-policy") ?? "";
    if (!/frame-ancestors 'none'/.test(csp)) {
      console.error(`${path}: content-security-policy has no frame-ancestors 'none'`);
      failed += 1;
    }
    if (!/'nonce-[^']+'/.test(csp)) {
      console.error(`${path}: content-security-policy names no script nonce`);
      failed += 1;
    }
  }
}

if (pages === 0) {
  console.error("security headers: no path answered with a page, so the policy was never read");
  process.exit(1);
}
if (failed > 0) {
  console.error(`security headers: ${failed} problem(s) across ${paths.length} path(s)`);
  process.exit(1);
}
console.log(`security headers: clean on ${paths.length} path(s), ${pages} page(s) carrying the policy`);
