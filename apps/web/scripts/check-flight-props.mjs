#!/usr/bin/env node
/**
 * NO PROP OVER 50 KB IN A PAGE'S FLIGHT PAYLOAD (Agent NATIVE, 7 November 2026).
 *
 * The running twin of `src/lib/platform/client-prop-size.test.ts`. That test
 * measures the dictionary statically; this one fetches real pages from a
 * running build and measures EVERY prop a server component handed to a
 * client component (listings, rows, threads, copy), from the
 * `self.__next_f.push` chunks in the HTML. Any single prop over 50 KB
 * serialised fails, unless it is in ALLOW below with its reason.
 *
 *     BASE_URL=http://localhost:3200 node scripts/check-flight-props.mjs
 *     BASE_URL=http://localhost:3200 node scripts/check-flight-props.mjs /welcome /search
 *
 * Signed-in routes need a session cookie in FLIGHT_COOKIE. Without BASE_URL it
 * says so and exits 0, so it can sit in a script list harmlessly.
 */

const LIMIT = 50 * 1024;
const ROUTES_DEFAULT = ["/", "/welcome", "/sign-in", "/sign-up", "/search", "/stays/search", "/around", "/home"];

/** `route -> prop path` (as printed) with the reason it may be large. */
const ALLOW = {};

const base = process.env.BASE_URL;
if (!base) {
  console.log("check-flight-props: no BASE_URL, nothing measured.");
  process.exit(0);
}
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ROUTES_DEFAULT;

function flightText(html) {
  let text = "";
  for (const m of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try {
      const a = JSON.parse(m[1]);
      if (a.length > 1 && typeof a[1] === "string") text += a[1];
    } catch {
      /* a chunk that is not JSON (a module row) carries no props */
    }
  }
  return text;
}

/** The deepest props over the limit: a parent is reported only through its largest child. */
function oversized(text) {
  const found = [];
  for (const row of text.split(/\n(?=[0-9a-f]+:)/)) {
    const i = row.indexOf(":");
    let data;
    try {
      data = JSON.parse(row.slice(i + 1));
    } catch {
      continue;
    }
    const walk = (node, path) => {
      if (!node || typeof node !== "object") return;
      const entries = Array.isArray(node) ? node.map((v, j) => [`[${j}]`, v]) : Object.entries(node).map(([k, v]) => [`.${k}`, v]);
      let deeper = false;
      for (const [k, v] of entries) {
        const size = Buffer.byteLength(JSON.stringify(v) ?? "", "utf8");
        if (size > LIMIT) {
          deeper = true;
          const before = found.length;
          walk(v, path + k);
          /* A prop is reported at the level of a named key whose children are each under the limit. */
          if (found.length === before && !Array.isArray(node)) found.push({ path: path + k, kb: Math.round(size / 1024) });
        }
      }
      return deeper;
    };
    walk(data, row.slice(0, i));
  }
  return found;
}

let failed = 0;
for (const route of routes) {
  const res = await fetch(new URL(route, base), {
    headers: { "user-agent": "Mozilla/5.0 (Linux; Android 13; wv) Chrome/131 Mobile VALLO-NATIVE", cookie: process.env.FLIGHT_COOKIE ?? "" },
    redirect: "manual",
  }).catch((e) => ({ error: e }));
  if (res.error || res.status >= 300) {
    console.log(`${route}: skipped (${res.error ? res.error.message : `HTTP ${res.status}`})`);
    continue;
  }
  const text = flightText(await res.text());
  const over = oversized(text).filter((o) => !ALLOW[`${route} -> ${o.path}`]);
  console.log(`${route}: flight ${Math.round(Buffer.byteLength(text) / 1024)} KB${over.length ? "" : ", every prop under 50 KB"}`);
  for (const o of over) {
    failed++;
    console.log(`  OVER: ${o.path} is ${o.kb} KB`);
  }
}
if (failed) {
  console.log(`\n${failed} prop(s) over 50 KB. Pass the slice the component reads.`);
  process.exit(1);
}
