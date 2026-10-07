// Builds the offline map and place-name data used by the map frames.
// Run with: node scripts/build-geo.mjs <geonames-dir> <world-topojson>
//
// <geonames-dir> holds cities15000.txt, admin1CodesASCII.txt and countryInfo.txt
// from https://download.geonames.org/export/dump/ (CC BY 4.0, credited in the app).
// <world-topojson> is Natural Earth 1:10m admin-0 countries (public domain), via
// world-atlas/countries-10m.json simplified with mapshaper (-simplify interval=5000)
// and ring winding fixed for d3-geo's spherical clipping.
//
// Writes src/geo/world.json (TopoJSON, countries with names) and
// src/geo/places.json ({ countries, admin1, places: "name|lat|lon|cc|admin1\n…" }).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [geonames, world] = process.argv.slice(2);
if (!geonames || !world) { console.error('usage: node scripts/build-geo.mjs <geonames-dir> <world-topojson>'); process.exit(1); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = (f) => readFileSync(join(geonames, f), 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));

const countries = Object.fromEntries(rows('countryInfo.txt').map((r) => [r[0], r[4]]));
const admin1All = Object.fromEntries(rows('admin1CodesASCII.txt').map((r) => [r[0], r[1]]));
const admin1 = {};
const places = [];
for (const r of rows('cities15000.txt')) {
  // Skip sections of cities (PPLX: districts, neighbourhoods) and abandoned or historical places.
  if (/^(PPLX|PPLH|PPLQ|PPLW)$/.test(r[7])) continue;
  const a1 = r[10] && admin1All[`${r[8]}.${r[10]}`] ? r[10] : '';
  if (a1) admin1[`${r[8]}.${a1}`] = admin1All[`${r[8]}.${a1}`];
  places.push([r[1].replace(/\|/g, ' '), (+r[4]).toFixed(2), (+r[5]).toFixed(2), r[8], a1].join('|'));
}
writeFileSync(join(root, 'src', 'geo', 'places.json'), JSON.stringify({ countries, admin1, places: places.join('\n') }));

const topo = JSON.parse(readFileSync(world, 'utf8'));
writeFileSync(join(root, 'src', 'geo', 'world.json'), JSON.stringify(topo));
console.log(`Wrote src/geo/places.json (${places.length} places) and src/geo/world.json (${topo.objects.countries.geometries.length} countries).`);
