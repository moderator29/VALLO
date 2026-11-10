/**
 * Where the map's imagery comes from, and who gets credited for it.
 *
 *   node apps/web/tests/map-tiles.spec.mjs
 *
 * Self-contained: no runner, no dev server, no database. It imports the REAL
 * provider module and drives it both ways, because this is a LICENSING rule
 * before it is a rendering one and a licensing rule is worth a guard.
 *
 * CARTO's public basemaps were free and non-commercial use only, and a
 * marketplace taking a booking fee is a commercial use. Since 9 November 2026
 * the map draws on OpenFreeMap, which is free, needs no key and allows
 * commercial use. The MapTiler switch (`NEXT_PUBLIC_MAPTILER_KEY`, the paid
 * path the founder declined) was removed the same day, and this guard holds
 * that: setting the old variable must change nothing. The credit line has to
 * travel with the provider, because a swap that silently kept the old credit
 * replaces one licence breach with another.
 *
 * Node strips the TypeScript itself (22.6+).
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE = pathToFileURL(path.join(HERE, "..", "src", "lib", "maps", "tiles.ts")).href;

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok      ${name}`);
  } else {
    failures += 1;
    console.log(`  FAILED  ${name}${detail ? `\n          ${detail}` : ""}`);
  }
}

/* -------------------------------------- OpenFreeMap, commercial use allowed */

delete process.env.NEXT_PUBLIC_MAPTILER_KEY;
const free = await import(`${MODULE}?free`);

for (const theme of ["light", "dark"]) {
  const p = free.tileProvider(theme);
  check(`${theme}: draws on OpenFreeMap`, p.id === "openfreemap", p.id);
  check(`${theme}: a vector style, not an image template`, p.kind === "vector" && p.url === "", String(p.url));
  check(
    `${theme}: the style and TileJSON are OpenFreeMap's own, over https`,
    /^https:\/\/tiles\.openfreemap\.org\/styles\//.test(p.style) && /^https:\/\/tiles\.openfreemap\.org\//.test(p.tileJson),
    `${p.style} ${p.tileJson}`,
  );
  check(`${theme}: it is NOT flagged non-commercial`, p.nonCommercial === false);
  check(
    `${theme}: OpenMapTiles and OpenStreetMap are credited, as OpenFreeMap's terms require`,
    p.credits.some((c) => c.label.includes("OpenMapTiles")) &&
      p.credits.some((c) => c.label.includes("OpenStreetMap")),
    JSON.stringify(p.credits.map((c) => c.label)),
  );
  check(`${theme}: OpenFreeMap is named too`, p.credits.some((c) => c.label === "OpenFreeMap"));
  check(`${theme}: CARTO is no longer credited or fetched`, !p.credits.some((c) => /CARTO/.test(c.label)) && !JSON.stringify(p).includes("cartocdn"));
  check(`${theme}: no key of any kind is in any URL`, !/key=/.test(JSON.stringify(p)));
  check(
    `${theme}: every credit carries a link somebody can follow`,
    p.credits.every((c) => /^https:\/\//.test(c.href)),
  );
}
check("hasCommercialTiles() is true: the pre-launch check reads clean", free.hasCommercialTiles() === true);

/* ---------------- the old MapTiler variable, still set in production, does nothing */

process.env.NEXT_PUBLIC_MAPTILER_KEY = "test-key-not-a-real-one";
const keyed = await import(`${MODULE}?keyed`);

for (const theme of ["light", "dark"]) {
  const p = keyed.tileProvider(theme);
  check(`${theme}: a MapTiler key does not move the map off OpenFreeMap`, p.id === "openfreemap" && p.kind === "vector", p.id);
  check(`${theme}: the key reaches no URL`, !JSON.stringify(p).includes("test-key-not-a-real-one"));
  check(`${theme}: MapTiler is not credited or fetched`, !/maptiler/i.test(JSON.stringify(p)));
}
check("with the old key set, hasCommercialTiles() is still true", keyed.hasCommercialTiles() === true);
const tilesSource = (await import("node:fs")).readFileSync(new URL(MODULE), "utf8");
check("tiles.ts reads no provider key from the environment", !/process\.env/.test(tilesSource));
delete process.env.NEXT_PUBLIC_MAPTILER_KEY;

/* --------------------------------------------------------- the component is wired */

const { readFileSync } = await import("node:fs");
const canvas = readFileSync(path.join(HERE, "..", "src/components/app/search/MapCanvas.tsx"), "utf8");
check(
  "the map reads the provider and draws through the shared ground, not a hard-coded URL",
  /tileProvider\(/.test(canvas) && /addBaseLayer\(/.test(canvas) && !/cartocdn|openfreemap\.org/.test(canvas),
  "a literal tile host is in MapCanvas.tsx",
);
const creditControl = readFileSync(path.join(HERE, "..", "src/components/app/search/MapCredit.tsx"), "utf8");
check(
  "the credit line is rendered from the provider, not hard-coded",
  /credits=\{credits\}/.test(canvas) && /credits\.map\(/.test(creditControl),
);
const ground = readFileSync(path.join(HERE, "..", "src/lib/maps/base-layer.ts"), "utf8");
check(
  "a non-commercial provider, if one ever comes back, is said out loud to whoever runs the build",
  /warnIfNonCommercialTiles\(\)/.test(ground),
);
check(
  "MapLibre is only ever loaded by import(), never statically",
  /import\("\.\/gl-layer"\)/.test(ground) && !/from "maplibre-gl"/.test(ground),
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
