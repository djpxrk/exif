// Lazily loaded half of the map frames: projections, drawing and the offline
// reverse geocoder. Loaded through loadMaps() in map.js.

import { geoAzimuthalEquidistant, geoBounds, geoContains, geoGraticule, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import world from './geo/world.json';
import placeData from './geo/places.json';

const EARTH_KM = 6371;
const RAD = Math.PI / 180;

// ---------- World geometry ----------

const countries = feature(world, world.objects.countries).features;
const borders = mesh(world, world.objects.countries, (a, b) => a !== b);
const bounds = countries.map((f) => geoBounds(f));

/** The country containing a point (bounding boxes first, then the polygon test). */
const countryCache = new Map();
function countryAt(lon, lat) {
  const key = `${lon.toFixed(3)},${lat.toFixed(3)}`;
  if (countryCache.has(key)) return countryCache.get(key);
  let hit = null;
  for (let i = 0; i < countries.length && !hit; i++) {
    const [[x0, y0], [x1, y1]] = bounds[i];
    const inLon = x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1; // boxes may cross the antimeridian
    if (inLon && lat >= y0 && lat <= y1 && geoContains(countries[i], [lon, lat])) hit = countries[i];
  }
  countryCache.set(key, hit);
  return hit;
}

// ---------- Reverse geocoding ----------

const rows = placeData.places.split('\n');
const P = {
  lat: new Float32Array(rows.length),
  lon: new Float32Array(rows.length),
  name: new Array(rows.length),
  cc: new Array(rows.length),
  a1: new Array(rows.length),
};
rows.forEach((r, i) => {
  const [name, lat, lon, cc, a1] = r.split('|');
  P.lat[i] = +lat; P.lon[i] = +lon; P.name[i] = name; P.cc[i] = cc; P.a1[i] = a1;
});

function haversineKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const placeCache = new Map();
/**
 * Nearest town or city (population 15,000+) to a point.
 * Returns { label, city, region, country, km }; city is empty beyond 25 km,
 * and everything is empty in open ocean.
 */
export function placeName(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (placeCache.has(key)) return placeCache.get(key);
  const k = Math.cos(lat * RAD);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < P.lat.length; i++) {
    const dy = P.lat[i] - lat;
    let dx = Math.abs(P.lon[i] - lon);
    if (dx > 180) dx = 360 - dx;
    const d = dy * dy + dx * k * (dx * k);
    if (d < bestD) { bestD = d; best = i; }
  }
  const km = best < 0 ? Infinity : haversineKm(lat, lon, P.lat[best], P.lon[best]);
  const land = countryAt(lon, lat);
  let city = '';
  let region = '';
  let country = land?.properties.name || '';
  if (km <= 150) {
    const cc = P.cc[best];
    const placeCountry = placeData.countries[cc] || '';
    if (!country || km <= 25) country = placeCountry || country;
    if (country === placeCountry) region = placeData.admin1[`${cc}.${P.a1[best]}`] || '';
    if (km <= 25) city = P.name[best];
  }
  if (region && city && (region === city || region.startsWith(`${city} `) || city.startsWith(`${region} `))) region = '';
  const label = [city || region, country].filter(Boolean).join(', ');
  const out = { label, city, region, country, km };
  placeCache.set(key, out);
  return out;
}

// ---------- Drawing ----------

export const MAP_STYLES = {
  paper: { sea: '#dfe5e6', land: '#f6f2e9', home: '#ece4d3', coast: '#8f9799', border: '#b3a99a', grid: 'rgba(255,255,255,0.7)', pin: '#d64532', halo: 'rgba(214,69,50,0.18)', cone: 'rgba(214,69,50,0.22)' },
  night: { sea: '#161b20', land: '#2c3237', home: '#3a4046', coast: '#5d666d', border: '#4a5258', grid: 'rgba(255,255,255,0.06)', pin: '#ff7a45', halo: 'rgba(255,122,69,0.22)', cone: 'rgba(255,122,69,0.26)' },
  stamp: { sea: '#bcd3d6', land: '#efe5cf', home: '#e3cfa6', coast: '#6f8b8f', border: '#a7967a', grid: 'rgba(255,255,255,0.55)', pin: '#c0392b', halo: 'rgba(192,57,43,0.25)', cone: 'rgba(192,57,43,0.25)' },
};

/**
 * A circular regional map centred on the photo's location, drawn into
 * (cx, cy, r). radiusKm is the ground distance from the centre to the rim.
 * With a heading, a wedge shows the direction and angle of view of the shot.
 */
export function drawRegion(ctx, { cx, cy, r, lat, lon, radiusKm = 250, heading = null, fov = 0, style = MAP_STYLES.paper, lineScale = 1 }) {
  const angle = radiusKm / EARTH_KM; // radians from centre to rim
  const proj = geoAzimuthalEquidistant()
    .rotate([-lon, -lat])
    .scale(r / angle)
    .translate([cx, cy])
    .clipAngle(Math.min(179, (angle / RAD) * 1.15))
    .precision(r / 600);
  const path = geoPath(proj, ctx);
  const lw = r * 0.008 * lineScale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = style.sea;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Graticule at a spacing that suits the scale: 1° locally, up to 10° for continents.
  const step = radiusKm < 150 ? 0.5 : radiusKm < 600 ? 2 : radiusKm < 1500 ? 5 : 10;
  ctx.beginPath();
  path(geoGraticule().step([step, step]).extent([[-180, -89.999], [180, 89.999]])());
  ctx.strokeStyle = style.grid;
  ctx.lineWidth = lw;
  ctx.stroke();

  ctx.beginPath();
  path({ type: 'FeatureCollection', features: countries });
  ctx.fillStyle = style.land;
  ctx.fill();
  const home = countryAt(lon, lat);
  if (home) {
    ctx.beginPath();
    path(home);
    ctx.fillStyle = style.home;
    ctx.fill();
  }
  ctx.beginPath();
  path({ type: 'FeatureCollection', features: countries });
  ctx.strokeStyle = style.coast;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.beginPath();
  path(borders);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = lw * 1.4;
  ctx.setLineDash([lw * 4, lw * 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  drawPin(ctx, cx, cy, r, heading, fov, style);
  ctx.restore();
  return { kmPerPx: radiusKm / r };
}

/** The location marker: a dot with a halo, plus a view wedge when the heading is known. */
function drawPin(ctx, cx, cy, r, heading, fov, style) {
  if (heading != null) {
    const a = (heading - 90) * RAD; // canvas angles start at east
    const half = Math.max(8, fov || 50) * RAD / 2;
    const len = r * 0.62;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
    g.addColorStop(0, style.cone.replace(/[\d.]+\)$/, '0.55)'));
    g.addColorStop(1, style.cone.replace(/[\d.]+\)$/, '0)'));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, len, a - half, a + half);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = style.halo;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.055, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.038, 0, Math.PI * 2);
  ctx.fillStyle = style.pin;
  ctx.fill();
}

/** A small globe (orthographic) turned to face the location, with a dot on it. */
export function drawGlobe(ctx, { cx, cy, r, lat, lon, style = MAP_STYLES.stamp, lineScale = 1 }) {
  // Tilt the view a little south of the point so the dot sits above centre, like a printed globe.
  const proj = geoOrthographic().rotate([-lon, -(lat * 0.7), 0]).scale(r).translate([cx, cy]).clipAngle(90).precision(r / 400);
  const path = geoPath(proj, ctx);
  const lw = r * 0.01 * lineScale;
  ctx.save();
  ctx.beginPath();
  path({ type: 'Sphere' });
  ctx.fillStyle = style.sea;
  ctx.fill();
  ctx.clip();
  ctx.beginPath();
  path(geoGraticule().step([15, 15])());
  ctx.strokeStyle = style.grid;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.beginPath();
  path({ type: 'FeatureCollection', features: countries });
  ctx.fillStyle = style.land;
  ctx.fill();
  const home = countryAt(lon, lat);
  if (home) {
    ctx.beginPath();
    path(home);
    ctx.fillStyle = style.home;
    ctx.fill();
  }
  ctx.beginPath();
  path({ type: 'FeatureCollection', features: countries });
  ctx.strokeStyle = style.coast;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // Shade the limb so it reads as a sphere.
  const shade = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  shade.addColorStop(0, 'rgba(255,255,255,0.18)');
  shade.addColorStop(0.7, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  const p = proj([lon, lat]);
  if (p) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], r * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = style.halo;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p[0], p[1], r * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = style.pin;
    ctx.fill();
  }
  ctx.beginPath();
  path({ type: 'Sphere' });
  ctx.strokeStyle = style.coast;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** A tidy scale-bar length (km) about a fifth of the map's width. */
export function niceScaleKm(kmAcross) {
  const target = kmAcross / 5;
  const pow = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((m) => m * pow).reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
}
